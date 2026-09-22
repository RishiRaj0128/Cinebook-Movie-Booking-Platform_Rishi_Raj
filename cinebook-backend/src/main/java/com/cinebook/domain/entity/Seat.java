package com.cinebook.domain.entity;

import com.cinebook.domain.enums.SeatType;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Physical seat in a screen. Status lives on ShowSeat, not here.
 * seat_type determines the pricing multiplier.
 */
@Entity
@Table(name = "seats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"screen_id", "row_label", "seat_number"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder @ToString
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Seat {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "screen_id", nullable = false)
    private Screen screen;

    @Column(nullable = false) private String  rowLabel;
    @Column(nullable = false) private Integer seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private SeatType seatType = SeatType.REGULAR;

    @CreationTimestamp private LocalDateTime createdAt;
    @UpdateTimestamp  private LocalDateTime updatedAt;
}
