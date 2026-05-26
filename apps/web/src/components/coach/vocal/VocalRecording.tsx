'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Square } from 'lucide-react';

interface VocalRecordingProps {
  formatted: string;
  elapsedSeconds: number;
  onStop: () => void;
}

export function VocalRecording({ formatted, elapsedSeconds, onStop }: VocalRecordingProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const timerColor = elapsedSeconds >= 240 ? '#EF4444' : '#6B6963';

  useEffect(() => {
    if (panelRef.current) {
      gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className="max-w-[640px] mx-auto flex flex-col items-center pt-16 gap-4"
    >
      {/* Status badge */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            backgroundColor: '#EF4444',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 400, color: '#EF4444', lineHeight: 1.4 }}>
          Enregistrement
        </span>
      </div>

      {/* Stop button */}
      <button
        type="button"
        onClick={onStop}
        className="flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: 9999,
          backgroundColor: '#EF4444',
          boxShadow: '0 4px 8px rgba(239,68,68,0.35)',
          animation: 'pulse-ring 1.5s ease-in-out infinite',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Square size={24} color="white" fill="white" />
      </button>

      {/* Stop hint */}
      <span style={{ fontSize: 14, fontWeight: 400, color: '#6B6963', lineHeight: 1.5, marginTop: 2 }}>
        Arrêter l&apos;enregistrement
      </span>

      {/* Timer */}
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: timerColor,
          lineHeight: 1.35,
          transition: 'color 500ms ease',
        }}
      >
        {formatted}
      </span>

      {/* Duration max hint */}
      <span style={{ fontSize: 12, fontWeight: 400, color: '#6B6963', lineHeight: 1.4, marginTop: -8 }}>
        Durée max : 5 min
      </span>
    </div>
  );
}
