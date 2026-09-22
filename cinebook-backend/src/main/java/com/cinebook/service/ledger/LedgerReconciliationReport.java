package com.cinebook.service.ledger;

import java.io.Serializable;
import java.time.Instant;

public record LedgerReconciliationReport(
        boolean isBalanced,
        long netBalancePaise,
        long totalCreditsPaise,
        long totalDebitsPaise,
        long entryCount,
        Instant auditedAt
) implements Serializable {}
