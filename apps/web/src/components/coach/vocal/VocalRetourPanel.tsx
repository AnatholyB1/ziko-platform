'use client';

import React, { useReducer, useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { vocalReducer } from './vocalReducer';
import { useVocalRecorder } from './useVocalRecorder';
import { useVocalTimer } from './useVocalTimer';
import { VocalIdle } from './VocalIdle';
import { VocalRecording } from './VocalRecording';
import { VocalTranscribing } from './VocalTranscribing';
import { VocalReview } from './VocalReview';
import { VocalStructuring } from './VocalStructuring';
import { VocalStructuringError } from './VocalStructuringError';
import { VocalCardReady } from './VocalCardReady';
import { VocalFeedbackHistory } from './VocalFeedbackHistory';

export function VocalRetourPanel({ clientId }: { clientId: string }): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);

  const [state, dispatch] = useReducer(vocalReducer, { status: 'idle' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedTranscript, setSavedTranscript] = useState<string>('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
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

  // Page entrance animation
  useEffect(() => {
    if (panelRef.current) {
      gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  // handleStructure: fires POST /api/coach/voice/structure with clientId as athlete_id
  async function handleStructure(transcript: string) {
    try {
      const res = await fetch('/api/coach/voice/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: clientId, transcript }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Structuration failed' }));
        dispatch({
          type: 'STRUCTURE_ERROR',
          message: (data as { error?: string }).error ?? 'Structuration failed',
        });
        return;
      }
      const data = await res.json();
      dispatch({ type: 'STRUCTURE_SUCCESS', card: data.card });
    } catch {
      dispatch({ type: 'STRUCTURE_ERROR', message: 'Erreur réseau. Vérifiez votre connexion.' });
    }
  }

  // Trigger structure call when state transitions to 'structuring'
  useEffect(() => {
    if (state.status !== 'structuring') return;
    handleStructure(state.transcript);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Real save: POST /api/coach/voice/save when card-saving
  useEffect(() => {
    if (state.status !== 'card-saving') return;
    const editedCard = state.editedCard;
    let cancelled = false;

    async function doSave() {
      try {
        const res = await fetch('/api/coach/voice/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            athlete_id: clientId,
            transcript: savedTranscript,
            card: editedCard,
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error('[VocalRetourPanel] save failed:', res.status);
          dispatch({ type: 'SAVE_ERROR' });
          return;
        }
        dispatch({ type: 'SAVE_COMPLETE' });
        setHistoryRefreshKey((k) => k + 1);
      } catch (err) {
        if (cancelled) return;
        console.error('[VocalRetourPanel] save network error:', err);
        dispatch({ type: 'SAVE_ERROR' });
      }
    }

    doSave();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

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
    try {
      await recorderStart();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone unavailable';
      dispatch({ type: 'TRANSCRIPTION_ERROR', message });
      return;
    }
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
    if (state.status === 'review') {
      setSavedTranscript(state.transcript);
    }
    dispatch({ type: 'VALIDATE' });
  }

  function handleRetryStructure() {
    dispatch({ type: 'RETRY_STRUCTURE' });
    // The useEffect on state.status will re-trigger handleStructure once state becomes 'structuring'
  }

  const formatted = timer.formatElapsed(elapsedSeconds);

  return (
    <>
      <div ref={panelRef} className="vocal-panel" data-testid="vocal-panel">
        {state.status === 'idle' && (
          <VocalIdle onStart={handleStart} />
        )}
        {state.status === 'recording' && (
          <VocalRecording
            formatted={formatted}
            elapsedSeconds={elapsedSeconds}
            onStop={handleStop}
          />
        )}
        {state.status === 'transcribing' && (
          <VocalTranscribing />
        )}
        {state.status === 'review' && (
          <VocalReview
            transcript={state.transcript}
            onValidate={handleValidate}
            onRelaunch={handleRelaunch}
          />
        )}
        {state.status === 'error' && (
          <VocalReview
            error={state.message}
            onRetry={handleRetry}
            onRelaunch={handleRelaunch}
          />
        )}
        {state.status === 'structuring' && <VocalStructuring />}
        {state.status === 'structuring-error' && (
          <VocalStructuringError
            message={state.message}
            onRetry={handleRetryStructure}
            onBack={() => dispatch({ type: 'RELAUNCH' })}
          />
        )}
        {(state.status === 'card-ready' ||
          state.status === 'card-editing' ||
          state.status === 'card-saving' ||
          state.status === 'card-saved') && (
          <VocalCardReady
            state={state}
            dispatch={dispatch}
          />
        )}
      </div>
      <VocalFeedbackHistory clientId={clientId} refreshKey={historyRefreshKey} />
    </>
  );
}
