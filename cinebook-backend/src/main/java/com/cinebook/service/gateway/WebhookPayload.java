package com.cinebook.service.gateway;

import java.io.Serializable;
import java.util.UUID;

/**
 * Webhook event payload sent by payment gateways (Razorpay / Juspay / MockGateway).
 */
public record WebhookPayload(
        String eventId,
        String eventType,
        UUID transactionId,
        UUID bookingId,
        long amountPaise,
        long timestamp
) implements Serializable {}
