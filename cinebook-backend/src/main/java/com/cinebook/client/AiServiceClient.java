package com.cinebook.client;

import com.cinebook.domain.entity.Movie;
import com.cinebook.domain.repository.MovieRepository;
import com.cinebook.dto.ai.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Dedicated resilient client integrating Java Spring Boot with Python FastAPI AI microservice.
 * Enforces circuit protection, custom timeouts, and graceful local fallbacks.
 */
@Service
@Slf4j
public class AiServiceClient {

    private final RestClient restClient;
    private final MovieRepository movieRepository;
    private final String internalApiKey;

    public AiServiceClient(
            @Value("${cinebook.ai-service.url:http://localhost:8000}") String aiServiceUrl,
            @Value("${cinebook.ai-service.timeout-ms:8000}") int timeoutMs,
            @Value("${cinebook.ai-service.api-key:cinebook-internal-secret-key-change-in-production}") String internalApiKey,
            MovieRepository movieRepository) {

        this.movieRepository = movieRepository;
        this.internalApiKey = internalApiKey;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(aiServiceUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("X-API-Key", internalApiKey)
                .build();
    }

    public AiSearchResponse searchSemantic(AiSearchRequest request) {
        try {
            return restClient.post()
                    .uri("/api/v1/search/semantic")
                    .body(request)
                    .retrieve()
                    .body(AiSearchResponse.class);
        } catch (Exception e) {
            log.warn("AI service semantic search failed (degrading to local catalog lookup): {}", e.getMessage());
            return fallbackSearch(request);
        }
    }

    public AiChatResponse sendChatMessage(AiChatRequest request, String bearerToken) {
        try {
            var spec = restClient.post()
                    .uri("/api/v1/chat")
                    .body(request);
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec.header(HttpHeaders.AUTHORIZATION, bearerToken);
            }
            return spec.retrieve().body(AiChatResponse.class);
        } catch (Exception e) {
            log.warn("AI service chat failed (degrading to fallback concierge): {}", e.getMessage());
            return fallbackChat(request);
        }
    }

    public AiRecommendationResponse getRecommendations(UUID userId, int limit, String bearerToken) {
        try {
            var spec = restClient.get()
                    .uri("/api/v1/recommendations/{userId}?limit={limit}", userId, limit);
            if (bearerToken != null && !bearerToken.isBlank()) {
                spec.header(HttpHeaders.AUTHORIZATION, bearerToken);
            }
            return spec.retrieve().body(AiRecommendationResponse.class);
        } catch (Exception e) {
            log.warn("AI service recommendation failed (degrading to catalog top picks): {}", e.getMessage());
            return fallbackRecommendations(userId, limit);
        }
    }

    // --- Graceful Fallbacks ---
    private AiSearchResponse fallbackSearch(AiSearchRequest request) {
        List<Movie> active = movieRepository.findByIsActiveTrueOrderByReleaseDateDesc();
        String q = request.getQuery() != null ? request.getQuery().toLowerCase() : "";

        List<AiSearchResponse.SearchResultItem> matched = active.stream()
                .filter(m -> m.getTitle().toLowerCase().contains(q) || m.getGenre().toLowerCase().contains(q))
                .limit(request.getLimit())
                .map(m -> AiSearchResponse.SearchResultItem.builder()
                        .id(m.getId())
                        .title(m.getTitle())
                        .description(m.getDescription())
                        .genre(m.getGenre())
                        .language(m.getLanguage())
                        .rating(m.getRating() != null ? m.getRating().doubleValue() : null)
                        .posterUrl(m.getPosterUrl())
                        .releaseDate(m.getReleaseDate() != null ? m.getReleaseDate().toString() : "")
                        .similarityScore(0.5)
                        .retrievalMethod("fts_fallback")
                        .build())
                .collect(Collectors.toList());

        return AiSearchResponse.builder()
                .query(request.getQuery())
                .totalFound(matched.size())
                .results(matched)
                .executionTimeMs(1.0)
                .build();
    }

    private AiChatResponse fallbackChat(AiChatRequest request) {
        List<Movie> active = movieRepository.findByIsActiveTrueOrderByReleaseDateDesc();
        String topTitles = active.stream().limit(3).map(Movie::getTitle).collect(Collectors.joining(", "));

        return AiChatResponse.builder()
                .sessionId(request.getSessionId() != null ? request.getSessionId() : UUID.randomUUID())
                .messageId(UUID.randomUUID())
                .role("assistant")
                .content("I am currently operating in resilient offline mode. Based on our catalog, I recommend exploring top titles like " + topTitles + ".")
                .toolCalls(Collections.emptyList())
                .recommendedMovies(Collections.emptyList())
                .createdAt(java.time.Instant.now().toString())
                .build();
    }

    private AiRecommendationResponse fallbackRecommendations(UUID userId, int limit) {
        List<Movie> active = movieRepository.findByIsActiveTrueOrderByReleaseDateDesc();
        List<AiRecommendationResponse.RecommendationItem> items = active.stream()
                .limit(limit)
                .map(m -> AiRecommendationResponse.RecommendationItem.builder()
                        .movieId(m.getId())
                        .title(m.getTitle())
                        .genre(m.getGenre())
                        .language(m.getLanguage())
                        .rating(m.getRating() != null ? m.getRating().doubleValue() : null)
                        .posterUrl(m.getPosterUrl())
                        .backdropUrl(m.getBackdropUrl())
                        .rankingScore(0.85)
                        .recommendationReason("Top trending title in our active cinema catalog.")
                        .build())
                .collect(Collectors.toList());

        return AiRecommendationResponse.builder()
                .userId(userId)
                .recommendationEventId(UUID.randomUUID())
                .recommendations(items)
                .modelVersion("fallback-catalog-v1")
                .generatedAt(java.time.Instant.now().toString())
                .executionTimeMs(1.0)
                .build();
    }
}
