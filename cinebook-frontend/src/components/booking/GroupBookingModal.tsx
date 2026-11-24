import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Share2,
  Clock,
  ShieldCheck,
  CheckCircle,
  CreditCard,
} from 'lucide-react';
import { GroupBookingSession, Booking } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface GroupBookingModalProps {
  session: GroupBookingSession;
  onClose: () => void;
  onUpdateSession: (updated: GroupBookingSession) => void;
  onCompleteBooking: (booking: Booking) => void;
}

export const GroupBookingModal: React.FC<GroupBookingModalProps> = ({
  session,
  onClose,
  onUpdateSession,
  onCompleteBooking,
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [selectedSeatForPay, setSelectedSeatForPay] = useState<string | null>(null);
  const [payerName, setPayerName] = useState(user?.fullName || '');
  const [payerEmail, setPayerEmail] = useState(user?.email || '');
  const [paying, setPaying] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    return Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  });

  // Countdown timer for 10-minute hold
  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setSecondsRemaining(left);
      if (left === 0 && session.status !== 'CONFIRMED') {
        const expired = { ...session, status: 'EXPIRED' as const };
        onUpdateSession(expired);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session.expiresAt]);

  const shareUrl = `${window.location.origin}/?groupId=${session.groupId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🎬 Hey! Join my CineBook group to watch "${session.show?.movie?.title}" at ${session.show?.screen?.theater?.name}. Click to pick your seat and pay your share: ${shareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handlePaySeatShare = async (seatId: string) => {
    if (!payerEmail.trim()) {
      alert('Please enter your email to receive ticket pass & receipt.');
      return;
    }

    setPaying(true);
    setTimeout(() => {
      // Simulate successful payment of friend's seat share
      const updatedSeats = session.seats.map((s) => {
        if (s.seatId === seatId) {
          return {
            ...s,
            claimedBy: payerName || 'Friend',
            claimedEmail: payerEmail,
            isPaid: true,
            paidAt: new Date().toISOString(),
          };
        }
        return s;
      });

      const allPaid = updatedSeats.every((s) => s.isPaid);
      const updatedSession: GroupBookingSession = {
        ...session,
        seats: updatedSeats,
        status: allPaid ? 'CONFIRMED' : 'PENDING',
      };

      onUpdateSession(updatedSession);
      setPaying(false);
      setSelectedSeatForPay(null);

      // If all seats paid, complete group booking
      if (allPaid) {
        const fakeBooking: Booking = {
          id: `grp-book-${session.groupId.substring(0, 8)}`,
          user: {
            id: user?.id || 'grp-org',
            email: session.organizerEmail,
            fullName: session.organizerName,
            role: 'CUSTOMER',
          },
          show: session.show,
          status: 'CONFIRMED',
          totalAmount: session.seats.reduce((acc, s) => acc + s.pricePaise, 0),
          bookingSeats: session.seats.map((s) => ({
            id: `bs-${s.seatId}`,
            showSeat: {
              id: s.seatId,
              showId: session.show.id,
              seat: {
                id: s.seatId,
                rowLabel: s.seatLabel.charAt(0),
                seatNumber: parseInt(s.seatLabel.substring(1)) || 1,
                seatType: 'REGULAR',
              },
              price: s.pricePaise,
              status: 'BOOKED',
            },
          })),
          createdAt: new Date().toISOString(),
        };
        onCompleteBooking(fakeBooking);
      }
    }, 1000);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const paidCount = session.seats.filter((s) => s.isPaid).length;
  const isExpired = secondsRemaining <= 0;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-container"
        style={{
          maxWidth: '640px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #030712 100%)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(90deg, #1e3a8a 0%, #0f172a 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
              }}
            >
              <Users size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#93c5fd', fontWeight: 800, letterSpacing: 1.5 }}>
                Social Group Cart
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', margin: 0 }}>
                Split & Hold with Friends
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

        {/* 10-Minute Hold Lock Banner */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: isExpired ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
            <Clock size={16} color={isExpired ? '#ef4444' : '#60a5fa'} />
            <span style={{ color: isExpired ? '#f87171' : '#93c5fd' }}>
              {isExpired ? 'Hold lock expired! Seats released.' : 'Seats temporarily locked for group:'}
            </span>
          </div>
          <div
            style={{
              fontSize: '1.1rem',
              fontWeight: 900,
              fontFamily: 'monospace',
              color: isExpired ? '#ef4444' : '#60a5fa',
              background: 'rgba(0,0,0,0.3)',
              padding: '2px 10px',
              borderRadius: '8px',
            }}
          >
            {formatTimer(secondsRemaining)}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flexGrow: 1 }}>
          {/* Movie & Theater Summary */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>
              Movie & Theater
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
              {session.show?.movie?.title}
            </div>
            <div style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
              {session.show?.screen?.theater?.name} • {session.seats.length} Seats Locked
            </div>
          </div>

          {/* Share with Friends Link Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              SHARE THIS LINK WITH YOUR GROUP
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                readOnly
                value={shareUrl}
                style={{
                  flexGrow: 1,
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#93c5fd',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  background: copied ? '#10b981' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  padding: '0 14px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleWhatsAppShare}
                style={{
                  background: '#25D366',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0 16px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                <Share2 size={16} /> WhatsApp
              </button>
            </div>
          </div>

          {/* Seat-by-Seat Payment Progress */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700 }}>
                SEATS STATUS ({paidCount}/{session.seats.length} PAID)
              </span>
              <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 700 }}>
                ₹{((session.seats[0]?.pricePaise || 25000) / 100).toFixed(0)} per seat
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {session.seats.map((seat) => (
                <div
                  key={seat.seatId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: seat.isPaid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)',
                    border: seat.isPaid ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        background: seat.isPaid ? '#10b981' : '#3b82f6',
                        color: '#fff',
                        fontWeight: 900,
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                      }}
                    >
                      {seat.seatLabel}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f3f4f6' }}>
                        {seat.claimedBy || 'Unclaimed Seat'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {seat.claimedEmail || 'Waiting for friend to claim'}
                      </div>
                    </div>
                  </div>

                  <div>
                    {seat.isPaid ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399', fontSize: '0.85rem', fontWeight: 700 }}>
                        <CheckCircle size={16} /> Paid
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedSeatForPay(seat.seatId)}
                        disabled={isExpired}
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          border: 'none',
                          color: '#fff',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: isExpired ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <CreditCard size={14} /> Pay ₹{((seat.pricePaise) / 100).toFixed(0)}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pay My Share Drawer/Form */}
          {selectedSeatForPay && (
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid #3b82f6',
                borderRadius: '14px',
                padding: '14px',
                marginTop: '1rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#93c5fd', marginBottom: 8 }}>
                Claim & Pay for Seat {session.seats.find((s) => s.seatId === selectedSeatForPay)?.seatLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setSelectedSeatForPay(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#9ca3af',
                    padding: '6px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePaySeatShare(selectedSeatForPay)}
                  disabled={paying}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {paying ? 'Processing...' : 'Authorize Payment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#94a3b8' }}>
            <ShieldCheck size={16} color="#10b981" />
            Zero-penalty dropout: Unpaid seats release automatically when timer ends.
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#d1d5db',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
