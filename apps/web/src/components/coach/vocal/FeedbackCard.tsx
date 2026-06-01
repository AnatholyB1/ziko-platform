'use client';

import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { Sparkles, Loader2 } from 'lucide-react';
import { CardSection } from './CardSection';
import { TagChip } from './TagChip';
import type {
  StructuredCard,
  CardSection as CardSectionKey,
  TagKey,
  VocalAction,
} from './vocalReducer';

const SECTIONS: Array<{ key: CardSectionKey; label: string }> = [
  { key: 'context', label: 'Contexte séance' },
  { key: 'strengths', label: 'Points forts' },
  { key: 'corrections', label: 'Corrections' },
  { key: 'next_steps', label: 'Prochaines étapes' },
];

const ALL_TAGS = ['force', 'technique', 'mental', 'cardio', 'recuperation'] as const satisfies TagKey[];

interface FeedbackCardProps {
  card: StructuredCard;
  editedCard: StructuredCard;
  isSaving: boolean;
  dispatch: React.Dispatch<VocalAction>;
}

export function FeedbackCard({ card: _card, editedCard, isSaving, dispatch }: FeedbackCardProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const loaderWrapperRef = useRef<HTMLSpanElement>(null);
  const [activeEditSection, setActiveEditSection] = useState<CardSectionKey | null>(null);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const gsapLoopRef = useRef<gsap.core.Tween | null>(null);

  // GSAP entrance animation on mount
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.from(cardRef.current, { y: 16, opacity: 0, duration: 0.25, ease: 'power2.out' });
    gsap.from(cardRef.current.querySelectorAll('.card-section'), {
      y: 8,
      opacity: 0,
      duration: 0.2,
      stagger: 0.04,
      ease: 'power2.out',
    });
    gsap.from(cardRef.current.querySelectorAll('.tag-chip'), {
      scale: 0.85,
      opacity: 0,
      duration: 0.15,
      stagger: 0.03,
      ease: 'back.out(1.4)',
      delay: 0.15,
    });
  }, []);

  // GSAP spinner animation when saving
  useEffect(() => {
    if (isSaving && loaderWrapperRef.current) {
      gsapLoopRef.current = gsap.to(loaderWrapperRef.current, {
        rotation: 360,
        duration: 0.8,
        ease: 'linear',
        repeat: -1,
        transformOrigin: '50% 50%',
      });
    } else {
      if (gsapLoopRef.current) {
        gsapLoopRef.current.kill();
        gsapLoopRef.current = null;
      }
    }
  }, [isSaving]);

  const handleSave = () => {
    if (isSaving) return;
    if (saveRef.current) {
      gsap.to(saveRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });
    }
    dispatch({ type: 'START_SAVING' });
  };

  return (
    <div
      ref={cardRef}
      className="feedback-card"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E0DA',
        borderRadius: 8,
        boxShadow: '0 4px 8px rgba(28,26,23,0.08)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #E2E0DA',
          paddingBottom: 16,
          marginBottom: 4,
        }}
      >
        <Sparkles size={14} color="#6B6963" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#6B6963',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Retour structuré
        </span>
      </div>

      {/* Sections */}
      {SECTIONS.map((s) => (
        <div key={s.key} className="card-section">
          <CardSection
            sectionKey={s.key}
            label={s.label}
            value={editedCard[s.key]}
            isEditing={activeEditSection === s.key}
            disabled={isSaving}
            onEdit={(key) => setActiveEditSection(key)}
            onChange={(value) => dispatch({ type: 'SECTION_EDIT', section: s.key, value })}
          />
        </div>
      ))}

      {/* Tags section */}
      <div>
        <p
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: '#6B6963',
            margin: '0 0 8px 0',
          }}
        >
          Tags
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {ALL_TAGS.map((tag) => (
            <TagChip
              key={tag}
              className="tag-chip"
              tag={tag}
              selected={editedCard.tags.includes(tag)}
              onToggle={() => dispatch({ type: 'TAG_TOGGLE', tag })}
              disabled={isSaving}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #E2E0DA',
          paddingTop: 16,
          marginTop: 4,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          ref={saveRef}
          disabled={isSaving}
          onClick={handleSave}
          onMouseEnter={() => { if (!isSaving) setIsButtonHovered(true); }}
          onMouseLeave={() => setIsButtonHovered(false)}
          aria-disabled={isSaving}
          style={{
            backgroundColor: isButtonHovered && !isSaving ? '#E5521A' : '#FF5C1A',
            color: '#FFFFFF',
            height: 40,
            paddingLeft: 24,
            paddingRight: 24,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background-color 150ms ease',
          }}
        >
          {isSaving ? (
            <>
              <span ref={loaderWrapperRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Loader2 size={16} color="white" />
              </span>
              {' '}Sauvegarde…
            </>
          ) : (
            'Sauvegarder'
          )}
        </button>
      </div>
    </div>
  );
}
