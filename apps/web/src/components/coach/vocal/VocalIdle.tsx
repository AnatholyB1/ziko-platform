'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { IoMicOutline } from 'react-icons/io5';

interface VocalIdleProps {
  onStart: () => void;
}

export function VocalIdle({ onStart }: VocalIdleProps): React.ReactElement {
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
      {/* Mic icon circle */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 64,
          height: 64,
          backgroundColor: '#F0EFE9',
          border: '1px solid #E2E0DA',
          borderRadius: 9999,
        }}
      >
        <IoMicOutline size={28} color="#6B6963" />
      </div>

      {/* Heading */}
      <h2
        className="text-center mt-6"
        style={{ fontSize: 18, fontWeight: 600, color: '#1C1A17', lineHeight: 1.35 }}
      >
        Enregistrer un retour
      </h2>

      {/* Body copy */}
      <p
        className="text-center mt-2"
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: '#6B6963',
          maxWidth: 300,
          lineHeight: 1.5,
        }}
      >
        Appuyez pour enregistrer un retour vocal pour cet athlète. Durée max : 5 min.
      </p>

      {/* CTA button */}
      <button
        type="button"
        onClick={onStart}
        className="mt-6 rounded-lg"
        style={{
          backgroundColor: '#FF5C1A',
          color: '#FFFFFF',
          height: 44,
          paddingLeft: 24,
          paddingRight: 24,
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Nouveau retour
      </button>
    </div>
  );
}
