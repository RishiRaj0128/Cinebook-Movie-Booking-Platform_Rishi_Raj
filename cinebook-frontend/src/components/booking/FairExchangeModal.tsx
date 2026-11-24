import React, { useState } from 'react';
import {
  X,
  Repeat,
  ShieldCheck,
  Tag,
  CheckCircle,
  Bell,
} from 'lucide-react';
import { ResaleListing, Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_RESALE_LISTINGS: ResaleListing[] = [
  {
    id: 'resale-101',
    originalBookingId: 'bk-resale-8821',
    movieTitle: 'Roshagni',
    theaterName: 'PVR IMAX Director\'s Cut',
    screenName: 'IMAX Screen 1',
    city: 'Mumbai',
    showTime: 'Tonight, 10:00 PM',
    seats: ['C4', 'C5'],
    faceValuePaise: 65000,
    sellerName: 'Aarav Sharma',
    sellerEmail: 'aarav.s@example.com',
    listedAt: '12 mins ago',
    status: 'AVAILABLE',
    posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80',
  },
  {
    id: 'resale-102',
    originalBookingId: 'bk-resale-9932',
    movieTitle: 'K.G.F: Chapter 2',
    theaterName: 'Cinepolis Seasons Mall',
    screenName: 'Screen 4 (4DX)',
    city: 'Pune',
    showTime: 'Tomorrow, 7:15 PM',
    seats: ['D7'],
    faceValuePaise: 35000,
    sellerName: 'Pooja Verma',
    sellerEmail: 'pooja.v@example.com',
    listedAt: '35 mins ago',
    status: 'AVAILABLE',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
  },
  {
    id: 'resale-103',
    originalBookingId: 'bk-resale-7714',
    movieTitle: 'The Beekeeper',
    theaterName: 'INOX Megaplex',
    screenName: 'Dolby Atmos Hall 2',
    city: 'Bengaluru',
    showTime: 'Fri, 8:45 PM',
    seats: ['E3', 'E4'],
    faceValuePaise: 70000,
    sellerName: 'Vikram Joshi',
    sellerEmail: 'vikram.j@example.com',
    listedAt: '1 hour ago',
    status: 'AVAILABLE',
    posterUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80',
  },
];

interface FairExchangeModalProps {
  onClose: () => void;
  onTicketPurchased: (booking: Booking) => void;
  userResaleListings?: ResaleListing[];
}

export const FairExchangeModal: React.FC<FairExchangeModalProps> = ({
  onClose,
  onTicketPurchased,
  userResaleListings = [],
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'listings' | 'waitlist'>('listings');
  const [allListings, setAllListings] = useState<ResaleListing[]>([
    ...userResaleListings,
    ...DEFAULT_RESALE_LISTINGS,
  ]);
  const [filterCity, setFilterCity] = useState<string>('All');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // Waitlist form state
  const [waitlistMovie, setWaitlistMovie] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  const filteredListings = allListings.filter((it) => {
    if (filterCity !== 'All' && it.city !== filterCity) return false;
    return it.status === 'AVAILABLE';
  });

  const handleBuyResale = (listing: ResaleListing) => {
    setPurchasingId(listing.id);

    setTimeout(() => {
      // Mark as sold
      setAllListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: 'SOLD' as const } : l))
      );

      // Create new verified booking pass for buyer
      const newBooking: Booking = {
        id: `resale-${listing.id}-${Date.now().toString(36).substring(3)}`,
        user: {
          id: user?.id || 'resale-buyer',
          email: user?.email || 'buyer@example.com',
          fullName: user?.fullName || 'Verified Resale Buyer',
          role: 'CUSTOMER',
        },
        show: {
          id: `show-${listing.id}`,
          movie: {
            id: `m-${listing.id}`,
            title: listing.movieTitle,
            description: 'Verified Fair-Exchange Resale Ticket',
            durationMinutes: 140,
            genre: 'Action, Thriller',
            language: 'Hindi',
            posterUrl: listing.posterUrl,
            releaseDate: '2026-01-01',
            isActive: true,
          },
          screen: {
            id: `scr-${listing.id}`,
            name: listing.screenName,
            totalRows: 10,
            totalColumns: 10,
            theater: {
              id: `th-${listing.id}`,
              name: listing.theaterName,
              city: listing.city,
              address: 'Central Multiplex, Downtown Hub',
            },
          },
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 2.5 * 3600 * 1000).toISOString(),
          basePrice: listing.faceValuePaise,
          isActive: true,
        },
        status: 'CONFIRMED',
        totalAmount: listing.faceValuePaise,
        bookingSeats: listing.seats.map((s, idx) => ({
          id: `bs-resale-${idx}`,
          showSeat: {
            id: `st-${s}`,
            showId: `show-${listing.id}`,
            seat: {
              id: `seat-${s}`,
              rowLabel: s.charAt(0),
              seatNumber: parseInt(s.substring(1)) || 1,
              seatType: 'REGULAR',
            },
            price: listing.faceValuePaise / listing.seats.length,
            status: 'BOOKED',
          },
        })),
        createdAt: new Date().toISOString(),
      };

      setPurchasingId(null);
      onTicketPurchased(newBooking);
      onClose();
    }, 1200);
  };

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistMovie.trim() || !waitlistEmail.trim()) return;
    setWaitlistSuccess(true);
    setTimeout(() => {
      setWaitlistSuccess(false);
      setWaitlistMovie('');
    }, 3000);
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-container"
        style={{
          maxWidth: '720px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #111827 0%, #030712 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(90deg, #064e3b 0%, #111827 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
              }}
            >
              <Repeat size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6ee7b7', fontWeight: 800, letterSpacing: 1.5 }}>
                100% Anti-Scalping Marketplace
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                CineBook Fair Exchange
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Guarantees Banner */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(16, 185, 129, 0.1)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.825rem',
            color: '#a7f3d0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="#10b981" />
            <span>
              <strong>Face-Value Capped:</strong> Zero scalping markup permitted. Old QR passes auto-revoked.
            </span>
          </div>
          <span style={{ background: '#10b981', color: '#064e3b', padding: '2px 8px', borderRadius: 12, fontWeight: 800, fontSize: '0.7rem' }}>
            Instant Seller Refund
          </span>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '0 1.5rem',
          }}
        >
          <button
            onClick={() => setActiveTab('listings')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'listings' ? '3px solid #10b981' : '3px solid transparent',
              color: activeTab === 'listings' ? '#34d399' : '#9ca3af',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Tag size={16} /> Available Resale Tickets ({filteredListings.length})
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'waitlist' ? '3px solid #10b981' : '3px solid transparent',
              color: activeTab === 'waitlist' ? '#34d399' : '#9ca3af',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Bell size={16} /> Sold-Out Show Waitlist
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flexGrow: 1 }}>
          {activeTab === 'listings' ? (
            <div>
              {/* City Filter */}
              <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', overflowX: 'auto' }}>
                {['All', 'Mumbai', 'Pune', 'Bengaluru', 'Delhi'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCity(c)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 16,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: filterCity === c ? '#10b981' : 'rgba(255,255,255,0.06)',
                      color: filterCity === c ? '#064e3b' : '#d1d5db',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {filteredListings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
                  <Repeat size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <h4>No Resale Tickets Currently Available</h4>
                  <p style={{ fontSize: '0.85rem' }}>
                    Switch to the <strong>Sold-Out Waitlist</strong> tab to get notified first when a ticket is listed!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredListings.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        gap: 14,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                        alignItems: 'center',
                      }}
                    >
                      <img
                        src={item.posterUrl}
                        alt={item.movieTitle}
                        style={{
                          width: 64,
                          height: 90,
                          borderRadius: '8px',
                          objectFit: 'cover',
                        }}
                      />

                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            {item.city}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                            Listed {item.listedAt}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                          {item.movieTitle}
                        </h4>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: 2 }}>
                          {item.theaterName} • {item.screenName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 700, marginTop: 4 }}>
                          Seats: {item.seats.join(', ')} • {item.showTime}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Exact Face Value</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34d399' }}>
                          ₹{(item.faceValuePaise / 100).toFixed(0)}
                        </div>
                        <button
                          onClick={() => handleBuyResale(item)}
                          disabled={purchasingId === item.id}
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#fff',
                            padding: '8px 16px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: purchasingId === item.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          {purchasingId === item.id ? 'Issuing Pass...' : 'Buy Resale Ticket'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: 480, margin: '0 auto', padding: '1rem 0' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                🔔 Get Instant Alerts for Sold-Out Shows
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                Join the automated waitlist queue. When an attendee lists their ticket on Fair Exchange,
                you will receive an instant push/email alert to grab it before anyone else.
              </p>

              {waitlistSuccess ? (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    color: '#34d399',
                    fontWeight: 700,
                  }}
                >
                  <CheckCircle size={28} style={{ margin: '0 auto 8px auto' }} />
                  You are added to the priority waitlist! We will notify you the moment a ticket is listed.
                </div>
              ) : (
                <form onSubmit={handleJoinWaitlist} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Movie You Are Looking For
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. K.G.F: Chapter 2 or Roshagni"
                      value={waitlistMovie}
                      onChange={(e) => setWaitlistMovie(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Your Email Address
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{
                      marginTop: 8,
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#fff',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Bell size={18} /> Join Priority Waitlist
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'rgba(17, 24, 39, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#6b7280',
          }}
        >
          <span>CineBook Verified Smart Escrow: Payments held until entry pass is accepted.</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
