package com.cinebook.domain.repository;

import com.cinebook.domain.entity.PaymentTransaction;
import com.cinebook.domain.enums.TransactionState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {

    Optional<PaymentTransaction> findByIdempotencyKey(String idempotencyKey);

    List<PaymentTransaction> findByBookingId(UUID bookingId);

    List<PaymentTransaction> findByUserId(UUID userId);

    List<PaymentTransaction> findByState(TransactionState state);

    /**
     * Finds transactions stuck in PROCESSING state older than a given threshold timestamp.
     * Used by reconciliation / recovery sweep.
     */
    @Query("""
        SELECT pt FROM PaymentTransaction pt
        WHERE pt.state = :state AND pt.updatedAt < :stuckBefore
        """)
    List<PaymentTransaction> findStuckTransactions(
            @Param("state") TransactionState state,
            @Param("stuckBefore") LocalDateTime stuckBefore
    );
}
