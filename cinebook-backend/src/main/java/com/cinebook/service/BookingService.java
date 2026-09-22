package com.cinebook.service;

import com.cinebook.domain.entity.*;
import com.cinebook.domain.enums.BookingStatus;
import com.cinebook.domain.enums.SeatStatus;
import com.cinebook.domain.repository.*;
import com.cinebook.dto.request.CreateBookingRequest;
import com.cinebook.exception.BadRequestException;
import com.cinebook.exception.ResourceNotFoundException;
import com.cinebook.exception.SeatsUnavailableException;
import com.cinebook.util.PricingUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ShowRepository showRepository;
    private final ShowSeatRepository showSeatRepository;
    private final UserRepository userRepository;
    private final PricingUtil pricingUtil;

    @Transactional
    public Booking createBooking(CreateBookingRequest request, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Show show = showRepository.findById(request.getShowId())
                .orElseThrow(() -> new ResourceNotFoundException("Show not found"));

        List<ShowSeat> showSeats = showSeatRepository.findByIdsWithLock(request.getShowSeatIds(), request.getShowId());

        if (showSeats.size() < request.getShowSeatIds().size()) {
            throw new BadRequestException("Invalid show seats specified");
        }

        LocalDateTime now = LocalDateTime.now();

        // Verify all seats are still locked by THIS user and not expired
        for (ShowSeat ss : showSeats) {
            if (ss.getStatus() != SeatStatus.LOCKED ||
                !userId.equals(ss.getLockedBy()) ||
                (ss.getLockExpiresAt() != null && ss.getLockExpiresAt().isBefore(now))) {
                throw new SeatsUnavailableException("Your seat hold has expired. Please select seats again.");
            }
        }

        int subtotalPaise = showSeats.stream().mapToInt(ShowSeat::getPrice).sum();
        int totalAmountPaise = pricingUtil.calculateTotalAmount(subtotalPaise);

        Booking booking = Booking.builder()
                .user(user)
                .show(show)
                .status(BookingStatus.CREATED)
                .totalAmount(totalAmountPaise)
                .build();

        List<BookingSeat> bookingSeats = new ArrayList<>();
        for (ShowSeat ss : showSeats) {
            bookingSeats.add(BookingSeat.builder()
                    .booking(booking)
                    .showSeat(ss)
                    .build());
        }

        booking.setBookingSeats(bookingSeats);
        return bookingRepository.save(booking);
    }

    @Transactional
    public Booking confirmBooking(UUID bookingId, UUID userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BadRequestException("Unauthorized booking confirmation");
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return booking; // Idempotent success
        }

        if (booking.getStatus() != BookingStatus.CREATED) {
            throw new BadRequestException("Booking is in invalid state: " + booking.getStatus());
        }

        List<BookingSeat> bookingSeats = booking.getBookingSeats();

        for (BookingSeat bs : bookingSeats) {
            ShowSeat ss = bs.getShowSeat();
            ss.setStatus(SeatStatus.BOOKED);
            ss.setLockedBy(null);
            ss.setLockedAt(null);
            ss.setLockExpiresAt(null);
            showSeatRepository.save(ss);
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        return bookingRepository.save(booking);
    }

    @Transactional
    public void cancelBooking(UUID bookingId, UUID userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getUser().getId().equals(userId)) {
            throw new BadRequestException("Unauthorized access to booking");
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            throw new BadRequestException("Cannot cancel a confirmed booking directly");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.EXPIRED) {
            return;
        }

        // Release seats back to AVAILABLE
        for (BookingSeat bs : booking.getBookingSeats()) {
            ShowSeat ss = bs.getShowSeat();
            if (userId.equals(ss.getLockedBy())) {
                ss.setStatus(SeatStatus.AVAILABLE);
                ss.setLockedBy(null);
                ss.setLockedAt(null);
                ss.setLockExpiresAt(null);
                showSeatRepository.save(ss);
            }
        }

        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(booking);
    }

    public List<Booking> getUserBookings(UUID userId) {
        return bookingRepository.findByUserIdWithDetails(userId);
    }

    public Booking getBookingById(UUID bookingId, UUID userId) {
        return bookingRepository.findByIdAndUserIdWithDetails(bookingId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }

    public Booking getPublicBooking(UUID bookingId) {
        return bookingRepository.findByIdWithDetails(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
    }
}
