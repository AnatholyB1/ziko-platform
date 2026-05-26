'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

export function VocalTranscribing(): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className="max-w-[640px] mx-auto flex flex-col items-center pt-16"
    >
      {/* CSS spinner */}
      <div
        className="animate-spin rounded-full"
        style={{
          width: 32,
          height: 32,
          border: '4px solid #E2E0DA',
          borderTopColor: '#FF5C1A',
        }}
      />

      {/* Heading */}
      <p
        className="text-center mt-4"
        style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', lineHeight: 1.5 }}
      >
        Transcription en cours…
      </p>

      {/* Body */}
      <p
        className="text-center mt-2"
        style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#6B6963',
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        L&apos;audio est en cours de traitement. Cela prend généralement 5 à 15 secondes.
      </p>
    </div>
  );
}
