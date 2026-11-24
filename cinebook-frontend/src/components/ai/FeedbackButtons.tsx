import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { api } from '../../services/api';

interface FeedbackButtonsProps {
  movieId?: string;
  recommendationEventId?: string;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  movieId,
  recommendationEventId,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState<'UP' | 'DOWN' | null>(null);

  const handleFeedback = async (type: 'THUMBS_UP' | 'THUMBS_DOWN') => {
    if (feedbackGiven || !movieId) return;
    setFeedbackGiven(type === 'THUMBS_UP' ? 'UP' : 'DOWN');
    try {
      await api.submitAiFeedback({
        movieId,
        feedbackType: type,
        recommendationEventId,
      });
    } catch {
      // Non-blocking telemetry
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={() => handleFeedback('THUMBS_UP')}
        disabled={feedbackGiven !== null}
        title="Helpful recommendation"
        style={{
          background: feedbackGiven === 'UP' ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          padding: '3px 6px',
          color: feedbackGiven === 'UP' ? '#34d399' : '#9ca3af',
          cursor: feedbackGiven ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
        }}
      >
        {feedbackGiven === 'UP' ? <Check size={12} /> : <ThumbsUp size={12} />}
      </button>

      <button
        onClick={() => handleFeedback('THUMBS_DOWN')}
        disabled={feedbackGiven !== null}
        title="Not for me"
        style={{
          background: feedbackGiven === 'DOWN' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          padding: '3px 6px',
          color: feedbackGiven === 'DOWN' ? '#ef4444' : '#9ca3af',
          cursor: feedbackGiven ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
        }}
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  );
};
