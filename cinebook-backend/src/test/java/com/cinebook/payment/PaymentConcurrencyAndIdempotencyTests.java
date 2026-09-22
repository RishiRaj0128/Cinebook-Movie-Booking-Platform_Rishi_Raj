package com.cinebook.payment;

import com.cinebook.domain.entity.PaymentTransaction;
import com.cinebook.domain.entity.User;
import com.cinebook.domain.entity.Wallet;
import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.TransactionState;
import com.cinebook.domain.enums.UserRole;
import com.cinebook.domain.model.payment.LedgerEntryRecord;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.model.payment.PaymentRequestRecord;
import com.cinebook.domain.model.payment.TransactionResultRecord;
import com.cinebook.domain.repository.PaymentTransactionRepository;
import com.cinebook.domain.repository.UserRepository;
import com.cinebook.domain.repository.WalletRepository;
import com.cinebook.exception.IdempotencyConflictException;
import com.cinebook.exception.InsufficientBalanceException;
import com.cinebook.exception.InvalidStateTransitionException;
import com.cinebook.service.functional.PaymentRule;
import com.cinebook.service.functional.PaymentValidationRules;
import com.cinebook.service.functional.RuleEvaluationPipeline;
import com.cinebook.service.gateway.HmacSignatureService;
import com.cinebook.service.gateway.MockPaymentGateway;
import com.cinebook.service.gateway.WebhookPayload;
import com.cinebook.service.idempotency.IdempotencyService;
import com.cinebook.service.ledger.LedgerReconciliationReport;
import com.cinebook.service.ledger.LedgerService;
import com.cinebook.service.payment.PaymentEngineService;
import com.cinebook.service.saga.BookingPaymentSagaCoordinator;
import com.cinebook.service.saga.SagaExecutionResult;
import com.cinebook.service.saga.SagaOrchestrator;
import com.cinebook.service.saga.SagaStep;
import com.cinebook.service.statemachine.TransactionStateMachine;
import com.cinebook.service.wallet.WalletService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.DefaultTransactionDefinition;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class PaymentConcurrencyAndIdempotencyTests {

    @Autowired private PaymentEngineService paymentEngineService;
    @Autowired private WalletService walletService;
    @Autowired private LedgerService ledgerService;
    @Autowired private IdempotencyService idempotencyService;
    @Autowired private TransactionStateMachine stateMachine;
    @Autowired private MockPaymentGateway mockGateway;
    @Autowired private HmacSignatureService hmacSignatureService;
    @Autowired private SagaOrchestrator sagaOrchestrator;
    @Autowired private BookingPaymentSagaCoordinator sagaCoordinator;
    @Autowired private UserRepository userRepository;
    @Autowired private WalletRepository walletRepository;
    @Autowired private PaymentTransactionRepository transactionRepository;
    @Autowired private com.cinebook.domain.repository.LedgerRepository ledgerRepository;
    @Autowired private com.cinebook.domain.repository.BookingRepository bookingRepository;
    @Autowired private com.cinebook.domain.repository.ShowRepository showRepository;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private MockMvc mockMvc;
    @Autowired private PlatformTransactionManager transactionManager;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.findByEmail("user@cinebook.com")
                .orElseGet(() -> userRepository.save(User.builder()
                        .fullName("Test Payment User")
                        .email("user@cinebook.com")
                        .password("$2a$10$dummyHashForTestingPurposesOnly")
                        .role(UserRole.CUSTOMER)
                        .phone("9876543210")
                        .build()));
    }

    // =========================================================================
    // PHASE 1: Functional Domain Model & Rule Engine Tests
    // =========================================================================
    @Test
    @DisplayName("Phase 1: Pure validation rules accumulate all failure codes in one pass")
    void testRuleAccumulationPipeline() {
        RuleEvaluationPipeline pipeline = RuleEvaluationPipeline.defaultRules();

        // Request with multiple intentional violations: negative amount and unsupported currency
        PaymentRequestRecord invalidReq = new PaymentRequestRecord(
                null,
                testUser.getId(),
                Money.ofPaise(0L), // Non-positive amount
                "USD",             // Unsupported currency
                "BITCOIN",         // Unsupported payment method
                "test-key-1",
                Map.of()
        );

        List<String> violations = pipeline.validateAll(invalidReq);

        // Assert all violated rules were accumulated without premature short-circuiting
        assertTrue(violations.contains("ERR_NON_POSITIVE_AMOUNT"), "Must catch non-positive amount");
        assertTrue(violations.contains("ERR_INACTIVE_OR_MISSING_BOOKING"), "Must catch missing or inactive booking");
        assertTrue(violations.contains("ERR_UNSUPPORTED_CURRENCY"), "Must catch unsupported currency");
        assertTrue(violations.contains("ERR_UNSUPPORTED_PAYMENT_METHOD"), "Must catch unsupported payment method");

        // Short-circuit pipeline should catch the first error
        Optional<String> firstViolation = pipeline.validateShortCircuit(invalidReq);
        assertTrue(firstViolation.isPresent());
        assertEquals("ERR_NON_POSITIVE_AMOUNT", firstViolation.get());
    }

    @Test
    @DisplayName("Phase 1: Core 5 financial rules verified (positiveAmount, activeBooking, userEligibility, antiFraudVelocity, singleTransactionLimit)")
    void testCoreFiveFinancialValidationRules() {
        RuleEvaluationPipeline corePipeline = RuleEvaluationPipeline.coreFinancialRules();

        // 1. Valid request passing all 5 core rules
        PaymentRequestRecord validReq = new PaymentRequestRecord(
                UUID.randomUUID(),
                testUser.getId(),
                Money.ofPaise(25_000L),
                "INR",
                "WALLET",
                "idem-valid-1",
                Map.of("bookingStatus", "CREATED", "userStatus", "ACTIVE", "fraudVelocityScore", "0.1")
        );
        assertTrue(corePipeline.validateAll(validReq).isEmpty(), "Valid request must have 0 rule violations");

        // 2. Request violating 3 of the 5 core rules (non-positive amount, cancelled booking, suspended user)
        PaymentRequestRecord multiViolations = new PaymentRequestRecord(
                UUID.randomUUID(),
                testUser.getId(),
                Money.ofPaise(0L), // Non-positive amount (0 paise)
                "INR",
                "WALLET",
                "idem-valid-2",
                Map.of("bookingStatus", "CANCELLED", "userStatus", "SUSPENDED")
        );
        List<String> violations = corePipeline.validateAll(multiViolations);
        assertEquals(3, violations.size(), "Pipeline must accumulate exactly 3 violations");
        assertTrue(violations.contains("ERR_NON_POSITIVE_AMOUNT"));
        assertTrue(violations.contains("ERR_INACTIVE_OR_MISSING_BOOKING"));
        assertTrue(violations.contains("ERR_USER_NOT_ELIGIBLE"));

        // 3. Fraud velocity breach
        PaymentRequestRecord velocitySpike = new PaymentRequestRecord(
                UUID.randomUUID(),
                testUser.getId(),
                Money.ofPaise(10_000L),
                "INR",
                "WALLET",
                "idem-valid-3",
                Map.of("bookingStatus", "CREATED", "fraudVelocityScore", "0.95")
        );
        List<String> velocityViolations = corePipeline.validateAll(velocitySpike);
        assertTrue(velocityViolations.contains("ERR_FRAUD_VELOCITY_EXCEEDED"));

        // 4. Single transaction limit exceeded (> ₹50,000)
        PaymentRequestRecord limitExceeded = new PaymentRequestRecord(
                UUID.randomUUID(),
                testUser.getId(),
                Money.ofPaise(6_000_000L), // ₹60,000
                "INR",
                "WALLET",
                "idem-valid-4",
                Map.of("bookingStatus", "CREATED")
        );
        List<String> limitViolations = corePipeline.validateAll(limitExceeded);
        assertTrue(limitViolations.contains("ERR_TRANSACTION_LIMIT_EXCEEDED"));
    }

    // =========================================================================
    // PHASE 2: Cryptographic Idempotency Tests
    // =========================================================================
    @Test
    @DisplayName("Phase 2: Two concurrent threads with same Idempotency-Key produce exactly ONE charge")
    void testConcurrentIdempotentRequests() throws InterruptedException {
        // Fund user wallet with ₹1,000 (100,000 paise)
        walletService.creditWallet(testUser.getId(), Money.ofPaise(100_000L), UUID.randomUUID(), "Test seed balance");
        long initialBalance = walletService.getBalance(testUser.getId()).getAmountPaise();

        String sharedIdempotencyKey = "idem-test-key-" + UUID.randomUUID();
        Money chargeAmount = Money.ofPaise(30_000L); // ₹300

        com.cinebook.domain.entity.Show show = showRepository.findAll().stream().findFirst().orElse(null);
        com.cinebook.domain.entity.Booking testBooking = bookingRepository.save(com.cinebook.domain.entity.Booking.builder()
                .user(testUser)
                .show(show)
                .totalAmount(30000)
                .status(com.cinebook.domain.enums.BookingStatus.CREATED)
                .bookingSeats(new ArrayList<>())
                .build());

        PaymentRequestRecord request = new PaymentRequestRecord(
                testBooking.getId(),
                testUser.getId(),
                chargeAmount,
                "INR",
                "WALLET",
                sharedIdempotencyKey,
                Map.of("bookingStatus", "CREATED")
        );

        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);
        List<Future<TransactionResultRecord>> futures = new ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            futures.add(executor.submit(() -> {
                readyLatch.countDown();
                startLatch.await(); // Synchronize thread release
                return paymentEngineService.processPayment(request);
            }));
        }

        readyLatch.await();
        startLatch.countDown(); // Fire concurrently

        List<TransactionResultRecord> results = new ArrayList<>();
        for (Future<TransactionResultRecord> future : futures) {
            try {
                results.add(future.get(5, TimeUnit.SECONDS));
            } catch (Exception e) {
                fail("Thread execution failed: " + e.getMessage());
            }
        }
        executor.shutdown();

        // Both calls must return success with identical transaction ID (cached verbatim replay)
        assertEquals(2, results.size());
        UUID firstTxId = results.get(0).transactionId();
        UUID secondTxId = results.get(1).transactionId();
        assertEquals(firstTxId, secondTxId, "Idempotent repeat must return identical transaction ID");

        // CRITICAL ASSERTION: Exactly one charge of ₹300 deducted from wallet balance
        long finalBalance = walletService.getBalance(testUser.getId()).getAmountPaise();
        assertEquals(initialBalance - chargeAmount.getAmountPaise(), finalBalance,
                "Wallet balance must be debited exactly once despite concurrent duplicate calls");
    }

    @Test
    @DisplayName("Phase 2: Database atomic claim & UNIQUE constraint prevents concurrent multi-instance business execution")
    void testMultiInstanceDatabaseIdempotencyConstraint() throws Exception {
        String key = "db-unique-key-" + UUID.randomUUID();
        Map<String, Object> payload = Map.of("bookingId", UUID.randomUUID().toString(), "amount", 500);

        AtomicInteger businessExecutionCount = new AtomicInteger(0);
        CountDownLatch startLatch = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Callable<String> worker = () -> {
            startLatch.await();
            return idempotencyService.executeWithDatabaseGuaranteesOnly(key, payload, String.class, () -> {
                businessExecutionCount.incrementAndGet();
                try {
                    Thread.sleep(150);
                } catch (InterruptedException ignored) {}
                return "ORDER_PROCESSED_SUCCESS";
            });
        };

        Future<String> futureA = executor.submit(worker);
        Future<String> futureB = executor.submit(worker);

        startLatch.countDown(); // Release both threads concurrently
        executor.shutdown();
        assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));

        String responseA = futureA.get();
        String responseB = futureB.get();

        // Both cluster nodes must obtain identical successful responses
        assertEquals("ORDER_PROCESSED_SUCCESS", responseA);
        assertEquals("ORDER_PROCESSED_SUCCESS", responseB);

        // CRITICAL: The business action must execute EXACTLY ONCE despite concurrent race!
        assertEquals(1, businessExecutionCount.get(), "Business logic must execute exactly once across concurrent cluster nodes");
    }

    @Test
    @DisplayName("Phase 2: Same Idempotency-Key with different payload rejects with conflict error")
    void testIdempotencyPayloadMismatchRejection() {
        String key = "conflict-key-" + UUID.randomUUID();

        // 1st request: ₹100
        idempotencyService.execute(key, Map.of("amount", 100), String.class, () -> "SUCCESS_100");

        // 2nd request with same key but different body: ₹200
        assertThrows(IdempotencyConflictException.class, () -> {
            idempotencyService.execute(key, Map.of("amount", 200), String.class, () -> "SUCCESS_200");
        }, "Must reject reused idempotency key with conflicting payload");
    }

    // =========================================================================
    // PHASE 3: Concurrency Correctness (Pessimistic Row Lock Contention & Timeout)
    // =========================================================================
    @Test
    @DisplayName("Phase 3: 5 concurrent threads contending for last balance: exactly 1 wins, 4 queue and receive clean business rule rejections")
    void testConcurrentContentionPessimisticLocking() throws InterruptedException {
        // Give user exactly ₹500 (50,000 paise)
        Wallet wallet = walletService.getOrCreateWallet(testUser.getId());
        wallet.setBalancePaise(50_000L);
        walletRepository.save(wallet);

        int threadCount = 5;
        Money attemptAmount = Money.ofPaise(50_000L); // Each thread tries to spend the entire ₹500

        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch readyLatch = new CountDownLatch(threadCount);
        CountDownLatch startLatch = new CountDownLatch(1);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger businessRejectionCount = new AtomicInteger(0);
        AtomicInteger unexpectedErrorCount = new AtomicInteger(0);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    readyLatch.countDown();
                    startLatch.await(); // Synchronized release

                    walletService.debitWallet(testUser.getId(), attemptAmount, UUID.randomUUID(), "Contention race");
                    successCount.incrementAndGet();
                } catch (InsufficientBalanceException e) {
                    // EXPECTED: Subsequent threads acquire row lock in order and fail the balance check
                    businessRejectionCount.incrementAndGet();
                } catch (Exception e) {
                    unexpectedErrorCount.incrementAndGet();
                }
            });
        }

        readyLatch.await();
        startLatch.countDown(); // Release threads simultaneously
        executor.shutdown();
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));

        // EXACTLY 1 winner, and EXACTLY 4 sequential business rule rejections
        assertEquals(1, successCount.get(), "Exactly one thread must succeed in debiting balance");
        assertEquals(4, businessRejectionCount.get(), "Remaining 4 threads must receive clean InsufficientBalanceException after acquiring row lock");
        assertEquals(0, unexpectedErrorCount.get(), "Zero unhandled lock or crash exceptions");

        // Remaining balance must be zero
        assertEquals(0L, walletService.getBalance(testUser.getId()).getAmountPaise());
    }

    @Test
    @DisplayName("Phase 3: Explicit lock timeout guardrail triggers fail-fast on long-held row locks")
    void testPessimisticLockTimeoutBehavior() throws Exception {
        walletService.getOrCreateWallet(testUser.getId());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch lockAcquiredLatch = new CountDownLatch(1);
        CountDownLatch releaseLockLatch = new CountDownLatch(1);
        AtomicBoolean timeoutCaught = new AtomicBoolean(false);

        // Thread 1: Acquire PESSIMISTIC_WRITE lock on wallet row and hold it
        Future<?> holderFuture = executor.submit(() -> {
            DefaultTransactionDefinition def = new DefaultTransactionDefinition();
            TransactionStatus status = transactionManager.getTransaction(def);
            try {
                walletRepository.findByUserIdWithLock(testUser.getId());
                lockAcquiredLatch.countDown(); // Signal lock held
                releaseLockLatch.await(5, TimeUnit.SECONDS); // Hold lock
            } catch (Exception e) {
                fail("Holder failed: " + e.getMessage());
            } finally {
                transactionManager.rollback(status);
            }
        });

        lockAcquiredLatch.await(); // Ensure Thread 1 holds row lock

        // Thread 2: Attempt to acquire row lock with 3000ms timeout
        Future<?> contenderFuture = executor.submit(() -> {
            DefaultTransactionDefinition def = new DefaultTransactionDefinition();
            TransactionStatus status = transactionManager.getTransaction(def);
            try {
                long start = System.currentTimeMillis();
                walletRepository.findByUserIdWithLock(testUser.getId());
                transactionManager.commit(status);
            } catch (Exception ex) {
                // Assert that exception occurred due to lock acquisition failure / timeout
                timeoutCaught.set(true);
            } finally {
                try {
                    if (!status.isCompleted()) {
                        transactionManager.rollback(status);
                    }
                } catch (Exception ignored) {
                    // Lock timeout aborts connection, which is safe to ignore
                }
            }
        });

        // Allow time for contention timeout to trigger (~3 seconds)
        Thread.sleep(3500);
        releaseLockLatch.countDown(); // Release Thread 1

        holderFuture.get(2, TimeUnit.SECONDS);
        contenderFuture.get(2, TimeUnit.SECONDS);
        executor.shutdown();

        // Verify that lock timeout occurred on second thread contending for row lock
        assertTrue(timeoutCaught.get(), "Second transaction must fail due to the 3000ms lock timeout");
    }

    // =========================================================================
    // PHASE 4: Double-Entry Append-Only Ledger Invariant Test
    // =========================================================================
    @Test
    @DisplayName("Phase 4: Double-entry ledger is append-only and nets to zero across all accounts")
    void testDoubleEntryLedgerZeroSumReconciliation() {
        UUID tx1 = UUID.randomUUID();
        UUID tx2 = UUID.randomUUID();

        // Record two transfers
        ledgerService.recordTransfer(tx1, "USER_WALLET:A", AccountType.USER_WALLET, "ESCROW", AccountType.MERCHANT_ESCROW, Money.ofPaise(15000L), "Ticket 1");
        ledgerService.recordTransfer(tx2, "ESCROW", AccountType.MERCHANT_ESCROW, "CINEMA_REVENUE", AccountType.CINEMA_REVENUE, Money.ofPaise(15000L), "Settlement 1");

        LedgerReconciliationReport report = ledgerService.reconcileLedger();

        // Invariant: sum(DEBIT) == sum(CREDIT) and net balance is ZERO
        assertTrue(report.isBalanced(), "Ledger must be perfectly balanced");
        assertEquals(0L, report.netBalancePaise(), "Net sum across all debit and credit entries must be 0");
        assertEquals(report.totalCreditsPaise(), report.totalDebitsPaise(), "Total credits must equal total debits");
    }

    @Test
    @DisplayName("Phase 4: Ledger append-only immutability invariant strictly rejects UPDATE and DELETE")
    void testAppendOnlyLedgerProhibitsUpdateAndDelete() {
        UUID tx = UUID.randomUUID();
        List<LedgerEntryRecord> entries = ledgerService.recordTransfer(
                tx, "USER_WALLET:B", AccountType.USER_WALLET, "ESCROW", AccountType.MERCHANT_ESCROW, Money.ofPaise(5000L), "Immutability test"
        );
        assertEquals(2, entries.size());

        List<com.cinebook.domain.entity.LedgerEntry> dbEntries = ledgerRepository.findByTransactionId(tx);
        assertFalse(dbEntries.isEmpty());
        com.cinebook.domain.entity.LedgerEntry entry = dbEntries.get(0);

        // Verify entity-level JPA lifecycle callbacks reject updates and deletes
        assertThrows(UnsupportedOperationException.class, entry::preUpdate, "LedgerEntry must prohibit updates");
        assertThrows(UnsupportedOperationException.class, entry::preRemove, "LedgerEntry must prohibit deletions");
    }

    // =========================================================================
    // PHASE 5: Transaction State Machine Transition Tests
    // =========================================================================
    @Test
    @DisplayName("Phase 5: State machine strictly enforces allowed transitions including PARTIALLY_REFUNDED and records audit trail")
    void testTransactionStateMachineTransitions() {
        PaymentTransaction tx = PaymentTransaction.builder()
                .user(testUser)
                .amountPaise(25000L)
                .state(TransactionState.CREATED)
                .build();
        tx = transactionRepository.save(tx);

        // Valid forward progression: CREATED -> PROCESSING -> CAPTURED -> SETTLED
        tx = stateMachine.transition(tx, TransactionState.PROCESSING, "GATEWAY_DISPATCH", "Sent to processor");
        assertEquals(TransactionState.PROCESSING, tx.getState());

        tx = stateMachine.transition(tx, TransactionState.CAPTURED, "AUTH_CONFIRMED", "Funds authorized and captured");
        assertEquals(TransactionState.CAPTURED, tx.getState());

        tx = stateMachine.transition(tx, TransactionState.SETTLED, "BANK_SETTLEMENT", "Settled to cinema merchant");
        assertEquals(TransactionState.SETTLED, tx.getState());

        // PARTIALLY_REFUNDED support: SETTLED -> PARTIALLY_REFUNDED
        tx = stateMachine.transition(tx, TransactionState.PARTIALLY_REFUNDED, "CUSTOMER_PARTIAL_REFUND", "Refunded 1 of 2 tickets");
        assertEquals(TransactionState.PARTIALLY_REFUNDED, tx.getState());

        // Subsequent partial refund allowed
        tx = stateMachine.transition(tx, TransactionState.PARTIALLY_REFUNDED, "SECOND_PARTIAL_REFUND", "Refunded additional concession item");
        assertEquals(TransactionState.PARTIALLY_REFUNDED, tx.getState());

        // Final full refund: PARTIALLY_REFUNDED -> REFUNDED
        tx = stateMachine.transition(tx, TransactionState.REFUNDED, "FINAL_FULL_REFUND", "Remaining balance refunded");
        assertEquals(TransactionState.REFUNDED, tx.getState());

        // ILLEGAL TRANSITION: Terminal REFUNDED cannot jump back to PROCESSING
        final PaymentTransaction refundedTx = tx;
        assertThrows(InvalidStateTransitionException.class, () -> {
            stateMachine.transition(refundedTx, TransactionState.PROCESSING, "ILLEGAL_MUTATION", "Attempted invalid rollback");
        }, "State machine must reject illegal transitions from terminal state");
    }

    // =========================================================================
    // PHASE 6: Money Handling & Float Precision Bug Demonstration
    // =========================================================================
    @Test
    @DisplayName("Phase 6: Demonstrate classic float precision bug vs exact integer paise arithmetic")
    void testMoneyPaiseVsFloatPrecision() {
        // Classic float bug: 0.1 + 0.2 != 0.3 in IEEE 754 floating point arithmetic
        double floatA = 0.1;
        double floatB = 0.2;
        double floatSum = floatA + floatB;
        assertNotEquals(0.3, floatSum, "IEEE 754 float arithmetic demonstrates inherent precision inaccuracy");

        // Loop accumulation precision drift with float/double
        double floatTotal = 0.0;
        for (int i = 0; i < 10_000; i++) {
            floatTotal += 0.10; // 10 paise in rupees as float
        }
        // floatTotal is 1000.000000000139, NOT 1000.00
        assertNotEquals(1000.0, floatTotal, "Accumulating float values introduces compounding precision drift");

        // By contrast: exact integer paise with Money value object
        Money paiseSum = Money.ZERO;
        Money tenPaise = Money.ofPaise(10L); // 10 paise = ₹0.10
        for (int i = 0; i < 10_000; i++) {
            paiseSum = paiseSum.plus(tenPaise);
        }

        // 10,000 * 10 paise = 100,000 paise = exactly ₹1,000.00 with ZERO rounding loss
        assertEquals(100_000L, paiseSum.getAmountPaise());
        assertEquals(new BigDecimal("1000.00"), paiseSum.toRupeesDecimal());
    }

    // =========================================================================
    // PHASE 7: 4-Step Saga Pattern Orchestration & Reverse Compensation
    // =========================================================================
    @Test
    @DisplayName("Phase 7: Full 4-step Saga executes: HoldSeat -> AuthorizePayment -> PostLedger -> ConfirmBooking")
    void testFourStepSagaSuccessfulExecution() {
        walletService.creditWallet(testUser.getId(), Money.ofPaise(50_000L), UUID.randomUUID(), "Saga credit");

        BookingPaymentSagaCoordinator.BookingSagaContext ctx = BookingPaymentSagaCoordinator.BookingSagaContext.builder()
                .bookingId(UUID.randomUUID())
                .userId(testUser.getId())
                .showId(UUID.randomUUID())
                .seatIds(List.of(UUID.randomUUID(), UUID.randomUUID()))
                .amount(Money.ofPaise(25_000L))
                .transactionId(UUID.randomUUID())
                .build();

        SagaExecutionResult result = sagaCoordinator.runBookingSaga(ctx);

        assertTrue(result.success(), "4-step saga must succeed end-to-end");
        assertEquals(4, result.completedSteps().size(), "All 4 steps must be completed");
        assertEquals(List.of("HoldSeatStep", "AuthorizePaymentStep", "PostLedgerStep", "ConfirmBookingStep"), result.completedSteps());
        assertTrue(result.compensatedSteps().isEmpty(), "No compensations should execute on success");

        // CRITICAL ASSERTION: Real double-entry ledger entries were committed to DB
        // Step 2 debits wallet into escrow (2 entries), Step 3 transfers escrow to cinema revenue (2 entries) = 4 total
        List<com.cinebook.domain.entity.LedgerEntry> sagaLedgerEntries = ledgerRepository.findByTransactionId(ctx.getTransactionId());
        assertEquals(4, sagaLedgerEntries.size(), "Step 2 and Step 3 must commit exactly 4 balanced ledger entries (2 pairs of DEBIT/CREDIT)");
    }

    @Test
    @DisplayName("Phase 7: 4-step Saga failure at Step 4 (ConfirmBooking) triggers reverse compensations for Steps 3, 2, and 1")
    void testFourStepSagaFailureAtStep4TriggersFullReverseCompensation() {
        walletService.creditWallet(testUser.getId(), Money.ofPaise(50_000L), UUID.randomUUID(), "Saga credit");

        BookingPaymentSagaCoordinator.BookingSagaContext ctx = BookingPaymentSagaCoordinator.BookingSagaContext.builder()
                .bookingId(UUID.randomUUID())
                .userId(testUser.getId())
                .showId(UUID.randomUUID())
                .seatIds(List.of(UUID.randomUUID()))
                .amount(Money.ofPaise(20_000L))
                .transactionId(UUID.randomUUID())
                .failAtStep4(true) // Induce failure at Step 4
                .build();

        SagaExecutionResult result = sagaCoordinator.runBookingSaga(ctx);

        assertFalse(result.success(), "Saga must report failure");
        assertEquals(3, result.completedSteps().size(), "Steps 1, 2, and 3 completed before failure at Step 4");
        // Compensations executed in strict reverse order: Step 3 -> Step 2 -> Step 1
        assertEquals(List.of("PostLedgerStep", "AuthorizePaymentStep", "HoldSeatStep"), result.compensatedSteps());
        assertFalse(ctx.isPaymentAuthorized(), "Payment authorization must be rolled back by compensation");
        assertFalse(ctx.isSeatsHeld(), "Seat hold must be released by compensation");

        // CRITICAL ASSERTION: Forward ledger transfers (4 entries) + compensating reverse transfers (4 entries) = 8 total
        List<com.cinebook.domain.entity.LedgerEntry> sagaLedgerEntries = ledgerRepository.findByTransactionId(ctx.getTransactionId());
        assertEquals(8, sagaLedgerEntries.size(), "Compensated saga must have 8 ledger entries (4 forward + 4 reverse)");
        assertTrue(ledgerService.reconcileLedger().isBalanced(), "Ledger remains balanced after compensation");
    }

    @Test
    @DisplayName("Phase 7: 4-step Saga failure at Step 2 (Payment) compensates Step 1 (Seat Hold)")
    void testFourStepSagaFailureAtStep2CompensatesStep1() {
        BookingPaymentSagaCoordinator.BookingSagaContext ctx = BookingPaymentSagaCoordinator.BookingSagaContext.builder()
                .bookingId(UUID.randomUUID())
                .userId(testUser.getId())
                .showId(UUID.randomUUID())
                .seatIds(List.of(UUID.randomUUID()))
                .amount(Money.ofPaise(20_000L))
                .transactionId(UUID.randomUUID())
                .failAtStep2(true) // Induce failure at Step 2
                .build();

        SagaExecutionResult result = sagaCoordinator.runBookingSaga(ctx);

        assertFalse(result.success());
        assertEquals(List.of("HoldSeatStep"), result.completedSteps());
        assertEquals(List.of("HoldSeatStep"), result.compensatedSteps());
        assertFalse(ctx.isSeatsHeld(), "Seats held in Step 1 must be released");
    }

    @Test
    @DisplayName("Phase 7 Edge Case: Saga tracks and logs when a compensating action itself fails")
    void testSagaCompensationFailureHandling() {
        List<SagaStep<String>> steps = List.of(
                SagaStep.of(
                        "Step1",
                        ctx -> {},
                        ctx -> { throw new RuntimeException("Compensation network failure"); }
                ),
                SagaStep.of(
                        "Step2",
                        ctx -> { throw new RuntimeException("Step 2 failed"); },
                        ctx -> {}
                )
        );

        SagaExecutionResult result = sagaOrchestrator.execute("FailingCompensationSaga", "ctx", steps);

        assertFalse(result.success());
        assertTrue(result.hasCompensationFailures(), "Must flag compensation failure for reconciliation sweep");
        assertEquals(1, result.failedCompensations().size());
        assertTrue(result.failedCompensations().get(0).contains("Step1"));
    }

    // =========================================================================
    // PHASE 8: Webhook HMAC Verification & Deduplication
    // =========================================================================
    @Test
    @DisplayName("Phase 8: Webhook rejects invalid HMAC signature and dedupes duplicate event delivery")
    void testWebhookHmacVerificationAndDeduplication() {
        PaymentTransaction tx = PaymentTransaction.builder()
                .user(testUser)
                .amountPaise(45000L)
                .state(TransactionState.PROCESSING)
                .build();
        tx = transactionRepository.save(tx);

        MockPaymentGateway.SignedWebhook webhook = mockGateway.createWebhook(
                "evt_test_" + UUID.randomUUID(),
                "payment.captured",
                tx.getId(),
                null,
                45000L
        );

        // 1. Invalid signature should be rejected
        assertThrows(Exception.class, () -> {
            paymentEngineService.processWebhook(webhook.rawJson(), "invalid_bad_signature_hex");
        }, "Must reject invalid signature");

        // 2. First valid delivery succeeds
        boolean firstDelivery = paymentEngineService.processWebhook(webhook.rawJson(), webhook.signature());
        assertTrue(firstDelivery, "First webhook delivery must succeed");

        PaymentTransaction updatedTx = transactionRepository.findById(tx.getId()).orElseThrow();
        assertEquals(TransactionState.SETTLED, updatedTx.getState(), "Transaction must settle after capture webhook");

        // 3. Duplicate delivery with identical event ID (at-least-once simulation)
        boolean secondDelivery = paymentEngineService.processWebhook(webhook.rawJson(), webhook.signature());
        assertTrue(secondDelivery, "Duplicate webhook must be safely acknowledged without re-processing");
    }

    @Test
    @DisplayName("Phase 8 & 4: REST Controller Integration Tests for Webhook & Ledger Reconciliation Endpoints")
    @WithMockUser(username = "admin@cinebook.com", roles = {"ADMIN", "CUSTOMER"})
    void testRestControllerEndpoints() throws Exception {
        // 1. Test Ledger Reconciliation Endpoint GET /api/payments/reconciliation/ledger
        mockMvc.perform(get("/api/payments/reconciliation/ledger")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isBalanced").value(true))
                .andExpect(jsonPath("$.data.netBalancePaise").value(0));

        // 2. Test Webhook POST /api/payments/webhook with invalid signature
        mockMvc.perform(post("/api/payments/webhook")
                        .content("{\"eventId\":\"evt_bad\"}")
                        .header("X-Signature", "invalid_sig")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // PHASE 9: Break It On Purpose — Stuck Transaction Reconciliation Sweep
    // =========================================================================
    @Test
    @DisplayName("Phase 9: Gateway timeout leaves tx in PROCESSING, resolved by reconciliation sweep")
    void testGatewayTimeoutAndReconciliationSweep() {
        // Create an orphaned transaction stuck in PROCESSING
        PaymentTransaction stuckTx = PaymentTransaction.builder()
                .user(testUser)
                .amountPaise(20000L)
                .state(TransactionState.PROCESSING)
                .build();
        stuckTx = transactionRepository.save(stuckTx);

        // Run reconciliation sweep (threshold 0 seconds so it sweeps immediately)
        int resolved = paymentEngineService.reconcileStuckTransactions(0);
        assertTrue(resolved >= 1, "Must resolve at least 1 stuck transaction");

        PaymentTransaction sweptTx = transactionRepository.findById(stuckTx.getId()).orElseThrow();
        assertEquals(TransactionState.FAILED, sweptTx.getState(), "Stuck transaction must be transitioned to FAILED");
        assertTrue(sweptTx.getFailureReason().contains("RECONCILIATION_SWEEP_EXPIRED"));
    }
}
