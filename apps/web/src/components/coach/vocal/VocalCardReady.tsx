'use client';

import React from 'react';
import type { VocalState, VocalAction } from './vocalReducer';

interface VocalCardReadyProps {
  state: Extract<VocalState, { status: 'card-ready' | 'card-editing' | 'card-saving' | 'card-saved' }>;
  dispatch: React.Dispatch<VocalAction>;
}

export function VocalCardReady({ state, dispatch }: VocalCardReadyProps): React.ReactElement {
  void dispatch;
  void state;
  return (
    <div data-testid="vocal-card-ready" style={{ padding: 24 }}>
      FeedbackCard — Plan 02-04
    </div>
  );
}
