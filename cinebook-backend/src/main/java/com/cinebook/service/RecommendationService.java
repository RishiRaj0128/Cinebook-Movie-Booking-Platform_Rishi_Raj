package com.cinebook.service;

import com.cinebook.domain.entity.Movie;
import com.cinebook.domain.repository.MovieRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Spring AI Recommendation Service — AI movie recommendations based on user prompts.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendationService {

    private final ChatClient.Builder chatClientBuilder;
    private final MovieRepository   movieRepository;

    public String recommendMovies(String userPreference) {
        List<Movie> activeMovies = movieRepository.findByIsActiveTrueOrderByReleaseDateDesc();

        String catalogStr = activeMovies.stream()
                .map(m -> String.format("ID: %s, Title: %s, Genre: %s, Rating: %s, Language: %s",
                        m.getId(), m.getTitle(), m.getGenre(), m.getRating(), m.getLanguage()))
                .collect(Collectors.joining("\n"));

        String systemMessage = """
            You are CineBook AI — an intelligent movie concierge and entertainment planner.
            You have access to the current active movie catalog provided below.
            
            Capabilities:
            1. Movie Recommendation: If the user asks for movies (genre, mood, language), recommend up to 3 best matching titles from the catalog with concise, compelling reasons.
            2. Vibe & Outing / Date Night Itinerary: If the user asks for a date night, friend hangout, or day itinerary, curate a complete entertainment schedule:
               - Step 1: Pre-Show Dining (vibrant, thematic restaurant or bistro recommendation)
               - Step 2: Featured Movie & Showtime (select the ideal movie from the catalog, e.g. at 8:00 PM)
               - Step 3: Interval Snack Suggestion (e.g. gourmet truffle popcorn / queso nachos)
               - Step 4: Post-Movie Dessert / Late-Night Lounge (cozy cafe or cocktail spot to discuss the film)
            
            Keep the tone warm, modern, and exciting. Format with clean bullet points and clear emojis.
            """;

        String userPrompt = "Movie Catalog:\n" + catalogStr + "\n\nUser Preference: " + userPreference;

        try {
            return chatClientBuilder.build()
                    .prompt()
                    .system(systemMessage)
                    .user(userPrompt)
                    .call()
                    .content();
        } catch (Exception e) {
            log.warn("Spring AI call failed (falling back to simple recommendation): {}", e.getMessage());
            return "Based on your preference for '" + userPreference + "', we recommend checking out top rated movies like " +
                    activeMovies.stream().limit(3).map(Movie::getTitle).collect(Collectors.joining(", "));
        }
    }
}
