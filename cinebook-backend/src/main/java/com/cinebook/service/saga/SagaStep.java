package com.cinebook.service.saga;

import java.util.function.Consumer;

/**
 * Functional definition of a forward action and its reverse compensating action.
 */
public interface SagaStep<T> {

    String getName();

    void execute(T context);

    void compensate(T context);

    static <T> SagaStep<T> of(String name, Consumer<T> action, Consumer<T> compensation) {
        return new SagaStep<>() {
            @Override
            public String getName() {
                return name;
            }

            @Override
            public void execute(T context) {
                action.accept(context);
            }

            @Override
            public void compensate(T context) {
                compensation.accept(context);
            }
        };
    }
}
