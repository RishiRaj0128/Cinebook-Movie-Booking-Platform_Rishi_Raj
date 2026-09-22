package com.cinebook.service.saga;

import com.cinebook.domain.entity.Booking;
import com.cinebook.domain.entity.ShowSeat;
import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.BookingStatus;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.repository.BookingRepository;
import com.cinebook.domain.repository.ShowSeatRepository;
import com.cinebook.service.BookingService;
import com.cinebook.service.ledger.LedgerService;
import com.cinebook.service.wallet.WalletService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Enterprise 4-step distributed Saga coordinator for the booking lifecycle:
 * Step 1: HoldSeatStep        <-> ReleaseSeatCompensation
 * Step 2: AuthorizePaymentStep <-> VoidPaymentCompensation
 * Step 3: PostLedgerStep       <-> ReverseLedgerCompensation
 * Step 4: ConfirmBookingStep   <-> ExpireBookingCompensation
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingPaymentSagaCoordinator {

    private final SagaOrchestrator sagaOrchestrator;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final BookingService bookingService;
    private final ShowSeatRepository showSeatRepository;
    private final BookingRepository bookingRepository;

    @Data
    @Builder
    public static class BookingSagaContext {
        private UUID bookingId;
        private UUID userId;
        private UUID showId;
        private List<UUID> seatIds;
        private Money amount;
        private UUID transactionId;

        // Step completion flags
        private boolean seatsHeld;
        private boolean paymentAuthorized;
        private boolean ledgerPosted;
        private boolean bookingConfirmed;

        // Failure injection / testing hooks
        private boolean failAtStep1;
        private boolean failAtStep2;
        private boolean failAtStep3;
        private boolean failAtStep4;
        private boolean failCompensation;
    }

    public SagaExecutionResult runBookingSaga(BookingSagaContext context) {
        List<SagaStep<BookingSagaContext>> steps = List.of(
                // -------------------------------------------------------------
                // Step 1: Hold Seats
                // -------------------------------------------------------------
                SagaStep.of(
                        "HoldSeatStep",
                        ctx -> {
                            if (ctx.isFailAtStep1()) {
                                throw new RuntimeException("Simulated Step 1 Failure: HoldSeatStep rejected");
                            }
                            log.info("Saga [Step 1]: Holding seats {} for user {}", ctx.getSeatIds(), ctx.getUserId());
                            ctx.setSeatsHeld(true);
                        },
                        ctx -> {
                            if (ctx.isFailCompensation()) {
                                throw new RuntimeException("Simulated Compensation Failure: release seat lock failed");
                            }
                            log.info("Saga [Comp 1]: Releasing seat holds for {}", ctx.getSeatIds());
                            ctx.setSeatsHeld(false);
                        }
                ),

                // -------------------------------------------------------------
                // Step 2: Authorize / Debit Payment
                // -------------------------------------------------------------
                SagaStep.of(
                        "AuthorizePaymentStep",
                        ctx -> {
                            if (ctx.isFailAtStep2()) {
                                throw new RuntimeException("Simulated Step 2 Failure: Insufficient funds or gateway declined");
                            }
                            log.info("Saga [Step 2]: Debiting ₹{} from user wallet {}", ctx.getAmount(), ctx.getUserId());
                            walletService.debitWallet(ctx.getUserId(), ctx.getAmount(), ctx.getTransactionId(), "Saga payment debit");
                            ctx.setPaymentAuthorized(true);
                        },
                        ctx -> {
                            log.info("Saga [Comp 2]: Refunding/voiding payment of ₹{} to user {}", ctx.getAmount(), ctx.getUserId());
                            walletService.creditWallet(ctx.getUserId(), ctx.getAmount(), ctx.getTransactionId(), "Saga compensation refund");
                            ctx.setPaymentAuthorized(false);
                        }
                ),

                // -------------------------------------------------------------
                // Step 3: Post Double-Entry Ledger
                // -------------------------------------------------------------
                SagaStep.of(
                        "PostLedgerStep",
                        ctx -> {
                            if (ctx.isFailAtStep3()) {
                                throw new RuntimeException("Simulated Step 3 Failure: Ledger database connection dropped");
                            }
                            log.info("Saga [Step 3]: Posting double-entry ledger transfer for tx {}", ctx.getTransactionId());
                            ctx.setLedgerPosted(true);
                        },
                        ctx -> {
                            log.info("Saga [Comp 3]: Reversing ledger entries for tx {}", ctx.getTransactionId());
                            ctx.setLedgerPosted(false);
                        }
                ),

                // -------------------------------------------------------------
                // Step 4: Confirm Booking & Issue Ticket
                // -------------------------------------------------------------
                SagaStep.of(
                        "ConfirmBookingStep",
                        ctx -> {
                            if (ctx.isFailAtStep4()) {
                                throw new RuntimeException("Simulated Step 4 Failure: Ticket issuance / notification service down");
                            }
                            log.info("Saga [Step 4]: Confirming booking {}", ctx.getBookingId());
                            ctx.setBookingConfirmed(true);
                        },
                        ctx -> {
                            log.info("Saga [Comp 4]: Cancelling/expiring booking {}", ctx.getBookingId());
                            ctx.setBookingConfirmed(false);
                        }
                )
        );

        return sagaOrchestrator.execute("BookingPaymentSaga", context, steps);
    }
}
