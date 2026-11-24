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
public class AiChatResponse {
    private UUID sessionId;
    private UUID messageId;
    private String role;
    private String content;
    private List<Map<String, Object>> toolCalls;
    private List<Map<String, Object>> recommendedMovies;
    private String createdAt;
}
