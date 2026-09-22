package com.cinebook.domain.enums;

/**
 * Deterministic finite state machine enum for payment transactions.
 * Lifecycle: CREATED -> PROCESSING -> AUTHORIZED -> CAPTURED -> SETTLED.
 * Terminal/Side branches: FAILED, REFUNDED, PARTIALLY_REFUNDED.
 */
public enum TransactionState {
    CREATED,
    PROCESSING,
    AUTHORIZED,
    CAPTURED,
    SETTLED,
    FAILED,
    REFUNDED,
    PARTIALLY_REFUNDED;

    public boolean isTerminal() {
        return this == SETTLED || this == FAILED || this == REFUNDED;
    }
}
