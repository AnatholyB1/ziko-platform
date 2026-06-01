'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

export function VocalStructuring(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.from(containerRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="max-w-[640px] mx-auto flex flex-col items-center"
      style={{ paddingLeft: 24, paddingRight: 24, marginTop: 48 }}
    >
      {/* CSS spinner — reuses Tailwind animate-spin (same as VocalTranscribing) */}
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
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#1C1A17',
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        Structuration en cours…
      </p>

      {/* Body */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#6B6963',
          textAlign: 'center',
          maxWidth: 300,
          lineHeight: 1.5,
          marginTop: 8,
        }}
      >
        Claude analyse le retour vocal et le contexte de l&apos;athlète. Cela prend
        généralement 5 à 10 secondes.
      </p>
    </div>
  );
}
