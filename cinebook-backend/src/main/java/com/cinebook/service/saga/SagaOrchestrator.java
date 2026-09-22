package com.cinebook.service.saga;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Enterprise Saga Orchestrator executing forward actions and compensating actions in reverse order.
 * If any compensation throws, logs a CRITICAL alert and registers the failure for the reconciliation sweep.
 */
@Component
@Slf4j
public class SagaOrchestrator {

    public <T> SagaExecutionResult execute(String sagaName, T context, List<SagaStep<T>> steps) {
        log.info("Starting saga: '{}' with {} steps", sagaName, steps.size());

        Deque<SagaStep<T>> executedSteps = new ArrayDeque<>();
        List<String> completedStepNames = new ArrayList<>();
        List<String> compensatedStepNames = new ArrayList<>();
        List<String> failedCompensationNames = new ArrayList<>();

        for (SagaStep<T> step : steps) {
            try {
                log.debug("Saga '{}': executing step '{}'", sagaName, step.getName());
                step.execute(context);
                executedSteps.push(step);
                completedStepNames.add(step.getName());
            } catch (Exception e) {
                log.warn("Saga '{}' failed at step '{}': {}. Initiating reverse compensation...",
                        sagaName, step.getName(), e.getMessage());

                // Execute reverse compensation for all previously completed steps
                while (!executedSteps.isEmpty()) {
                    SagaStep<T> compStep = executedSteps.pop();
                    try {
                        log.info("Saga '{}': compensating step '{}'", sagaName, compStep.getName());
                        compStep.compensate(context);
                        compensatedStepNames.add(compStep.getName());
                    } catch (Exception compEx) {
                        // CRITICAL: Compensation failure!
                        log.error("CRITICAL SAGA ALERT: Compensation failed for step '{}' in saga '{}'! Error: {}. Queuing for reconciliation sweep.",
                                compStep.getName(), sagaName, compEx.getMessage(), compEx);
                        failedCompensationNames.add(compStep.getName() + " [Error: " + compEx.getMessage() + "]");
                    }
                }

                return new SagaExecutionResult(
                        false,
                        completedStepNames,
                        compensatedStepNames,
                        failedCompensationNames,
                        e.getMessage()
                );
            }
        }

        log.info("Saga '{}' completed successfully across all {} steps", sagaName, steps.size());
        return new SagaExecutionResult(
                true,
                completedStepNames,
                compensatedStepNames,
                failedCompensationNames,
                null
        );
    }
}
