package com.cinebook.service.idempotency;

import com.cinebook.domain.entity.IdempotencyRecord;
import com.cinebook.exception.IdempotencyConflictException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Enterprise idempotency service ensuring no duplicate payments, double bookings, or conflicting replays.
 * Backed by an atomic insert-claim state machine (PROCESSING -> COMPLETED/FAILED) via database
 * UNIQUE(idempotency_key) constraint in REQUIRES_NEW transactions, completely eliminating distributed
 * race conditions across multi-instance clusters before any business action executes.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IdempotencyService {

    private final IdempotencyClaimService claimService;
    private final ObjectMapper objectMapper;

    @jakarta.annotation.PostConstruct
    public void init() {
        objectMapper.findAndRegisterModules();
    }

    // Single-node JVM synchronization map
    private final ConcurrentHashMap<String, Object> keyLocks = new ConcurrentHashMap<>();

    /**
     * Computes the SHA-256 hash of any serializable request object.
     */
    public String computeRequestHash(Object request) {
        if (request == null) {
            return "0000000000000000000000000000000000000000000000000000000000000000";
        }
        try {
            String json = (request instanceof String str) ? str : objectMapper.writeValueAsString(request);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashBytes);
        } catch (NoSuchAlgorithmException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to calculate request SHA-256 hash", e);
        }
    }

    /**
     * Executes the given action idempotently with both thread-level and database-level unique constraint guarantees.
     */
    public <T> T execute(String idempotencyKey, Object requestPayload, Class<T> responseClass, Supplier<T> action) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return action.get();
        }

        String requestHash = computeRequestHash(requestPayload);
        Object lock = keyLocks.computeIfAbsent(idempotencyKey.intern(), k -> new Object());

        synchronized (lock) {
            return executeInternal(idempotencyKey, requestHash, responseClass, action);
        }
    }

    /**
     * Direct execution bypassing the JVM mutex (simulating multi-instance cluster nodes competing on the DB).
     */
    public <T> T executeWithDatabaseGuaranteesOnly(String idempotencyKey, Object requestPayload, Class<T> responseClass, Supplier<T> action) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return action.get();
        }
        String requestHash = computeRequestHash(requestPayload);
        return executeInternal(idempotencyKey, requestHash, responseClass, action);
    }

    private <T> T executeInternal(String idempotencyKey, String requestHash, Class<T> responseClass, Supplier<T> action) {
        // 1. Atomic claim prior to any business execution
        IdempotencyClaimService.ClaimResult claim = claimService.claim(idempotencyKey, requestHash);

        // 2. If already completed, return cached response verbatim immediately
        if (claim.status() == IdempotencyClaimService.ClaimStatus.ALREADY_COMPLETED) {
            log.info("Idempotent replay for key '{}'. Returning cached response.", sanitizeKey(idempotencyKey));
            return deserializeResponse(claim.record().getResponseBody(), responseClass, idempotencyKey);
        }

        // 3. If another node is actively processing, await completion (up to 5 seconds)
        if (claim.status() == IdempotencyClaimService.ClaimStatus.ALREADY_PROCESSING) {
            log.info("Key '{}' is currently being processed by another cluster instance. Awaiting completion.", sanitizeKey(idempotencyKey));
            for (int i = 0; i < 50; i++) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Interrupted while awaiting idempotent response for key: " + idempotencyKey, e);
                }

                Optional<IdempotencyRecord> polled = claimService.findRecord(idempotencyKey);
                if (polled.isPresent()) {
                    IdempotencyRecord record = polled.get();
                    if ("COMPLETED".equals(record.getStatus())) {
                        log.info("Key '{}' completed by owner node. Returning cached response.", sanitizeKey(idempotencyKey));
                        return deserializeResponse(record.getResponseBody(), responseClass, idempotencyKey);
                    }
                    if ("FAILED".equals(record.getStatus())) {
                        throw new IllegalStateException("Concurrent transaction execution failed for idempotency key: " + idempotencyKey);
                    }
                }
            }
            throw new IdempotencyConflictException("Concurrent request execution timeout for idempotency key: " + idempotencyKey);
        }

        // 4. Current node won the claim -> execute business action
        T result;
        try {
            result = action.get();
        } catch (RuntimeException ex) {
            claimService.markFailed(idempotencyKey, ex.getMessage());
            throw ex;
        }

        // 5. Mark claim as COMPLETED with verbatim serialized response
        claimService.markCompleted(idempotencyKey, result, 200);
        return result;
    }

    private <T> T deserializeResponse(String json, Class<T> responseClass, String idempotencyKey) {
        try {
            if (responseClass.equals(String.class)) {
                @SuppressWarnings("unchecked")
                T str = (T) (json.startsWith("\"") && json.endsWith("\"") ? objectMapper.readValue(json, String.class) : json);
                return str;
            }
            return objectMapper.readValue(json, responseClass);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize cached response for key: " + idempotencyKey, e);
        }
    }

    private String sanitizeKey(String key) {
        return key != null ? key.replaceAll("[\r\n\t]", "_") : "null";
    }
}
