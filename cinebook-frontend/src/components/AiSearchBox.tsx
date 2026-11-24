import React, { useState } from 'react';
import { Sparkles, Search, Loader2, Heart, Film } from 'lucide-react';
import { api } from '../services/api';

interface AiSearchBoxProps {
  onSelectMovieTitle?: (title: string) => void;
}

export const AiSearchBox: React.FC<AiSearchBoxProps> = ({ onSelectMovieTitle }) => {
  const [activeTab, setActiveTab] = useState<'recommend' | 'itinerary'>('recommend');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const itineraryPresets = [
    {
      label: '🌹 Romantic Date Night',
      query: 'Plan a romantic date night in Mumbai: Italian dinner at 7 PM, followed by a lighthearted or romantic movie at 8:30 PM, interval snacks, and rooftop gelato.',
    },
    {
      label: '⚡ Action Night with Friends',
      query: 'Plan a high-energy evening with friends: Burgers & craft shakes, high-octane action thriller at IMAX, queso nachos at interval, and late-night diner.',
    },
    {
      label: '👨‍👩‍👧 Family Matinee with Kids',
      query: 'Plan a relaxing family Sunday outing: Kids friendly pizza lunch, animated or family adventure movie around 2 PM, and churros at interval.',
    },
    {
      label: '🌙 Late Night Cinephile',
      query: 'Plan a late-night solo/cinephile experience: Atmospheric cafe for reading, gripping mystery or neo-noir movie after 10 PM, and 24/7 coffee stop.',
    },
  ];

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setResult('');
    try {
      const response = await api.getAiRecommendations(q);
      setResult(response);
    } catch {
      setResult('Failed to connect to CineBook AI concierge. Please check your query or try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <div
      className="ai-box"
      style={{
        background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.95), rgba(10, 13, 22, 0.95))',
        border: '1px solid rgba(229, 9, 20, 0.3)',
        borderRadius: '20px',
        padding: '1.5rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header with Mode Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #e50914, #ff5722)',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
            }}
          >
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', margin: 0 }}>
              CineBook AI Concierge
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af' }}>
              Powered by Groq Llama 3.3 70B & Instant Catalog Sync
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.06)',
            padding: '4px',
            borderRadius: '12px',
            gap: 4,
          }}
        >
          <button
            onClick={() => {
              setActiveTab('recommend');
              setResult('');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'recommend' ? '#e50914' : 'transparent',
              color: activeTab === 'recommend' ? '#fff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Film size={14} /> Movie Matcher
          </button>
          <button
            onClick={() => {
              setActiveTab('itinerary');
              setResult('');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'itinerary' ? '#e50914' : 'transparent',
              color: activeTab === 'itinerary' ? '#fff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <Heart size={14} /> Date & Outing Planner
          </button>
        </div>
      </div>

      {activeTab === 'itinerary' && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 800, letterSpacing: 1, marginBottom: 8 }}>
            Popular Outing Blueprints (Click to Plan Instantly)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {itineraryPresets.map((preset, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(preset.query);
                  handleSearch(preset.query);
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  color: '#e5e7eb',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          className="form-input"
          placeholder={
            activeTab === 'itinerary'
              ? 'e.g. "Romantic dinner + movie outing for two in Delhi this Saturday"'
              : 'e.g. "I want an adrenaline-pumping Kannada action thriller with great music"'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flexGrow: 1,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#fff',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{
            padding: '0 24px',
            borderRadius: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 20px rgba(229, 9, 20, 0.4)',
          }}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
          {activeTab === 'itinerary' ? 'Plan Outing' : 'Recommend'}
        </button>
      </form>

      {/* AI Output Stream */}
      {result && (
        <div
          style={{
            marginTop: '1.25rem',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '1.25rem',
            borderRadius: '16px',
            fontSize: '0.925rem',
            lineHeight: 1.6,
            borderLeft: '4px solid #e50914',
            border: '1px solid rgba(229, 9, 20, 0.25)',
            color: '#f3f4f6',
            whiteSpace: 'pre-line',
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
};
