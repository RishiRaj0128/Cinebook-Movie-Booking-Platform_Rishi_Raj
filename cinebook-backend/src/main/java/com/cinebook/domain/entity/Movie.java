package com.cinebook.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Represents a movie in the catalog.
 * All TMDB metadata fields are optional (populated via TMDB import).
 */
@Entity
@Table(name = "movies")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder @ToString
public class Movie {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer durationMinutes;

    @Column(nullable = false)
    private String genre;

    @Column(nullable = false)
    @Builder.Default
    private String language = "English";

    private String posterUrl;
    private String backdropUrl;
    private String trailerUrl;

    @Column(precision = 3, scale = 1)
    private BigDecimal rating;

    private Integer voteCount;

    @Column(nullable = false)
    private LocalDate releaseDate;

    @Builder.Default
    private boolean isActive = true;

    private Integer tmdbId;
    private String  imdbId;

    @CreationTimestamp private LocalDateTime createdAt;
    @UpdateTimestamp  private LocalDateTime updatedAt;
}
