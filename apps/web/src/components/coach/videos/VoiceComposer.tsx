'use client';

import React, { useReducer, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { useVocalRecorder } from '../vocal/useVocalRecorder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoiceState =
  | { status: 'idle' }
  | { status: 'recording' }
  | { status: 'transcribing' }
  | { status: 'review'; transcript: string; audioPath: string }
  | { status: 'error'; message: string };

type VoiceAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'TRANSCRIPTION_SUCCESS'; transcript: string; audioPath: string }
  | { type: 'TRANSCRIPTION_ERROR'; message: string }
  | { type: 'RESET' };

function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'START_RECORDING':
      return { status: 'recording' };
    case 'STOP_RECORDING':
      return { status: 'transcribing' };
    case 'TRANSCRIPTION_SUCCESS':
      return { status: 'review', transcript: action.transcript, audioPath: action.audioPath };
    case 'TRANSCRIPTION_ERROR':
      return { status: 'error', message: action.message };
    case 'RESET':
      return { status: 'idle' };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VoiceComposerProps {
  timestampSeconds: number;
  onVoiceReady: (result: { transcript: string; audioPath: string }) => void;
  onCancel: () => void;
  accessToken: string;
  apiUrl: string;
  videoId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceComposer({
  timestampSeconds,
  onVoiceReady,
  onCancel,
  accessToken,
  apiUrl,
  videoId,
}: VoiceComposerProps): React.ReactElement {
  const [state, dispatch] = useReducer(voiceReducer, { status: 'idle' });
  const [elapsed, setElapsed] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const micBtnRef = useRef<HTMLButtonElement>(null);
  const spinnerContainerRef = useRef<HTMLDivElement>(null);
  const transcriptBoxRef = useRef<HTMLTextAreaElement>(null);
  const errorCardRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { start: recorderStart, stop: recorderStop } = useVocalRecorder();

  // Mount entrance animation
  useEffect(() => {
    if (containerRef.current) {
      gsap.from(containerRef.current, { x: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  // Transcribing spinner entrance
  useEffect(() => {
    if (state.status === 'transcribing' && spinnerContainerRef.current) {
      gsap.from(spinnerContainerRef.current, { scale: 0, opacity: 0, duration: 0.2, ease: 'back.out(1.4)' });
    }
  }, [state.status]);

  // Review transcript box entrance
  useEffect(() => {
    if (state.status === 'review' && transcriptBoxRef.current) {
      gsap.from(transcriptBoxRef.current, { y: 8, opacity: 0, duration: 0.25, ease: 'power2.out' });
    }
  }, [state.status]);

  // Error card entrance
  useEffect(() => {
    if (state.status === 'error' && errorCardRef.current) {
      gsap.from(errorCardRef.current, { y: 4, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, [state.status]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleStart() {
    // Mic button press feedback
    if (micBtnRef.current) {
      gsap.from(micBtnRef.current, { scale: 0.9, duration: 0.1, ease: 'back.out(1.7)' });
    }
    await recorderStart();
    dispatch({ type: 'START_RECORDING' });
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }

  async function handleStop() {
    const { blob, mimeType } = await recorderStop();

    // Client-side blob size guard — warns if approaching Vercel 4.5MB limit (T-47-WEB-02)
    if (blob.size > 4_000_000) {
      console.warn('[VoiceComposer] Audio blob >4MB — may exceed Vercel body limit.');
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setElapsed(0);

    dispatch({ type: 'STOP_RECORDING' });
    await uploadAndTranscribe(blob, mimeType);
  }

  async function handleCancelDuringRecording() {
    // Stop recording and discard blob, reset to idle
    try {
      await recorderStop();
    } catch {
      // ignore — we're discarding anyway
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setElapsed(0);
    dispatch({ type: 'RESET' });
  }

  async function uploadAndTranscribe(blob: Blob, mimeType: string) {
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('audio', blob, `recording.${ext}`);
    formData.append('mimeType', mimeType || 'audio/webm');
    formData.append('videoId', videoId);
    formData.append('timestamp_s', String(timestampSeconds));

    // Do NOT set Content-Type manually — browser sets it with boundary
    try {
      const res = await fetch(`${apiUrl}/coach/videos/annotations/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Transcription échouée' }));
        dispatch({
          type: 'TRANSCRIPTION_ERROR',
          message: (data as { error?: string }).error ?? 'Transcription échouée',
        });
        return;
      }

      const data = await res.json();
      dispatch({
        type: 'TRANSCRIPTION_SUCCESS',
        transcript: data.transcript,
        audioPath: data.audioPath,
      });
    } catch {
      dispatch({
        type: 'TRANSCRIPTION_ERROR',
        message: 'La transcription a échoué. Vérifiez votre connexion et réessayez.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="flex flex-col flex-1">
      {/* ---- IDLE state ---- */}
      {state.status === 'idle' && (
        <>
          <div className="flex flex-col items-center justify-center flex-1 pt-8 pb-4 gap-0">
            <button
              ref={micBtnRef}
              onClick={handleStart}
              className="w-16 h-16 rounded-full bg-[#FF5C1A] flex items-center justify-center shadow-md cursor-pointer hover:bg-[#E04E14] transition-colors duration-100 active:scale-95"
              aria-label="Commencer l'enregistrement"
            >
              <Mic size={28} className="text-white" />
            </button>
            <p className="mt-3 text-xs text-[#6B6963] text-center max-w-[180px]">
              Appuyez pour commencer l&apos;enregistrement
            </p>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E0DA] flex gap-2">
            <button
              onClick={onCancel}
              className="border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-full hover:bg-[#F0EFE9] transition-colors duration-100"
            >
              Annuler
            </button>
          </div>
        </>
      )}

      {/* ---- RECORDING state ---- */}
      {state.status === 'recording' && (
        <>
          <div className="flex flex-col items-center justify-center flex-1 pt-8 pb-4 gap-0">
            <button
              onClick={handleStop}
              className="w-16 h-16 rounded-full bg-[#EF4444] flex items-center justify-center cursor-pointer relative"
              aria-label="Arrêter l'enregistrement"
            >
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full border-2 border-[#EF4444] animate-ping opacity-75 pointer-events-none" />
              <Square size={24} className="text-white" />
            </button>
            <p className="mt-2 text-sm text-[#6B6963] font-mono">
              {formatElapsed(elapsed)}
            </p>
            <p className="mt-1 text-xs text-[#6B6963] text-center max-w-[200px]">
              Enregistrement en cours... Appuyez pour arrêter
            </p>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E0DA] flex gap-2">
            <button
              onClick={handleCancelDuringRecording}
              className="border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-full hover:bg-[#F0EFE9] transition-colors duration-100"
            >
              Annuler
            </button>
          </div>
        </>
      )}

      {/* ---- TRANSCRIBING state ---- */}
      {state.status === 'transcribing' && (
        <>
          <div className="flex flex-col items-center justify-center flex-1 pt-8 pb-4 gap-0">
            <div ref={spinnerContainerRef} className="w-16 h-16 flex items-center justify-center">
              <Loader2 size={28} className="text-[#FF5C1A] animate-spin" />
            </div>
            <p className="mt-3 text-sm text-[#1C1A17] text-center font-medium">
              Transcription IA en cours...
            </p>
            <p className="mt-1 text-xs text-[#6B6963] text-center">
              Quelques secondes...
            </p>
          </div>
          {/* Empty footer — transcribing is a locked state */}
          <div className="px-4 py-3 border-t border-[#E2E0DA]" />
        </>
      )}

      {/* ---- REVIEW state ---- */}
      {state.status === 'review' && (
        <>
          <div className="flex flex-col gap-2 pt-4 flex-1 px-0">
            <p className="text-xs text-[#6B6963]">Transcription IA</p>
            <textarea
              ref={transcriptBoxRef}
              readOnly
              rows={3}
              className="w-full bg-[#F0EFE9] border border-[#E2E0DA] rounded-md px-3 py-2 text-sm text-[#1C1A17] resize-none leading-relaxed cursor-default focus:outline-none"
              value={state.transcript}
            />
            <p className="text-xs text-[#6B6963] mt-1">
              Relisez avant de sauvegarder. Si ce n&apos;est pas correct, ré-enregistrez.
            </p>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E0DA] flex gap-2">
            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-1/2 hover:border-[#1C1A17] hover:text-[#1C1A17] transition-colors duration-100"
            >
              Ré-enregistrer
            </button>
            <button
              onClick={() => onVoiceReady({ transcript: state.transcript, audioPath: state.audioPath })}
              className="bg-[#FF5C1A] text-white text-sm font-medium py-2 rounded-md w-1/2 hover:bg-[#E04E14] transition-colors duration-100"
            >
              Sauvegarder
            </button>
          </div>
        </>
      )}

      {/* ---- ERROR state ---- */}
      {state.status === 'error' && (
        <>
          <div className="flex flex-col items-center justify-center flex-1 pt-8 pb-4 gap-0 px-0">
            <div
              ref={errorCardRef}
              className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-md px-3 py-2 mt-4 flex items-start gap-2 w-full"
            >
              <AlertCircle size={14} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#EF4444]">
                La transcription a échoué. Vérifiez votre connexion et réessayez.
              </p>
            </div>
            <button
              onClick={() => dispatch({ type: 'RESET' })}
              className="border border-[#FF5C1A] text-[#FF5C1A] bg-white text-sm py-2 rounded-md w-full mt-3 hover:bg-[#FFF0E8] transition-colors duration-100"
            >
              Ré-enregistrer
            </button>
          </div>
          <div className="px-4 py-3 border-t border-[#E2E0DA] flex gap-2">
            <button
              onClick={onCancel}
              className="border border-[#E2E0DA] text-[#6B6963] bg-white text-sm py-2 rounded-md w-full hover:bg-[#F0EFE9] transition-colors duration-100"
            >
              Annuler
            </button>
          </div>
        </>
      )}
    </div>
  );
}
