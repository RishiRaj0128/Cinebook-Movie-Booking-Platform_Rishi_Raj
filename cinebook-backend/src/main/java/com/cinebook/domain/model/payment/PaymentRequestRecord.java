package com.cinebook.domain.model.payment;

import java.io.Serializable;
import java.util.Collections;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable domain record representing an incoming payment authorization or deduction request.
 * All fields final, no mutators.
 */
public record PaymentRequestRecord(
        UUID bookingId,
        UUID userId,
        Money amount,
        String currency,
        String paymentMethod,
        String idempotencyKey,
        Map<String, String> metadata
) implements Serializable {

    public PaymentRequestRecord {
        Objects.requireNonNull(userId, "userId is required");
        Objects.requireNonNull(amount, "amount is required");
        currency = (currency == null || currency.isBlank()) ? "INR" : currency;
        paymentMethod = (paymentMethod == null || paymentMethod.isBlank()) ? "WALLET" : paymentMethod;
        metadata = (metadata == null) ? Collections.emptyMap() : Collections.unmodifiableMap(metadata);
    }

    public static PaymentRequestRecord of(UUID bookingId, UUID userId, long amountPaise, String idempotencyKey) {
        return new PaymentRequestRecord(
                bookingId,
                userId,
                Money.ofPaise(amountPaise),
                "INR",
                "WALLET",
                idempotencyKey,
                Collections.emptyMap()
        );
    }
}
