import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MovieCard } from './components/MovieCard';
import { AuthModal } from './components/AuthModal';
import { SeatMapModal } from './components/SeatMapModal';
import { ShowtimeModal } from './components/ShowtimeModal';
import { MyBookingsModal } from './components/MyBookingsModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { TicketModal } from './components/TicketModal';
import { TrailerModal } from './components/TrailerModal';
import { AiSearchBox } from './components/AiSearchBox';
import { FairExchangeModal } from './components/booking/FairExchangeModal';
import { GroupBookingModal } from './components/booking/GroupBookingModal';
import { AIChatDrawer } from './components/ai/AIChatDrawer';
import { Movie, Show, Booking, ResaleListing, GroupBookingSession } from './types';
import { api } from './services/api';
import { Film, Filter, Play, CheckCircle, Sparkles } from 'lucide-react';

export function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('All');

  const [featuredMovie, setFeaturedMovie] = useState<Movie | null>(null);
  const [showtimeMovie, setShowtimeMovie] = useState<Movie | null>(null);
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    null
  );
  const [trailerMovie, setTrailerMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);

  // New Innovative Features State
  const [showFairExchangeModal, setShowFairExchangeModal] = useState<boolean>(false);
  const [userResaleListings, setUserResaleListings] = useState<ResaleListing[]>([]);
  const [activeGroupSession, setActiveGroupSession] = useState<GroupBookingSession | null>(null);

  const displayedMovies = movies.filter((m) => {
    const matchesLang =
      !selectedLanguage ||
      (m.language &&
        m.language.toLowerCase() === selectedLanguage.toLowerCase());
    return matchesLang;
  });

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showAiChatDrawer, setShowAiChatDrawer] = useState(false);

  useEffect(() => {
    fetchMovies();
    fetchGenres();
    fetchCities();
    checkTicketUrlQuery();
  }, [selectedGenre]);

  const checkTicketUrlQuery = async () => {
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('ticketId');
    if (ticketId) {
      try {
        const b = await api.getPublicBooking(ticketId);
        setConfirmedBooking(b);
      } catch (err) {
        console.error('Failed to load scanned ticket pass:', err);
      }
    }

    const groupId = params.get('groupId');
    if (groupId) {
      const stored = localStorage.getItem(`cinebook_group_${groupId}`);
      if (stored) {
        try {
          setActiveGroupSession(JSON.parse(stored));
        } catch {}
      } else {
        // Fallback demo group session if opened on a different machine
        const demoSession: GroupBookingSession = {
          groupId,
          show: {
            id: 'grp-show-1',
            movie: {
              id: 'm-grp',
              title: 'Roshagni',
              description: 'Action blockbuster screening',
              durationMinutes: 140,
              genre: 'Action, Thriller',
              language: 'Kannada',
              posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80',
              releaseDate: '2026-01-01',
              isActive: true,
            },
            screen: {
              id: 'scr-grp',
              name: 'IMAX Screen 1',
              totalRows: 5,
              totalColumns: 8,
              theater: {
                id: 'th-grp',
                name: 'PVR IMAX Director\'s Cut',
                city: 'Mumbai',
                address: 'Central Mall, Downtown',
              },
            },
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 2.5 * 3600 * 1000).toISOString(),
            basePrice: 30000,
            isActive: true,
          },
          organizerName: 'Organizer Friend',
          organizerEmail: 'friend@example.com',
          seats: [
            {
              seatId: 'seat-C4',
              seatLabel: 'C4',
              pricePaise: 30000,
              claimedBy: 'Organizer Friend',
              claimedEmail: 'friend@example.com',
              isPaid: true,
              paidAt: new Date().toISOString(),
            },
            {
              seatId: 'seat-C5',
              seatLabel: 'C5',
              pricePaise: 30000,
              isPaid: false,
            },
            {
              seatId: 'seat-C6',
              seatLabel: 'C6',
              pricePaise: 30000,
              isPaid: false,
            },
          ],
          expiresAt: Date.now() + 8 * 60 * 1000,
          status: 'PENDING',
          createdAt: Date.now(),
        };
        setActiveGroupSession(demoSession);
      }
    }
  };

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const data = await api.getMovies(selectedGenre || undefined);
      setMovies(data);
      if (data.length > 0 && !featuredMovie) {
        setFeaturedMovie(data[0]);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGenres = async () => {
    try {
      const data = await api.getGenres();
      setGenres(data);
    } catch (err) {
      console.error('Failed to load genres:', err);
    }
  };

  const fetchCities = async () => {
    try {
      const data = await api.getCities();
      setCities(data);
    } catch (err) {
      console.error('Failed to load cities:', err);
    }
  };

  const handleSelectMovie = (movie: Movie) => {
    setShowtimeMovie(movie);
  };

  return (
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <Navbar
        selectedCity={selectedCity}
        cities={cities}
        onSelectCity={setSelectedCity}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenBookings={() => setShowBookingsModal(true)}
        onOpenAdmin={() => setShowAdminModal(true)}
        onOpenFairExchange={() => setShowFairExchangeModal(true)}
        onOpenAiChat={() => setShowAiChatDrawer(true)}
      />

      {showSuccessBanner && (
        <div
          style={{
            background: '#10b981',
            color: 'white',
            padding: '12px 24px',
            textAlign: 'center',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={20} /> Booking Confirmed! Ticket QR code & receipt
          sent to your email.
        </div>
      )}

      <main
        style={{
          flexGrow: 1,
          padding: '2rem',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Featured Hero Banner */}
        {featuredMovie && (
          <div
            className="hero-banner"
            style={{
              backgroundImage: `url(${featuredMovie.backdropUrl || featuredMovie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80'})`,
            }}
          >
            <div className="hero-overlay" />
            <div className="hero-content">
              <div
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  fontSize: '0.8rem',
                  color: '#e50914',
                  fontWeight: 800,
                  marginBottom: 8,
                }}
              >
                Featured Movie
              </div>
              <h1
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  marginBottom: '0.5rem',
                  lineHeight: 1.1,
                }}
              >
                {featuredMovie.title}
              </h1>
              <p
                style={{
                  color: '#d1d5db',
                  fontSize: '0.95rem',
                  marginBottom: '1.5rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {featuredMovie.description}
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTrailerMovie(featuredMovie)}
                >
                  <Play size={16} fill="#ffffff" /> Watch Trailer
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSelectMovie(featuredMovie)}
                >
                  <Film size={16} /> Book Tickets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        <AiSearchBox />

        {/* Header & Filters */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Now Showing ({displayedMovies.length})
              {selectedGenre && (
                <span
                  style={{
                    fontSize: '0.85rem',
                    background: 'rgba(229,9,20,0.2)',
                    color: '#e50914',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                >
                  {selectedGenre}
                </span>
              )}
              {selectedLanguage && (
                <span
                  style={{
                    fontSize: '0.85rem',
                    background: 'rgba(16,185,129,0.2)',
                    color: '#10b981',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                >
                  {selectedLanguage}
                </span>
              )}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} color="#9ca3af" />
              <select
                className="form-input"
                style={{ width: 'auto', padding: '6px 12px' }}
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="">All Genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Language & Cinema Industry Filter Pills (Kannada & Malayalam Removed per request) */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
            }}
          >
            {[
              { label: '🌏 All Languages', value: '' },
              { label: '🇮🇳 Hindi (Bollywood)', value: 'Hindi' },
              { label: '🇮🇳 Telugu (Tollywood)', value: 'Telugu' },
              { label: '🇮🇳 Tamil (Kollywood)', value: 'Tamil' },
              { label: '🇺🇸 English (Hollywood)', value: 'English' },
            ].map((lang) => {
              const isActive = selectedLanguage === lang.value;
              return (
                <button
                  key={lang.value}
                  onClick={() => setSelectedLanguage(lang.value)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isActive
                      ? '1.5px solid #10b981'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: isActive
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#10b981' : '#d1d5db',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Genre Filter Pills Bar */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 6,
            }}
          >
            <button
              onClick={() => setSelectedGenre('')}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                border:
                  selectedGenre === ''
                    ? '1.5px solid #e50914'
                    : '1px solid rgba(255,255,255,0.1)',
                background:
                  selectedGenre === '' ? '#e50914' : 'rgba(255,255,255,0.04)',
                color: '#ffffff',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              🎬 All Genres
            </button>

            {genres.map((g) => {
              const isActive = selectedGenre.toLowerCase() === g.toLowerCase();
              return (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(isActive ? '' : g)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isActive
                      ? '1.5px solid #e50914'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: isActive
                      ? 'rgba(229, 9, 20, 0.25)'
                      : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#e50914' : '#d1d5db',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Movies List */}
        {loading ? (
          <div
            style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}
          >
            Loading movies catalog...
          </div>
        ) : displayedMovies.length === 0 ? (
          <div
            style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}
          >
            No movies found for selected filters. Try selecting "All Languages"
            or "All Genres"!
          </div>
        ) : (
          <div className="movie-grid">
            {displayedMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onSelect={handleSelectMovie}
                onPlayTrailer={(m) => setTrailerMovie(m)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showBookingsModal && (
        <MyBookingsModal onClose={() => setShowBookingsModal(false)} />
      )}
      {showAdminModal && (
        <AdminDashboardModal
          onClose={() => setShowAdminModal(false)}
          onRefreshMovies={fetchMovies}
        />
      )}

      {/* In-Site Video Trailer Modal */}
      {trailerMovie && (
        <TrailerModal
          movie={trailerMovie}
          onClose={() => setTrailerMovie(null)}
        />
      )}

      {/* Showtime Selector Modal */}
      {showtimeMovie && (
        <ShowtimeModal
          movie={showtimeMovie}
          onClose={() => setShowtimeMovie(null)}
          onSelectShow={(show) => {
            setShowtimeMovie(null);
            setSelectedShow(show);
          }}
          onPlayTrailer={(m) => setTrailerMovie(m)}
        />
      )}

      {/* Seat Map Modal */}
      {selectedShow && (
        <SeatMapModal
          show={selectedShow}
          onClose={() => setSelectedShow(null)}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenGroupSession={(s) => setActiveGroupSession(s)}
          onSuccess={(booking) => {
            setConfirmedBooking(booking);
            setShowSuccessBanner(true);
            setTimeout(() => setShowSuccessBanner(false), 8000);
          }}
        />
      )}

      {/* Ticket Pass Modal with QR Code */}
      {confirmedBooking && (
        <TicketModal
          booking={confirmedBooking}
          onClose={() => setConfirmedBooking(null)}
          onListOnFairExchange={(listing) => {
            setUserResaleListings((prev) => [listing, ...prev]);
            setShowFairExchangeModal(true);
          }}
        />
      )}

      {/* Fair Exchange Resale & Waitlist Modal */}
      {showFairExchangeModal && (
        <FairExchangeModal
          userResaleListings={userResaleListings}
          onClose={() => setShowFairExchangeModal(false)}
          onTicketPurchased={(booking) => {
            setConfirmedBooking(booking);
            setShowSuccessBanner(true);
            setTimeout(() => setShowSuccessBanner(false), 8000);
          }}
        />
      )}

      {/* Shared Group Booking Modal (When opened from link or invitation) */}
      {activeGroupSession && (
        <GroupBookingModal
          session={activeGroupSession}
          onClose={() => setActiveGroupSession(null)}
          onUpdateSession={(updated) => setActiveGroupSession(updated)}
          onCompleteBooking={(finalized) => {
            setActiveGroupSession(null);
            setConfirmedBooking(finalized);
            setShowSuccessBanner(true);
            setTimeout(() => setShowSuccessBanner(false), 8000);
          }}
        />
      )}
      {/* AI Assistant Floating Button */}
      <button
        onClick={() => setShowAiChatDrawer(true)}
        title="Open AI Concierge"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 900,
          background: 'linear-gradient(135deg, #e50914, #ff5722)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '50px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '0.9rem',
          boxShadow: '0 8px 24px rgba(229, 9, 20, 0.45)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Sparkles size={18} />
        <span>Ask AI</span>
      </button>

      {/* AI Concierge Slide-out Drawer */}
      <AIChatDrawer
        isOpen={showAiChatDrawer}
        onClose={() => setShowAiChatDrawer(false)}
        onSelectMovie={(title) => {
          const matched = movies.find((m) =>
            m.title.toLowerCase().includes(title.toLowerCase())
          );
          if (matched) {
            handleSelectMovie(matched);
            setShowAiChatDrawer(false);
          }
        }}
      />
    </div>
  );
}
