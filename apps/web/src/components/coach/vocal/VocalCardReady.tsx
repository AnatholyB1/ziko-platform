'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { CheckCircle } from 'lucide-react';
import { FeedbackCard } from './FeedbackCard';
import type { VocalState, VocalAction } from './vocalReducer';

type CardState = Extract<VocalState, { status: 'card-ready' | 'card-editing' | 'card-saving' | 'card-saved' }>;

interface VocalCardReadyProps {
  state: CardState;
  dispatch: React.Dispatch<VocalAction>;
}

export function VocalCardReady({ state, dispatch }: VocalCardReadyProps): React.ReactElement {
  const successBlockRef = useRef<HTMLDivElement>(null);
  const [isNewButtonHovered, setIsNewButtonHovered] = React.useState(false);

  // GSAP entrance for success block
  useEffect(() => {
    if (state.status === 'card-saved' && successBlockRef.current) {
      gsap.from(successBlockRef.current, { y: 12, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, [state.status]);

  if (state.status === 'card-saved') {
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
        <div
          ref={successBlockRef}
          role="status"
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={18} color="#22C55E" />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', margin: 0 }}>
              Retour sauvegardé.
            </p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 400, color: '#6B6963', marginTop: 4, margin: '4px 0 0 0' }}>
            La card structurée a été enregistrée avec succès pour cet athlète.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            onMouseEnter={() => setIsNewButtonHovered(true)}
            onMouseLeave={() => setIsNewButtonHovered(false)}
            style={{
              border: '1px solid #E2E0DA',
              backgroundColor: isNewButtonHovered ? '#F0EFE9' : '#FFFFFF',
              color: '#1C1A17',
              height: 40,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
          >
            Nouveau retour
          </button>
        </div>
      </div>
    );
  }

  // card-ready | card-editing | card-saving
  const isSaving = state.status === 'card-saving';

  const card = state.card;

  return (
    <div style={{ maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
      <FeedbackCard
        card={card}
        editedCard={state.editedCard}
        isSaving={isSaving}
        dispatch={dispatch}
      />
    </div>
  );
}
