'use client';

import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { AlertTriangle } from 'lucide-react';

interface VocalReviewProps {
  transcript?: string;
  error?: string;
  onValidate?: () => void;
  onRelaunch: () => void;
  onRetry?: () => void;
}

export function VocalReview({ transcript, error, onValidate, onRelaunch, onRetry }: VocalReviewProps): React.ReactElement {
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!blockRef.current) return;

    if (error) {
      // Error block: entrance + shake
      gsap.from(blockRef.current, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.out' });
      gsap.to(blockRef.current, {
        keyframes: { x: [-6, 6, -4, 4, -2, 2, 0] },
        duration: 0.3,
        delay: 0.2,
      });
    } else {
      // Transcript block entrance
      gsap.from(blockRef.current, { y: 12, opacity: 0, duration: 0.25, ease: 'power2.out' });
    }
  }, [error]);

  return (
    <div className="max-w-[640px] mx-auto pt-12" style={{ paddingLeft: 24, paddingRight: 24 }}>
      {transcript !== undefined && !error && (
        <>
          {/* Label */}
          <p style={{ fontSize: 12, fontWeight: 400, color: '#6B6963', marginBottom: 8, lineHeight: 1.4 }}>
            Transcript
          </p>

          {/* Transcript block */}
          <div
            ref={blockRef}
            className="transcript-block"
            style={{
              backgroundColor: '#F0EFE9',
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              padding: 16,
              minHeight: 160,
              maxHeight: 320,
              overflowY: 'auto',
              fontSize: 16,
              fontWeight: 400,
              color: '#1C1A17',
              lineHeight: 1.5,
              pointerEvents: 'none',
            }}
          >
            {transcript}
          </div>

          {/* Button row */}
          <div className="flex justify-end" style={{ marginTop: 16, gap: 8 }}>
            <button
              type="button"
              onClick={onRelaunch}
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
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0EFE9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'; }}
            >
              Relancer
            </button>
            <button
              type="button"
              onClick={onValidate}
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
            >
              Valider
            </button>
          </div>
        </>
      )}

      {error !== undefined && (
        <>
          {/* Error block */}
          <div
            ref={blockRef}
            className="error-block"
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div className="flex items-start" style={{ gap: 8 }}>
              <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', lineHeight: 1.5 }}>
                  La transcription a échoué.
                </p>
                <p style={{ fontSize: 12, fontWeight: 400, color: '#6B6963', lineHeight: 1.4, marginTop: 4 }}>
                  {error || 'Une erreur est survenue lors du traitement. Vérifiez votre connexion ou réessayez.'}
                </p>
              </div>
            </div>
          </div>

          {/* Button row */}
          <div className="flex justify-end" style={{ marginTop: 16, gap: 8 }}>
            <button
              type="button"
              onClick={onRelaunch}
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
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0EFE9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'; }}
            >
              Relancer
            </button>
            <button
              type="button"
              onClick={onRetry}
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
            >
              Ressayer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
