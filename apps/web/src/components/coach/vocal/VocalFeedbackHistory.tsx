'use client';

import React, { useState, useEffect } from 'react';
import { createClientSupabase } from '@/lib/supabase/client';
import { TagChip } from './TagChip';
import { CardSection } from './CardSection';
import type { StructuredCard, TagKey, CardSection as CardSectionKey } from './vocalReducer';

interface VocalFeedback {
  id: string;
  created_at: string;
  card: StructuredCard;
}

interface VocalFeedbackHistoryProps {
  clientId: string;
  refreshKey?: number;
}

const SECTIONS: Array<{ key: CardSectionKey; label: string }> = [
  { key: 'context', label: 'Contexte séance' },
  { key: 'strengths', label: 'Points forts' },
  { key: 'corrections', label: 'Corrections' },
  { key: 'next_steps', label: 'Prochaines étapes' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function VocalFeedbackHistory({ clientId, refreshKey }: VocalFeedbackHistoryProps): React.ReactElement | null {
  const [feedbacks, setFeedbacks] = useState<VocalFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchHistory() {
      const supabase = createClientSupabase();
      const { data, error } = await supabase
        .from('coach_vocal_feedbacks')
        .select('id, created_at, card')
        .eq('athlete_id', clientId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('[VocalFeedbackHistory] fetch error:', error.message);
        setLoading(false);
        return;
      }
      setFeedbacks((data ?? []) as VocalFeedback[]);
      setLoading(false);
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, [clientId, refreshKey]);

  if (loading) {
    return (
      <div style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto', marginTop: 32 }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              height: 60,
              backgroundColor: '#F0EFE9',
              borderRadius: 8,
              marginBottom: 8,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (feedbacks.length === 0) return null;

  return (
    <div style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Section divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '32px 0 16px' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #E2E0DA' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#6B6963',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Feedbacks précédents
        </span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #E2E0DA' }} />
      </div>

      {/* History rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {feedbacks.map((feedback) => {
          const isExpanded = expandedId === feedback.id;
          return (
            <div
              key={feedback.id}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E0DA',
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              {/* Row header: date + tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1C1A17', marginRight: 4 }}>
                  {formatDate(feedback.created_at)}
                </span>
                {feedback.card.tags.map((tag: TagKey) => (
                  <TagChip key={tag} tag={tag} selected={true} onToggle={() => {}} disabled={true} />
                ))}
              </div>

              {/* Context preview */}
              <p style={{ fontSize: 13, color: '#6B6963', margin: '6px 0 8px', lineHeight: 1.4 }}>
                {feedback.card.context.slice(0, 100)}{feedback.card.context.length > 100 ? '\u2026' : ''}
              </p>

              {/* Toggle expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : feedback.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#FF5C1A',
                  fontWeight: 500,
                }}
              >
                {isExpanded ? 'Masquer \u25b4' : 'Voir le d\u00e9tail \u25be'}
              </button>

              {/* Inline expanded card */}
              {isExpanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E2E0DA' }}>
                  {SECTIONS.map((s) => (
                    <CardSection
                      key={s.key}
                      sectionKey={s.key}
                      label={s.label}
                      value={feedback.card[s.key]}
                      isEditing={false}
                      disabled={true}
                      onEdit={() => {}}
                      onChange={() => {}}
                    />
                  ))}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {feedback.card.tags.map((tag: TagKey) => (
                      <TagChip key={tag} tag={tag} selected={true} onToggle={() => {}} disabled={true} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
