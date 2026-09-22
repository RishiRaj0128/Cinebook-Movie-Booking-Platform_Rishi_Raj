package com.cinebook.service.saga;

import java.io.Serializable;
import java.util.List;

public record SagaExecutionResult(
        boolean success,
        List<String> completedSteps,
        List<String> compensatedSteps,
        List<String> failedCompensations,
        String failureReason
) implements Serializable {

    public boolean hasCompensationFailures() {
        return failedCompensations != null && !failedCompensations.isEmpty();
    }
}
