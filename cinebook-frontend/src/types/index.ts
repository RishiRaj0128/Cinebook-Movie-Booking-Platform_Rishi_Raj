export type UserRole = 'CUSTOMER' | 'ADMIN';
export type SeatType = 'REGULAR' | 'PREMIUM' | 'RECLINER';
export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED';
export type BookingStatus = 'CREATED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

// Deliberate type error for CI gate verification test
export const brokenTypeCheck: number = "this is definitely not a number";

export interface User {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  genre: string;
  language: string;
  posterUrl: string;
  backdropUrl?: string;
  trailerUrl?: string;
  rating?: number;
  releaseDate: string;
  isActive: boolean;
  tmdbId?: number;
}

export interface Theater {
  id: string;
  name: string;
  city: string;
  address: string;
}

export interface Screen {
  id: string;
  name: string;
  totalRows: number;
  totalColumns: number;
  theater?: Theater;
}

export interface Seat {
  id: string;
  rowLabel: string;
  seatNumber: number;
  seatType: SeatType;
}

export interface Show {
  id: string;
  movie: Movie;
  screen: Screen;
  startTime: string;
  endTime: string;
  basePrice: number; // in paise
  isActive: boolean;
}

export interface ShowSeat {
  id: string;
  showId: string;
  seat: Seat;
  price: number; // in paise
  status: SeatStatus;
  lockedBy?: string;
  lockExpiresAt?: string;
}

export interface BookingSeat {
  id: string;
  showSeat: ShowSeat;
}

export interface Booking {
  id: string;
  user: User;
  show: Show;
  status: BookingStatus;
  totalAmount: number; // in paise
  bookingSeats: BookingSeat[];
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  fullName?: string;
  role: UserRole;
}

export interface HoldSeatsResponse {
  success: boolean;
  lockedSeatIds: string[];
  expiresAt: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  bookingId: string;
}
