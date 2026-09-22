-- ============================================================
-- V2__payment_engine_ledger_idempotency.sql
-- Production Payment Engineering Architecture Migration
-- ============================================================

-- 1. WALLETS (User Account Balance Projection)
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_paise   BIGINT NOT NULL DEFAULT 0 CHECK (balance_paise >= 0),
  currency        VARCHAR(10) NOT NULL DEFAULT 'INR',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- 2. IDEMPOTENCY RECORDS
CREATE TABLE IF NOT EXISTS idempotency_records (
  id                  UUID PRIMARY KEY,
  idempotency_key     VARCHAR(255) NOT NULL UNIQUE,
  request_hash        VARCHAR(64) NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'PROCESSING',
  response_status_code INT,
  response_body       TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_idempotency_records_key ON idempotency_records(idempotency_key);

-- 3. DOUBLE-ENTRY LEDGER ENTRIES (Append-Only)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID PRIMARY KEY,
  account_id      VARCHAR(255) NOT NULL,
  account_type    VARCHAR(50) NOT NULL,
  amount_paise    BIGINT NOT NULL CHECK (amount_paise > 0),
  direction       VARCHAR(10) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  transaction_id  UUID NOT NULL,
  description     VARCHAR(500),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_account_id     ON ledger_entries(account_id);
CREATE INDEX idx_ledger_direction      ON ledger_entries(direction);

-- 4. PAYMENT TRANSACTIONS (Finite State Machine Enforced)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                  UUID PRIMARY KEY,
  booking_id          UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_paise        BIGINT NOT NULL CHECK (amount_paise > 0),
  currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_method      VARCHAR(50) NOT NULL DEFAULT 'WALLET',
  state               VARCHAR(50) NOT NULL DEFAULT 'CREATED',
  idempotency_key     VARCHAR(255),
  external_reference  VARCHAR(255),
  failure_reason      TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_tx_booking_id      ON payment_transactions(booking_id);
CREATE INDEX idx_payment_tx_user_id         ON payment_transactions(user_id);
CREATE INDEX idx_payment_tx_state           ON payment_transactions(state);
CREATE INDEX idx_payment_tx_idempotency_key ON payment_transactions(idempotency_key);

-- 5. TRANSACTION STATE TRANSITIONS (Immutable Audit Log)
CREATE TABLE IF NOT EXISTS transaction_state_transitions (
  id              UUID PRIMARY KEY,
  transaction_id  UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  from_state      VARCHAR(50),
  to_state        VARCHAR(50) NOT NULL,
  trigger_event   VARCHAR(100) NOT NULL,
  metadata        TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_state_transitions_tx_id ON transaction_state_transitions(transaction_id);
