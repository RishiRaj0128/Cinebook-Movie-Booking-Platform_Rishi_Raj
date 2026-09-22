package com.cinebook.domain.model.payment;

import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.LedgerDirection;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable domain record representing an append-only double-entry ledger event.
 */
public record LedgerEntryRecord(
        UUID id,
        String accountId,
        AccountType accountType,
        Money amount,
        LedgerDirection direction,
        UUID transactionId,
        String description,
        Instant createdAt
) implements Serializable {

    public LedgerEntryRecord {
        Objects.requireNonNull(id, "id cannot be null");
        Objects.requireNonNull(accountId, "accountId cannot be null");
        Objects.requireNonNull(accountType, "accountType cannot be null");
        Objects.requireNonNull(amount, "amount cannot be null");
        Objects.requireNonNull(direction, "direction cannot be null");
        Objects.requireNonNull(transactionId, "transactionId cannot be null");
        Objects.requireNonNull(createdAt, "createdAt cannot be null");
    }
}
