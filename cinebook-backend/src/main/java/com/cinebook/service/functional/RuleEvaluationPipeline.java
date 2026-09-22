package com.cinebook.service.functional;

import com.cinebook.domain.model.payment.PaymentRequestRecord;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Functional pipeline for executing payment rules.
 * Supports:
 * 1. Accumulating all rule violations in one pass (no early short-circuit, for detailed client feedback/logging).
 * 2. Short-circuit chained execution using functional composition.
 */
public final class RuleEvaluationPipeline {

    private final List<PaymentRule> rules;

    private RuleEvaluationPipeline(List<PaymentRule> rules) {
        this.rules = List.copyOf(rules);
    }

    public static RuleEvaluationPipeline of(PaymentRule... rules) {
        return new RuleEvaluationPipeline(List.of(rules));
    }

    /**
     * Core 5-rule financial suite from implementation plan:
     * 1. positiveAmountRule
     * 2. activeBookingRule
     * 3. userEligibilityRule
     * 4. antiFraudVelocityRule
     * 5. singleTransactionLimitRule
     */
    public static RuleEvaluationPipeline coreFinancialRules() {
        return of(
                PaymentValidationRules.POSITIVE_AMOUNT_RULE,
                PaymentValidationRules.ACTIVE_BOOKING_RULE,
                PaymentValidationRules.USER_ELIGIBILITY_RULE,
                PaymentValidationRules.ANTI_FRAUD_VELOCITY_RULE,
                PaymentValidationRules.SINGLE_TRANSACTION_LIMIT_RULE
        );
    }

    public static RuleEvaluationPipeline productionPipeline() {
        return of(
                PaymentValidationRules.POSITIVE_AMOUNT_RULE,
                PaymentValidationRules.ACTIVE_BOOKING_RULE,
                PaymentValidationRules.USER_ELIGIBILITY_RULE,
                PaymentValidationRules.ANTI_FRAUD_VELOCITY_RULE,
                PaymentValidationRules.SINGLE_TRANSACTION_LIMIT_RULE,
                PaymentValidationRules.CURRENCY_RULE,
                PaymentValidationRules.PAYMENT_METHOD_RULE,
                PaymentValidationRules.IDEMPOTENCY_KEY_RULE
        );
    }

    public static RuleEvaluationPipeline defaultRules() {
        return productionPipeline();
    }

    /**
     * Accumulates all rule violations without short-circuiting.
     * Evaluates every rule in the pipeline and collects all failed rule codes into a List.
     */
    public List<String> validateAll(PaymentRequestRecord request) {
        Objects.requireNonNull(request, "request cannot be null");
        return rules.stream()
                .map(rule -> rule.apply(request))
                .flatMap(Optional::stream)
                .toList();
    }

    /**
     * Evaluates rules sequentially using composed short-circuiting (.and()).
     * Stops and returns the first violation encountered, if any.
     */
    public Optional<String> validateShortCircuit(PaymentRequestRecord request) {
        Objects.requireNonNull(request, "request cannot be null");
        if (rules.isEmpty()) {
            return Optional.empty();
        }

        PaymentRule composite = rules.get(0);
        for (int i = 1; i < rules.size(); i++) {
            composite = composite.and(rules.get(i));
        }
        return composite.apply(request);
    }
}
