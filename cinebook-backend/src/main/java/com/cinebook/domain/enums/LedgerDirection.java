package com.cinebook.domain.enums;

/**
 * Direction of double-entry ledger entry.
 * In a balanced double-entry accounting ledger:
 * Every transaction creates matching DEBIT and CREDIT entries such that sum(DEBIT) == sum(CREDIT).
 */
public enum LedgerDirection {
    DEBIT,
    CREDIT
}
