package com.cinebook.controller;

import com.cinebook.client.AiServiceClient;
import com.cinebook.dto.ai.*;
import com.cinebook.dto.response.ApiResponse;
import com.cinebook.service.RecommendationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiServiceClient aiServiceClient;
    private final RecommendationService legacyRecommendationService;

    /**
     * Backward-compatible recommendation endpoint for legacy frontend components.
     */
    @PostMapping("/recommend")
    public ResponseEntity<ApiResponse<String>> recommendMovies(@RequestParam String query) {
        return ResponseEntity.ok(ApiResponse.ok(legacyRecommendationService.recommendMovies(query)));
    }

    /**
     * Natural-language semantic and hybrid movie search.
     */
    @PostMapping("/search")
    public ResponseEntity<ApiResponse<AiSearchResponse>> searchMovies(@RequestBody AiSearchRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(aiServiceClient.searchSemantic(request)));
    }

    /**
     * Agentic conversational chat interface.
     */
    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @RequestBody AiChatRequest request,
            HttpServletRequest httpServletRequest) {

        String token = httpServletRequest.getHeader(HttpHeaders.AUTHORIZATION);
        return ResponseEntity.ok(ApiResponse.ok(aiServiceClient.sendChatMessage(request, token)));
    }

    /**
     * Personalized recommendations for user.
     */
    @GetMapping("/recommendations/{userId}")
    public ResponseEntity<ApiResponse<AiRecommendationResponse>> getRecommendations(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "5") int limit,
            HttpServletRequest httpServletRequest) {

        String token = httpServletRequest.getHeader(HttpHeaders.AUTHORIZATION);
        return ResponseEntity.ok(ApiResponse.ok(aiServiceClient.getRecommendations(userId, limit, token)));
    }
}
