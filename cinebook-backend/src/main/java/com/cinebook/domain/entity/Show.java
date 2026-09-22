package com.cinebook.domain.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/** A specific movie screening event: movie + screen + time + price. */
@Entity
@Table(name = "shows")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder @ToString
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Show {

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "movie_id", nullable = false)
    private Movie movie;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "screen_id", nullable = false)
    private Screen screen;

    @Column(nullable = false) private LocalDateTime startTime;
    @Column(nullable = false) private LocalDateTime endTime;

    /** Price in paise (1 INR = 100 paise). Multiplied by seat type. */
    @Column(nullable = false) private Integer basePrice;

    @Builder.Default private boolean isActive = true;

    @CreationTimestamp private LocalDateTime createdAt;
    @UpdateTimestamp  private LocalDateTime updatedAt;
}
