import React from 'react';
import { Film, User, LogOut, Ticket, MapPin, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  selectedCity: string;
  cities: string[];
  onSelectCity: (city: string) => void;
  onOpenAuth: () => void;
  onOpenBookings: () => void;
  onOpenAdmin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedCity,
  cities,
  onSelectCity,
  onOpenAuth,
  onOpenBookings,
  onOpenAdmin,
}) => {
  const { user, logout, isAdmin } = useAuth();

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a href="/" className="brand-logo">
          <Film className="w-7 h-7 text-red-600" color="#e50914" size={28} />
          Cine<span>Book</span>
        </a>

        {/* Global City Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.06)',
            padding: '4px 12px',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <MapPin size={15} color="#e50914" />
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f3f4f6',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option
              value="All"
              style={{ background: '#111827', color: '#fff' }}
            >
              All Cities
            </option>
            {Array.from(
              new Set([
                ...cities,
                'Ahmedabad',
                'Bengaluru',
                'Bhubaneswar',
                'Chandigarh',
                'Chennai',
                'Delhi',
                'Guwahati',
                'Hyderabad',
                'Indore',
                'Jaipur',
                'Kochi',
                'Kolkata',
                'Lucknow',
                'Mumbai',
                'Patna',
                'Pune',
                'Surat',
                'Visakhapatnam',
              ])
            )
              .sort()
              .map((city) => (
                <option
                  key={city}
                  value={city}
                  style={{ background: '#111827', color: '#fff' }}
                >
                  {city}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={onOpenAdmin}>
            <PlusCircle size={16} /> Admin Panel
          </button>
        )}

        {user ? (
          <>
            <button className="btn btn-secondary" onClick={onOpenBookings}>
              <Ticket size={16} /> My Tickets
            </button>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(255,255,255,0.05)',
                padding: '6px 12px',
                borderRadius: '20px',
              }}
            >
              <User size={16} color="#e50914" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {user.fullName || user.email}
              </span>
            </div>
            <button
              className="btn btn-secondary"
              style={{ padding: '8px' }}
              onClick={logout}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={onOpenAuth}>
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
