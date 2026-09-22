package com.cinebook.service.statemachine;

import com.cinebook.domain.entity.PaymentTransaction;
import com.cinebook.domain.entity.TransactionStateTransition;
import com.cinebook.domain.enums.TransactionState;
import com.cinebook.domain.repository.PaymentTransactionRepository;
import com.cinebook.domain.repository.TransactionStateTransitionRepository;
import com.cinebook.exception.InvalidStateTransitionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * Strict finite state machine governing all financial transaction status transitions.
 * Enforces valid lifecycles and records an immutable audit log for every change.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TransactionStateMachine {

    private final PaymentTransactionRepository transactionRepository;
    private final TransactionStateTransitionRepository transitionRepository;

    private static final Map<TransactionState, Set<TransactionState>> VALID_TRANSITIONS;

    static {
        Map<TransactionState, Set<TransactionState>> map = new EnumMap<>(TransactionState.class);

        map.put(TransactionState.CREATED, Set.of(
                TransactionState.PROCESSING,
                TransactionState.FAILED
        ));

        map.put(TransactionState.PROCESSING, Set.of(
                TransactionState.AUTHORIZED,
                TransactionState.CAPTURED,
                TransactionState.FAILED
        ));

        map.put(TransactionState.AUTHORIZED, Set.of(
                TransactionState.CAPTURED,
                TransactionState.FAILED,
                TransactionState.REFUNDED
        ));

        map.put(TransactionState.CAPTURED, Set.of(
                TransactionState.SETTLED,
                TransactionState.REFUNDED,
                TransactionState.PARTIALLY_REFUNDED
        ));

        map.put(TransactionState.SETTLED, Set.of(
                TransactionState.REFUNDED,
                TransactionState.PARTIALLY_REFUNDED
        ));

        map.put(TransactionState.FAILED, Collections.emptySet());
        map.put(TransactionState.REFUNDED, Collections.emptySet());
        map.put(TransactionState.PARTIALLY_REFUNDED, Set.of(
                TransactionState.PARTIALLY_REFUNDED,
                TransactionState.REFUNDED
        ));

        VALID_TRANSITIONS = Collections.unmodifiableMap(map);
    }

    public boolean canTransition(TransactionState from, TransactionState to) {
        if (from == null || to == null) return false;
        if (from == to) return true; // Idempotent same-state check
        Set<TransactionState> allowed = VALID_TRANSITIONS.getOrDefault(from, Collections.emptySet());
        return allowed.contains(to);
    }

    /**
     * Atomically moves a transaction to a new state and logs the transition.
     */
    @Transactional
    public PaymentTransaction transition(
            PaymentTransaction transaction,
            TransactionState toState,
            String triggerEvent,
            String metadata
    ) {
        TransactionState fromState = transaction.getState();

        if (fromState == toState) {
            log.debug("Transaction {} is already in state {}. Skipping transition.", transaction.getId(), toState);
            return transaction;
        }

        if (!canTransition(fromState, toState)) {
            log.error("Rejected illegal state transition for transaction {}: {} -> {}",
                    transaction.getId(), fromState, toState);
            throw new InvalidStateTransitionException(fromState, toState);
        }

        transaction.setState(toState);
        PaymentTransaction updated = transactionRepository.save(transaction);

        TransactionStateTransition transitionLog = TransactionStateTransition.builder()
                .transaction(updated)
                .fromState(fromState)
                .toState(toState)
                .triggerEvent(triggerEvent)
                .metadata(metadata)
                .build();
        transitionRepository.save(transitionLog);

        log.info("Transaction {} transitioned: {} -> {} [event='{}']",
                transaction.getId(), fromState, toState, triggerEvent);

        return updated;
    }
}
