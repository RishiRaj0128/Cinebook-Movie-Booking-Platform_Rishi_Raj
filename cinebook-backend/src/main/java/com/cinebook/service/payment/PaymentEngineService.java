package com.cinebook.service.payment;

import com.cinebook.domain.entity.Booking;
import com.cinebook.domain.entity.PaymentTransaction;
import com.cinebook.domain.entity.ShowSeat;
import com.cinebook.domain.entity.User;
import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.BookingStatus;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.enums.TransactionState;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.model.payment.PaymentRequestRecord;
import com.cinebook.domain.model.payment.TransactionResultRecord;
import com.cinebook.domain.repository.BookingRepository;
import com.cinebook.domain.repository.PaymentTransactionRepository;
import com.cinebook.domain.repository.ShowSeatRepository;
import com.cinebook.domain.repository.UserRepository;
import com.cinebook.exception.BadRequestException;
import com.cinebook.exception.ResourceNotFoundException;
import com.cinebook.exception.SeatsUnavailableException;
import com.cinebook.service.BookingService;
import com.cinebook.service.functional.RuleEvaluationPipeline;
import com.cinebook.service.gateway.HmacSignatureService;
import com.cinebook.service.gateway.WebhookPayload;
import com.cinebook.service.idempotency.IdempotencyService;
import com.cinebook.service.ledger.LedgerService;
import com.cinebook.service.statemachine.TransactionStateMachine;
import com.cinebook.service.wallet.WalletService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Core production-grade financial transaction engine orchestrating:
 * - Functional domain validation
 * - Cryptographic idempotency
 * - Deterministic lock ordering (Seat row lock FIRST, Wallet lock SECOND)
 * - Double-entry append-only ledger transfers
 * - Finite state machine transition auditing
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentEngineService {

    private final PaymentTransactionRepository transactionRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final ShowSeatRepository showSeatRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final IdempotencyService idempotencyService;
    private final TransactionStateMachine stateMachine;
    private final HmacSignatureService hmacSignatureService;
    private final BookingService bookingService;
    private final ObjectMapper objectMapper;

    private final RuleEvaluationPipeline rulePipeline = RuleEvaluationPipeline.defaultRules();

    /**
     * Executes a payment transaction end-to-end with idempotency, lock ordering, and ledger integration.
     * Idempotency wrapper runs outside outer transaction to coordinate key synchronization.
     */
    public TransactionResultRecord processPayment(PaymentRequestRecord request) {
        Objects.requireNonNull(request, "request cannot be null");

        // 1. Pure Functional Rule Validation (accumulates all violations in one pass)
        List<String> violations = rulePipeline.validateAll(request);
        if (!violations.isEmpty()) {
            log.warn("Payment request rejected due to rule violations: {}", violations);
            return TransactionResultRecord.failed(
                    UUID.randomUUID(),
                    request.amount(),
                    violations,
                    "Validation rules violated: " + String.join(", ", violations)
            );
        }

        // 2. Idempotency Execution Wrapper
        return idempotencyService.execute(
                request.idempotencyKey(),
                request,
                TransactionResultRecord.class,
                () -> executePaymentTransaction(request)
        );
    }

    @Transactional
    public TransactionResultRecord executePaymentTransaction(PaymentRequestRecord request) {
        User user = userRepository.findById(request.userId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + request.userId()));

        Booking booking = null;
        if (request.bookingId() != null) {
            booking = bookingRepository.findById(request.bookingId())
                    .orElseThrow(() -> new ResourceNotFoundException("Booking not found: " + request.bookingId()));

            // =========================================================================
            // LOCK ORDERING DISCIPLINE:
            // Seat rows locked FIRST to eliminate cyclic deadlocks with wallet locks.
            // =========================================================================
            List<UUID> showSeatIds = booking.getBookingSeats().stream()
                    .map(bs -> bs.getShowSeat().getId())
                    .toList();

            List<ShowSeat> lockedSeats = showSeatRepository.findByIdsWithLock(showSeatIds, booking.getShow().getId());
            LocalDateTime now = LocalDateTime.now();

            for (ShowSeat ss : lockedSeats) {
                if (ss.getStatus() == SeatStatus.BOOKED) {
                    throw new SeatsUnavailableException("Seat already booked by another user");
                }
                if (ss.getStatus() == SeatStatus.LOCKED) {
                    boolean isNotMine = !request.userId().equals(ss.getLockedBy());
                    boolean isNotExpired = ss.getLockExpiresAt() != null && ss.getLockExpiresAt().isAfter(now);
                    if (isNotMine && isNotExpired) {
                        throw new SeatsUnavailableException("Seat currently held by another user");
                    }
                }
            }
        }

        // 3. Create initial PaymentTransaction in CREATED state
        PaymentTransaction tx = PaymentTransaction.builder()
                .booking(booking)
                .user(user)
                .amountPaise(request.amount().getAmountPaise())
                .currency(request.currency())
                .paymentMethod(request.paymentMethod())
                .state(TransactionState.CREATED)
                .idempotencyKey(request.idempotencyKey())
                .build();
        tx = transactionRepository.save(tx);

        try {
            // 4. State Machine Transition: CREATED -> PROCESSING
            tx = stateMachine.transition(tx, TransactionState.PROCESSING, "INITIATE_PAYMENT", "Payment authorization started");

            // =========================================================================
            // LOCK ORDERING DISCIPLINE:
            // Wallet row locked SECOND (after seat locks acquired).
            // =========================================================================
            if ("WALLET".equalsIgnoreCase(request.paymentMethod())) {
                walletService.debitWallet(request.userId(), request.amount(), tx.getId(), "Booking payment #" + tx.getId());
            }

            // 5. State Machine Transition: PROCESSING -> CAPTURED
            tx = stateMachine.transition(tx, TransactionState.CAPTURED, "PAYMENT_CAPTURED", "Payment debited and ledger updated");

            // 6. Confirm Booking & Seat status
            if (booking != null) {
                bookingService.confirmBooking(booking.getId(), request.userId());
            }

            // 7. State Machine Transition: CAPTURED -> SETTLED
            tx = stateMachine.transition(tx, TransactionState.SETTLED, "ORDER_FULFILLED", "Booking successfully confirmed");

            return TransactionResultRecord.success(
                    tx.getId(),
                    tx.getState(),
                    request.amount(),
                    "TX-" + tx.getId().toString().substring(0, 8).toUpperCase()
            );

        } catch (Exception e) {
            log.error("Transaction {} failed during execution: {}", tx.getId(), e.getMessage());
            try {
                tx.setFailureReason(e.getMessage());
                stateMachine.transition(tx, TransactionState.FAILED, "PAYMENT_FAILED", e.getMessage());
            } catch (Exception transitionEx) {
                log.error("Failed to transition tx {} to FAILED: {}", tx.getId(), transitionEx.getMessage());
            }
            throw e;
        }
    }

    /**
     * Ingests incoming gateway webhooks with HMAC signature verification and deduplication.
     */
    @Transactional
    public boolean processWebhook(String rawPayload, String signature) {
        // 1. Signature Verification
        if (!hmacSignatureService.verifySignature(rawPayload, signature)) {
            log.error("Webhook rejected: Invalid HMAC signature");
            throw new BadRequestException("Invalid webhook signature verification failed");
        }

        try {
            WebhookPayload payload = objectMapper.readValue(rawPayload, WebhookPayload.class);
            log.info("Received valid signed webhook event '{}' for tx={}", payload.eventId(), payload.transactionId());

            // 2. Event Deduplication via Idempotency Engine
            return idempotencyService.execute(
                    "webhook:" + payload.eventId(),
                    payload,
                    Boolean.class,
                    () -> handleWebhookEvent(payload)
            );
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Webhook processing error: {}", e.getMessage(), e);
            throw new BadRequestException("Failed to process webhook: " + e.getMessage());
        }
    }

    private boolean handleWebhookEvent(WebhookPayload payload) {
        Optional<PaymentTransaction> txOpt = transactionRepository.findById(payload.transactionId());
        if (txOpt.isEmpty()) {
            log.warn("Webhook received for unknown transaction: {}", payload.transactionId());
            return true; // Acknowledge to prevent endless webhook retries
        }

        PaymentTransaction tx = txOpt.get();

        if ("payment.captured".equalsIgnoreCase(payload.eventType())) {
            if (tx.getState() == TransactionState.PROCESSING || tx.getState() == TransactionState.AUTHORIZED) {
                stateMachine.transition(tx, TransactionState.CAPTURED, "WEBHOOK_CAPTURED", "Gateway confirmed capture via event " + payload.eventId());
                stateMachine.transition(tx, TransactionState.SETTLED, "WEBHOOK_SETTLED", "Gateway settled");

                // Post balanced ledger entry
                ledgerService.recordTransfer(
                        tx.getId(),
                        "GATEWAY_CLEARING",
                        AccountType.GATEWAY_CLEARING,
                        "MERCHANT_ESCROW",
                        AccountType.MERCHANT_ESCROW,
                        Money.ofPaise(payload.amountPaise()),
                        "Gateway clearing settlement for tx=" + tx.getId()
                );
            }
        } else if ("payment.failed".equalsIgnoreCase(payload.eventType())) {
            if (!tx.getState().isTerminal()) {
                stateMachine.transition(tx, TransactionState.FAILED, "WEBHOOK_FAILED", "Gateway reported payment failed");
            }
        }

        return true;
    }

    /**
     * Reconciliation sweep: Recovers transactions stuck in PROCESSING due to crashed gateways or network timeouts.
     */
    @Transactional
    public int reconcileStuckTransactions(int thresholdSeconds) {
        LocalDateTime stuckBefore = LocalDateTime.now().minusSeconds(thresholdSeconds);
        List<PaymentTransaction> stuck = transactionRepository.findStuckTransactions(TransactionState.PROCESSING, stuckBefore);

        log.info("Reconciliation sweep: Found {} transactions stuck in PROCESSING older than {}s", stuck.size(), thresholdSeconds);

        int resolvedCount = 0;
        for (PaymentTransaction tx : stuck) {
            log.warn("Resolving stuck transaction {}: transitioning to FAILED and releasing locks", tx.getId());
            tx.setFailureReason("RECONCILIATION_SWEEP_EXPIRED: Gateway timed out or transaction orphaned");
            stateMachine.transition(tx, TransactionState.FAILED, "SWEEP_TIMEOUT", "Auto-reconciled stuck processing transaction");

            // Release booking seat holds if pending
            if (tx.getBooking() != null && tx.getBooking().getStatus() == BookingStatus.CREATED) {
                try {
                    bookingService.cancelBooking(tx.getBooking().getId(), tx.getUser().getId());
                } catch (Exception e) {
                    log.error("Failed to cancel booking {} during sweep: {}", tx.getBooking().getId(), e.getMessage());
                }
            }
            resolvedCount++;
        }

        return resolvedCount;
    }
}
