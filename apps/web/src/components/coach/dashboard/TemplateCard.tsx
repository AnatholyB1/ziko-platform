'use client';

import { useState, useRef } from 'react';
import gsap from 'gsap';
import type { CoachMemoryTemplate } from '@/hooks/useCoachMemory';

interface TemplateCardProps {
  template: CoachMemoryTemplate;
  onApply: (template: CoachMemoryTemplate) => void;
  isApplying?: boolean;
  isOtherApplying?: boolean;
}

export function TemplateCard({
  template,
  onApply,
  isApplying = false,
  isOtherApplying = false,
}: TemplateCardProps) {
  const [hovered, setHovered] = useState(false);
  const useTemplateBtnRef = useRef<HTMLButtonElement>(null);

  const n = template.widgets.length;
  const badgeLabel = `${n} widget${n !== 1 ? 's' : ''}`;

  const widgetSummary = template.widgets.map((w) => w.title).join(', ');

  const createdAt = new Date(template.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  function handleApply() {
    if (useTemplateBtnRef.current) {
      gsap.to(useTemplateBtnRef.current, {
        scale: 0.96,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power3.out',
      });
    }
    // Slight delay so GSAP animation can start
    setTimeout(() => {
      onApply(template);
    }, 0);
  }

  return (
    <div
      style={{
        position: 'relative',
        background: '#FFFFFF',
        border: hovered ? '1px solid #FF5C1A' : '1px solid #E2E0DA',
        borderRadius: 8,
        padding: 20,
        boxShadow: hovered
          ? '0 8px 24px rgba(28,26,23,0.10)'
          : '0 4px 8px rgba(28,26,23,0.08)',
        minHeight: 160,
        cursor: 'pointer',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        opacity: isOtherApplying ? 0.5 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Widget count badge */}
      <span
        style={{
          display: 'inline-block',
          background: '#F0EFE9',
          color: '#1C1A17',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {badgeLabel}
      </span>

      {/* Template name */}
      <p
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#1C1A17',
          marginTop: 12,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {template.name}
      </p>

      {/* Widget summary */}
      <p
        style={{
          fontSize: 14,
          color: '#6B6963',
          marginTop: 8,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.5,
        } as React.CSSProperties}
      >
        {widgetSummary}
      </p>

      {/* Divider + date */}
      <div
        style={{
          borderTop: '1px solid #E2E0DA',
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <p style={{ fontSize: 12, color: '#6B6963' }}>Créé le {createdAt}</p>
      </div>

      {/* Apply button */}
      <button
        ref={useTemplateBtnRef}
        onClick={handleApply}
        disabled={isApplying || isOtherApplying}
        aria-label={`Utiliser le modèle ${template.name}`}
        style={{
          width: '100%',
          height: 36,
          marginTop: 12,
          background: '#FF5C1A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: isApplying || isOtherApplying ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: isOtherApplying ? 0.5 : 1,
        }}
      >
        {isApplying ? (
          <span
            style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: '#FFFFFF',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              display: 'inline-block',
            }}
          />
        ) : (
          'Utiliser ce modèle'
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
