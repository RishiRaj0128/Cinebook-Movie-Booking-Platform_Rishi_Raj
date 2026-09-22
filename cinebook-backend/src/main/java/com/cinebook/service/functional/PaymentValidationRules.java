package com.cinebook.service.functional;

import com.cinebook.domain.model.payment.PaymentRequestRecord;

import java.util.Set;
import java.util.function.Predicate;

/**
 * Pure validation rule definitions for financial payment requests.
 * All methods are pure static functions: deterministic, zero side-effects.
 * Explicitly implements the full required rule suite:
 * - positiveAmountRule
 * - activeBookingRule
 * - userEligibilityRule
 * - antiFraudVelocityRule
 * - singleTransactionLimitRule
 */
public final class PaymentValidationRules {

    private PaymentValidationRules() {}

    // Max transaction limit for movie booking = ₹50,000 (5,000,000 paise)
    public static final long MAX_SINGLE_TRANSACTION_PAISE = 5_000_000L;
    public static final Set<String> SUPPORTED_CURRENCIES = Set.of("INR");
    public static final Set<String> SUPPORTED_METHODS = Set.of("WALLET", "RAZORPAY", "UPI", "CARD");

    // 1. Positive Amount Predicate
    public static final Predicate<PaymentRequestRecord> HAS_POSITIVE_AMOUNT =
            req -> req.amount() != null && req.amount().isPositive();

    // 2. Active Booking Predicate (requires a valid booking context that is not cancelled or expired)
    public static final Predicate<PaymentRequestRecord> HAS_ACTIVE_BOOKING =
            req -> req.bookingId() != null &&
                    !"CANCELLED".equalsIgnoreCase(req.metadata().getOrDefault("bookingStatus", "CREATED")) &&
                    !"EXPIRED".equalsIgnoreCase(req.metadata().getOrDefault("bookingStatus", "CREATED"));

    // 3. User Eligibility Predicate (requires valid user and eligible account status)
    public static final Predicate<PaymentRequestRecord> IS_USER_ELIGIBLE =
            req -> req.userId() != null &&
                    !"SUSPENDED".equalsIgnoreCase(req.metadata().getOrDefault("userStatus", "ACTIVE")) &&
                    !"BLOCKED".equalsIgnoreCase(req.metadata().getOrDefault("userStatus", "ACTIVE"));

    // 4. Anti-Fraud Velocity Rule Predicate (pure check rejecting excessive velocity flags or burst counters)
    public static final Predicate<PaymentRequestRecord> PASSES_ANTI_FRAUD_VELOCITY =
            req -> {
                String velocityFlag = req.metadata().get("fraudVelocityScore");
                if (velocityFlag != null) {
                    try {
                        return Double.parseDouble(velocityFlag) < 0.85; // Reject high risk scores
                    } catch (NumberFormatException ignored) {}
                }
                return !"SUSPECTED_VELOCITY_SPIKE".equalsIgnoreCase(req.metadata().get("fraudRiskLevel"));
            };

    // 5. Single Transaction Limit Predicate
    public static final Predicate<PaymentRequestRecord> WITHIN_SINGLE_TRANSACTION_LIMIT =
            req -> req.amount() != null && req.amount().getAmountPaise() <= MAX_SINGLE_TRANSACTION_PAISE;

    // Additional Protocol Sanity Rules
    public static final Predicate<PaymentRequestRecord> HAS_SUPPORTED_CURRENCY =
            req -> req.currency() != null && SUPPORTED_CURRENCIES.contains(req.currency().toUpperCase());

    public static final Predicate<PaymentRequestRecord> HAS_SUPPORTED_PAYMENT_METHOD =
            req -> req.paymentMethod() != null && SUPPORTED_METHODS.contains(req.paymentMethod().toUpperCase());

    public static final Predicate<PaymentRequestRecord> HAS_VALID_IDEMPOTENCY_KEY =
            req -> req.idempotencyKey() == null || (!req.idempotencyKey().isBlank() && req.idempotencyKey().length() <= 255);

    // =========================================================================
    // Pure Rule Instances (Returning exact error codes for failure accumulation)
    // =========================================================================
    public static final PaymentRule POSITIVE_AMOUNT_RULE =
            PaymentRule.fromPredicate(HAS_POSITIVE_AMOUNT, "ERR_NON_POSITIVE_AMOUNT");

    public static final PaymentRule ACTIVE_BOOKING_RULE =
            PaymentRule.fromPredicate(HAS_ACTIVE_BOOKING, "ERR_INACTIVE_OR_MISSING_BOOKING");

    public static final PaymentRule USER_ELIGIBILITY_RULE =
            PaymentRule.fromPredicate(IS_USER_ELIGIBLE, "ERR_USER_NOT_ELIGIBLE");

    public static final PaymentRule ANTI_FRAUD_VELOCITY_RULE =
            PaymentRule.fromPredicate(PASSES_ANTI_FRAUD_VELOCITY, "ERR_FRAUD_VELOCITY_EXCEEDED");

    public static final PaymentRule SINGLE_TRANSACTION_LIMIT_RULE =
            PaymentRule.fromPredicate(WITHIN_SINGLE_TRANSACTION_LIMIT, "ERR_TRANSACTION_LIMIT_EXCEEDED");

    public static final PaymentRule CURRENCY_RULE =
            PaymentRule.fromPredicate(HAS_SUPPORTED_CURRENCY, "ERR_UNSUPPORTED_CURRENCY");

    public static final PaymentRule PAYMENT_METHOD_RULE =
            PaymentRule.fromPredicate(HAS_SUPPORTED_PAYMENT_METHOD, "ERR_UNSUPPORTED_PAYMENT_METHOD");

    public static final PaymentRule IDEMPOTENCY_KEY_RULE =
            PaymentRule.fromPredicate(HAS_VALID_IDEMPOTENCY_KEY, "ERR_INVALID_IDEMPOTENCY_KEY");
}
