import React from 'react';
import { Eye, Volume2, Compass, Sparkles } from 'lucide-react';
import { SeatSightlineInfo } from '../../types';

interface SeatSightlinePreviewProps {
  rowLabel: string;
  seatNumber: number;
  movieTitle?: string;
}

export const getSightlineMetrics = (row: string, col: number): SeatSightlineInfo => {
  const rowUpper = row.toUpperCase();
  const rowOffsets: Record<string, { dist: number; neck: number; fov: number; audio: number }> = {
    A: { dist: 4.5, neck: 32, fov: 62, audio: 78 },
    B: { dist: 7.2, neck: 22, fov: 54, audio: 86 },
    C: { dist: 10.8, neck: 12, fov: 44, audio: 98 },
    D: { dist: 14.5, neck: 7, fov: 37, audio: 94 },
    E: { dist: 18.2, neck: 3, fov: 31, audio: 88 },
  };

  const base = rowOffsets[rowUpper] || { dist: 11.0, neck: 12, fov: 42, audio: 90 };
  const colCenterDist = Math.abs(col - 4.5); // 0.5 to 3.5
  const isCenter = colCenterDist <= 1.5;

  let verdict: SeatSightlineInfo['verdict'] = 'SWEET_SPOT';
  let desc = 'Prime Dolby Atmos audio sweetspot with centered, zero-distortion viewing.';

  if (rowUpper === 'A') {
    verdict = 'ULTRA_IMMERSIVE';
    desc = 'Maximum field of view covering peripheral vision. Noticeable upward neck tilt.';
  } else if (rowUpper === 'E') {
    verdict = 'PANORAMIC';
    desc = 'Wide relaxing sightline at eye-level with spacious recliner comfort.';
  } else if (!isCenter) {
    verdict = 'SIDE_ANGLE';
    desc = `Off-center perspective (${Math.round(colCenterDist * 8)}° angle). Best when center seats are filled.`;
  }

  const finalAudio = Math.max(70, Math.round(base.audio - colCenterDist * 4));

  return {
    rowLabel: rowUpper,
    seatNumber: col,
    distanceMeters: base.dist,
    verticalNeckAngleDeg: base.neck,
    horizontalFovDeg: base.fov,
    audioSweetSpotPercent: finalAudio,
    verdict,
    verdictDescription: desc,
  };
};

export const SeatSightlinePreview: React.FC<SeatSightlinePreviewProps> = ({
  rowLabel,
  seatNumber,
  movieTitle,
}) => {
  const metrics = getSightlineMetrics(rowLabel, seatNumber);

  // Perspective transforms based on row and column
  const rowUpper = rowLabel.toUpperCase();
  const scaleMap: Record<string, number> = { A: 1.45, B: 1.25, C: 1.05, D: 0.9, E: 0.78 };
  const screenScale = scaleMap[rowUpper] || 1.0;
  const colOffset = (seatNumber - 4.5) * 8; // -28 to +28 deg rotateY

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(30, 41, 59, 0.95))',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '16px',
        padding: '1.25rem',
        color: '#f9fafb',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #e50914, #b20710)',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
            }}
          >
            <Eye size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: 1 }}>
              Seat Sightline 3D Simulator
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              View from Seat <span style={{ color: '#f87171' }}>{rowLabel}{seatNumber}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            background:
              metrics.verdict === 'SWEET_SPOT'
                ? 'rgba(16, 185, 129, 0.2)'
                : metrics.verdict === 'ULTRA_IMMERSIVE'
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(59, 130, 246, 0.2)',
            border:
              metrics.verdict === 'SWEET_SPOT'
                ? '1px solid #10b981'
                : metrics.verdict === 'ULTRA_IMMERSIVE'
                ? '1px solid #ef4444'
                : '1px solid #3b82f6',
            color:
              metrics.verdict === 'SWEET_SPOT'
                ? '#34d399'
                : metrics.verdict === 'ULTRA_IMMERSIVE'
                ? '#f87171'
                : '#60a5fa',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Sparkles size={12} /> {metrics.verdict.replace('_', ' ')}
        </div>
      </div>

      {/* 3D Simulated Cinema Auditorium Box */}
      <div
        style={{
          height: '160px',
          background: 'radial-gradient(ellipse at 50% 20%, #1f2937 0%, #030712 90%)',
          borderRadius: '12px',
          position: 'relative',
          perspective: '500px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1rem',
        }}
      >
        {/* Ambient Cinema Lighting Glow */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            width: '80%',
            height: '40px',
            background: 'radial-gradient(circle, rgba(229, 9, 20, 0.3) 0%, transparent 70%)',
            filter: 'blur(10px)',
          }}
        />

        {/* Curved Projected Screen */}
        <div
          style={{
            width: `${Math.min(95, 60 * screenScale)}%`,
            height: `${Math.min(95, 65 * screenScale)}px`,
            background: 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 70%, #94a3b8 100%)',
            borderRadius: '6px',
            boxShadow: '0 0 25px rgba(255, 255, 255, 0.4), 0 10px 30px rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotateY(${-colOffset * 0.7}deg) translateZ(${Math.round(20 * screenScale)}px)`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            position: 'relative',
            color: '#0f172a',
            padding: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>
            IMAX CURVED SCREEN
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 900,
              maxWidth: '90%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {movieTitle || 'NOW SHOWING'}
          </div>
        </div>

        {/* Stage & Speaker Floor Guide */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            width: '90%',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: '#6b7280',
            padding: '0 1rem',
          }}
        >
          <span>◀ Left Channel</span>
          <span style={{ color: '#9ca3af' }}>Seat {rowLabel}{seatNumber} Perspective</span>
          <span>Right Channel ▶</span>
        </div>
      </div>

      {/* Numerical Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '0.75rem',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Distance</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>
            {metrics.distanceMeters}m
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Neck Tilt</div>
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: metrics.verticalNeckAngleDeg > 20 ? '#f87171' : '#34d399',
            }}
          >
            {metrics.verticalNeckAngleDeg}°
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>FOV Angle</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f3f4f6' }}>
            {metrics.horizontalFovDeg}°
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Volume2 size={11} /> Atmos
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
            {metrics.audioSweetSpotPercent}%
          </div>
        </div>
      </div>

      {/* Description text */}
      <div
        style={{
          fontSize: '0.8rem',
          color: '#d1d5db',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '8px 12px',
          borderRadius: '8px',
          borderLeft: '3px solid #e50914',
          lineHeight: 1.4,
        }}
      >
        {metrics.verdictDescription}
      </div>
    </div>
  );
};
