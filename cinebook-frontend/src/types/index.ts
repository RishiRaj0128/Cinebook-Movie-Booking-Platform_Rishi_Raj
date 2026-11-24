export type UserRole = 'CUSTOMER' | 'ADMIN';
export type SeatType = 'REGULAR' | 'PREMIUM' | 'RECLINER';
export type SeatStatus = 'AVAILABLE' | 'LOCKED' | 'BOOKED';
export type BookingStatus = 'CREATED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

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

// Snack & Concession types for Interval Express
export interface SnackItem {
  id: string;
  name: string;
  category: 'Popcorn' | 'Combos' | 'Beverages' | 'Bites' | 'Dessert';
  pricePaise: number;
  description: string;
  imageUrl: string;
  isVeg: boolean;
}

export interface SnackOrderItem {
  snack: SnackItem;
  quantity: number;
}

// Sightline Simulator types
export interface SeatSightlineInfo {
  rowLabel: string;
  seatNumber: number;
  distanceMeters: number;
  verticalNeckAngleDeg: number;
  horizontalFovDeg: number;
  audioSweetSpotPercent: number;
  verdict: 'SWEET_SPOT' | 'ULTRA_IMMERSIVE' | 'PANORAMIC' | 'SIDE_ANGLE';
  verdictDescription: string;
}

// Group Booking & Split types
export interface GroupMemberSeat {
  seatId: string;
  seatLabel: string;
  pricePaise: number;
  claimedBy?: string;
  claimedEmail?: string;
  isPaid: boolean;
  paidAt?: string;
}

export interface GroupBookingSession {
  groupId: string;
  show: Show;
  organizerName: string;
  organizerEmail: string;
  seats: GroupMemberSeat[];
  expiresAt: number; // timestamp
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
  createdAt: number;
}

// Fair Exchange Resale & Waitlist types
export interface ResaleListing {
  id: string;
  originalBookingId: string;
  movieTitle: string;
  theaterName: string;
  screenName: string;
  city: string;
  showTime: string;
  seats: string[];
  faceValuePaise: number;
  sellerName: string;
  sellerEmail: string;
  listedAt: string;
  status: 'AVAILABLE' | 'SOLD' | 'CANCELLED';
  posterUrl: string;
}

export interface WaitlistEntry {
  id: string;
  movieTitle: string;
  cityName: string;
  userEmail: string;
  userPhone?: string;
  createdAt: string;
}


// ===== CineBook Agentic AI Platform Types =====
export interface AiSearchResultItem {
  id: string;
  title: string;
  description?: string;
  genre: string;
  language: string;
  rating?: number;
  posterUrl?: string;
  releaseDate?: string;
  similarityScore: number;
  retrievalMethod: 'vector' | 'fts' | 'hybrid' | 'fts_fallback';
}

export interface AiSearchResponse {
  query: string;
  totalFound: number;
  results: AiSearchResultItem[];
  executionTimeMs: number;
}

export interface AiToolExecution {
  toolName: string;
  arguments: Record<string, any>;
  status: string;
  durationMs: number;
}

export interface AiChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: AiToolExecution[];
  recommendedMovies?: any[];
  createdAt?: string;
  timestamp?: string;
}

export interface AiChatResponse {
  sessionId: string;
  messageId: string;
  role: string;
  content: string;
  toolCalls: AiToolExecution[];
  recommendedMovies: any[];
  createdAt: string;
}

export interface AiRecommendationItem {
  movieId: string;
  title: string;
  genre: string;
  language: string;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  rankingScore: number;
  recommendationReason: string;
  scoreBreakdown?: Record<string, number>;
}

export interface AiRecommendationResponse {
  userId?: string;
  recommendationEventId: string;
  recommendations: AiRecommendationItem[];
  modelVersion: string;
  generatedAt: string;
  executionTimeMs: number;
}
