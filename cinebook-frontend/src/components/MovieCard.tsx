import React from 'react';
import { Star, Clock, Ticket, Play } from 'lucide-react';
import { Movie } from '../types';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  onPlayTrailer?: (movie: Movie) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onSelect,
  onPlayTrailer,
}) => {
  return (
    <div className="movie-card" onClick={() => onSelect(movie)}>
      <div className="movie-poster-wrap">
        <img
          src={
            movie.posterUrl ||
            'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80'
          }
          alt={movie.title}
          loading="lazy"
        />
        {movie.rating && (
          <div className="rating-badge">
            <Star size={14} fill="#f59e0b" color="#f59e0b" />
            {movie.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>
        <div className="movie-meta">
          <span>{movie.genre}</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Clock size={12} /> {movie.durationMinutes}m
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: '0.75rem' }}>
          {onPlayTrailer && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onPlayTrailer(movie);
              }}
              style={{
                flex: 1,
                padding: '8px 6px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Play size={13} fill="#ffffff" /> Trailer
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(movie);
            }}
            style={{
              flex: 1.4,
              padding: '8px 8px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Ticket size={13} /> Book
          </button>
        </div>
      </div>
    </div>
  );
};
