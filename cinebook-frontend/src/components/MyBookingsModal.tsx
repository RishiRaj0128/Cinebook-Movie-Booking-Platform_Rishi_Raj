import React, { useState, useEffect } from 'react';
import { X, Ticket, Calendar, MapPin, QrCode, Trash2 } from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';
import { TicketModal } from './TicketModal';

interface MyBookingsModalProps {
  onClose: () => void;
}

export const MyBookingsModal: React.FC<MyBookingsModalProps> = ({
  onClose,
}) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Booking | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const data = await api.getUserBookings();
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.cancelBooking(bookingId);
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content"
          style={{ maxWidth: 640 }}
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
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ticket color="#e50914" /> My Movie Tickets
          </h2>

          {loading ? (
            <div
              style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}
            >
              Loading tickets...
            </div>
          ) : bookings.length === 0 ? (
            <div
              style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}
            >
              No bookings found yet. Pick a movie and book your tickets!
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxHeight: 420,
                overflowY: 'auto',
              }}
            >
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="glass-panel"
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#f3f4f6',
                      }}
                    >
                      {booking.show?.movie?.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#9ca3af',
                        marginTop: 4,
                        display: 'flex',
                        gap: 12,
                      }}
                    >
                      <span>
                        <MapPin size={14} style={{ display: 'inline' }} />{' '}
                        {booking.show?.screen?.theater?.name}
                      </span>
                      <span>
                        <Calendar size={14} style={{ display: 'inline' }} />{' '}
                        {new Date(booking.show?.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      Status:{' '}
                      <span
                        style={{
                          color:
                            booking.status === 'CONFIRMED'
                              ? '#10b981'
                              : '#f59e0b',
                        }}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: '#f3f4f6',
                      }}
                    >
                      ₹{(booking.totalAmount / 100).toFixed(0)}
                    </div>

                    <button
                      onClick={() => setActiveTicket(booking)}
                      style={{
                        background: 'rgba(229,9,20,0.15)',
                        border: '1px solid rgba(229,9,20,0.4)',
                        color: '#e50914',
                        borderRadius: 8,
                        padding: '5px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <QrCode size={14} /> View Ticket & QR
                    </button>

                    {booking.status === 'CREATED' && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Trash2 size={12} /> Cancel Hold
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTicket && (
        <TicketModal
          booking={activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}
    </>
  );
};
