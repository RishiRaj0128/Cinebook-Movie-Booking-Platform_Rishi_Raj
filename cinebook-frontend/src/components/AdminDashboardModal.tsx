import React, { useState } from 'react';
import { X, Download, ShieldCheck, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface AdminDashboardModalProps {
  onClose: () => void;
  onRefreshMovies: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  onClose,
  onRefreshMovies,
}) => {
  const [tmdbId, setTmdbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmdbId) return;

    setLoading(true);
    setMessage('');
    try {
      const movie = await api.importTmdbMovie(parseInt(tmdbId, 10));
      setMessage(`Successfully imported "${movie.title}"!`);
      onRefreshMovies();
    } catch (err: any) {
      setMessage(`Import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch('/api/tmdb/sync?pages=2', { method: 'POST' });
      const data = await res.json();
      setMessage(
        data.message || `Successfully synced popular movies from TMDB!`
      );
      onRefreshMovies();
    } catch (err: any) {
      setMessage(`TMDB sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 540 }}
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
          <ShieldCheck color="#e50914" /> Admin Control Panel
        </h2>

        {/* Quick Bulk TMDB Sync */}
        <div
          className="glass-panel"
          style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={16} /> Fetch Popular Movies Live from TMDB
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#9ca3af',
              marginBottom: '1rem',
            }}
          >
            Automatically fetches and imports top trending movies directly from
            TMDB API across all genres.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleBulkSync}
            disabled={syncing}
            style={{ width: '100%' }}
          >
            {syncing
              ? 'Fetching TMDB Movies...'
              : '⚡ Bulk Sync Top Movies from TMDB'}
          </button>
        </div>

        {/* Import single movie by ID */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={16} /> Import Specific Movie by TMDB ID
          </h3>
          <form onSubmit={handleImport} style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 550, 27205, 299536"
              value={tmdbId}
              onChange={(e) => setTmdbId(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-secondary"
              disabled={loading}
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
          </form>

          {message && (
            <div
              style={{
                marginTop: '1rem',
                fontSize: '0.875rem',
                color: message.includes('failed') ? '#ef4444' : '#10b981',
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
