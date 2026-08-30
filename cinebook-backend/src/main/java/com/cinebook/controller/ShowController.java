package com.cinebook.controller;

import com.cinebook.domain.entity.Show;
import com.cinebook.domain.entity.ShowSeat;
import com.cinebook.domain.entity.User;
import com.cinebook.dto.request.HoldSeatsRequest;
import com.cinebook.dto.response.ApiResponse;
import com.cinebook.dto.response.HoldSeatsResponse;
import com.cinebook.service.SeatLockService;
import com.cinebook.service.ShowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/shows")
@RequiredArgsConstructor
public class ShowController {

    private final ShowService     showService;
    private final SeatLockService seatLockService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Show>>> getShows(
            @RequestParam UUID movieId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(showService.getShowsForMovieAndDate(movieId, date)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Show>> getShowById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(showService.getShowById(id)));
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<List<ShowSeat>>> getSeatMap(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(showService.getSeatMapForShow(id)));
    }

    @PostMapping("/hold-seats")
    public ResponseEntity<ApiResponse<HoldSeatsResponse>> holdSeats(
            @Valid @RequestBody HoldSeatsRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.ok(seatLockService.holdSeats(request, user.getId()), "Seats held successfully"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Show>> createShow(
            @RequestParam UUID movieId,
            @RequestParam UUID screenId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam Integer basePricePaise) {
        return ResponseEntity.ok(ApiResponse.ok(
                showService.createShow(movieId, screenId, startTime, basePricePaise),
                "Show and show seats generated successfully"
        ));
    }

    @PostMapping("/seed-upcoming")
    public ResponseEntity<ApiResponse<String>> seedUpcomingShows() {
        int count = showService.seedShowsForAllMovies(7);
        return ResponseEntity.ok(ApiResponse.ok("Successfully seeded " + count + " upcoming shows across theaters"));
    }

    @GetMapping("/seed-upcoming")
    public ResponseEntity<ApiResponse<String>> seedUpcomingShowsGet() {
        int count = showService.seedShowsForAllMovies(7);
        return ResponseEntity.ok(ApiResponse.ok("Successfully seeded " + count + " upcoming shows across theaters"));
    }
}
