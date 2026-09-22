import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({ email, password, fullName, phone });
        login(res.accessToken, {
          id: res.userId,
          email: res.email,
          fullName: res.fullName,
          role: res.role,
        });
      } else {
        const res = await api.login({ email, password });
        login(res.accessToken, {
          id: res.userId,
          email: res.email,
          fullName: res.fullName,
          role: res.role,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
            textAlign: 'center',
          }}
        >
          {isRegister ? 'Create an Account' : 'Welcome Back'}
        </h2>

        {error && (
          <div
            style={{
              background: 'rgba(229, 9, 20, 0.15)',
              border: '1px solid #e50914',
              color: '#f87171',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label>Full Name</label>

                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>

                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegister ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#9ca3af',
          }}
        >
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#e50914',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
