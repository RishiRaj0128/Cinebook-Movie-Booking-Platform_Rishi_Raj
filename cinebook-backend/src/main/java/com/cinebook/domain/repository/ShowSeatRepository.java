package com.cinebook.domain.repository;

import com.cinebook.domain.entity.ShowSeat;
import com.cinebook.domain.enums.SeatStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ShowSeatRepository extends JpaRepository<ShowSeat, UUID> {

    /** Full seat map for a show, with seat details. */
    @Query("""
        SELECT ss FROM ShowSeat ss
        JOIN FETCH ss.seat s
        WHERE ss.show.id = :showId
        ORDER BY s.rowLabel ASC, s.seatNumber ASC
        """)
    List<ShowSeat> findByShowIdWithSeat(@Param("showId") UUID showId);

    /**
     * Acquire PESSIMISTIC_WRITE lock on target rows.
     * Equivalent to PostgreSQL SELECT ... FOR UPDATE.
     * Used by SeatLockService to prevent double-booking.
     * Uses 3000ms lock timeout to fail-fast rather than hanging indefinitely.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")})
    @Query("SELECT ss FROM ShowSeat ss WHERE ss.id IN :ids AND ss.show.id = :showId")
    List<ShowSeat> findByIdsWithLock(
        @Param("ids")    List<UUID> ids,
        @Param("showId") UUID showId
    );

    /** Bulk update: release expired locks back to AVAILABLE. */
    @Modifying
    @Query("""
        UPDATE ShowSeat ss
        SET ss.status = 'AVAILABLE', ss.lockedBy = NULL,
            ss.lockedAt = NULL, ss.lockExpiresAt = NULL
        WHERE ss.status = 'LOCKED' AND ss.lockExpiresAt < :now
        """)
    int releaseExpiredLocks(@Param("now") LocalDateTime now);

    List<ShowSeat> findByShowId(UUID showId);
}
