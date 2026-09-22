package com.cinebook.domain.entity;

import com.cinebook.domain.enums.SeatStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * THE CONCURRENCY TABLE.
 * One row per physical seat per show. This is where seat locking happens.
 * Mutations only through SeatLockService with PESSIMISTIC_WRITE locks.
 */
@Entity
@Table(name = "show_seats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"show_id", "seat_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder @ToString
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ShowSeat {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "show_id", nullable = false)
    private Show show;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    /** Price in paise for this seat in this show (seat_type multiplier already applied). */
    @Column(nullable = false)
    private Integer price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SeatStatus status = SeatStatus.AVAILABLE;

    /** UUID of user who currently holds the lock. Null when AVAILABLE or BOOKED. */
    @Column(name = "locked_by")
    private UUID lockedBy;

    private LocalDateTime lockedAt;
    private LocalDateTime lockExpiresAt;

    @CreationTimestamp private LocalDateTime createdAt;
    @UpdateTimestamp  private LocalDateTime updatedAt;
}
