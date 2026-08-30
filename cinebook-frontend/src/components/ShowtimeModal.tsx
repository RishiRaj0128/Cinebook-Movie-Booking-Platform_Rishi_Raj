import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Calendar, Navigation, Building2, Play } from 'lucide-react';
import { Movie, Show, Theater } from '../types';
import { api } from '../services/api';

interface ShowtimeModalProps {
  movie: Movie;
  onClose: () => void;
  onSelectShow: (show: Show) => void;
  onPlayTrailer?: (movie: Movie) => void;
}

const DEFAULT_THEATERS: Theater[] = [
  { id: 'th-mumbai', name: "PVR IMAX Director's Cut", city: 'Mumbai', address: 'Phoenix Palladium, Lower Parel, Mumbai' },
  { id: 'th-delhi', name: 'Cinepolis VIP Saket', city: 'Delhi', address: 'DLF Avenue Mall, Saket, New Delhi' },
  { id: 'th-bengaluru', name: 'INOX Megaplex Mantri', city: 'Bengaluru', address: 'Mantri Square Mall, Malleshwaram, Bengaluru' },
  { id: 'th-hyderabad', name: 'Prasads IMAX Multiplex', city: 'Hyderabad', address: 'NTR Gardens, Khairatabad, Hyderabad' },
  { id: 'th-chennai', name: 'SPI Palazzo Multiplex', city: 'Chennai', address: 'Nexus Vijaya Mall, Vadapalani, Chennai' },
  { id: 'th-kolkata', name: 'PVR Mani Square Superplex', city: 'Kolkata', address: 'Mani Square Mall, EM Bypass, Kolkata' },
  { id: 'th-pune', name: 'Cinepolis Westend', city: 'Pune', address: 'Westend Mall, Aundh, Pune' },
  { id: 'th-ahmedabad', name: 'PVR Acropolis Mall', city: 'Ahmedabad', address: 'Thaltej Cross Road, Ahmedabad' },
  { id: 'th-jaipur', name: 'INOX Crystal Palm', city: 'Jaipur', address: 'Sardar Patel Marg, C Scheme, Jaipur' },
  { id: 'th-lucknow', name: 'Wave Cinemas Gomti Nagar', city: 'Lucknow', address: 'Vibhuti Khand, Gomti Nagar, Lucknow' },
  { id: 'th-kochi', name: 'PVR Lulu International Mall', city: 'Kochi', address: 'Edappally, Kochi, Kerala' },
  { id: 'th-chandigarh', name: 'PVR Elante Mall', city: 'Chandigarh', address: 'Industrial Area Phase 1, Chandigarh' },
  { id: 'th-indore', name: 'INOX C21 Mall', city: 'Indore', address: 'AB Road, Scheme 54, Indore' },
  { id: 'th-vizag', name: 'Cinepolis Jagadamba Junction', city: 'Visakhapatnam', address: 'Chitralaya Mall, Visakhapatnam' },
  { id: 'th-surat', name: 'Rajhans Cinema Multiplex', city: 'Surat', address: 'Pal Hazira Road, Adajan, Surat' },
  { id: 'th-patna', name: 'Cinepolis Patna Central Mall', city: 'Patna', address: 'Fraser Road, Patna, Bihar' },
  { id: 'th-bhubaneswar', name: 'Inox Symphony Mall', city: 'Bhubaneswar', address: 'Rudrapur, NH 16, Bhubaneswar' },
  { id: 'th-guwahati', name: 'PVR City Centre', city: 'Guwahati', address: 'GS Road, Christian Basti, Guwahati' },
];

const formatLocalDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ShowtimeModal: React.FC<ShowtimeModalProps> = ({ movie, onClose, onSelectShow, onPlayTrailer }) => {
  const [selectedDate, setSelectedDate] = useState<string>(formatLocalDate(new Date()));
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [allCities, setAllCities] = useState<string[]>([]);
  const [allTheaters, setAllTheaters] = useState<Theater[]>(DEFAULT_THEATERS);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate dynamic shows for current movie and date across theaters
  const generateDynamicShows = (currentMovie: Movie, dateStr: string, theaterList: Theater[]): Show[] => {
    const slots = [
      { time: '10:30', endTime: '13:00', price: 22000, label: '10:30 AM' },
      { time: '14:15', endTime: '16:45', price: 26000, label: '02:15 PM' },
      { time: '18:45', endTime: '21:15', price: 30000, label: '06:45 PM' },
      { time: '21:30', endTime: '23:55', price: 28000, label: '09:30 PM' },
    ];

    const generated: Show[] = [];
    const sourceTheaters = theaterList.length > 0 ? theaterList : DEFAULT_THEATERS;

    sourceTheaters.forEach((theater, tIdx) => {
      // Pick 3 or 4 slots per theater
      const theaterSlots = slots.slice((tIdx % 2 === 0) ? 0 : 1, 4);
      theaterSlots.forEach((slot, sIdx) => {
        generated.push({
          id: `sh-${theater.id || tIdx}-${currentMovie.id}-${dateStr}-${slot.time.replace(':', '')}`,
          movie: currentMovie,
          screen: {
            id: `screen-${theater.id || tIdx}`,
            name: sIdx === 0 ? 'Audi 1 (IMAX 4K Laser)' : sIdx === 1 ? 'Audi 2 (Dolby Atmos)' : 'Audi 3 (4DX)',
            totalRows: 5,
            totalColumns: 8,
            theater,
          },
          startTime: `${dateStr}T${slot.time}:00`,
          endTime: `${dateStr}T${slot.endTime}:00`,
          basePrice: slot.price,
          isActive: true,
        });
      });
    });

    return generated;
  };

  useEffect(() => {
    api.getTheaters().then(theaters => {
      if (theaters && theaters.length > 0) {
        setAllTheaters(theaters);
        const cityNames = Array.from(new Set(theaters.map(t => t.city).filter(Boolean)));
        setAllCities(cityNames);
      } else {
        setAllTheaters(DEFAULT_THEATERS);
        setAllCities(DEFAULT_THEATERS.map(t => t.city));
      }
    }).catch(() => {
      setAllTheaters(DEFAULT_THEATERS);
      setAllCities(DEFAULT_THEATERS.map(t => t.city));
    });
  }, []);

  useEffect(() => {
    fetchShows();
  }, [movie.id, selectedDate, allTheaters]);

  const fetchShows = async () => {
    setLoading(true);
    try {
      let data = await api.getShows(movie.id, selectedDate);
      if (!data || data.length === 0) {
        data = generateDynamicShows(movie, selectedDate, allTheaters);
      }
      setShows(data);
    } catch {
      const fallback = generateDynamicShows(movie, selectedDate, allTheaters);
      setShows(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Generate next 7 dates with full formatted labels
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = formatLocalDate(d);
    return {
      dateStr,
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      fullFormatted: d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    };
  });

  const activeDateObj = dates.find(d => d.dateStr === selectedDate) || dates[0];

  // Group shows by theater & filter by city
  const filteredShows = shows.filter(show => {
    if (selectedCity === 'All') return true;
    const city = show.screen?.theater?.city || '';
    return city.toLowerCase() === selectedCity.toLowerCase();
  });

  const theaterMap = new Map<string, { theater: any; shows: Show[] }>();
  filteredShows.forEach(show => {
    const t = show.screen?.theater;
    const tKey = t ? (t.id || t.name) : 'default';
    if (!theaterMap.has(tKey)) {
      theaterMap.set(tKey, { theater: t, shows: [] });
    }
    theaterMap.get(tKey)!.shows.push(show);
  });

  // Combine fetched cities with cities present in current shows & default theaters
  const availableCities = Array.from(
    new Set([
      ...allCities,
      ...allTheaters.map(t => t.city).filter(Boolean),
      ...shows.map(s => s.screen?.theater?.city).filter(Boolean)
    ])
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 800, padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        {/* Movie Header */}
        <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem', alignItems: 'center' }}>
          <img
            src={movie.posterUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80'}
            alt={movie.title}
            style={{ width: 75, height: 105, borderRadius: 12, objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          />
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f3f4f6', marginBottom: 4 }}>{movie.title}</h2>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span>{movie.genre}</span>
              <span>•</span>
              <span>{movie.durationMinutes} mins</span>
              <span>•</span>
              <span style={{ color: '#e50914', fontWeight: 600 }}>{movie.language}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={14} color="#e50914" /> {activeDateObj.fullFormatted}
              </span>
              {onPlayTrailer && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onPlayTrailer(movie)}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Play size={12} fill="#ffffff" /> Watch Trailer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date & City Selector Control Bar */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header Bar: City Selection Label */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e50914', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 size={16} /> Select Location / City:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={16} color="#e50914" />
              <select
                className="form-input"
                style={{ width: 'auto', padding: '6px 14px', fontSize: '0.875rem', fontWeight: 600, background: '#111827', borderColor: 'rgba(229,9,20,0.5)', color: '#ffffff' }}
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="All">All Cities ({availableCities.length})</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates Bar (7 Days) */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 4, paddingBottom: 4 }}>
            {dates.map((d) => (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                style={{
                  flex: 1,
                  minWidth: 85,
                  padding: '8px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: selectedDate === d.dateStr ? '2px solid #e50914' : '1px solid rgba(255,255,255,0.1)',
                  background: selectedDate === d.dateStr ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: selectedDate === d.dateStr ? '#e50914' : '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>{d.dayName}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: selectedDate === d.dateStr ? '#e50914' : '#f3f4f6' }}>{d.dayNum}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{d.month}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Shows grouped by Theater */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading theater showtimes & locations...</div>
        ) : theaterMap.size === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px border var(--border-color)' }}>
            No showtimes scheduled for {activeDateObj.fullFormatted} in {selectedCity === 'All' ? 'any city' : selectedCity}. Try selecting another date!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {Array.from(theaterMap.values()).map(({ theater, shows: theaterShows }) => (
              <div key={theater?.id || Math.random()} className="glass-panel" style={{ padding: '1.25rem' }}>
                {/* Theater Name & Full Address */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={18} color="#e50914" /> {theater?.name || 'PVR Cinemas'}
                    {theater?.city && (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(229,9,20,0.2)', color: '#e50914', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                        {theater.city}
                      </span>
                    )}
                  </div>
                  {theater?.address && (
                    <div style={{ fontSize: '0.825rem', color: '#9ca3af', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 24 }}>
                      <Navigation size={12} color="#6b7280" /> {theater.address}
                    </div>
                  )}
                </div>

                {/* Showtime Pills */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {theaterShows.map((show) => {
                    const startTimeFormatted = new Date(show.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <button
                        key={show.id}
                        className="btn btn-primary"
                        onClick={() => onSelectShow(show)}
                        style={{
                          padding: '8px 16px',
                          fontSize: '0.875rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800 }}>
                          <Clock size={13} /> {startTimeFormatted}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                          {show.screen?.name} • ₹{show.basePrice / 100}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
