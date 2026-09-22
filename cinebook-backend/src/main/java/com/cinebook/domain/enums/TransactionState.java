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

    /**
     * Truly terminal states from which zero outgoing transitions exist.
     * Note: SETTLED and PARTIALLY_REFUNDED are non-terminal because they can transition to refund states.
     */
    public boolean isTerminal() {
        return this == FAILED || this == REFUNDED;
    }
}
