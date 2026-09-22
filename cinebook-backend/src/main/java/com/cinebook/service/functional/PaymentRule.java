package com.cinebook.service.functional;

import com.cinebook.domain.model.payment.PaymentRequestRecord;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Functional interface for pure payment validation rules.
 * A rule evaluates an immutable PaymentRequestRecord and returns:
 * - Optional.empty() if the rule is satisfied.
 * - Optional.of(violationCode) if the rule is violated.
 */
@FunctionalInterface
public interface PaymentRule extends Function<PaymentRequestRecord, Optional<String>> {

    /**
     * Creates a PaymentRule from a pure Predicate and failure violation code.
     */
    static PaymentRule fromPredicate(Predicate<PaymentRequestRecord> predicate, String violationCode) {
        Objects.requireNonNull(predicate, "predicate cannot be null");
        Objects.requireNonNull(violationCode, "violationCode cannot be null");
        return req -> predicate.test(req) ? Optional.empty() : Optional.of(violationCode);
    }

    /**
     * Composes two rules with short-circuit evaluation:
     * If this rule fails, the second rule is not evaluated.
     */
    default PaymentRule and(PaymentRule nextRule) {
        Objects.requireNonNull(nextRule, "nextRule cannot be null");
        return req -> {
            Optional<String> firstViolation = this.apply(req);
            return firstViolation.isPresent() ? firstViolation : nextRule.apply(req);
        };
    }
}
