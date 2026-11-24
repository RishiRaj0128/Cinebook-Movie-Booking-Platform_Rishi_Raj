package com.cinebook.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiRecommendationResponse {
    private UUID userId;
    private UUID recommendationEventId;
    private List<RecommendationItem> recommendations;
    private String modelVersion;
    private String generatedAt;
    private Double executionTimeMs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendationItem {
        private UUID movieId;
        private String title;
        private String genre;
        private String language;
        private Double rating;
        private String posterUrl;
        private String backdropUrl;
        private Double rankingScore;
        private String recommendationReason;
        private Map<String, Double> scoreBreakdown;
    }
}
