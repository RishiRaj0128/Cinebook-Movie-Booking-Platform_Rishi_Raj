package com.cinebook.service;

import com.cinebook.domain.entity.*;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.repository.*;
import com.cinebook.exception.ResourceNotFoundException;
import com.cinebook.util.PricingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShowService {

    private final ShowRepository showRepository;
    private final MovieRepository movieRepository;
    private final ScreenRepository screenRepository;
    private final SeatRepository seatRepository;
    private final ShowSeatRepository showSeatRepository;
    private final PricingUtil pricingUtil;

    @Transactional
    public List<Show> getShowsForMovieAndDate(UUID movieId, LocalDate date) {
        LocalDateTime startOfDay = date.atStartOfDay();
        LocalDateTime endOfDay = date.atTime(LocalTime.MAX);
        List<Show> shows = showRepository.findShowsForMovie(movieId, startOfDay, endOfDay);
        if (shows.isEmpty()) {
            shows = generateShowsForMovieAndDate(movieId, date);
        }
        return shows;
    }

    @Transactional
    public List<Show> generateShowsForMovieAndDate(UUID movieId, LocalDate date) {
        Movie movie = movieRepository.findById(movieId).orElse(null);
        if (movie == null) return List.of();

        List<Screen> screens = screenRepository.findAll();
        if (screens.isEmpty()) return List.of();

        List<Show> createdShows = new ArrayList<>();
        int[] showTimesHours = {10, 14, 18, 21};
        int duration = (movie.getDurationMinutes() != null && movie.getDurationMinutes() > 0) ? movie.getDurationMinutes() : 120;

        for (Screen screen : screens) {
            for (int hour : showTimesHours) {
                LocalDateTime startTime = date.atTime(LocalTime.of(hour, (hour % 2 == 0 ? 0 : 30)));
                LocalDateTime endTime = startTime.plusMinutes(duration + 30);

                try {
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
                    createdShows.add(show);
                } catch (Exception e) {
                    // Ignore duplicate constraint or conflict
                }
            }
        }
        return createdShows;
    }

    public Show getShowById(UUID id) {
        return showRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Show not found"));
    }

    public List<ShowSeat> getSeatMapForShow(UUID showId) {
        return showSeatRepository.findByShowIdWithSeat(showId);
    }

    @Transactional
    public Show createShow(UUID movieId, UUID screenId, LocalDateTime startTime, Integer basePricePaise) {
        Movie movie = movieRepository.findById(movieId)
                .orElseThrow(() -> new ResourceNotFoundException("Movie not found"));
        Screen screen = screenRepository.findById(screenId)
                .orElseThrow(() -> new ResourceNotFoundException("Screen not found"));

        LocalDateTime endTime = startTime.plusMinutes(movie.getDurationMinutes() + 30); // 30 mins inter-show gap

        Show show = Show.builder()
                .movie(movie)
                .screen(screen)
                .startTime(startTime)
                .endTime(endTime)
                .basePrice(basePricePaise)
                .isActive(true)
                .build();

        Show savedShow = showRepository.save(show);

        // Instantiate ShowSeats for every physical seat in the screen
        List<Seat> physicalSeats = seatRepository.findByScreenIdOrderByRowLabelAscSeatNumberAsc(screenId);
        List<ShowSeat> showSeats = new ArrayList<>();

        for (Seat seat : physicalSeats) {
            int seatPrice = pricingUtil.calculateSeatPrice(basePricePaise, seat.getSeatType());
            showSeats.add(ShowSeat.builder()
                    .show(savedShow)
                    .seat(seat)
                    .price(seatPrice)
                    .status(SeatStatus.AVAILABLE)
                    .build());
        }

        showSeatRepository.saveAll(showSeats);
        return savedShow;
    }

    @Transactional
    public int seedShowsForAllMovies(int days) {
        List<Movie> movies = movieRepository.findAll();
        List<Screen> screens = screenRepository.findAll();
        if (movies.isEmpty() || screens.isEmpty()) return 0;

        int count = 0;
        LocalDate today = LocalDate.now();
        int[] showTimesHours = {10, 14, 18, 21};

        for (int dayOffset = 0; dayOffset < days; dayOffset++) {
            LocalDate date = today.plusDays(dayOffset);
            for (Screen screen : screens) {
                for (int mIdx = 0; mIdx < Math.min(movies.size(), showTimesHours.length); mIdx++) {
                    int movieIdx = Math.abs((screen.getId().hashCode() + mIdx) % movies.size());
                    Movie movie = movies.get(movieIdx);
                    int hour = showTimesHours[mIdx % showTimesHours.length];
                    LocalDateTime startTime = date.atTime(LocalTime.of(hour, 0));
                    LocalDateTime endTime = startTime.plusMinutes(150);

                    try {
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
                        count++;
                    } catch (Exception ignored) {}
                }
            }
        }
        return count;
    }
}
