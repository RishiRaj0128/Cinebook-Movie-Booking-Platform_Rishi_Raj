package com.cinebook.service;

import com.cinebook.domain.entity.*;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.enums.SeatType;
import com.cinebook.domain.repository.*;
import com.cinebook.exception.BadRequestException;
import com.cinebook.util.PricingUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TmdbService {

    private final MovieRepository     movieRepository;
    private final TheaterRepository   theaterRepository;
    private final ScreenRepository    screenRepository;
    private final SeatRepository      seatRepository;
    private final ShowRepository      showRepository;
    private final ShowSeatRepository  showSeatRepository;
    private final PricingUtil         pricingUtil;

    @Value("${tmdb.api-key}")
    private String apiKey;

    @Value("${tmdb.base-url}")
    private String baseUrl;

    @Value("${tmdb.image-base}")
    private String imageBase;

    public String searchMoviesFromTmdb(String query) {
        WebClient client = WebClient.create(baseUrl);
        return client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search/movie")
                        .queryParam("api_key", apiKey)
                        .queryParam("query", query)
                        .build())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    @org.springframework.cache.annotation.CacheEvict(value = "movies", allEntries = true)
    public List<Movie> syncPopularMoviesFromTmdb(int maxPages) {
        List<Movie> importedMovies = new ArrayList<>();
        WebClient client = WebClient.create(baseUrl);

        int pagesToFetch = Math.max(1, maxPages);
        List<String> baseEndpoints = List.of(
            "/movie/popular?api_key=" + apiKey,
            "/discover/movie?api_key=" + apiKey + "&region=IN&with_original_language=hi&sort_by=popularity.desc",
            "/discover/movie?api_key=" + apiKey + "&region=IN&with_original_language=te&sort_by=popularity.desc",
            "/discover/movie?api_key=" + apiKey + "&region=IN&with_original_language=ta&sort_by=popularity.desc",
            "/discover/movie?api_key=" + apiKey + "&region=IN&with_original_language=kn&sort_by=popularity.desc",
            "/discover/movie?api_key=" + apiKey + "&region=IN&with_original_language=ml&sort_by=popularity.desc",
            "/discover/movie?api_key=" + apiKey + "&region=IN&sort_by=popularity.desc"
        );

        for (int page = 1; page <= pagesToFetch; page++) {
            for (String baseEndpoint : baseEndpoints) {
                String endpoint = baseEndpoint + "&page=" + page;
                try {
                    String jsonStr = client.get()
                            .uri(endpoint)
                            .retrieve()
                            .bodyToMono(String.class)
                            .block();

                    JSONObject json = new JSONObject(jsonStr);
                    JSONArray results = json.optJSONArray("results");
                    if (results == null) continue;

                    for (int i = 0; i < results.length(); i++) {
                        JSONObject m = results.getJSONObject(i);
                        int tmdbId = m.getInt("id");

                        try {
                            Movie movie = importMovieFromTmdb(tmdbId);
                            if (movie != null) {
                                importedMovies.add(movie);
                            }
                        } catch (Exception e) {
                            log.debug("Skipped TMDB movie ID {}: {}", tmdbId, e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to fetch TMDB endpoint {}: {}", endpoint, e.getMessage());
                }
            }
        }
        log.info("Bulk TMDB Sync completed. Total movies imported: {}", importedMovies.size());
        return importedMovies;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Movie importMovieFromTmdb(Integer tmdbId) {
        WebClient client = WebClient.create(baseUrl);
        String jsonStr = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/movie/" + tmdbId)
                        .queryParam("api_key", apiKey)
                        .queryParam("append_to_response", "videos")
                        .build())
                .retrieve()
                .bodyToMono(String.class)
                .block();

        JSONObject json = new JSONObject(jsonStr);

        String title = json.getString("title");
        String overview = json.optString("overview", "No description available.");
        int runtime = json.optInt("runtime", 120);
        String posterPath = json.optString("poster_path", null);
        String backdropPath = json.optString("backdrop_path", null);
        double voteAverage = json.optDouble("vote_average", 7.0);
        int voteCount = json.optInt("vote_count", 0);
        String releaseDateStr = json.optString("release_date", LocalDate.now().toString());
        if (releaseDateStr.isBlank()) releaseDateStr = LocalDate.now().toString();

        String origLangCode = json.optString("original_language", "en");
        String language = switch (origLangCode.toLowerCase()) {
            case "hi" -> "Hindi";
            case "te" -> "Telugu";
            case "ta" -> "Tamil";
            case "kn" -> "Kannada";
            case "ml" -> "Malayalam";
            case "bn" -> "Bengali";
            case "mr" -> "Marathi";
            case "ja" -> "Japanese";
            case "ko" -> "Korean";
            case "es" -> "Spanish";
            case "fr" -> "French";
            default -> "English";
        };

        JSONArray genresArr = json.optJSONArray("genres");
        List<String> genreList = new ArrayList<>();
        if (genresArr != null) {
            for (int i = 0; i < genresArr.length(); i++) {
                genreList.add(genresArr.getJSONObject(i).optString("name"));
            }
        }
        String genre = genreList.isEmpty() ? "Drama" : String.join(", ", genreList);

        String trailerUrl = null;
        JSONObject videos = json.optJSONObject("videos");
        if (videos != null) {
            JSONArray results = videos.optJSONArray("results");
            if (results != null && results.length() > 0) {
                // First pass: look for official "Trailer"
                for (int i = 0; i < results.length(); i++) {
                    JSONObject v = results.getJSONObject(i);
                    if ("YouTube".equalsIgnoreCase(v.optString("site")) && "Trailer".equalsIgnoreCase(v.optString("type"))) {
                        trailerUrl = "https://www.youtube.com/watch?v=" + v.optString("key");
                        break;
                    }
                }
                // Second pass: fallback to "Teaser", "Clip", or any YouTube video
                if (trailerUrl == null) {
                    for (int i = 0; i < results.length(); i++) {
                        JSONObject v = results.getJSONObject(i);
                        if ("YouTube".equalsIgnoreCase(v.optString("site")) && v.has("key") && !v.optString("key").isBlank()) {
                            trailerUrl = "https://www.youtube.com/watch?v=" + v.optString("key");
                            break;
                        }
                    }
                }
            }
        }

        Movie movie = movieRepository.findByTmdbId(tmdbId).orElse(null);
        if (movie != null) {
            movie.setLanguage(language);
            movie.setGenre(genre);
            if (trailerUrl != null) movie.setTrailerUrl(trailerUrl);
            if (posterPath != null) movie.setPosterUrl(imageBase + "/w500" + posterPath);
            if (backdropPath != null) movie.setBackdropUrl(imageBase + "/original" + backdropPath);
            movie.setRating(BigDecimal.valueOf(voteAverage));
            return movieRepository.save(movie);
        }

        movie = Movie.builder()
                .title(title)
                .description(overview)
                .durationMinutes(runtime > 0 ? runtime : 120)
                .genre(genre)
                .language(language)
                .posterUrl(posterPath != null ? imageBase + "/w500" + posterPath : null)
                .backdropUrl(backdropPath != null ? imageBase + "/original" + backdropPath : null)
                .trailerUrl(trailerUrl)
                .rating(BigDecimal.valueOf(voteAverage))
                .voteCount(voteCount)
                .releaseDate(LocalDate.parse(releaseDateStr))
                .isActive(true)
                .tmdbId(tmdbId)
                .imdbId(json.optString("imdb_id", null))
                .build();

        Movie savedMovie = movieRepository.save(movie);
        createDefaultShowsForMovie(savedMovie);
        return savedMovie;
    }

    private void createDefaultShowsForMovie(Movie movie) {
        List<Screen> screens = screenRepository.findAll();
        if (screens.isEmpty()) return;

        Screen screen = screens.get(0);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startTime = now.plusHours(2);
        int duration = (movie.getDurationMinutes() != null && movie.getDurationMinutes() > 0) ? movie.getDurationMinutes() : 120;
        LocalDateTime endTime = startTime.plusMinutes(duration + 30);

        Show show = showRepository.save(Show.builder()
                .movie(movie)
                .screen(screen)
                .startTime(startTime)
                .endTime(endTime)
                .basePrice(25000)
                .isActive(true)
                .build());

        List<Seat> physicalSeats = seatRepository.findByScreenIdOrderByRowLabelAscSeatNumberAsc(screen.getId());
        List<ShowSeat> showSeats = new ArrayList<>();
        for (Seat seat : physicalSeats) {
            int seatPrice = pricingUtil.calculateSeatPrice(25000, seat.getSeatType());
            showSeats.add(ShowSeat.builder()
                    .show(show)
                    .seat(seat)
                    .price(seatPrice)
                    .status(SeatStatus.AVAILABLE)
                    .build());
        }
        showSeatRepository.saveAll(showSeats);
    }
}
