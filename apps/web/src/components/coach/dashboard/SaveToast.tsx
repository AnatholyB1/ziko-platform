'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

interface SaveToastProps {
  onUndo: () => void;
  onDismiss: () => void;
  message?: string;
}

export function SaveToast({ onUndo, onDismiss, message }: SaveToastProps) {
  const toastRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toastRef.current) {
      // Entrance animation
      gsap.from(toastRef.current, {
        y: 16,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.out',
      });
    }

    // Auto-dismiss after 3000ms
    timerRef.current = setTimeout(() => {
      if (toastRef.current) {
        gsap.to(toastRef.current, {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: onDismiss,
        });
      } else {
        onDismiss();
      }
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (toastRef.current) gsap.killTweensOf(toastRef.current);
    onDismiss();
  }

  function handleUndo() {
    onUndo();
    onDismiss();
  }

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 w-80 bg-white rounded-xl z-50"
      style={{
        borderLeft: '4px solid #22C55E',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(28,26,23,0.10)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkmark icon */}
        <svg
          width={20}
          height={20}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: 1 }}
        >
          <circle cx="10" cy="10" r="10" fill="#22C55E" />
          <path
            d="M6 10.5l2.5 2.5 5.5-5.5"
            stroke="#FFFFFF"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Content */}
        <div className="flex-1">
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', lineHeight: 1.4 }}>
            {message ?? 'Dashboard sauvegardé'}
          </p>
          <button
            onClick={handleUndo}
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#FF5C1A',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 2,
            }}
          >
            Annuler
          </button>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Fermer la notification"
          style={{
            fontSize: 16,
            color: '#6B6963',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
