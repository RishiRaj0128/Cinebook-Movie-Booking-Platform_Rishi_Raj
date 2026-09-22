package com.cinebook.domain.repository;

import com.cinebook.domain.entity.TransactionStateTransition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionStateTransitionRepository extends JpaRepository<TransactionStateTransition, UUID> {
    List<TransactionStateTransition> findByTransactionIdOrderByCreatedAtAsc(UUID transactionId);
}
