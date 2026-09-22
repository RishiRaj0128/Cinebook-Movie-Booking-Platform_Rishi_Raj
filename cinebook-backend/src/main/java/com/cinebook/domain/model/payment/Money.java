package com.cinebook.domain.model.payment;

import java.io.Serializable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * Immutable value object representing financial currency strictly in the smallest subunit (paise).
 * Never uses floating-point types (float, double) to avoid IEEE 754 precision artifacts.
 * Decimal rupees conversion is only performed at API boundaries using exact BigDecimal scale arithmetic.
 */
public final class Money implements Comparable<Money>, Serializable {

    private static final long serialVersionUID = 1L;
    private static final BigDecimal PAISE_IN_RUPEE = BigDecimal.valueOf(100);

    public static final Money ZERO = new Money(0L);

    private final long amountPaise;

    private Money(long amountPaise) {
        if (amountPaise < 0) {
            throw new IllegalArgumentException("Negative money amounts are prohibited in this domain context: " + amountPaise);
        }
        this.amountPaise = amountPaise;
    }

    @com.fasterxml.jackson.annotation.JsonCreator
    public static Money ofPaise(@com.fasterxml.jackson.annotation.JsonProperty("amountPaise") long amountPaise) {
        if (amountPaise == 0) return ZERO;
        return new Money(amountPaise);
    }

    @com.fasterxml.jackson.annotation.JsonProperty("amountPaise")
    public long getAmountPaise() {
        return amountPaise;
    }

    /**
     * Converts a decimal Rupee representation to exact integer paise at the boundary.
     * Rejects more than 2 decimal places to prevent sub-paise fractional rounding loss.
     */
    public static Money ofRupees(BigDecimal rupees) {
        Objects.requireNonNull(rupees, "Rupees amount cannot be null");
        if (rupees.scale() > 2) {
            throw new IllegalArgumentException("Rupee amount cannot have precision beyond 2 decimal places (paise): " + rupees);
        }
        long paise = rupees.multiply(PAISE_IN_RUPEE).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        return ofPaise(paise);
    }

    /**
     * Exact decimal representation in Rupees (e.g. 25050 paise -> "250.50").
     */
    public BigDecimal toRupeesDecimal() {
        return BigDecimal.valueOf(amountPaise).divide(PAISE_IN_RUPEE, 2, RoundingMode.UNNECESSARY);
    }

    public Money plus(Money other) {
        Objects.requireNonNull(other, "Cannot add null Money");
        return ofPaise(Math.addExact(this.amountPaise, other.amountPaise));
    }

    public Money minus(Money other) {
        Objects.requireNonNull(other, "Cannot subtract null Money");
        if (this.amountPaise < other.amountPaise) {
            throw new ArithmeticException("Subtraction would result in negative balance: " + this.amountPaise + " - " + other.amountPaise);
        }
        return ofPaise(Math.subtractExact(this.amountPaise, other.amountPaise));
    }

    public boolean isGreaterThanOrEqual(Money other) {
        return this.amountPaise >= other.amountPaise;
    }

    public boolean isPositive() {
        return this.amountPaise > 0;
    }

    public boolean isZero() {
        return this.amountPaise == 0;
    }

    @Override
    public int compareTo(Money o) {
        return Long.compare(this.amountPaise, o.amountPaise);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money money)) return false;
        return amountPaise == money.amountPaise;
    }

    @Override
    public int hashCode() {
        return Long.hashCode(amountPaise);
    }

    @Override
    public String toString() {
        return "₹" + toRupeesDecimal().toPlainString() + " (" + amountPaise + " paise)";
    }
}
