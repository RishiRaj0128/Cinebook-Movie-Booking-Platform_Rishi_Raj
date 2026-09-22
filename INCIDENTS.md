# Post-Mortem Incident Log: Payment Engineering Induced Failures & Fixes

> **Context**: In financial transaction systems, edge cases are not hypothetical — network partitions, duplicate webhooks, and concurrency races will occur. This document logs three deliberately induced catastrophic failure scenarios, their root causes, and the production-grade engineering defenses implemented in CineBook.

---

## Incident 1: Mock Gateway Timeout Mid-Request (Stuck Processing State)

### The Failure Induced
- **Scenario**: A payment deduction was initiated, but the external gateway socket timed out after 5,000ms, or dropped the TCP connection before returning an HTTP response.
- **Observed Behavior Without Fix**:
  - The transaction remained orphaned in `PROCESSING` status indefinitely.
  - The customer's seats remained in `LOCKED` status, preventing other users from buying them.
  - No subsequent retry could proceed cleanly because the seat hold expired while the transaction was still marked active.

### Root Cause
Financial systems cannot assume an in-flight HTTP request has failed just because the client timed out. The upstream gateway might have actually authorized the charge. Leaving transactions in an indeterminate `PROCESSING` state indefinitely leads to seat inventory starvation.

### The Engineering Fix
1. **Reconciliation Sweep Job (`reconcileStuckTransactions`)**:
   - A scheduled background task inspects all transactions in `PROCESSING` state older than an allowed threshold (e.g. 300 seconds).
   - Automatically queries the gateway status; if the gateway has no record or the order expired, transitions the transaction state machine deterministically:
     $$\text{PROCESSING} \xrightarrow{\text{SWEEP\_TIMEOUT}} \text{FAILED}$$
   - Compensates the booking by invoking `bookingService.cancelBooking(...)`, returning all held seats to `AVAILABLE`.
2. **Deterministic Audit Trail**:
   - The state transition is logged in `transaction_state_transitions` with trigger event `SWEEP_TIMEOUT` and metadata identifying the recovery action.

---

## Incident 2: Webhook Duplicate Replay (At-Least-Once Double Credit)

### The Failure Induced
- **Scenario**: Payment gateways (Razorpay, Stripe, Juspay) operate under **at-least-once delivery** guarantees. Network retries frequently cause the exact same `payment.captured` webhook event to be delivered twice within milliseconds.
- **Observed Behavior Without Fix**:
  - First webhook credited the merchant escrow and confirmed the booking.
  - Second duplicate webhook executed again, posting a duplicate double-credit to the ledger and creating ghost accounting entries.

### Root Cause
Webhooks cannot be trusted to arrive exactly once. Processing webhooks procedurally without cryptographic signature verification and event deduplication invites double crediting and replay attacks.

### The Engineering Fix
1. **HMAC-SHA256 Signature Verification**:
   - Incoming payloads are verified using constant-time HMAC-SHA256 evaluation (`MessageDigest.isEqual(...)`) against the shared webhook secret.
   - Any unsigned or tampered payload is rejected immediately with HTTP 400/401 before touching application state.
2. **Event ID Deduplication via Idempotency Engine**:
   - Webhook processing executes through `IdempotencyService` keyed by `webhook:{eventId}`.
   - The first receipt claims the event key and completes the ledger transfer.
   - The duplicate delivery hits the idempotency record, returns HTTP 200 OK immediately, and bypasses state machine transitions and ledger mutations.

---

## Incident 3: High-Contention Race for Last Balance / Last Seat

### The Failure Induced
- **Scenario**: 5 concurrent threads attempted to spend the last ₹500 in a user's wallet simultaneously, or reserve the exact same hot-demand blockbuster seat.
- **Observed Behavior Without Fix**:
  - Standard check-then-act (`if (balance >= amount) balance -= amount`) resulted in negative wallet balances (double/triple spend) due to lost updates under `READ_COMMITTED` isolation.
  - Optimistic locking (`@Version`) caused 4 out of 5 threads to blow up with retry storms and database rollbacks.

### Root Cause
High concurrency on scarce resources requires serialized access. In ticketing and fintech, optimistic concurrency control fails under high contention because all losers fail simultaneously and hammer the database with expensive retries.

### The Engineering Fix
1. **Pessimistic Row-Level Locking (`PESSIMISTIC_WRITE`)**:
   - Both `ShowSeatRepository.findByIdsWithLock` and `WalletRepository.findByUserIdWithLock` issue PostgreSQL row-level locks (`SELECT ... FOR UPDATE`).
2. **Lock Timeout Guardrail (`jakarta.persistence.lock.timeout = 3000ms`)**:
   - Every lock acquisition query enforces a strict 3-second timeout hint. If a worker thread stalls, contenders fail-fast rather than blocking database connection pools indefinitely.
3. **Deterministic Global Lock Ordering (Seat $\rightarrow$ Wallet)**:
   - When a booking transaction requires both seat locks and wallet locks, the system strictly acquires locks in canonical order: **Seat rows FIRST, Wallet row SECOND**.
   - This mathematically prevents cyclic wait graphs and eliminates deadlocks between concurrent booking requests.
4. **Clean Sequential Business Rule Rejection**:
   - Contenders queue at the database row level. The first thread acquires the lock and debits the balance to 0.
   - Subsequent threads acquire the lock in sequence, re-read the updated committed state, and are rejected with clean **business rule violations** (`InsufficientBalanceException` / `SeatsUnavailableException`), not unhandled lock crashes.

---

## Edge Case Analysis: Partial Saga Compensation Failures

### The Gap Acknowledged
In Phase 7, our `SagaOrchestrator` implements reverse compensating actions (e.g. `ReleaseSeatStep` compensates `ReserveSeatStep` when payment fails downstream).
- **What happens if a compensation itself fails?** (e.g. database network drops during seat release).
- **Current Mitigation**:
  - `SagaOrchestrator` catches compensation exceptions, flags the execution as `COMPENSATION_FAILED`, logs a CRITICAL alert, and records the orphaned step.
  - In this version, failed compensations are not auto-retried inline. Instead, they rely on the Phase 9 reconciliation sweep (`reconcileStuckTransactions`) to clean up orphaned locks.
- **Production Roadmap**:
  - In a distributed multi-service architecture, failed compensations would be published to a dead-letter queue (DLQ) or an outbox table with an exponential-backoff retry consumer.
