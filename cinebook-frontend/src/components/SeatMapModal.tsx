import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  User as UserIcon,
  LogIn,
  Eye,
  Utensils,
  Users,
} from 'lucide-react';
import { Show, ShowSeat, Booking, SnackOrderItem, GroupBookingSession } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PaymentModal } from './PaymentModal';
import { SeatSightlinePreview } from './seatmap/SeatSightlinePreview';
import { IntervalExpressModal } from './booking/IntervalExpressModal';
import { GroupBookingModal } from './booking/GroupBookingModal';

interface SeatMapModalProps {
  show: Show;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
  onOpenAuth: () => void;
  onOpenGroupSession?: (session: GroupBookingSession) => void;
}

export const SeatMapModal: React.FC<SeatMapModalProps> = ({
  show,
  onClose,
  onSuccess,
  onOpenAuth,
  onOpenGroupSession,
}) => {
  const { user } = useAuth();
  const [seats, setSeats] = useState<ShowSeat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);

  // New Innovative Features State
  const [hoveredSeat, setHoveredSeat] = useState<ShowSeat | null>(null);
  const [showSightline, setShowSightline] = useState<boolean>(true);
  const [selectedSnacks, setSelectedSnacks] = useState<SnackOrderItem[]>([]);
  const [showSnackModal, setShowSnackModal] = useState<boolean>(false);
  const [activeGroupSession, setActiveGroupSession] = useState<GroupBookingSession | null>(null);


  // Generate dynamic seat map if backend returns empty or 404
  const generateDynamicSeats = (currentShow: Show): ShowSeat[] => {
    const rows = [
      { label: 'A', type: 'REGULAR' as const, priceMult: 1.0 },
      { label: 'B', type: 'REGULAR' as const, priceMult: 1.0 },
      { label: 'C', type: 'PREMIUM' as const, priceMult: 1.3 },
      { label: 'D', type: 'PREMIUM' as const, priceMult: 1.3 },
      { label: 'E', type: 'RECLINER' as const, priceMult: 1.8 },
    ];
    const generated: ShowSeat[] = [];
    const base = currentShow.basePrice || 25000;
    const hash = Math.abs(
      (currentShow.id || '')
        .split('')
        .reduce((acc, c) => acc + c.charCodeAt(0), 0)
    );

    rows.forEach((r, rIdx) => {
      for (let c = 1; c <= 8; c++) {
        // Deterministically mark a couple seats as booked for realism
        const isBooked = (hash + rIdx * 8 + c) % 7 === 0;
        const status = isBooked ? 'BOOKED' : 'AVAILABLE';
        const seatPrice = Math.round(base * r.priceMult);
        generated.push({
          id: `seat-${currentShow.id}-${r.label}${c}`,
          showId: currentShow.id,
          seat: {
            id: `st-${r.label}${c}`,
            rowLabel: r.label,
            seatNumber: c,
            seatType: r.type,
          },
          price: seatPrice,
          status,
        });
      }
    });
    return generated;
  };

  useEffect(() => {
    fetchSeatMap();
  }, [show.id]);

  const fetchSeatMap = async () => {
    try {
      setLoading(true);
      setError('');
      let data = await api.getSeatMap(show.id);
      if (!data || data.length === 0) {
        data = generateDynamicSeats(show);
      }
      setSeats(data);
    } catch {
      const fallback = generateDynamicSeats(show);
      setSeats(fallback);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeatSelection = (seat: ShowSeat) => {
    if (seat.status !== 'AVAILABLE') return;

    if (selectedSeatIds.includes(seat.id)) {
      setSelectedSeatIds(selectedSeatIds.filter((id) => id !== seat.id));
    } else {
      if (selectedSeatIds.length >= 6) {
        setError('Maximum 6 seats allowed per transaction');
        return;
      }
      setError('');
      setSelectedSeatIds([...selectedSeatIds, seat.id]);
    }
  };

  const selectedSeats = seats.filter((s) => selectedSeatIds.includes(s.id));
  const subtotalPaise = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const convenienceFeePaise = Math.round(subtotalPaise * 0.025);
  const gstPaise = Math.round(subtotalPaise * 0.18);
  const snacksTotalPaise = selectedSnacks.reduce(
    (sum, it) => sum + it.snack.pricePaise * it.quantity,
    0
  );
  const totalAmountPaise = subtotalPaise + convenienceFeePaise + gstPaise + snacksTotalPaise;

  const handleStartGroupBooking = () => {
    if (selectedSeats.length < 2) {
      setError('Please select at least 2 seats to initiate a Split & Hold Group Cart');
      return;
    }
    const groupId =
      'GRP-' +
      Math.random().toString(36).substring(2, 6).toUpperCase() +
      '-' +
      Date.now().toString(36).substring(4, 8).toUpperCase();

    const session: GroupBookingSession = {
      groupId,
      show,
      organizerName: user?.fullName || guestName || 'Organizer (You)',
      organizerEmail: user?.email || guestEmail || 'organizer@example.com',
      seats: selectedSeats.map((s, idx) => ({
        seatId: s.id,
        seatLabel: `${s.seat.rowLabel}${s.seat.seatNumber}`,
        pricePaise: s.price,
        claimedBy: idx === 0 ? (user?.fullName || guestName || 'Organizer (You)') : undefined,
        claimedEmail: idx === 0 ? (user?.email || guestEmail) : undefined,
        isPaid: idx === 0, // organizer pre-claims first seat
        paidAt: idx === 0 ? new Date().toISOString() : undefined,
      })),
      expiresAt: Date.now() + 10 * 60 * 1000,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    try {
      localStorage.setItem(`cinebook_group_${groupId}`, JSON.stringify(session));
    } catch {}

    setActiveGroupSession(session);
    if (onOpenGroupSession) {
      onOpenGroupSession(session);
    }
  };

  const handleProceedToPayment = async () => {
    if (selectedSeatIds.length === 0) {
      setError('Please select at least one seat to proceed to payment');
      return;
    }

    if (!user && !showGuestForm) {
      setShowGuestForm(true);
      return;
    }

    if (!user && showGuestForm && !guestEmail.trim()) {
      setError('Please enter your email to receive ticket & payment receipt');
      return;
    }

    try {
      setHolding(true);
      setError('');

      let booking: Booking | null = null;

      // Try holding seats & creating real booking on backend if user is signed in
      if (user) {
        try {
          await api.holdSeats(show.id, selectedSeatIds);
          booking = await api.createBooking(show.id, selectedSeatIds);
        } catch (e) {
          console.warn(
            'Backend booking initialization falling back to client checkout session:',
            e
          );
        }
      }

      // Ready booking object for Payment Gateway
      const bookingForPayment: Booking = booking || {
        id: `BK-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        user: user || {
          id: 'guest-' + Date.now(),
          email: guestEmail.trim() || 'guest.customer@cinebook.com',
          fullName: guestName.trim() || 'CineBook Customer',
          role: 'CUSTOMER',
        },
        show,
        status: 'CREATED',
        totalAmount: totalAmountPaise,
        bookingSeats: selectedSeats.map((s, idx) => ({
          id: `bks-${s.id || idx}`,
          showSeat: s,
        })),
        createdAt: new Date().toISOString(),
      };

      // Open Payment Gateway Modal
      setPendingBooking(bookingForPayment);
    } catch (err: any) {
      setError(
        err.message || 'Failed to initialize checkout. Please try again.'
      );
    } finally {
      setHolding(false);
    }
  };

  // Group seats by row
  const rowsMap: Record<string, ShowSeat[]> = {};
  seats.forEach((s) => {
    const r = s.seat.rowLabel;
    if (!rowsMap[r]) rowsMap[r] = [];
    rowsMap[r].push(s);
  });

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          style={{ maxWidth: 740, padding: '2rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>

          <h2
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              marginBottom: '0.25rem',
            }}
          >
            {show.movie.title}
          </h2>
          <p
            style={{
              color: '#9ca3af',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            {show.screen?.theater?.name || 'Multiplex Cinema'} •{' '}
            {show.screen?.name || 'Screen 1'} •{' '}
            {new Date(show.startTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            (
            {new Date(show.startTime).toLocaleDateString([], {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            )
          </p>

          {error && (
            <div
              style={{
                background: 'rgba(229,9,20,0.15)',
                border: '1px solid #e50914',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: '0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Cinema Screen Curved Bar */}
          <div className="screen-display">
            <span className="screen-text">Screen This Way</span>
          </div>

          {/* Innovative Feature Toggles (Sightline Simulator & Interval Express) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setShowSightline(!showSightline)}
              style={{
                background: showSightline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                border: showSightline ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: showSightline ? '#f87171' : '#9ca3af',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <Eye size={15} /> 3D Sightline Simulator: {showSightline ? 'ACTIVE' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setShowSnackModal(true)}
              style={{
                background: selectedSnacks.length > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)',
                border: selectedSnacks.length > 0 ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: selectedSnacks.length > 0 ? '#34d399' : '#d1d5db',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <Utensils size={15} />
              {selectedSnacks.length > 0
                ? `🍿 Snacks Added (₹${(snacksTotalPaise / 100).toFixed(0)})`
                : '🍿 Add Interval Express Snacks'}
            </button>
          </div>

          {/* 3D Sightline Preview Box */}
          {showSightline && (
            <div style={{ marginBottom: '1.25rem' }}>
              <SeatSightlinePreview
                rowLabel={hoveredSeat?.seat.rowLabel || selectedSeats[0]?.seat.rowLabel || 'C'}
                seatNumber={hoveredSeat?.seat.seatNumber || selectedSeats[0]?.seat.seatNumber || 4}
                movieTitle={show.movie.title}
              />
            </div>
          )}

          {/* Seat Grid */}
          {loading ? (
            <div
              style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}
            >
              Loading interactive seat map...
            </div>
          ) : (
            <div className="seat-grid" style={{ marginBottom: '1.25rem' }}>
              {Object.keys(rowsMap)
                .sort()
                .map((rowLabel) => (
                  <div key={rowLabel} className="seat-row">
                    <div className="row-label">{rowLabel}</div>
                    {rowsMap[rowLabel].map((seat) => {
                      const isSelected = selectedSeatIds.includes(seat.id);
                      let className = 'seat ';
                      if (seat.status === 'BOOKED') className += 'seat-booked';
                      else if (seat.status === 'LOCKED')
                        className += 'seat-locked';
                      else if (isSelected) className += 'seat-selected';
                      else className += 'seat-available';

                      return (
                        <div
                          key={seat.id}
                          className={className}
                          onClick={() => toggleSeatSelection(seat)}
                          onMouseEnter={() => setHoveredSeat(seat)}
                          title={`${seat.seat.rowLabel}${seat.seat.seatNumber} — ₹${(seat.price / 100).toFixed(0)} (${seat.seat.seatType}) • Hover for 3D Sightline`}
                        >
                          {seat.seat.seatNumber}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}

          {/* Seat Legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1.5rem',
              fontSize: '0.8rem',
              color: '#9ca3af',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="seat seat-available"
                style={{ width: 18, height: 18 }}
              ></div>{' '}
              Available
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="seat seat-selected"
                style={{ width: 18, height: 18 }}
              ></div>{' '}
              Selected
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                className="seat seat-booked"
                style={{ width: 18, height: 18 }}
              ></div>{' '}
              Booked
            </div>
          </div>

          {/* Guest / Delivery Contact Form when not signed in */}
          {!user && showGuestForm && (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(229,9,20,0.3)',
                borderRadius: 12,
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: '#f3f4f6',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserIcon size={16} color="#e50914" /> Ticket & Receipt
                  Delivery Contact
                </span>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e50914',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <LogIn size={13} /> Or Sign In
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Full Name (e.g. Rahul Sharma)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  style={{ flex: '1 1 200px', fontSize: '0.85rem' }}
                />
                <input
                  type="email"
                  className="form-input"
                  placeholder="Email for Payment Receipt & QR Pass (e.g. rahul@gmail.com)"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  style={{ flex: '1 1 240px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          )}

          {/* Summary Footer */}
          <div
            className="glass-panel"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                {selectedSeatIds.length} seat(s) selected{' '}
                {selectedSeats.length > 0 &&
                  `(${selectedSeats.map((s) => s.seat.rowLabel + s.seat.seatNumber).join(', ')})`}
              </div>
              <div
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: '#f3f4f6',
                }}
              >
                ₹{(totalAmountPaise / 100).toFixed(2)}
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#9ca3af',
                    fontWeight: 400,
                    marginLeft: 6,
                  }}
                >
                  inc. taxes
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {selectedSeatIds.length >= 2 && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleStartGroupBooking}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    padding: '10px 18px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                  }}
                >
                  <Users size={16} /> Split & Hold ({selectedSeatIds.length})
                </button>
              )}

              <button
                className="btn btn-primary"
                disabled={selectedSeatIds.length === 0 || holding}
                onClick={handleProceedToPayment}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CreditCard size={18} />
                {holding
                  ? 'Securing Seats...'
                  : `Proceed to Pay (₹${(totalAmountPaise / 100).toFixed(0)})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interval Express Snacks Modal */}
      {showSnackModal && (
        <IntervalExpressModal
          seatsSummary={selectedSeats.map((s) => s.seat.rowLabel + s.seat.seatNumber).join(', ') || 'Selected Seats'}
          movieTitle={show.movie.title}
          initialSelected={selectedSnacks}
          onClose={() => setShowSnackModal(false)}
          onConfirmSnacks={(items) => {
            setSelectedSnacks(items);
            setShowSnackModal(false);
          }}
        />
      )}

      {/* Group Booking Split & Hold Modal */}
      {activeGroupSession && (
        <GroupBookingModal
          session={activeGroupSession}
          onClose={() => setActiveGroupSession(null)}
          onUpdateSession={(updated) => setActiveGroupSession(updated)}
          onCompleteBooking={(finalized) => {
            setActiveGroupSession(null);
            onSuccess(finalized);
            onClose();
          }}
        />
      )}

      {/* Payment Gateway Modal */}
      {pendingBooking && (
        <PaymentModal
          booking={pendingBooking}
          onClose={() => setPendingBooking(null)}
          onSuccess={(finalizedBooking) => {
            setPendingBooking(null);
            onSuccess(finalizedBooking);
            onClose();
          }}
        />
      )}
    </>
  );
};

