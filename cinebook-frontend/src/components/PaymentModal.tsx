import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  CreditCard,
  Smartphone,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Booking } from '../types';
import { api } from '../services/api';

interface PaymentModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: (confirmedBooking: Booking) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  booking,
  onClose,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<
    'upi' | 'card' | 'netbanking' | 'razorpay'
  >('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showRazorpaySandbox, setShowRazorpaySandbox] = useState(false);
  const [customRazorpayKey, setCustomRazorpayKey] = useState('');

  const totalRupees = (booking.totalAmount / 100).toFixed(2);
  const show = booking.show;
  const movie = show?.movie;
  const theater = show?.screen?.theater;
  const seatsList =
    booking.bookingSeats
      ?.map(
        (bs) => `${bs.showSeat?.seat?.rowLabel}${bs.showSeat?.seat?.seatNumber}`
      )
      .join(', ') || 'Seats';

  const confirmAndFinalize = async (txnId: string) => {
    setPaymentSuccess(true);
    setProcessing(false);
    setShowRazorpaySandbox(false);

    try {
      await api.verifyPayment({
        bookingId: booking.id,
        razorpayOrderId: 'order_' + Date.now(),
        razorpayPaymentId: txnId,
        razorpaySignature: 'demo_sig',
      });
    } catch {
      // Offline fallback verification
    }

    const finalizedBooking: Booking = {
      ...booking,
      status: 'CONFIRMED',
    };

    api.saveLocalBooking(finalizedBooking);

    setTimeout(() => {
      onSuccess(finalizedBooking);
      onClose();
    }, 1200);
  };

  const handleRazorpayClick = () => {
    setError('');
    setShowRazorpaySandbox(true);
  };

  const handleLaunchRealRazorpay = () => {
    const keyToUse = customRazorpayKey.trim();
    if (!keyToUse || !keyToUse.startsWith('rzp_')) {
      setError(
        'Please enter a valid Razorpay Key starting with rzp_test_ or rzp_live_'
      );
      return;
    }

    try {
      if ((window as any).Razorpay) {
        const options = {
          key: keyToUse,
          amount: booking.totalAmount,
          currency: 'INR',
          name: 'CineBook Tickets',
          description: `Booking for ${movie?.title}`,
          handler: async function (response: any) {
            await confirmAndFinalize(
              response.razorpay_payment_id || 'pay_' + Date.now()
            );
          },
          prefill: {
            email: booking.user?.email || 'customer@cinebook.com',
            name: booking.user?.fullName || 'Moviegoer',
          },
          theme: { color: '#e50914' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        setError(
          'Razorpay SDK not loaded. Please use the simulated test checkout.'
        );
      }
    } catch (e: any) {
      setError(e.message || 'Razorpay popup failed. Using sandbox payment.');
    }
  };

  const handlePaymentSubmit = async () => {
    if (paymentMethod === 'upi' && !upiId.trim() && !upiId.includes('@')) {
      setError(
        'Please enter a valid UPI ID (e.g. yourname@okaxis, 9876543210@paytm)'
      );
      return;
    }
    if (paymentMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 15) {
        setError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        setError('Please enter expiry date as MM/YY');
        return;
      }
      if (cardCvv.length < 3) {
        setError('Please enter 3-digit CVV');
        return;
      }
    }

    try {
      setProcessing(true);
      setError('');

      // Simulate secure gateway authorization
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const txnId =
        'PAY_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      await confirmAndFinalize(txnId);
    } catch (err: any) {
      setError(
        err.message || 'Payment failed. Please try another payment method.'
      );
      setProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{ maxWidth: 680, padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={processing}
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

        {/* Security Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Lock size={20} color="#10b981" /> CineBook Secure Checkout
            </h2>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              <ShieldCheck size={14} color="#10b981" /> 256-Bit SSL Encrypted
              Payment Gateway
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Total Payable
            </div>
            <div
              style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}
            >
              ₹{totalRupees}
            </div>
          </div>
        </div>

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

        {/* Order Summary Mini Bar */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: '0.85rem',
          }}
        >
          <div>
            <span style={{ fontWeight: 700, color: '#f3f4f6' }}>
              {movie?.title}
            </span>{' '}
            • {theater?.name} ({theater?.city})
          </div>
          <div style={{ color: '#e50914', fontWeight: 700 }}>
            Seats: {seatsList}
          </div>
        </div>

        {paymentSuccess ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <CheckCircle2
              size={64}
              color="#10b981"
              style={{ margin: '0 auto 1rem' }}
            />
            <h3
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#f3f4f6',
                marginBottom: 8,
              }}
            >
              Payment Successful!
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
              Generating your verified Universal QR Ticket Pass...
            </p>
          </div>
        ) : (
          <div>
            {/* Payment Method Selector Pills */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: '1.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('upi');
                  setShowRazorpaySandbox(false);
                }}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border:
                    paymentMethod === 'upi' && !showRazorpaySandbox
                      ? '2px solid #e50914'
                      : '1px solid rgba(255,255,255,0.1)',
                  background:
                    paymentMethod === 'upi' && !showRazorpaySandbox
                      ? 'rgba(229,9,20,0.15)'
                      : 'rgba(255,255,255,0.02)',
                  color:
                    paymentMethod === 'upi' && !showRazorpaySandbox
                      ? '#ffffff'
                      : '#9ca3af',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <Smartphone
                  size={18}
                  color={
                    paymentMethod === 'upi' && !showRazorpaySandbox
                      ? '#e50914'
                      : '#9ca3af'
                  }
                />
                UPI / QR
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('card');
                  setShowRazorpaySandbox(false);
                }}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border:
                    paymentMethod === 'card' && !showRazorpaySandbox
                      ? '2px solid #e50914'
                      : '1px solid rgba(255,255,255,0.1)',
                  background:
                    paymentMethod === 'card' && !showRazorpaySandbox
                      ? 'rgba(229,9,20,0.15)'
                      : 'rgba(255,255,255,0.02)',
                  color:
                    paymentMethod === 'card' && !showRazorpaySandbox
                      ? '#ffffff'
                      : '#9ca3af',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <CreditCard
                  size={18}
                  color={
                    paymentMethod === 'card' && !showRazorpaySandbox
                      ? '#e50914'
                      : '#9ca3af'
                  }
                />
                Cards
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('netbanking');
                  setShowRazorpaySandbox(false);
                }}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border:
                    paymentMethod === 'netbanking' && !showRazorpaySandbox
                      ? '2px solid #e50914'
                      : '1px solid rgba(255,255,255,0.1)',
                  background:
                    paymentMethod === 'netbanking' && !showRazorpaySandbox
                      ? 'rgba(229,9,20,0.15)'
                      : 'rgba(255,255,255,0.02)',
                  color:
                    paymentMethod === 'netbanking' && !showRazorpaySandbox
                      ? '#ffffff'
                      : '#9ca3af',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <Building2
                  size={18}
                  color={
                    paymentMethod === 'netbanking' && !showRazorpaySandbox
                      ? '#e50914'
                      : '#9ca3af'
                  }
                />
                NetBanking
              </button>

              <button
                type="button"
                onClick={handleRazorpayClick}
                style={{
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: showRazorpaySandbox
                    ? '2px solid #3b82f6'
                    : '1px solid rgba(255,255,255,0.1)',
                  background: showRazorpaySandbox
                    ? 'rgba(59,130,246,0.2)'
                    : 'rgba(59,130,246,0.06)',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                <Lock size={18} color="#60a5fa" />
                Razorpay
              </button>
            </div>

            {/* Razorpay Sandbox View */}
            {showRazorpaySandbox ? (
              <div
                style={{
                  background: '#0b132b',
                  border: '1.5px solid #1d4ed8',
                  borderRadius: 12,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: 10,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <div
                      style={{
                        background: '#3b82f6',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      RAZORPAY
                    </div>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#f3f4f6',
                      }}
                    >
                      Test Gateway & Simulator
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(16,185,129,0.2)',
                      color: '#10b981',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 700,
                    }}
                  >
                    Active Sandbox
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '0.85rem',
                    color: '#cbd5e1',
                    lineHeight: 1.5,
                  }}
                >
                  Simulate instant Razorpay authorization or provide your
                  registered Key ID from{' '}
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                    dashboard.razorpay.com
                  </span>
                  .
                </div>

                {/* Instant Simulation Action */}
                <button
                  type="button"
                  disabled={processing}
                  onClick={() =>
                    confirmAndFinalize(
                      'pay_rzp_test_' + Date.now().toString(36)
                    )
                  }
                  style={{
                    padding: '12px',
                    borderRadius: 8,
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
                  }}
                >
                  <Sparkles size={18} />
                  {processing
                    ? 'Processing with Razorpay...'
                    : `Simulate Razorpay Success (Pay ₹${totalRupees})`}
                </button>

                {/* Custom Key Section */}
                <div
                  style={{
                    borderTop: '1px dashed rgba(255,255,255,0.1)',
                    paddingTop: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      marginBottom: 6,
                    }}
                  >
                    Or test with your own Razorpay Key ID (optional):
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="rzp_test_YourKeyHere"
                      value={customRazorpayKey}
                      onChange={(e) => setCustomRazorpayKey(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleLaunchRealRazorpay}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ffffff',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <ExternalLink size={13} /> Launch Popup
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* UPI Option */}
                {paymentMethod === 'upi' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#d1d5db',
                          marginBottom: 6,
                        }}
                      >
                        Enter UPI ID (Google Pay, PhonePe, Paytm, BHIM)
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. yourname@okaxis or 9876543210@paytm"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => setUpiId('customer@okaxis')}
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#d1d5db',
                            borderRadius: 8,
                            cursor: 'pointer',
                          }}
                        >
                          Use Test UPI
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                      }}
                    >
                      <span>Supported apps:</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>
                        Google Pay
                      </span>{' '}
                      •
                      <span style={{ color: '#6366f1', fontWeight: 600 }}>
                        PhonePe
                      </span>{' '}
                      •
                      <span style={{ color: '#0ea5e9', fontWeight: 600 }}>
                        Paytm
                      </span>{' '}
                      •
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                        BHIM
                      </span>{' '}
                      •
                      <span style={{ color: '#ec4899', fontWeight: 600 }}>
                        Cred UPI
                      </span>
                    </div>
                  </div>
                )}

                {/* Credit / Debit Card Option */}
                {paymentMethod === 'card' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#d1d5db',
                          marginBottom: 4,
                        }}
                      >
                        Card Number (Visa / Mastercard / RuPay)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        maxLength={19}
                        placeholder="4532 •••• •••• 8892"
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, '')
                            .substring(0, 16);
                          const formatted =
                            val.match(/.{1,4}/g)?.join(' ') || val;
                          setCardNumber(formatted);
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#d1d5db',
                            marginBottom: 4,
                          }}
                        >
                          Valid Thru (MM/YY)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          maxLength={5}
                          placeholder="12/28"
                          value={cardExpiry}
                          onChange={(e) => {
                            let val = e.target.value
                              .replace(/\D/g, '')
                              .substring(0, 4);
                            if (val.length >= 2)
                              val =
                                val.substring(0, 2) + '/' + val.substring(2);
                            setCardExpiry(val);
                          }}
                        />
                      </div>

                      <div style={{ width: 110 }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#d1d5db',
                            marginBottom: 4,
                          }}
                        >
                          CVV (3 Digits)
                        </label>
                        <input
                          type="password"
                          className="form-input"
                          maxLength={3}
                          placeholder="•••"
                          value={cardCvv}
                          onChange={(e) =>
                            setCardCvv(e.target.value.replace(/\D/g, ''))
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: '#d1d5db',
                          marginBottom: 4,
                        }}
                      >
                        Name on Card
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Cardholder Name"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Net Banking Option */}
                {paymentMethod === 'netbanking' && (
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#d1d5db',
                        marginBottom: 8,
                      }}
                    >
                      Select Bank:
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 8,
                      }}
                    >
                      {[
                        'HDFC Bank',
                        'State Bank of India (SBI)',
                        'ICICI Bank',
                        'Axis Bank',
                        'Kotak Mahindra Bank',
                        'Punjab National Bank',
                      ].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setSelectedBank(bank)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border:
                              selectedBank === bank
                                ? '1.5px solid #10b981'
                                : '1px solid rgba(255,255,255,0.1)',
                            background:
                              selectedBank === bank
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(255,255,255,0.02)',
                            color:
                              selectedBank === bank ? '#10b981' : '#f3f4f6',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Pay Button */}
                <div
                  style={{
                    marginTop: '1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <button
                    className="btn btn-primary"
                    disabled={processing}
                    onClick={handlePaymentSubmit}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Lock size={18} />
                    {processing
                      ? 'Processing Payment with Bank...'
                      : `Pay ₹${totalRupees}`}
                  </button>

                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                    }}
                  >
                    By clicking Pay, you agree to CineBook's Terms of
                    Reservation. Safe & encrypted transaction.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
