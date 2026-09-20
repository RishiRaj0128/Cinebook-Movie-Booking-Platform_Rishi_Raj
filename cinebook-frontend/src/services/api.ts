import { AuthResponse, Booking, HoldSeatsResponse, Movie, PaymentOrderResponse, Show, ShowSeat, Theater } from '../types';
import { FALLBACK_MOVIES } from './fallbackMovies';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://cinebook-api-6cw7.onrender.com/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers as unknown as HeadersInit;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any = {};

  if (text && text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server response error (${res.status}): ${text.substring(0, 150)}`);
    }
  }

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw new Error(json.message || json.error || 'Authentication required or session expired. Please sign in again.');
  }

  if (!res.ok || (json && json.success === false)) {
    throw new Error(json.message || json.error || `API Request failed with status ${res.status}`);
  }

  return json.data !== undefined ? json.data : json;
}

export const api = {
  // Auth
  async register(data: any): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AuthResponse>(res);
  },

  async login(data: any): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<AuthResponse>(res);
  },

  // Movies
  async getMovies(genre?: string, language?: string): Promise<Movie[]> {
    const params = new URLSearchParams();
    if (genre) params.append('genre', genre);
    if (language) params.append('language', language);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${API_BASE}/movies?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await handleResponse<Movie[]>(res);
      if (data && data.length > 0) {
        try { localStorage.setItem('cinebook_cached_movies', JSON.stringify(data)); } catch {}
        return data;
      }
    } catch {
      // Backend cold starting or offline
    }

    // Try cached movies from previous load
    try {
      const cached = localStorage.getItem('cinebook_cached_movies');
      if (cached) {
        let list: Movie[] = JSON.parse(cached);
        if (genre) list = list.filter(m => m.genre.toLowerCase().includes(genre.toLowerCase()));
        if (language) list = list.filter(m => m.language?.toLowerCase() === language.toLowerCase());
        if (list.length > 0) return list;
      }
    } catch {}

    // Return instant fallback catalog
    let fallback = [...FALLBACK_MOVIES];
    if (genre) fallback = fallback.filter(m => m.genre.toLowerCase().includes(genre.toLowerCase()));
    if (language) fallback = fallback.filter(m => m.language.toLowerCase() === language.toLowerCase());
    return fallback;
  },

  async getMovieById(id: string): Promise<Movie> {
    try {
      const res = await fetch(`${API_BASE}/movies/${id}`);
      return await handleResponse<Movie>(res);
    } catch {
      const found = FALLBACK_MOVIES.find(m => m.id === id);
      if (found) return found;
      throw new Error('Movie not found');
    }
  },

  async getGenres(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/movies/genres`);
      const genres = await handleResponse<string[]>(res);
      if (genres && genres.length > 0) return genres;
    } catch {}
    return ['Action', 'Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Adventure', 'Fantasy'];
  },

  async getLanguages(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/movies/languages`);
      const langs = await handleResponse<string[]>(res);
      if (langs && langs.length > 0) return langs;
    } catch {}
    return ['Hindi', 'Telugu', 'Tamil', 'English'];
  },

  // Theaters & Shows
  async getTheaters(city?: string): Promise<Theater[]> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    const res = await fetch(`${API_BASE}/theaters${params}`);
    return handleResponse<Theater[]>(res);
  },

  async getCities(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/theaters/cities`);
    return handleResponse<string[]>(res);
  },

  async getShows(movieId: string, date: string): Promise<Show[]> {
    const res = await fetch(`${API_BASE}/shows?movieId=${movieId}&date=${date}`);
    return handleResponse<Show[]>(res);
  },

  async getShowById(id: string): Promise<Show> {
    const res = await fetch(`${API_BASE}/shows/${id}`);
    return handleResponse<Show>(res);
  },

  async getSeatMap(showId: string): Promise<ShowSeat[]> {
    const res = await fetch(`${API_BASE}/shows/${showId}/seats`);
    return handleResponse<ShowSeat[]>(res);
  },

  // Booking & Concurrency Seat Lock
  async holdSeats(showId: string, showSeatIds: string[]): Promise<HoldSeatsResponse> {
    const res = await fetch(`${API_BASE}/shows/hold-seats`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ showId, showSeatIds }),
    });
    return handleResponse<HoldSeatsResponse>(res);
  },

  async createBooking(showId: string, showSeatIds: string[]): Promise<Booking> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ showId, showSeatIds }),
    });
    return handleResponse<Booking>(res);
  },

  getLocalBookings(): Booking[] {
    try {
      const stored = localStorage.getItem('cinebook_local_bookings');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveLocalBooking(booking: Booking): void {
    try {
      const current = api.getLocalBookings();
      const filtered = current.filter(b => b.id !== booking.id);
      localStorage.setItem('cinebook_local_bookings', JSON.stringify([booking, ...filtered]));
    } catch (e) {
      console.error('Failed to save local booking:', e);
    }
  },

  removeLocalBooking(bookingId: string): void {
    try {
      const current = api.getLocalBookings();
      const filtered = current.filter(b => b.id !== bookingId);
      localStorage.setItem('cinebook_local_bookings', JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove local booking:', e);
    }
  },

  async getUserBookings(): Promise<Booking[]> {
    const local = api.getLocalBookings();
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        headers: getHeaders(),
      });
      const remote = await handleResponse<Booking[]>(res);
      // Merge remote and local bookings, avoiding duplicates
      const remoteIds = new Set(remote.map(b => b.id));
      const uniqueLocal = local.filter(b => !remoteIds.has(b.id));
      return [...remote, ...uniqueLocal];
    } catch (e) {
      return local;
    }
  },

  async getPublicBooking(bookingId: string): Promise<Booking> {
    // Check local bookings first
    const local = api.getLocalBookings().find(b => b.id === bookingId);
    if (local) return local;

    const res = await fetch(`${API_BASE}/bookings/public/${bookingId}`);
    return handleResponse<Booking>(res);
  },

  async cancelBooking(bookingId: string): Promise<void> {
    api.removeLocalBooking(bookingId);
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
      });
      await handleResponse<void>(res);
    } catch (e) {
      // Local removal succeeded
    }
  },

  // Payments
  async createPaymentOrder(bookingId: string): Promise<PaymentOrderResponse> {
    const res = await fetch(`${API_BASE}/payments/create-order?bookingId=${bookingId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<PaymentOrderResponse>(res);
  },

  async verifyPayment(data: {
    bookingId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<boolean> {
    const res = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<boolean>(res);
  },

  // Spring AI Recommendations
  async getAiRecommendations(query: string): Promise<string> {
    const res = await fetch(`${API_BASE}/ai/recommend?query=${encodeURIComponent(query)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<string>(res);
  },

  // TMDB Import (Admin)
  async importTmdbMovie(tmdbId: number): Promise<Movie> {
    const res = await fetch(`${API_BASE}/tmdb/import/${tmdbId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse<Movie>(res);
  },
};
