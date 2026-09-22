package com.cinebook.domain.model.payment;

import com.cinebook.domain.enums.TransactionState;

import java.io.Serializable;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable domain record representing the outcome of a financial transaction.
 */
public record TransactionResultRecord(
        UUID transactionId,
        TransactionState state,
        Money amount,
        Instant timestamp,
        List<String> ruleViolations,
        String failureReason,
        String externalReference
) implements Serializable {

    public TransactionResultRecord {
        Objects.requireNonNull(state, "state cannot be null");
        Objects.requireNonNull(amount, "amount cannot be null");
        Objects.requireNonNull(timestamp, "timestamp cannot be null");
        ruleViolations = (ruleViolations == null) ? Collections.emptyList() : List.copyOf(ruleViolations);
    }

    public static TransactionResultRecord success(UUID transactionId, TransactionState state, Money amount, String externalReference) {
        return new TransactionResultRecord(
                transactionId,
                state,
                amount,
                Instant.now(),
                Collections.emptyList(),
                null,
                externalReference
        );
    }

    public static TransactionResultRecord failed(UUID transactionId, Money amount, List<String> ruleViolations, String failureReason) {
        return new TransactionResultRecord(
                transactionId,
                TransactionState.FAILED,
                amount,
                Instant.now(),
                ruleViolations,
                failureReason,
                null
        );
    }

    public boolean isSuccess() {
        return state == TransactionState.SETTLED || state == TransactionState.CAPTURED || state == TransactionState.AUTHORIZED;
    }
}
