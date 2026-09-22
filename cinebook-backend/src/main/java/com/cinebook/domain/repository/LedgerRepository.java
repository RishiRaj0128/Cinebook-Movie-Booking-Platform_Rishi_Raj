package com.cinebook.domain.repository;

import com.cinebook.domain.entity.LedgerEntry;
import com.cinebook.domain.enums.LedgerDirection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LedgerRepository extends JpaRepository<LedgerEntry, UUID> {

    List<LedgerEntry> findByTransactionId(UUID transactionId);

    List<LedgerEntry> findByAccountId(String accountId);

    /**
     * Calculates the net balance of the entire ledger.
     * In a healthy double-entry ledger, total credits must equal total debits, netting to ZERO:
     * sum(CREDIT) - sum(DEBIT) == 0.
     */
    @Query("""
        SELECT COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amountPaise ELSE -le.amountPaise END), 0)
        FROM LedgerEntry le
        """)
    Long calculateNetLedgerBalancePaise();

    /**
     * Calculates the balance of a specific account by summing credits and subtracting debits.
     */
    @Query("""
        SELECT COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amountPaise ELSE -le.amountPaise END), 0)
        FROM LedgerEntry le
        WHERE le.accountId = :accountId
        """)
    Long calculateAccountBalancePaise(@Param("accountId") String accountId);

    /**
     * Returns the absolute sum of all entries for a given direction (DEBIT or CREDIT).
     */
    @Query("""
        SELECT COALESCE(SUM(le.amountPaise), 0)
        FROM LedgerEntry le
        WHERE le.direction = :direction
        """)
    Long sumAmountByDirection(@Param("direction") LedgerDirection direction);
}
