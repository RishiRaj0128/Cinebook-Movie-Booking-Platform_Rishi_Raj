package com.cinebook.service.idempotency;

import com.cinebook.domain.entity.IdempotencyRecord;
import com.cinebook.domain.repository.IdempotencyRepository;
import com.cinebook.exception.IdempotencyConflictException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;

/**
 * Isolated transactional boundary for atomic idempotency claims.
 * Uses TransactionTemplate with REQUIRES_NEW transactions to guarantee that the PROCESSING claim
 * is committed to the database BEFORE any business execution begins, and safely handles
 * concurrent DataIntegrityViolationException without marking the caller transaction as rollback-only.
 */
@Service
@Slf4j
public class IdempotencyClaimService {

    private final IdempotencyRepository idempotencyRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate requiresNewTemplate;

    public IdempotencyClaimService(
            IdempotencyRepository idempotencyRepository,
            ObjectMapper objectMapper,
            PlatformTransactionManager transactionManager
    ) {
        this.idempotencyRepository = idempotencyRepository;
        this.objectMapper = objectMapper;
        this.requiresNewTemplate = new TransactionTemplate(transactionManager);
        this.requiresNewTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public enum ClaimStatus {
        CLAIMED,
        ALREADY_COMPLETED,
        ALREADY_PROCESSING
    }

    public record ClaimResult(ClaimStatus status, IdempotencyRecord record) {}

    /**
     * Atomically claims an idempotency key before business execution.
     * Guaranteed atomic by database UNIQUE(idempotency_key) constraint.
     */
    public ClaimResult claim(String idempotencyKey, String requestHash) {
        // 1. Fast-path lookup
        Optional<IdempotencyRecord> existingOpt = idempotencyRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOpt.isPresent()) {
            IdempotencyRecord existing = existingOpt.get();
            verifyRequestHash(existing, requestHash, idempotencyKey);
            if ("COMPLETED".equals(existing.getStatus())) {
                return new ClaimResult(ClaimStatus.ALREADY_COMPLETED, existing);
            }
            return new ClaimResult(ClaimStatus.ALREADY_PROCESSING, existing);
        }

        // 2. Try to insert claim in an isolated transaction
        try {
            IdempotencyRecord saved = requiresNewTemplate.execute(status -> {
                IdempotencyRecord newRecord = IdempotencyRecord.builder()
                        .idempotencyKey(idempotencyKey)
                        .requestHash(requestHash)
                        .status("PROCESSING")
                        .build();
                return idempotencyRepository.saveAndFlush(newRecord);
            });
            return new ClaimResult(ClaimStatus.CLAIMED, saved);
        } catch (DataIntegrityViolationException e) {
            // Concurrent race: another node inserted first
            log.info("Concurrent insert race caught for idempotency key '{}'. Resolving owner record.", idempotencyKey);
            IdempotencyRecord winner = idempotencyRepository.findByIdempotencyKey(idempotencyKey)
                    .orElseThrow(() -> new IllegalStateException("Record not found after unique constraint violation for key: " + idempotencyKey, e));
            verifyRequestHash(winner, requestHash, idempotencyKey);
            if ("COMPLETED".equals(winner.getStatus())) {
                return new ClaimResult(ClaimStatus.ALREADY_COMPLETED, winner);
            }
            return new ClaimResult(ClaimStatus.ALREADY_PROCESSING, winner);
        }
    }

    /**
     * Atomically marks the claim as COMPLETED with the serialized response payload.
     */
    public void markCompleted(String idempotencyKey, Object result, int statusCode) {
        requiresNewTemplate.executeWithoutResult(status -> {
            idempotencyRepository.findByIdempotencyKey(idempotencyKey).ifPresent(record -> {
                try {
                    record.setStatus("COMPLETED");
                    record.setResponseStatusCode(statusCode);
                    record.setResponseBody(objectMapper.writeValueAsString(result));
                    idempotencyRepository.saveAndFlush(record);
                    log.info("Idempotency record marked COMPLETED for key '{}'", idempotencyKey);
                } catch (JsonProcessingException e) {
                    log.error("Failed to serialize response body for idempotency key '{}'", idempotencyKey, e);
                }
            });
        });
    }

    /**
     * Marks the claim as FAILED so client can retry or audit failure.
     */
    public void markFailed(String idempotencyKey, String failureReason) {
        requiresNewTemplate.executeWithoutResult(status -> {
            idempotencyRepository.findByIdempotencyKey(idempotencyKey).ifPresent(record -> {
                record.setStatus("FAILED");
                record.setResponseBody(failureReason);
                idempotencyRepository.saveAndFlush(record);
                log.warn("Idempotency record marked FAILED for key '{}': {}", idempotencyKey, failureReason);
            });
        });
    }

    public Optional<IdempotencyRecord> findRecord(String idempotencyKey) {
        return idempotencyRepository.findByIdempotencyKey(idempotencyKey);
    }

    private void verifyRequestHash(IdempotencyRecord record, String requestHash, String idempotencyKey) {
        if (!record.getRequestHash().equals(requestHash)) {
            log.warn("Idempotency conflict detected for key '{}'. Existing hash: {}, incoming hash: {}",
                    idempotencyKey, record.getRequestHash(), requestHash);
            throw new IdempotencyConflictException(
                    "Idempotency-Key '" + idempotencyKey + "' was already used with a different request payload."
            );
        }
    }
}
