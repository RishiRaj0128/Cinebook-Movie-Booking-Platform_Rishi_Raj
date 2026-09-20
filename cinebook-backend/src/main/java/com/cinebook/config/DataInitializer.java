package com.cinebook.config;

import com.cinebook.domain.entity.*;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.enums.SeatType;
import com.cinebook.domain.enums.UserRole;
import com.cinebook.domain.repository.*;
import com.cinebook.service.TmdbService;
import com.cinebook.util.PricingUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final UserRepository      userRepository;
    private final PasswordEncoder     passwordEncoder;
    private final TmdbService         tmdbService;
    private final PricingUtil         pricingUtil;

    @Value("${tmdb.api-key:}")
    private String tmdbApiKey;

    @Override
    public void run(String... args) throws Exception {
        // 0. Ensure default users exist for seamless local testing
        if (userRepository.count() == 0) {
            userRepository.save(User.builder()
                    .email("admin@cinebook.com")
                    .password(passwordEncoder.encode("admin123"))
                    .fullName("CineBook Admin")
                    .phone("9876543210")
                    .role(UserRole.ADMIN)
                    .enabled(true)
                    .build());

            userRepository.save(User.builder()
                    .email("user@cinebook.com")
                    .password(passwordEncoder.encode("user123"))
                    .fullName("Demo User")
                    .phone("9876543211")
                    .role(UserRole.CUSTOMER)
                    .enabled(true)
                    .build());
            log.info("Initialized default users: admin@cinebook.com and user@cinebook.com");
        }

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

        // 2. Fetch & sync popular Indian & Global movies from TMDB API or Fallback
        if (movieRepository.count() == 0) {
            boolean hasValidTmdbKey = tmdbApiKey != null && !tmdbApiKey.isBlank() && !tmdbApiKey.contains("YOUR_TMDB_API_KEY");
            if (hasValidTmdbKey) {
                log.info("Valid TMDB API Key detected: Syncing movies from TMDB API...");
                try {
                    List<Integer> indianTmdbIds = List.of(
                        579974, 1013444, 792307, 492207, 934632, 934433, 856289, 736280,
                        587412, 564147, 858485, 634120, 1069945, 1149791, 1166133, 472221,
                        866398, 1159311, 862552
                    );
                    for (Integer id : indianTmdbIds) {
                        if (!movieRepository.existsByTmdbId(id)) {
                            try { tmdbService.importMovieFromTmdb(id); } catch (Exception e) { log.debug("Import TMDB error {}: {}", id, e.getMessage()); }
                        }
                    }
                    tmdbService.syncPopularMoviesFromTmdb(1);
                } catch (Exception e) {
                    log.warn("TMDB sync encountered error during initialization: {}", e.getMessage());
                }
            }

            if (movieRepository.count() == 0) {
                log.info("Seeding rich fallback movies catalog...");
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
                Movie.builder().title("RRR").description("A fearless warrior on a perilous mission comes face to face with a steely cop in British India in this epic tale of friendship, courage, and revolution.").durationMinutes(187).genre("Action, Drama").language("Telugu").posterUrl("https://image.tmdb.org/t/p/w500/wE0ScH2ThxtRjXDsnz20xYIBTX0.jpg").backdropUrl("https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf52v9y2uEZjSt.jpg").trailerUrl("https://www.youtube.com/watch?v=Gy4B78S1-dU").rating(BigDecimal.valueOf(8.8)).voteCount(2800).releaseDate(LocalDate.of(2022, 3, 24)).isActive(true).tmdbId(579974).build(),
                Movie.builder().title("Kalki 2898 AD").description("A modern avatar of Vishnu descends upon Earth to protect the world from evil forces in a dystopian future set in the sacred city of Kasi.").durationMinutes(181).genre("Sci-Fi, Action, Fantasy").language("Telugu").posterUrl("https://image.tmdb.org/t/p/w500/9XHgX5XEQt95nwZIlp2yiMaw65D.jpg").backdropUrl("https://image.tmdb.org/t/p/original/iZbZjYflt859q8hR7bsvApeDLr5.jpg").trailerUrl("https://www.youtube.com/watch?v=kQDd1AhGIHk").rating(BigDecimal.valueOf(8.6)).voteCount(1900).releaseDate(LocalDate.of(2024, 6, 27)).isActive(true).tmdbId(1013444).build(),
                Movie.builder().title("Jawan").description("A high-octane action thriller highlighting the emotional journey of a man driven to rectify the wrongs in society and fight systemic corruption.").durationMinutes(169).genre("Action, Thriller").language("Hindi").posterUrl("https://image.tmdb.org/t/p/w500/l9lAfp0S6hH2s62P4dM9p1v4J8w.jpg").backdropUrl("https://image.tmdb.org/t/p/original/jzi6G137fM8c4XpG4nS2K4F3.jpg").trailerUrl("https://www.youtube.com/watch?v=COv52Qyctws").rating(BigDecimal.valueOf(8.2)).voteCount(1500).releaseDate(LocalDate.of(2023, 9, 7)).isActive(true).tmdbId(866398).build(),
                Movie.builder().title("Stree 2: Sarkate Ka Aatank").description("The town of Chanderi is haunted by a terrifying new headless entity named Sarkata. The eccentric gang reassembles with Stree to protect the town.").durationMinutes(147).genre("Comedy, Horror").language("Hindi").posterUrl("https://image.tmdb.org/t/p/w500/f3yZZw7zIsWo6m9xJStfjDauIZX.jpg").backdropUrl("https://image.tmdb.org/t/p/original/ks72NqTPhpupk207NXiqmZIQQVI.jpg").trailerUrl("https://www.youtube.com/watch?v=KVnheXwqF08").rating(BigDecimal.valueOf(8.4)).voteCount(800).releaseDate(LocalDate.of(2024, 8, 15)).isActive(true).tmdbId(1159311).build(),
                Movie.builder().title("Spider-Man: Brand New Day").description("Peter Parker fights crime full-time in a world that no longer remembers him, confronting a sinister new syndicate threatening New York City.").durationMinutes(145).genre("Action, Adventure, Sci-Fi").language("English").posterUrl("https://image.tmdb.org/t/p/w500/6Q21yptoOCUq4ErwVncesLPVplb.jpg").backdropUrl("https://image.tmdb.org/t/p/original/kbvNLChuMl2nyAzPZvqkD8hZGZn.jpg").trailerUrl("https://www.youtube.com/watch?v=P3uI5sLosKU").rating(BigDecimal.valueOf(9.1)).voteCount(4200).releaseDate(LocalDate.of(2026, 7, 28)).isActive(true).tmdbId(969681).build(),
                Movie.builder().title("Leo").description("A mild-mannered cafe owner in Himachal Pradesh becomes a target of ruthless drug cartels who suspect him of being a legendary former gangster.").durationMinutes(164).genre("Action, Thriller, Crime").language("Tamil").posterUrl("https://image.tmdb.org/t/p/w500/5JykVg5yWm5QiFyeEBq3diDmI5.jpg").backdropUrl("https://image.tmdb.org/t/p/original/simwM18UKG0DSZXvzdKYM6ihUch.jpg").trailerUrl("https://www.youtube.com/watch?v=Po3jStA673E").rating(BigDecimal.valueOf(8.0)).voteCount(1100).releaseDate(LocalDate.of(2023, 10, 19)).isActive(true).tmdbId(934632).build(),
                Movie.builder().title("Jailer").description("A retired prison officer embarks on a merciless manhunt when his honest police inspector son goes missing after probing an antique smuggling syndicate.").durationMinutes(168).genre("Action, Crime, Thriller").language("Tamil").posterUrl("https://image.tmdb.org/t/p/w500/jt8pfSIdi47YpFMMWVRr8w5u2S0.jpg").backdropUrl("https://image.tmdb.org/t/p/original/v3lNH2gCojWYXVuXcT9FZLBxcSq.jpg").trailerUrl("https://www.youtube.com/watch?v=Y5BeWdODb7c").rating(BigDecimal.valueOf(8.1)).voteCount(950).releaseDate(LocalDate.of(2023, 8, 10)).isActive(true).tmdbId(934433).build(),
                Movie.builder().title("Inception").description("A skilled thief who steals corporate secrets through dream-sharing technology is offered a chance to have his criminal history erased if he can plant an idea.").durationMinutes(148).genre("Sci-Fi, Action, Thriller").language("English").posterUrl("https://image.tmdb.org/t/p/w500/oYuLEW9W2vBBGLav2Z9N9yP9R1f.jpg").backdropUrl("https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAiE7.jpg").trailerUrl("https://www.youtube.com/watch?v=YoHD9XEInc0").rating(BigDecimal.valueOf(8.8)).voteCount(35000).releaseDate(LocalDate.of(2010, 7, 16)).isActive(true).tmdbId(27205).build(),
                Movie.builder().title("Interstellar").description("When Earth becomes uninhabitable, a team of ex-NASA astronauts embarks on a voyage through a wormhole near Saturn in search of a new home for mankind.").durationMinutes(169).genre("Sci-Fi, Drama, Adventure").language("English").posterUrl("https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg").backdropUrl("https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV2yab.jpg").trailerUrl("https://www.youtube.com/watch?v=zSWdZVtXT7E").rating(BigDecimal.valueOf(8.7)).voteCount(34000).releaseDate(LocalDate.of(2014, 11, 7)).isActive(true).tmdbId(157336).build(),
                Movie.builder().title("Pushpa 2: The Rule").description("Pushpa Raj cements his rule over the red sandalwood smuggling empire while confronting ferocious challenges from law enforcement and rival syndicates.").durationMinutes(180).genre("Action, Crime, Thriller").language("Telugu").posterUrl("https://image.tmdb.org/t/p/w500/xWHolsIDUSvWngeFfeZi52A7W7P.jpg").backdropUrl("https://image.tmdb.org/t/p/original/z1Es5M643hfdW0tIJbdqnSS6rv2.jpg").trailerUrl("https://www.youtube.com/watch?v=Gy4B78S1-dU").rating(BigDecimal.valueOf(8.5)).voteCount(2400).releaseDate(LocalDate.of(2024, 12, 5)).isActive(true).tmdbId(792307).build(),
                Movie.builder().title("K.G.F: Chapter 2").description("In the blood-soaked Kolar Gold Fields, Rocky's name strikes fear into his foes.").durationMinutes(168).genre("Action, Crime, Thriller").language("Kannada").posterUrl("https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1wYh9iy5.jpg").backdropUrl("https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf52v9y2uEZjSt.jpg").trailerUrl("https://www.youtube.com/watch?v=JKa05nyUmuQ").rating(BigDecimal.valueOf(8.4)).voteCount(2100).releaseDate(LocalDate.of(2022, 4, 14)).isActive(true).tmdbId(587412).build()
        );

        movieRepository.saveAll(fallback);
    }
}
