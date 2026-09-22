package com.cinebook.service.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Mock payment gateway simulator modeled after real-world providers (Razorpay / Juspay / Stripe).
 * Simulates at-least-once async webhook delivery and induces timeouts on demand.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MockPaymentGateway {

    private final HmacSignatureService hmacSignatureService;
    private final ObjectMapper objectMapper;

    /**
     * Simulates an outbound charge authorization with optional simulated timeout.
     */
    public String initiateCharge(UUID transactionId, long amountPaise, boolean simulateTimeout) {
        if (simulateTimeout) {
            log.warn("MockGateway: Simulating network timeout/drop for transaction {}", transactionId);
            throw new RuntimeException("GATEWAY_TIMEOUT: Mock gateway connection dropped or timed out after 5000ms");
        }

        String externalRef = "mock_pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        log.info("MockGateway: Charge initiated successfully. Tx={}, Amount={} paise, Ref={}",
                transactionId, amountPaise, externalRef);
        return externalRef;
    }

    /**
     * Creates a signed webhook payload for a payment outcome.
     */
    public SignedWebhook createWebhook(String eventId, String eventType, UUID transactionId, UUID bookingId, long amountPaise) {
        WebhookPayload payload = new WebhookPayload(
                eventId != null ? eventId : "evt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12),
                eventType,
                transactionId,
                bookingId,
                amountPaise,
                Instant.now().toEpochMilli()
        );

        try {
            String json = objectMapper.writeValueAsString(payload);
            String signature = hmacSignatureService.computeSignature(json);
            return new SignedWebhook(json, signature, payload);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize mock webhook", e);
        }
    }

    public record SignedWebhook(String rawJson, String signature, WebhookPayload payload) {}
}
