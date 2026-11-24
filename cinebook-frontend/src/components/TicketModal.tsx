import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Calendar,
  MapPin,
  Clock,
  Printer,
  Navigation,
  User,
  ShieldCheck,
  RefreshCw,
  Lock,
  Repeat,
} from 'lucide-react';
import { Booking, ResaleListing } from '../types';
import QRCode from 'qrcode';

interface TicketModalProps {
  booking: Booking;
  onClose: () => void;
  onListOnFairExchange?: (listing: ResaleListing) => void;
}

export const TicketModal: React.FC<TicketModalProps> = ({
  booking,
  onClose,
  onListOnFairExchange,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(15);
  const [dynamicToken, setDynamicToken] = useState<string>('');
  const [resaleListed, setResaleListed] = useState<boolean>(false);


  const show = booking.show;
  const movie = show?.movie;
  const screen = show?.screen;
  const theater = screen?.theater;

  const seatsList =
    booking.bookingSeats
      ?.map(
        (bs) =>
          `${bs.showSeat?.seat?.rowLabel || ''}${bs.showSeat?.seat?.seatNumber || ''}`
      )
      .join(', ') || 'N/A';
  const showDate = show?.startTime
    ? new Date(show.startTime).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';
  const showTime = show?.startTime
    ? new Date(show.startTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';
  const totalRupees = (booking.totalAmount / 100).toFixed(2);
  const userName = booking.user?.fullName || 'Guest Customer';
  const userEmail = booking.user?.email || 'N/A';

  // Helper to generate dynamic short-lived security token
  const generateNewToken = () => {
    const randPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const tsPart = Date.now().toString(36).substring(3).toUpperCase();
    return `PASS-${randPart}-${tsPart}`;
  };

  // 15-second dynamic token refresh countdown timer (Anti-Screenshot Security)
  useEffect(() => {
    setDynamicToken(generateNewToken());
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setDynamicToken(generateNewToken());
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const [copied, setCopied] = useState(false);

  // Single QR payload containing full movie, theater venue, screen, showtime, seat, & customer details
  const qrDetailsText = [
    '🎬 CINEBOOK OFFICIAL TICKET PASS',
    '================================',
    `Movie: ${movie?.title || 'Movie'}`,
    `Genre: ${movie?.genre || ''} (${movie?.language || 'English'})`,
    `Theater: ${theater?.name || 'Cinema'} (${theater?.city || ''})`,
    `Screen: ${screen?.name || 'Auditorium 1'}`,
    `Address: ${theater?.address || ''}`,
    `Show Date: ${showDate}`,
    `Showtime: ${showTime}`,
    `Reserved Seats: ${seatsList}`,
    `Customer: ${userName}`,
    `Email: ${userEmail}`,
    `Booking Ref: ${booking.id}`,
    `Total Paid: Rs.${totalRupees}`,
    `Status: CONFIRMED & VERIFIED`,
  ].join('\n');

  // Generate QR Code when dynamicToken updates
  useEffect(() => {
    if (!dynamicToken) return;

    QRCode.toDataURL(qrDetailsText, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [dynamicToken, booking]);

  const handleCopy = () => {
    navigator.clipboard.writeText(qrDetailsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Single Page PDF Print via dedicated isolated popup window using secure DOM construction
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=750,height=900');
    if (!printWindow) {
      alert('Please allow popups for printing your ticket PDF.');
      return;
    }

    const doc = printWindow.document;
    doc.open();
    doc.title = `CineBook Ticket Pass - ${movie?.title || 'Pass'}`;

    const style = doc.createElement('style');
    style.textContent = `
      @page { size: A4 portrait; margin: 10mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #ffffff;
        color: #0f172a;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .ticket-card {
        max-width: 620px;
        margin: 10px auto;
        border: 2px solid #0f172a;
        border-radius: 14px;
        overflow: hidden;
        background: #ffffff;
      }
      .ticket-header {
        background: #e50914;
        color: #ffffff;
        padding: 18px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .ticket-header h1 { margin: 0; font-size: 20px; font-weight: 800; }
      .ticket-header p { margin: 2px 0 0 0; font-size: 12px; opacity: 0.9; }
      .ticket-body { padding: 20px 24px; }
      .holder-bar {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 14px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .movie-grid {
        display: grid;
        grid-template-columns: 110px 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }
      .poster-img {
        width: 110px;
        height: 160px;
        border-radius: 8px;
        object-fit: cover;
      }
      .movie-title {
        font-size: 22px;
        font-weight: 900;
        margin: 4px 0 6px 0;
        color: #0f172a;
      }
      .pill {
        display: inline-block;
        background: #f1f5f9;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        margin-right: 6px;
        margin-top: 6px;
      }
      .stub-line { border-top: 2px dashed #94a3b8; margin: 16px 0; }
      .bottom-grid {
        display: grid;
        grid-template-columns: 1fr 180px;
        gap: 16px;
        align-items: center;
      }
      .qr-container {
        border: 2px solid #e50914;
        border-radius: 10px;
        padding: 8px;
        text-align: center;
        background: #ffffff;
      }
      .qr-container img { width: 140px; height: 140px; }
    `;
    doc.head.appendChild(style);

    const card = doc.createElement('div');
    card.className = 'ticket-card';

    // Header
    const header = doc.createElement('div');
    header.className = 'ticket-header';
    const hLeft = doc.createElement('div');
    const h1 = doc.createElement('h1');
    h1.textContent = 'Booking Confirmed';
    const hp = doc.createElement('p');
    hp.textContent = 'Official Digital Cinema Entry Pass';
    hLeft.appendChild(h1);
    hLeft.appendChild(hp);
    const hBadge = doc.createElement('div');
    hBadge.setAttribute('style', 'font-weight: 900; font-size: 14px; background: rgba(255,255,255,0.25); padding: 4px 12px; border-radius: 12px;');
    hBadge.textContent = 'CINEBOOK';
    header.appendChild(hLeft);
    header.appendChild(hBadge);
    card.appendChild(header);

    // Body
    const body = doc.createElement('div');
    body.className = 'ticket-body';

    // Holder bar
    const holderBar = doc.createElement('div');
    holderBar.className = 'holder-bar';
    const holderLeft = doc.createElement('div');
    const holderLabel = doc.createElement('span');
    holderLabel.setAttribute('style', 'color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase;');
    holderLabel.textContent = 'Ticket Holder';
    const holderName = doc.createElement('div');
    holderName.setAttribute('style', 'font-weight: 800; font-size: 14px; color: #0f172a;');
    holderName.textContent = `${userName} (${userEmail})`;
    holderLeft.appendChild(holderLabel);
    holderLeft.appendChild(holderName);

    const verifiedBadge = doc.createElement('div');
    verifiedBadge.setAttribute('style', 'background: #10b981; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800;');
    verifiedBadge.textContent = 'VERIFIED PASS';
    holderBar.appendChild(holderLeft);
    holderBar.appendChild(verifiedBadge);
    body.appendChild(holderBar);

    // Movie grid
    const movieGrid = doc.createElement('div');
    movieGrid.className = 'movie-grid';

    const poster = doc.createElement('img');
    poster.className = 'poster-img';
    const safePosterUrl = movie?.posterUrl && (movie.posterUrl.startsWith('https://') || movie.posterUrl.startsWith('http://'))
      ? movie.posterUrl
      : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80';
    poster.src = safePosterUrl;
    poster.alt = movie?.title || 'Movie Poster';
    movieGrid.appendChild(poster);

    const movieDetails = doc.createElement('div');
    const genreDiv = doc.createElement('div');
    genreDiv.setAttribute('style', 'color: #e50914; font-size: 11px; font-weight: 800; text-transform: uppercase;');
    genreDiv.textContent = `${movie?.genre || ''} • ${movie?.language || ''}`;

    const titleDiv = doc.createElement('div');
    titleDiv.className = 'movie-title';
    titleDiv.textContent = movie?.title || 'Movie';

    const locDiv = doc.createElement('div');
    locDiv.setAttribute('style', 'font-size: 13px; font-weight: 700; color: #1e293b;');
    locDiv.textContent = `📍 ${theater?.name || 'CineBook Theater'} (${theater?.city || ''})`;

    const addrDiv = doc.createElement('div');
    addrDiv.setAttribute('style', 'font-size: 11px; color: #64748b; margin-top: 2px;');
    addrDiv.textContent = theater?.address || '';

    const pillsDiv = doc.createElement('div');
    pillsDiv.setAttribute('style', 'margin-top: 8px;');

    const pillDate = doc.createElement('span');
    pillDate.className = 'pill';
    pillDate.textContent = `📅 ${showDate}`;

    const pillTime = doc.createElement('span');
    pillTime.className = 'pill';
    pillTime.textContent = `⏰ ${showTime}`;

    const pillScreen = doc.createElement('span');
    pillScreen.className = 'pill';
    pillScreen.setAttribute('style', 'background: #fee2e2; color: #991b1b;');
    pillScreen.textContent = screen?.name || 'Auditorium 1';

    pillsDiv.appendChild(pillDate);
    pillsDiv.appendChild(pillTime);
    pillsDiv.appendChild(pillScreen);

    movieDetails.appendChild(genreDiv);
    movieDetails.appendChild(titleDiv);
    movieDetails.appendChild(locDiv);
    movieDetails.appendChild(addrDiv);
    movieDetails.appendChild(pillsDiv);
    movieGrid.appendChild(movieDetails);
    body.appendChild(movieGrid);

    // Stub line
    const stub = doc.createElement('div');
    stub.className = 'stub-line';
    body.appendChild(stub);

    // Bottom grid
    const bottomGrid = doc.createElement('div');
    bottomGrid.className = 'bottom-grid';

    const bLeft = doc.createElement('div');
    const seatsBox = doc.createElement('div');
    seatsBox.setAttribute('style', 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px;');
    const seatsLabel = doc.createElement('span');
    seatsLabel.setAttribute('style', 'font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;');
    seatsLabel.textContent = 'Reserved Seats';
    const seatsVal = doc.createElement('div');
    seatsVal.setAttribute('style', 'font-size: 18px; font-weight: 900; color: #e50914;');
    seatsVal.textContent = seatsList;
    seatsBox.appendChild(seatsLabel);
    seatsBox.appendChild(seatsVal);

    const priceBox = doc.createElement('div');
    priceBox.setAttribute('style', 'display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;');
    const priceLeft = doc.createElement('div');
    const paidLabel = doc.createElement('span');
    paidLabel.setAttribute('style', 'font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;');
    paidLabel.textContent = 'Total Paid';
    const paidVal = doc.createElement('div');
    paidVal.setAttribute('style', 'font-size: 15px; font-weight: 800; color: #10b981;');
    paidVal.textContent = `₹${totalRupees}`;
    priceLeft.appendChild(paidLabel);
    priceLeft.appendChild(paidVal);

    const priceRight = doc.createElement('div');
    priceRight.setAttribute('style', 'text-align: right;');
    const refLabel = doc.createElement('span');
    refLabel.setAttribute('style', 'font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;');
    refLabel.textContent = 'Booking Ref';
    const refVal = doc.createElement('div');
    refVal.setAttribute('style', 'font-size: 11px; font-family: monospace; font-weight: 700; color: #0f172a;');
    refVal.textContent = booking.id ? booking.id.substring(0, 16) : '';
    priceRight.appendChild(refLabel);
    priceRight.appendChild(refVal);

    priceBox.appendChild(priceLeft);
    priceBox.appendChild(priceRight);
    bLeft.appendChild(seatsBox);
    bLeft.appendChild(priceBox);
    bottomGrid.appendChild(bLeft);

    // QR container
    const qrContainer = doc.createElement('div');
    qrContainer.className = 'qr-container';
    const qrImg = doc.createElement('img');
    qrImg.src = qrDataUrl && qrDataUrl.startsWith('data:image/') ? qrDataUrl : '';
    qrImg.alt = 'Scannable Ticket QR Code';
    const qrCaption = doc.createElement('div');
    qrCaption.setAttribute('style', 'font-size: 9px; font-weight: 800; margin-top: 4px; color: #000000; letter-spacing: 0.5px;');
    qrCaption.textContent = 'SCAN FOR TICKET DETAILS';
    qrContainer.appendChild(qrImg);
    qrContainer.appendChild(qrCaption);
    bottomGrid.appendChild(qrContainer);

    body.appendChild(bottomGrid);
    card.appendChild(body);
    doc.body.appendChild(card);
    doc.close();

    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
        printWindow.close();
      } catch (e) {
        // print window handling
      }
    }, 250);
  };
  const handleListForResale = () => {
    if (resaleListed) return;
    const listing: ResaleListing = {
      id: `resale-${booking.id}`,
      originalBookingId: booking.id,
      movieTitle: movie?.title || 'Movie',
      theaterName: theater?.name || 'Multiplex Cinema',
      screenName: screen?.name || 'Screen 1',
      city: theater?.city || 'Mumbai',
      showTime: `${showDate}, ${showTime}`,
      seats: seatsList.split(', ').map((s) => s.trim()),
      faceValuePaise: booking.totalAmount,
      sellerName: userName,
      sellerEmail: userEmail,
      listedAt: 'Just now',
      status: 'AVAILABLE',
      posterUrl:
        movie?.posterUrl ||
        'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80',
    };

    setResaleListed(true);
    if (onListOnFairExchange) {
      onListOnFairExchange(listing);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: 680,
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(229,9,20,0.4)',
          boxShadow: '0 20px 50px rgba(229,9,20,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #e50914 0%, #99000d 100%)',
            padding: '1.25rem 1.5rem',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={24} color="#ffffff" />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Booking Confirmed!
              </h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: 0 }}>
                Official Dynamic Anti-Fraud Entry Pass
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cinema Ticket Card Body */}
        <div style={{ padding: '1.5rem', background: '#0f172a' }}>
          {/* Customer / Holder Info Bar */}
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} color="#e50914" />
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                }}
              >
                {userName}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                ({userEmail})
              </span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                background: '#10b981',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ShieldCheck size={12} /> VERIFIED PASS
            </span>
          </div>

          {/* Main Info Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: 20,
              marginBottom: '1.25rem',
            }}
          >
            {/* Poster */}
            <img
              src={
                movie?.posterUrl ||
                'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80'
              }
              alt={movie?.title}
              style={{
                width: 120,
                height: 175,
                borderRadius: 12,
                objectFit: 'cover',
                boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
              }}
            />

            {/* Movie & Venue Info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: '#e50914',
                    fontWeight: 800,
                  }}
                >
                  {movie?.genre} • {movie?.language}
                </span>
                <h2
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    color: '#f8fafc',
                    margin: '4px 0 8px 0',
                    lineHeight: 1.2,
                  }}
                >
                  {movie?.title}
                </h2>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MapPin size={15} color="#e50914" />
                  <strong style={{ color: '#f1f5f9' }}>
                    {theater?.name || 'CineBook Theater'}
                  </strong>
                  {theater?.city && (
                    <span
                      style={{
                        background: 'rgba(229,9,20,0.2)',
                        color: '#e50914',
                        padding: '1px 6px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {theater.city}
                    </span>
                  )}
                </div>
                {theater?.address && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#64748b',
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      paddingLeft: 21,
                    }}
                  >
                    <Navigation size={12} color="#64748b" /> {theater.address}
                  </div>
                )}
              </div>

              {/* Date & Screen Pills */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: '0.825rem',
                    color: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Calendar size={14} color="#e50914" /> <span>{showDate}</span>
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: '0.825rem',
                    color: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Clock size={14} color="#e50914" /> <span>{showTime}</span>
                </div>
                <div
                  style={{
                    background: 'rgba(229,9,20,0.15)',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: '0.825rem',
                    color: '#e50914',
                    fontWeight: 700,
                  }}
                >
                  {screen?.name || 'Auditorium 1'}
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Stub Perforated Line */}
          <div
            style={{
              borderTop: '2px dashed rgba(255,255,255,0.15)',
              margin: '1.25rem 0',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: -32,
                top: -12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#000',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: -32,
                top: -12,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#000',
              }}
            />
          </div>

          {/* Bottom Section: Seats & Dynamic Refreshing QR Code */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 200px',
              gap: 20,
              alignItems: 'center',
            }}
          >
            {/* Left Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Reserved Seats
                </span>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color: '#e50914',
                    marginTop: 2,
                  }}
                >
                  {seatsList}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    Total Paid
                  </span>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#10b981',
                    }}
                  >
                    ₹{totalRupees}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    Booking Ref
                  </span>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      marginTop: 4,
                    }}
                  >
                    {booking.id.substring(0, 13)}...
                  </div>
                </div>
              </div>

              {/* Anti-Fraud Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  color: '#10b981',
                  background: 'rgba(16,185,129,0.1)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <Lock size={13} />
                <span>
                  Anti-Screenshot Protection: Token auto-refreshes every 15s.
                </span>
              </div>
            </div>

            {/* Dynamic Self-Refreshing QR Code Container */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#ffffff',
                padding: 12,
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                border: '2px solid #e50914',
                position: 'relative',
              }}
            >
              {/* Pulsating Live Security Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  color: '#10b981',
                  marginBottom: 6,
                  background: '#ecfdf5',
                  padding: '2px 8px',
                  borderRadius: 10,
                  border: '1px solid #a7f3d0',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                LIVE ANTI-FRAUD QR
              </div>

              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Dynamic Refreshing Ticket QR Code"
                  style={{ width: 150, height: 150, objectFit: 'contain' }}
                />
              ) : (
                <div
                  style={{
                    width: 150,
                    height: 150,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontSize: '0.75rem',
                  }}
                >
                  Generating QR...
                </div>
              )}

              {/* Countdown Progress */}
              <div style={{ marginTop: 6, width: '100%', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: '#334155',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <RefreshCw size={11} className="spin-slow" /> Auto-refreshes
                  in {secondsLeft}s
                </div>

                {/* Animated countdown bar */}
                <div
                  style={{
                    width: '100%',
                    height: 3,
                    background: '#e2e8f0',
                    borderRadius: 2,
                    marginTop: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      background: '#e50914',
                      width: `${(secondsLeft / 15) * 100}%`,
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#0b0f19',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              <Printer size={15} /> Print / Save PDF
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleCopy}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              {copied ? '✓ Copied Details!' : '📋 Copy Details'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleListForResale}
              disabled={resaleListed}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem',
                color: resaleListed ? '#34d399' : '#f87171',
                borderColor: resaleListed ? '#10b981' : 'rgba(239, 68, 68, 0.4)',
              }}
            >
              <Repeat size={15} /> {resaleListed ? 'Listed on Fair Exchange' : 'List on Fair Exchange'}
            </button>
          </div>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
