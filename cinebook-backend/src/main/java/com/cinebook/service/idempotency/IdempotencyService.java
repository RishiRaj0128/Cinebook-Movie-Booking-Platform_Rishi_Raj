package com.cinebook.service.idempotency;

import com.cinebook.domain.entity.IdempotencyRecord;
import com.cinebook.domain.repository.IdempotencyRepository;
import com.cinebook.exception.IdempotencyConflictException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Enterprise idempotency service ensuring no duplicate payments, double bookings, or conflicting replays.
 * Backed by database UNIQUE(idempotency_key) constraint for cluster-wide multi-instance safety,
 * paired with thread-level synchronization for single-node efficiency.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IdempotencyService {

    private final IdempotencyRepository idempotencyRepository;
    private final ObjectMapper objectMapper;

    @jakarta.annotation.PostConstruct
    public void init() {
        objectMapper.findAndRegisterModules();
    }

    // Mutex map serializing concurrent threads on the same JVM competing for the same key
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
        try {
            // 1. Check if record already exists in database
            Optional<IdempotencyRecord> existingOpt = idempotencyRepository.findByIdempotencyKey(idempotencyKey);
            if (existingOpt.isPresent()) {
                return parseAndReturnCached(existingOpt.get(), requestHash, responseClass, idempotencyKey);
            }

            // 2. Execute business action
            T result = action.get();

            // 3. Atomically persist and flush to database (triggers DB unique constraint if raced by another node)
            String serializedResponse = objectMapper.writeValueAsString(result);
            IdempotencyRecord record = IdempotencyRecord.builder()
                    .idempotencyKey(idempotencyKey)
                    .requestHash(requestHash)
                    .status("COMPLETED")
                    .responseStatusCode(200)
                    .responseBody(serializedResponse)
                    .build();

            idempotencyRepository.saveAndFlush(record);
            log.info("Stored new idempotency record in DB for key '{}'", idempotencyKey);
            return result;

        } catch (DataIntegrityViolationException e) {
            // 4. Multi-instance cluster safety: Caught database unique constraint violation!
            log.info("Database UNIQUE constraint triggered for key '{}'. Fetching committed response from winner.", idempotencyKey);
            IdempotencyRecord winnerRecord = idempotencyRepository.findByIdempotencyKey(idempotencyKey)
                    .orElseThrow(() -> new IllegalStateException("Failed to find idempotency record after DB unique violation: " + idempotencyKey, e));
            return parseAndReturnCached(winnerRecord, requestHash, responseClass, idempotencyKey);

        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize/deserialize response for key: " + idempotencyKey, e);
        }
    }

    private <T> T parseAndReturnCached(IdempotencyRecord existing, String requestHash, Class<T> responseClass, String idempotencyKey) {
        // Detect mismatched request body (client bug / malicious key reuse)
        if (!existing.getRequestHash().equals(requestHash)) {
            log.warn("Idempotency conflict detected for key '{}'. Existing hash: {}, incoming hash: {}",
                    idempotencyKey, existing.getRequestHash(), requestHash);
            throw new IdempotencyConflictException(
                    "Idempotency-Key '" + idempotencyKey + "' was already used with a different request payload."
            );
        }

        // Return cached response verbatim
        log.info("Idempotent replay for key '{}'. Returning cached verbatim response from DB.", idempotencyKey);
        try {
            return objectMapper.readValue(existing.getResponseBody(), responseClass);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize cached response for key: " + idempotencyKey, e);
        }
    }
}
