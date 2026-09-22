package com.cinebook.service.ledger;

import com.cinebook.domain.entity.LedgerEntry;
import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.enums.LedgerDirection;
import com.cinebook.domain.model.payment.LedgerEntryRecord;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.repository.LedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Service managing the append-only double-entry financial ledger.
 * Invariant: For every transfer, exactly two balanced entries (one DEBIT, one CREDIT)
 * are committed in the same database transaction.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LedgerService {

    private final LedgerRepository ledgerRepository;

    /**
     * Records a balanced double-entry transfer between two accounts.
     * Guaranteed atomic with caller's transaction.
     */
    @Transactional
    public List<LedgerEntryRecord> recordTransfer(
            UUID transactionId,
            String sourceAccountId,
            AccountType sourceType,
            String destinationAccountId,
            AccountType destinationType,
            Money amount,
            String description
    ) {
        Objects.requireNonNull(transactionId, "transactionId cannot be null");
        Objects.requireNonNull(sourceAccountId, "sourceAccountId cannot be null");
        Objects.requireNonNull(destinationAccountId, "destinationAccountId cannot be null");
        Objects.requireNonNull(amount, "amount cannot be null");
        if (!amount.isPositive()) {
            throw new IllegalArgumentException("Ledger transfer amount must be strictly positive: " + amount);
        }

        long paise = amount.getAmountPaise();

        // 1. Debit from source account
        LedgerEntry debitEntry = LedgerEntry.builder()
                .accountId(sourceAccountId)
                .accountType(sourceType)
                .amountPaise(paise)
                .direction(LedgerDirection.DEBIT)
                .transactionId(transactionId)
                .description(description != null ? description : "Debit transfer")
                .build();

        // 2. Credit to destination account
        LedgerEntry creditEntry = LedgerEntry.builder()
                .accountId(destinationAccountId)
                .accountType(destinationType)
                .amountPaise(paise)
                .direction(LedgerDirection.CREDIT)
                .transactionId(transactionId)
                .description(description != null ? description : "Credit transfer")
                .build();

        LedgerEntry savedDebit = ledgerRepository.save(debitEntry);
        LedgerEntry savedCredit = ledgerRepository.save(creditEntry);

        log.info("Ledger transfer recorded: tx={}, {} DEBIT {} -> {} CREDIT {}",
                transactionId, sourceAccountId, paise, destinationAccountId, paise);

        return List.of(toRecord(savedDebit), toRecord(savedCredit));
    }

    /**
     * Audit job / reconciliation checking that the entire ledger is balanced.
     * sum(CREDIT) - sum(DEBIT) == 0.
     */
    @Transactional(readOnly = true)
    public LedgerReconciliationReport reconcileLedger() {
        Long netBalancePaise = ledgerRepository.calculateNetLedgerBalancePaise();
        Long totalCredits = ledgerRepository.sumAmountByDirection(LedgerDirection.CREDIT);
        Long totalDebits = ledgerRepository.sumAmountByDirection(LedgerDirection.DEBIT);
        long entryCount = ledgerRepository.count();

        boolean isBalanced = (netBalancePaise != null && netBalancePaise == 0L)
                && Objects.equals(totalCredits, totalDebits);

        if (!isBalanced) {
            log.error("CRITICAL LEDGER DRIFT DETECTED! Net balance: {} paise (Credits={}, Debits={})",
                    netBalancePaise, totalCredits, totalDebits);
        } else {
            log.info("Ledger audit passed: Zero-sum balanced across {} entries. Total volume: ₹{}",
                    entryCount, Money.ofPaise(totalCredits != null ? totalCredits : 0).toRupeesDecimal());
        }

        return new LedgerReconciliationReport(
                isBalanced,
                netBalancePaise != null ? netBalancePaise : 0L,
                totalCredits != null ? totalCredits : 0L,
                totalDebits != null ? totalDebits : 0L,
                entryCount,
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public Money getAccountBalance(String accountId) {
        Long balance = ledgerRepository.calculateAccountBalancePaise(accountId);
        return Money.ofPaise(balance != null ? balance : 0L);
    }

    private LedgerEntryRecord toRecord(LedgerEntry entity) {
        return new LedgerEntryRecord(
                entity.getId(),
                entity.getAccountId(),
                entity.getAccountType(),
                Money.ofPaise(entity.getAmountPaise()),
                entity.getDirection(),
                entity.getTransactionId(),
                entity.getDescription(),
                entity.getCreatedAt() != null ? entity.getCreatedAt().toInstant(ZoneOffset.UTC) : Instant.now()
        );
    }
}
