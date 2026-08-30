package com.cinebook.config;

import com.cinebook.domain.entity.*;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.enums.SeatType;
import com.cinebook.domain.repository.*;
import com.cinebook.service.TmdbService;
import com.cinebook.util.PricingUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Auto-seeds realistic Theaters with full locations/addresses across major cities,
 * Auditoriums, Seats, and Showtimes for current & upcoming dates.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final MovieRepository     movieRepository;
    private final TheaterRepository   theaterRepository;
    private final ScreenRepository    screenRepository;
    private final SeatRepository      seatRepository;
    private final ShowRepository      showRepository;
    private final ShowSeatRepository  showSeatRepository;
    private final TmdbService         tmdbService;
    private final PricingUtil         pricingUtil;

    @Override
    public void run(String... args) throws Exception {
        boolean needsCatalog = (movieRepository.count() == 0 || theaterRepository.count() == 0);
        if (!needsCatalog) {
            log.info("CineBook catalog already initialized with {} movies across theaters. Checking upcoming shows...",
                    movieRepository.count());
        }

        // 1. Ensure theaters exist across all 18 major Indian cities
        List<String> targetCities = List.of(
            "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", 
            "Ahmedabad", "Jaipur", "Lucknow", "Kochi", "Chandigarh", "Indore", 
            "Visakhapatnam", "Surat", "Patna", "Bhubaneswar", "Guwahati"
        );
        Set<String> existingCities = theaterRepository.findAll().stream()
                .map(t -> t.getCity() != null ? t.getCity().toLowerCase().trim() : "")
                .collect(java.util.stream.Collectors.toSet());

        for (String c : targetCities) {
            if (!existingCities.contains(c.toLowerCase().trim())) {
                Theater t = theaterRepository.save(Theater.builder()
                        .name(c.equalsIgnoreCase("Mumbai") ? "PVR IMAX Director's Cut" :
                              c.equalsIgnoreCase("Delhi") ? "Cinepolis VIP Saket" :
                              c.equalsIgnoreCase("Bengaluru") ? "INOX Megaplex Mantri" :
                              "CineBook Multiplex " + c)
                        .city(c)
                        .address("Central Mall, City Center, " + c)
                        .build());
                Screen screen = screenRepository.save(Screen.builder()
                        .theater(t)
                        .name("IMAX Screen 1")
                        .totalRows(5)
                        .totalColumns(8)
                        .build());
                List<Seat> seats = new ArrayList<>();
                for (int r = 0; r < 5; r++) {
                    String rowLabel = String.valueOf((char) ('A' + r));
                    SeatType seatType = (r >= 3) ? SeatType.RECLINER : (r >= 2 ? SeatType.PREMIUM : SeatType.REGULAR);
                    for (int col = 1; col <= 8; col++) {
                        seats.add(Seat.builder().screen(screen).rowLabel(rowLabel).seatNumber(col).seatType(seatType).build());
                    }
                }
                seatRepository.saveAll(seats);
            }
        }

        // 2. Fetch & sync popular Indian & Global movies from TMDB API
        if (movieRepository.count() == 0) {
            log.info("Database empty: Syncing Indian (Bollywood/Tollywood/Kollywood) and Global movies from TMDB API...");
            try {
                // Import iconic blockbusters for Telugu, Tamil, Kannada, Malayalam, and Hindi
                List<Integer> indianTmdbIds = List.of(
                    579974,  // RRR (Telugu)
                    1013444, // Kalki 2898 AD (Telugu)
                    792307,  // Pushpa 2: The Rule (Telugu)
                    492207,  // Baahubali 2 (Telugu)
                    934632,  // Leo (Tamil)
                    934433,  // Jailer (Tamil)
                    856289,  // Ponniyin Selvan: Part II (Tamil)
                    736280,  // GOAT (Tamil)
                    587412,  // K.G.F: Chapter 2 (Kannada)
                    564147,  // K.G.F: Chapter 1 (Kannada)
                    858485,  // Kantara (Kannada)
                    634120,  // 777 Charlie (Kannada)
                    1069945, // Manjummel Boys (Malayalam)
                    1149791, // Premalu (Malayalam)
                    1166133, // Bramayugam (Malayalam)
                    472221,  // The Goat Life (Malayalam)
                    866398,  // Jawan (Hindi)
                    1159311, // Stree 2 (Hindi)
                    862552   // Pathaan (Hindi)
                );
                for (Integer id : indianTmdbIds) {
                    if (!movieRepository.existsByTmdbId(id)) {
                        try { tmdbService.importMovieFromTmdb(id); } catch (Exception e) { log.debug("Import TMDB error {}: {}", id, e.getMessage()); }
                    }
                }
                tmdbService.syncPopularMoviesFromTmdb(1);
            } catch (Exception e) {
                log.warn("TMDB sync failed during initialization (using fallback movies): {}", e.getMessage());
                seedFallbackMovies();
            }
        }

        // Normalize languages & set high quality working YouTube trailers for DB catalog
        List<Movie> allMovies = movieRepository.findAll();
        for (Movie m : allMovies) {
            String title = m.getTitle().toLowerCase();
            if (title.contains("kgf") || title.contains("k.g.f")) {
                if (!"Kannada".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Kannada");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=JKa05nyUmuQ");
                    movieRepository.save(m);
                }
            } else if (title.contains("rrr")) {
                if (!"Telugu".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Telugu");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=Gy4B78S1-dU");
                    movieRepository.save(m);
                }
            } else if (title.contains("jawan")) {
                if (!"Hindi".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Hindi");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=COv52Qyctws");
                    movieRepository.save(m);
                }
            } else if (title.contains("stree")) {
                if (!"Hindi".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Hindi");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=KVnheXwqF08");
                    movieRepository.save(m);
                }
            } else if (title.contains("pathaan")) {
                if (!"Hindi".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Hindi");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=vqu4z34wENw");
                    movieRepository.save(m);
                }
            } else if (title.contains("kalki")) {
                if (!"Telugu".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Telugu");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=kQDd1AhGIHk");
                    movieRepository.save(m);
                }
            } else if (title.contains("leo")) {
                if (!"Tamil".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Tamil");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=Po3jStA673E");
                    movieRepository.save(m);
                }
            } else if (title.contains("jailer")) {
                if (!"Tamil".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("Tamil");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=Y5BeWdODb7c");
                    movieRepository.save(m);
                }
            } else if (title.contains("inception")) {
                if (!"English".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("English");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=YoHD9XEInc0");
                    movieRepository.save(m);
                }
            } else if (title.contains("interstellar")) {
                if (!"English".equalsIgnoreCase(m.getLanguage())) {
                    m.setLanguage("English");
                    m.setTrailerUrl("https://www.youtube.com/watch?v=zSWdZVtXT7E");
                    movieRepository.save(m);
                }
            }
        }

        // 3. Ensure shows exist for today & next 5 days across all theaters
        seedMultiDateShows();

        log.info("CineBook catalog initialized with {} movies and {} active shows across theaters!",
                movieRepository.count(), showRepository.count());
    }

    private void seedMultiDateShows() {
        if (showRepository.findUpcomingShows(LocalDateTime.now()).size() >= 10) return;

        List<Movie> movies = movieRepository.findAll();
        List<Screen> screens = screenRepository.findAll();
        if (movies.isEmpty() || screens.isEmpty()) return;

        LocalDate today = LocalDate.now();
        int[] showTimesHours = {10, 14, 18, 21}; // 10:00 AM, 02:00 PM, 06:00 PM, 09:00 PM

        for (Screen screen : screens) {
            for (int dayOffset = 0; dayOffset < 7; dayOffset++) {
                LocalDate showDate = today.plusDays(dayOffset);

                for (int mIdx = 0; mIdx < Math.min(movies.size(), showTimesHours.length); mIdx++) {
                    int movieIdx = Math.abs((screen.getId().hashCode() + mIdx) % movies.size());
                    Movie movie = movies.get(movieIdx);

                    int hour = showTimesHours[mIdx % showTimesHours.length];
                    LocalDateTime startTime = showDate.atTime(LocalTime.of(hour, 0));
                    int duration = (movie.getDurationMinutes() != null && movie.getDurationMinutes() > 0) ? movie.getDurationMinutes() : 120;
                    LocalDateTime endTime = startTime.plusMinutes(duration + 30);

                    if (startTime.isBefore(LocalDateTime.now())) continue;

                    try {
                        Show show = showRepository.save(Show.builder()
                                .movie(movie)
                                .screen(screen)
                                .startTime(startTime)
                                .endTime(endTime)
                                .basePrice(25000) // ₹250
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
                    } catch (Exception e) {
                        log.debug("Skipped show creation: {}", e.getMessage());
                    }
                }
            }
        }
    }

    private void seedFallbackMovies() {
        if (movieRepository.count() > 0) return;

        List<Movie> fallback = List.of(
                Movie.builder().title("RRR").description("A fearless warrior on a perilous mission comes face to face with a steely cop in British India.").durationMinutes(187).genre("Action, Drama").language("Telugu").posterUrl("https://image.tmdb.org/t/p/w500/wE0ScH2ThxtRjXDsnz20xYIBTX0.jpg").backdropUrl("https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf52v9y2uEZjSt.jpg").rating(BigDecimal.valueOf(8.5)).voteCount(2800).releaseDate(LocalDate.of(2022, 3, 24)).isActive(true).tmdbId(579974).build(),
                Movie.builder().title("Jawan").description("A high-octane action thriller highlighting the emotional journey of a man driven to rectify the wrongs in society.").durationMinutes(169).genre("Action, Thriller").language("Hindi").posterUrl("https://image.tmdb.org/t/p/w500/l9lAfp0S6hH2s62P4dM9p1v4J8w.jpg").backdropUrl("https://image.tmdb.org/t/p/original/jzi6G137fM8c4XpG4nS2K4F3.jpg").rating(BigDecimal.valueOf(8.0)).voteCount(1500).releaseDate(LocalDate.of(2023, 9, 7)).isActive(true).tmdbId(866398).build(),
                Movie.builder().title("K.G.F: Chapter 2").description("In the blood-soaked Kolar Gold Fields, Rocky's name strikes fear into his foes.").durationMinutes(168).genre("Action, Crime, Thriller").language("Kannada").posterUrl("https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1wYh9iy5.jpg").rating(BigDecimal.valueOf(8.4)).voteCount(2100).releaseDate(LocalDate.of(2022, 4, 14)).isActive(true).tmdbId(586945).build(),
                Movie.builder().title("Inception").description("Dream sharing thief").durationMinutes(148).genre("Sci-Fi, Action").language("English").posterUrl("https://image.tmdb.org/t/p/w500/oYuLEW9W2vBBGLav2Z9N9yP9R1f.jpg").backdropUrl("https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAiE7.jpg").rating(BigDecimal.valueOf(8.8)).voteCount(35000).releaseDate(LocalDate.of(2010, 7, 16)).isActive(true).tmdbId(27205).build(),
                Movie.builder().title("Interstellar").description("Space exploration for human survival").durationMinutes(169).genre("Sci-Fi, Drama").language("English").posterUrl("https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg").backdropUrl("https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV2yab.jpg").rating(BigDecimal.valueOf(8.7)).voteCount(34000).releaseDate(LocalDate.of(2014, 11, 7)).isActive(true).tmdbId(157336).build()
        );

        movieRepository.saveAll(fallback);
    }
}
