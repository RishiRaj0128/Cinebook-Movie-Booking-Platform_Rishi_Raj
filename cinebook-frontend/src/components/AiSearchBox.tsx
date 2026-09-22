import React, { useState } from 'react';
import { Sparkles, Search, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export const AiSearchBox: React.FC = () => {
  const [query, setQuery] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecommend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await api.getAiRecommendations(query);
      setRecommendation(result);
    } catch (err) {
      setRecommendation('Failed to fetch recommendations. Try another search!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-box">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: '0.75rem',
        }}
      >
        <Sparkles size={20} color="#e50914" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
          CineBook AI Assistant
        </h3>
      </div>
      <p
        style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem' }}
      >
        Ask for movie recommendations in plain language (e.g. "I want an action
        movie in Hindi")
      </p>

      <form onSubmit={handleRecommend} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          className="form-input"
          placeholder="What kind of movie are you looking for?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Search size={18} />
          )}{' '}
          Recommend
        </button>
      </form>

      {recommendation && (
        <div
          style={{
            marginTop: '1rem',
            background: 'rgba(0,0,0,0.3)',
            padding: '1rem',
            borderRadius: 12,
            fontSize: '0.9rem',
            whiteSpace: 'pre-line',
            borderLeft: '4px solid #e50914',
          }}
        >
          {recommendation}
        </div>
      )}
    </div>
  );
};
