package com.cinebook.domain.entity;

import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.LedgerDirection;
import com.cinebook.domain.model.payment.Money;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Immutable, append-only record representing a financial debit or credit.
 * Rows are NEVER updated or deleted.
 * Every monetary movement produces exactly two balanced entries in the same DB transaction.
 */
@Entity
@Table(name = "ledger_entries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(name = "account_id", nullable = false)
    private String accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 50)
    private AccountType accountType;

    @Column(name = "amount_paise", nullable = false)
    private Long amountPaise;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LedgerDirection direction;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    @Column(length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Money getAmountMoney() {
        return Money.ofPaise(amountPaise);
    }

    @PreUpdate
    public void preUpdate() {
        throw new UnsupportedOperationException("LedgerEntry is immutable: UPDATE operations are strictly prohibited.");
    }

    @PreRemove
    public void preRemove() {
        throw new UnsupportedOperationException("LedgerEntry is append-only: DELETE operations are strictly prohibited.");
    }
}
