'use client';

import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { vocalReducer } from './vocalReducer';
import { useVocalRecorder } from './useVocalRecorder';
import { useVocalTimer } from './useVocalTimer';

export function VocalRetourPanel({ clientId }: { clientId: string }): React.ReactElement {
  // clientId is reserved for Phase 02 (structuring route) — not used in Phase 01
  void clientId;

  const [state, dispatch] = useReducer(vocalReducer, { status: 'idle' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const { start: recorderStart, stop: recorderStop } = useVocalRecorder();

  // Stable ref for handleStop to avoid circular dependency in useVocalTimer onAutoStop
  const handleStopRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const onAutoStop = useCallback(() => {
    handleStopRef.current?.();
  }, []);

  const timer = useVocalTimer({ onAutoStop });

  // Local interval for React-state elapsed tracking (supplements the factory timer)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startElapsedTracking() {
    setElapsedSeconds(0);
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }

  function stopElapsedTracking() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setElapsedSeconds(0);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // beforeunload guard — fires ONLY during state.status === 'recording' (D-04)
  useEffect(() => {
    if (state.status !== 'recording') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Enregistrement en cours. Quitter annulera le retour.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.status]);

  async function handleStart() {
    await recorderStart();
    dispatch({ type: 'START_RECORDING' });
    timer.start();
    startElapsedTracking();
  }

  async function handleStop() {
    const { blob, mimeType } = await recorderStop();

    // Client-side blob size guard (T-01-06) — warns if approaching Vercel 4.5MB limit
    if (blob.size > 4_000_000) {
      console.warn(
        'Audio blob is large (>4MB). Safari mp4 recordings may exceed Vercel 4.5MB limit.'
      );
    }

    timer.stop();
    stopElapsedTracking();
    dispatch({ type: 'STOP_RECORDING', blob, mimeType });
    await uploadBlob(blob, mimeType);
  }

  // Assign handleStop to ref so onAutoStop can call it
  handleStopRef.current = handleStop;

  async function uploadBlob(blob: Blob, mimeType: string) {
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('audio', blob, `recording.${extension}`);
    formData.append('mimeType', mimeType || 'audio/webm');

    // Do NOT set Content-Type header manually — browser sets it with boundary automatically
    try {
      const res = await fetch('/api/coach/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Transcription failed' }));
        dispatch({
          type: 'TRANSCRIPTION_ERROR',
          message: (data as { error?: string }).error ?? 'Transcription failed',
        });
        return;
      }

      const data = await res.json();
      dispatch({ type: 'TRANSCRIPTION_SUCCESS', transcript: data.transcript });
    } catch {
      dispatch({ type: 'TRANSCRIPTION_ERROR', message: 'Transcription failed' });
    }
  }

  function handleRetry() {
    if (state.status !== 'error') return;
    const { blob, mimeType } = state;
    dispatch({ type: 'RETRY' });
    uploadBlob(blob, mimeType);
  }

  function handleRelaunch() {
    dispatch({ type: 'RELAUNCH' });
  }

  function handleValidate() {
    dispatch({ type: 'VALIDATE' });
    // Phase 02 will intercept VALIDATE to trigger structuring
  }

  const formatted = timer.formatElapsed(elapsedSeconds);

  // Render — placeholder divs for all 5 states (Plan 01-05 replaces with styled sub-components)
  if (state.status === 'idle') {
    return (
      <div data-testid="vocal-idle">
        <span>idle</span>
        <button type="button" onClick={handleStart}>
          Nouveau retour
        </button>
      </div>
    );
  }

  if (state.status === 'recording') {
    return (
      <div data-testid="vocal-recording">
        <span>recording {formatted}</span>
        <button type="button" onClick={handleStop}>
          Arrêter
        </button>
      </div>
    );
  }

  if (state.status === 'transcribing') {
    return (
      <div data-testid="vocal-transcribing">
        <span>transcribing</span>
      </div>
    );
  }

  if (state.status === 'review') {
    return (
      <div data-testid="vocal-review">
        <span>{state.transcript}</span>
        <button type="button" onClick={handleValidate}>
          Valider
        </button>
        <button type="button" onClick={handleRelaunch}>
          Relancer
        </button>
      </div>
    );
  }

  // state.status === 'error'
  return (
    <div data-testid="vocal-error">
      <span>{state.message}</span>
      <button type="button" onClick={handleRetry}>
        Ressayer
      </button>
      <button type="button" onClick={handleRelaunch}>
        Relancer
      </button>
    </div>
  );
}
