# Functional Programming in Payment Architecture: Design Notes & Honest Boundaries

> **Context**: These notes document the functional-programming paradigms applied to the CineBook payment and transaction engine, specifically written to facilitate an honest, technically rigorous conversation during senior payments engineering interviews (e.g. Juspay).

---

## 1. Functional Principles Applied

### A. Immutability at the Core
- **Java Records as Domain Types**: All domain models (`PaymentRequestRecord`, `TransactionResultRecord`, `LedgerEntryRecord`, `Money`) are implemented as immutable Java 21 records or final value objects.
- **Zero Setters / Zero In-Place Mutation**: Once a `PaymentRequestRecord` or `LedgerEntryRecord` is constructed, its state cannot be altered. 
- **Append-Only Ledger**: Balances are never mutated in place. In-place balance updates (`UPDATE accounts SET balance = balance - 100`) are fundamentally procedural and prone to lost-update bugs or drift. The double-entry ledger replaces mutable state with an append-only log of immutable transfer records. Current balance is conceptually a fold/reduce over historical ledger entries:
  $$\text{Balance} = \sum (\text{CREDIT}) - \sum (\text{DEBIT})$$

### B. Pure Functions & Separation of Logic from Effects
- **Stateless Validation Rules**: Rules in `PaymentValidationRules` are pure functions (`Predicate<PaymentRequestRecord>` and `Function<PaymentRequestRecord, Optional<String>>`).
  - Given the identical `PaymentRequestRecord`, they produce the exact same outcome every time.
  - Zero I/O, zero database lookups, zero thread-local reads, and zero mutation side-effects.
- **Rule Composition**: Rules can be composed horizontally (combining multiple rules into a pipeline) and vertically (short-circuit composition via `.and()`).

### C. Railway-Oriented Flow & Functional Composition
- We avoid `null` checks and try-catch sprawl across normal business flows by leveraging `Optional` and higher-order functions (`map`, `flatMap`, `filter`).
- A transaction execution pipeline flows sequentially:
  $$\text{validateRequest}(req) \xrightarrow{\text{flatMap}} \text{checkSeatHold}(req) \xrightarrow{\text{flatMap}} \text{authorizePayment}(req) \xrightarrow{\text{flatMap}} \text{postLedger}(req)$$
- If any stage yields an empty/failed container, downstream execution is cleanly bypassed without throwing unhandled control-flow exceptions.

### D. Smallest Integer Currency Discipline (`Money` Value Object)
- To eliminate IEEE 754 floating-point rounding errors ($0.1 + 0.2 \neq 0.3$), all monetary math is restricted to integer `paise`.
- `Money` is a closed algebraic value object: adding two `Money` instances yields a new `Money` instance; negative amounts are disallowed by domain invariant; rupee decimals are parsed/formatted strictly at API boundaries.

---

## 2. What Is *Not* True FP Here (Honest Technical Boundaries)

It is critical not to overclaim. While idiomatic Java 21 can adopt functional aesthetics and immutable data modeling, it remains bounded by the JVM and Spring runtime semantics:

### A. Lack of Native Algebraic Data Types (ADTs) & Pattern Matching
- In Haskell or PureScript, errors and results are modeled as tagged sum types:
  ```haskell
  data PaymentResult = Success TransactionId LedgerPair
                     | InsufficientFunds Amount Required
                     | RuleViolations (NonEmpty String)
                     | GatewayTimeout GatewayRef
  ```
- While Java 21 offers `sealed interface` and pattern matching in `switch`, it lacks full compiler-enforced exhaustiveness across higher-kinded types, dependent types, and Generalized Algebraic Data Types (GADTs). In this codebase, we use Java records and `Optional`/`Result` wrappers rather than pure ADTs.

### B. Lack of True Monadic Error Accumulation (`Validated` / `Validation`)
- In standard Haskell (`Control.Applicative`) or Cats (`Validated`), you can accumulate errors across independent applicative computations without short-circuiting:
  ```purescript
  validateReq = Tuple <$> checkAmount req <*> checkUser req <*> checkCurrency req
  ```
- Java's `Optional` is a *monad* that short-circuits on the first failure (`empty`). It cannot natively accumulate error messages.
- To solve this in Java without pulling in external FP libraries (like Vavr), we built `RuleEvaluationPipeline` which explicitly traverses the rule list using Java Streams to accumulate a `List<String>` of failed rule names. This achieves the engineering goal (returning all errors) but is an imperative/stream hybrid, not pure monadic error accumulation.

### C. Referential Transparency Is Not Guaranteed Across the Call Graph
- A function is referentially transparent if it can be replaced with its value without changing the program's behavior.
- In a production Spring Boot application, persistence touches the database via JPA / Hibernate (`EntityManager`, JDBC connections, Flyway migrations, `@Transactional` boundaries).
- Calling `walletService.debitWallet(...)` performs external I/O, acquires database row locks (`SELECT ... FOR UPDATE`), and depends on wall-clock time (`Instant.now()`). These are side effects. In PureScript/Haskell, these would be explicitly encapsulated in an `Effect` or `IO` monad; in Java, they execute imperatively inside Spring's transaction manager.

---

## Summary for Technical Interviews
> *"We brought functional design where it yields the highest safety dividend — immutable records, pure validation predicates, append-only ledger math, and monadic composition — while pragmatically leveraging Spring's battle-tested transactional infrastructure for ACID guarantees and row-level database locking."*
