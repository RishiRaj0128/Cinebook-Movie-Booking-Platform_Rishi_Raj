package com.cinebook.domain.entity;

import com.cinebook.domain.model.payment.Money;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Wallet entity representing a user's stored-value balance.
 * Concurrency protected via PESSIMISTIC_WRITE lock (SELECT ... FOR UPDATE).
 * Backed by append-only double-entry ledger.
 */
@Entity
@Table(name = "wallets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** Current balance in smallest currency unit (paise). */
    @Column(name = "balance_paise", nullable = false)
    @Builder.Default
    private Long balancePaise = 0L;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "INR";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Money getBalanceMoney() {
        return Money.ofPaise(balancePaise);
    }

    public boolean hasSufficientBalance(long amountPaise) {
        return this.balancePaise >= amountPaise;
    }

    public void debit(long amountPaise) {
        if (!hasSufficientBalance(amountPaise)) {
            throw new IllegalStateException("Insufficient wallet balance: available " + balancePaise + " paise, requested " + amountPaise + " paise");
        }
        this.balancePaise -= amountPaise;
    }

    public void credit(long amountPaise) {
        if (amountPaise < 0) {
            throw new IllegalArgumentException("Cannot credit negative amount: " + amountPaise);
        }
        this.balancePaise += amountPaise;
    }
}
