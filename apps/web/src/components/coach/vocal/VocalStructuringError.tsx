'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { AlertTriangle } from 'lucide-react';

interface VocalStructuringErrorProps {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export function VocalStructuringError({
  message,
  onRetry,
  onBack,
}: VocalStructuringErrorProps): React.ReactElement {
  const blockRef = useRef<HTMLDivElement>(null);
  const retryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!blockRef.current) return;

    // Entrance animation
    gsap.from(blockRef.current, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.out' });
    // Shake animation
    gsap.to(blockRef.current, {
      keyframes: { x: [-6, 6, -4, 4, -2, 2, 0] },
      duration: 0.3,
      delay: 0.2,
    });
  }, []);

  function handleRetry() {
    if (retryBtnRef.current) {
      gsap.to(retryBtnRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });
    }
    onRetry();
  }

  return (
    <div
      style={{
        maxWidth: 640,
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Error block */}
      <div
        ref={blockRef}
        role="alert"
        style={{
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 8,
          padding: 16,
        }}
      >
        {/* Icon row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>
            La structuration a échoué.
          </p>
        </div>
        {/* Body */}
        <p style={{ fontSize: 12, fontWeight: 400, color: '#6B6963', marginTop: 4 }}>
          {message ||
            "Claude n'a pas pu analyser le retour vocal. Vérifiez votre connexion ou réessayez."}
        </p>
      </div>

      {/* Button row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {/* Retour — ghost */}
        <button
          type="button"
          onClick={onBack}
          style={{
            height: 40,
            paddingLeft: 24,
            paddingRight: 24,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 400,
            border: '1px solid #E2E0DA',
            backgroundColor: '#FFFFFF',
            color: '#1C1A17',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0EFE9';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF';
          }}
        >
          Retour
        </button>

        {/* Réessayer — primary */}
        <button
          ref={retryBtnRef}
          type="button"
          onClick={handleRetry}
          style={{
            height: 40,
            paddingLeft: 24,
            paddingRight: 24,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: '#FF5C1A',
            color: '#FFFFFF',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#E5521A';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FF5C1A';
          }}
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
