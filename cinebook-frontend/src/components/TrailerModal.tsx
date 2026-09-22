import React from 'react';
import { X, Film, Star, ExternalLink } from 'lucide-react';
import { Movie } from '../types';

interface TrailerModalProps {
  movie: Movie;
  onClose: () => void;
}

const TRAILER_MAP: Record<string, string> = {
  'the odyssey': 'odDvRxuP2wQ',
  rrr: 'Gy4B78S1-dU',
  jawan: 'COv52Qyctws',
  pathaan: 'vqu4z34wENw',
  'stree 2': 'KVnheXwqF08',
  'kalki 2898 ad': 'kQDd1AhGIHk',
  'k.g.f: chapter 2': 'JKa05nyUmuQ',
  'k.g.f: chapter 1': '-KfsY-qwBSY',
  kantara: '858485',
  leo: 'Po3jStA673E',
  jailer: 'Y5BeWdODb7c',
  inception: 'YoHD9XEInc0',
  interstellar: 'zSWdZVtXT7E',
  'avatar: the way of water': 'd9MyW72ELq0',
  'the dark knight': 'EXeTwQWrcwY',
  'dune: part two': 'Way9Dexny3w',
  moana: 'LKFuXETZusI',
  'toy story 5': '4j7F0F77Nsc',
  supergirl: 'Qd-y66aRzXg',
  'scary movie': 'tLknq7kI8-0',
};

export function extractYouTubeId(url?: string | null, title?: string): string {
  if (url) {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
      return match[2];
    }
  }
  if (title) {
    const cleanTitle = title.toLowerCase().trim();
    for (const [key, id] of Object.entries(TRAILER_MAP)) {
      if (cleanTitle.includes(key) || key.includes(cleanTitle)) {
        return id;
      }
    }
  }
  return '';
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  movie,
  onClose,
}) => {
  const videoId = extractYouTubeId(movie.trailerUrl, movie.title);

  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`
    : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(movie.title + ' official trailer')}&autoplay=1`;

  const directWatchUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' official trailer')}`;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 1100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 920,
          width: '95%',
          background: '#0f172a',
          borderRadius: 16,
          padding: '1.5rem',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'rgba(229,9,20,0.2)',
                color: '#e50914',
                padding: 8,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Film size={20} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                }}
              >
                {movie.title} — Official Trailer
              </h3>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  display: 'flex',
                  gap: 10,
                  marginTop: 2,
                  flexWrap: 'wrap',
                }}
              >
                <span>{movie.genre}</span>
                <span>•</span>
                <span>{movie.language || 'English'}</span>
                {movie.rating && (
                  <>
                    <span>•</span>
                    <span
                      style={{
                        color: '#f59e0b',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />{' '}
                      {movie.rating.toFixed(1)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 16:9 In-Site Embedded Video Player */}
        <div
          style={{
            position: 'relative',
            paddingBottom: '56.25%',
            height: 0,
            overflow: 'hidden',
            borderRadius: 12,
            background: '#000000',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <iframe
            src={embedUrl}
            title={`${movie.title} Official Trailer`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Video Fallback Toolbar */}
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            🎬 In-Site Video Player • Playing Official Trailer for {movie.title}
          </span>

          <a
            href={directWatchUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.75rem',
              color: '#38bdf8',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600,
            }}
          >
            <ExternalLink size={12} /> Open in YouTube Player
          </a>
        </div>
      </div>
    </div>
  );
};
