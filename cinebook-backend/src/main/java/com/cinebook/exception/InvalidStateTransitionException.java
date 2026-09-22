package com.cinebook.exception;

import com.cinebook.domain.enums.TransactionState;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
public class InvalidStateTransitionException extends RuntimeException {
    public InvalidStateTransitionException(TransactionState from, TransactionState to) {
        super(String.format("Invalid transaction state transition: cannot move from [%s] to [%s]", from, to));
    }
}
