package com.cinebook.service.wallet;

import com.cinebook.domain.entity.User;
import com.cinebook.domain.entity.Wallet;
import com.cinebook.domain.enums.AccountType;
import com.cinebook.domain.model.payment.Money;
import com.cinebook.domain.repository.UserRepository;
import com.cinebook.domain.repository.WalletRepository;
import com.cinebook.exception.InsufficientBalanceException;
import com.cinebook.exception.ResourceNotFoundException;
import com.cinebook.service.ledger.LedgerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service managing user wallets with explicit pessimistic row-level locking.
 * Balances are tied 1:1 with append-only double-entry ledger transfers.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WalletService {

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;

    public static final String ESCROW_ACCOUNT = "MERCHANT_ESCROW";
    public static final String SETTLEMENT_ACCOUNT = "GATEWAY_CLEARING";

    /**
     * Gets or creates a wallet for a user.
     */
    @Transactional
    public Wallet getOrCreateWallet(UUID userId) {
        return walletRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
                    Wallet newWallet = Wallet.builder()
                            .user(user)
                            .balancePaise(0L)
                            .currency("INR")
                            .build();
                    return walletRepository.save(newWallet);
                });
    }

    /**
     * Credits a wallet with funds (e.g. deposit or refund) backed by ledger.
     */
    @Transactional
    public Wallet creditWallet(UUID userId, Money amount, UUID transactionId, String description) {
        if (!amount.isPositive()) {
            throw new IllegalArgumentException("Credit amount must be positive: " + amount);
        }

        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseGet(() -> getOrCreateWallet(userId));

        long paise = amount.getAmountPaise();
        wallet.credit(paise);
        Wallet updated = walletRepository.save(wallet);

        // Record balanced ledger transfer: Clearing -> User Wallet
        ledgerService.recordTransfer(
                transactionId != null ? transactionId : UUID.randomUUID(),
                SETTLEMENT_ACCOUNT,
                AccountType.GATEWAY_CLEARING,
                "USER_WALLET:" + userId,
                AccountType.USER_WALLET,
                amount,
                description != null ? description : "Wallet deposit"
        );

        log.info("Credited ₹{} ({} paise) to wallet of user {}. New balance: ₹{}",
                amount.toRupeesDecimal(), paise, userId, updated.getBalanceMoney().toRupeesDecimal());
        return updated;
    }

    /**
     * Debits a wallet with explicit PESSIMISTIC_WRITE row lock (SELECT ... FOR UPDATE).
     * Subsequent concurrent threads wait, acquire lock in turn, and receive a clean
     * InsufficientBalanceException if funds were already spent.
     */
    @Transactional
    public Wallet debitWallet(UUID userId, Money amount, UUID transactionId, String description) {
        if (!amount.isPositive()) {
            throw new IllegalArgumentException("Debit amount must be positive: " + amount);
        }

        // PESSIMISTIC_WRITE lock with 3000ms timeout
        Wallet wallet = walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new InsufficientBalanceException("Wallet not found for user: " + userId));

        long paise = amount.getAmountPaise();
        if (!wallet.hasSufficientBalance(paise)) {
            log.warn("Wallet debit rejected for user {}: required {} paise, available {} paise",
                    userId, paise, wallet.getBalancePaise());
            throw new InsufficientBalanceException(
                    "Insufficient wallet balance. Required: " + amount + ", Available: " + wallet.getBalanceMoney()
            );
        }

        wallet.debit(paise);
        Wallet updated = walletRepository.save(wallet);

        // Record balanced ledger transfer: User Wallet -> Merchant Escrow
        ledgerService.recordTransfer(
                transactionId != null ? transactionId : UUID.randomUUID(),
                "USER_WALLET:" + userId,
                AccountType.USER_WALLET,
                ESCROW_ACCOUNT,
                AccountType.MERCHANT_ESCROW,
                amount,
                description != null ? description : "Payment deduction"
        );

        log.info("Debited ₹{} ({} paise) from wallet of user {}. Remaining balance: ₹{}",
                amount.toRupeesDecimal(), paise, userId, updated.getBalanceMoney().toRupeesDecimal());
        return updated;
    }

    @Transactional(readOnly = true)
    public Money getBalance(UUID userId) {
        return walletRepository.findByUserId(userId)
                .map(Wallet::getBalanceMoney)
                .orElse(Money.ZERO);
    }
}
