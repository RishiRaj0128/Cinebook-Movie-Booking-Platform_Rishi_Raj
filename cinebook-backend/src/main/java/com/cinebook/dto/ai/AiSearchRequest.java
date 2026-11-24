package com.cinebook.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSearchRequest {
    private String query;
    private String genre;
    private String language;
    private Float minRating;
    @Builder.Default
    private int limit = 10;
    @Builder.Default
    private boolean hybrid = true;
}
