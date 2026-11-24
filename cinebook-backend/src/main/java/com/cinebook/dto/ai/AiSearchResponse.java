package com.cinebook.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSearchResponse {
    private String query;
    private int totalFound;
    private List<SearchResultItem> results;
    private Double executionTimeMs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SearchResultItem {
        private UUID id;
        private String title;
        private String description;
        private String genre;
        private String language;
        private Double rating;
        private String posterUrl;
        private String releaseDate;
        private Double similarityScore;
        private String retrievalMethod;
    }
}
