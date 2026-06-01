'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import type { Widget } from '@/types/dashboard';
import { useCoachMemory } from '@/hooks/useCoachMemory';
import { TemplateCard } from './TemplateCard';
import type { CoachMemoryTemplate } from '@/hooks/useCoachMemory';

interface TemplatePickerProps {
  clientId: string;
  onSelect: (widgets: Widget[]) => void;
  onSkip: () => void;
}

export function TemplatePicker({ clientId, onSelect, onSkip }: TemplatePickerProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { data: memory, isLoading } = useCoachMemory();

  const pickerContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<HTMLDivElement[]>([]);
  const footerLinkRef = useRef<HTMLButtonElement>(null);

  // Auto-skip when no templates — avoids stranding the coach on a blank panel
  useEffect(() => {
    if (!isLoading && (memory?.templates?.length ?? 0) === 0) {
      onSkip()
    }
  }, [isLoading, memory, onSkip])

  // GSAP entrance — fires when data has loaded and templates are available
  useEffect(() => {
    if (!isLoading && (memory?.templates?.length ?? 0) > 0) {
      if (headerRef.current) {
        gsap.from(headerRef.current, { opacity: 0, y: 12, duration: 0.2, ease: 'power2.out' });
      }
      const validCardRefs = cardRefs.current.filter(Boolean);
      if (validCardRefs.length > 0) {
        gsap.from(validCardRefs, {
          opacity: 0,
          y: 16,
          duration: 0.2,
          ease: 'power2.out',
          stagger: 0.06,
          delay: 0.05,
        });
      }
      if (footerLinkRef.current) {
        gsap.from(footerLinkRef.current, { opacity: 0, duration: 0.15, ease: 'power2.out', delay: 0.2 });
      }
    }
  }, [isLoading]);

  async function handleApply(template: CoachMemoryTemplate) {
    setApplyingId(template.id);
    try {
      const res = await fetch(`/api/coach/dashboards/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: template.widgets }),
      });
      if (!res.ok) {
        throw new Error(`PUT failed: ${res.status}`);
      }
      // GSAP exit — fade out then call onSelect
      if (pickerContainerRef.current) {
        gsap.to(pickerContainerRef.current, {
          opacity: 0,
          duration: 0.15,
          ease: 'power2.in',
          onComplete: () => onSelect(template.widgets),
        });
      } else {
        onSelect(template.widgets);
      }
    } catch {
      setApplyingId(null);
    }
  }

  function handleSkip() {
    if (pickerContainerRef.current) {
      gsap.to(pickerContainerRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
        onComplete: () => onSkip(),
      });
    } else {
      onSkip();
    }
  }

  return (
    <div
      ref={pickerContainerRef}
      style={{
        padding: 32,
        background: '#F7F6F3',
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {isLoading ? (
        // State B1: Loading skeleton
        <div role="status" aria-label="Chargement des modèles...">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E0DA',
                  borderRadius: 8,
                  padding: 20,
                  minHeight: 160,
                }}
              >
                {/* Badge placeholder */}
                <div
                  style={{
                    width: 48,
                    height: 20,
                    background: '#E2E0DA',
                    borderRadius: 4,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
                {/* Name placeholder */}
                <div
                  style={{
                    width: 160,
                    height: 16,
                    background: '#E2E0DA',
                    borderRadius: 4,
                    marginTop: 12,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
                {/* Summary line 1 */}
                <div
                  style={{
                    width: 220,
                    height: 12,
                    background: '#E2E0DA',
                    borderRadius: 4,
                    marginTop: 8,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
                {/* Summary line 2 */}
                <div
                  style={{
                    width: 180,
                    height: 12,
                    background: '#E2E0DA',
                    borderRadius: 4,
                    marginTop: 4,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
                {/* Date placeholder */}
                <div
                  style={{
                    width: 100,
                    height: 10,
                    background: '#E2E0DA',
                    borderRadius: 4,
                    marginTop: 12,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
                {/* Button placeholder */}
                <div
                  style={{
                    width: '100%',
                    height: 36,
                    background: '#E2E0DA',
                    borderRadius: 8,
                    marginTop: 12,
                    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (memory?.templates?.length ?? 0) > 0 ? (
        // State B2: Populated
        <>
          <div ref={headerRef} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1C1A17', margin: 0 }}>
              Commencer depuis un modèle
            </h2>
            <p style={{ fontSize: 14, color: '#6B6963', marginTop: 8, marginBottom: 0 }}>
              Sélectionnez un modèle enregistré ou créez un dashboard vide.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {(memory?.templates ?? []).map((t, i) => (
              <div
                key={t.id}
                ref={(el) => {
                  if (el) cardRefs.current[i] = el;
                }}
              >
                <TemplateCard
                  template={t}
                  onApply={handleApply}
                  isApplying={applyingId === t.id}
                  isOtherApplying={applyingId !== null && applyingId !== t.id}
                />
              </div>
            ))}
          </div>

          {applyingId === null && (
            <div style={{ marginTop: 32 }}>
              <button
                ref={footerLinkRef}
                onClick={handleSkip}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#FF5C1A',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none';
                }}
              >
                Créer sans modèle →
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
