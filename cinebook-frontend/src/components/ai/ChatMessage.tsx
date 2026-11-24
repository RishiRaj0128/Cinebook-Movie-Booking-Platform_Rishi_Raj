import React from 'react';
import { Sparkles, User, Film, Star } from 'lucide-react';
import { AiChatMessage } from '../../types';
import { ToolExecutionStatus } from './ToolExecutionStatus';
import { FeedbackButtons } from './FeedbackButtons';

interface ChatMessageProps {
  message: AiChatMessage;
  onSelectMovieTitle?: (title: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageProps> = ({
  message,
  onSelectMovieTitle,
}) => {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 10,
        marginBottom: '1rem',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isUser
            ? 'linear-gradient(135deg, #4f46e5, #06b6d4)'
            : 'linear-gradient(135deg, #e50914, #ff5722)',
          color: '#fff',
        }}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* Bubble Container */}
      <div
        style={{
          maxWidth: '82%',
          background: isUser
            ? 'rgba(79, 70, 229, 0.2)'
            : 'rgba(25, 30, 48, 0.85)',
          border: isUser
            ? '1px solid rgba(79, 70, 229, 0.4)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: '0.85rem 1rem',
          color: '#e5e7eb',
          fontSize: '0.9rem',
          lineHeight: '1.5',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {/* Tool Call Badges */}
        {!isUser && <ToolExecutionStatus toolCalls={message.toolCalls} />}

        {/* Text Content */}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>

        {/* Embedded Movie Cards */}
        {message.recommendedMovies && message.recommendedMovies.length > 0 && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {message.recommendedMovies.map((movie, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 20, 35, 0.8)',
                  border: '1px solid rgba(229, 9, 20, 0.25)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      background: 'rgba(229, 9, 20, 0.15)',
                      borderRadius: '6px',
                      padding: '6px',
                      display: 'flex',
                    }}
                  >
                    <Film size={16} color="#e50914" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                      {movie.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                      {movie.genre} {movie.rating ? `• ★ ${movie.rating}` : ''}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FeedbackButtons movieId={movie.id || movie.movieId} />
                  {onSelectMovieTitle && (
                    <button
                      onClick={() => onSelectMovieTitle(movie.title)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      View Shows
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
