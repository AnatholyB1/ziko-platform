'use client';

import React, { useReducer, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useMediaState, useMediaRemote } from '@vidstack/react';
import { Plus, Send, Pencil, Trash2, MessageSquare, CheckCircle, Loader2 } from 'lucide-react';
import { Annotation } from './VideoPlayerClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnnotationState =
  | { status: 'list'; annotations: Annotation[] }
  | { status: 'composing'; annotations: Annotation[]; timestamp_s: number }
  | { status: 'editing'; annotations: Annotation[]; annotationId: string; content: string; timestamp_s: number }
  | { status: 'sending'; annotations: Annotation[] }
  | { status: 'sent'; annotations: Annotation[] };

type AnnotationAction =
  | { type: 'START_COMPOSE'; timestamp_s: number }
  | { type: 'START_EDIT'; annotationId: string; content: string; timestamp_s: number }
  | { type: 'CANCEL_COMPOSE' }
  | { type: 'SAVE_SUCCESS'; annotation: Annotation }
  | { type: 'UPDATE_SUCCESS'; annotation: Annotation }
  | { type: 'DELETE_ANNOTATION'; annotationId: string }
  | { type: 'START_SEND' }
  | { type: 'SEND_SUCCESS' }
  | { type: 'SEND_ERROR'; message: string }
  | { type: 'SET_ANNOTATIONS'; annotations: Annotation[] };

function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  switch (action.type) {
    case 'START_COMPOSE':
      return { status: 'composing', annotations: state.annotations, timestamp_s: action.timestamp_s };

    case 'START_EDIT':
      return {
        status: 'editing',
        annotations: state.annotations,
        annotationId: action.annotationId,
        content: action.content,
        timestamp_s: action.timestamp_s,
      };

    case 'CANCEL_COMPOSE':
      return { status: 'list', annotations: state.annotations };

    case 'SAVE_SUCCESS': {
      const sorted = [...state.annotations, action.annotation].sort(
        (a, b) => a.timestamp_s - b.timestamp_s,
      );
      return { status: 'list', annotations: sorted };
    }

    case 'UPDATE_SUCCESS': {
      const updated = state.annotations.map((a) =>
        a.id === action.annotation.id ? action.annotation : a,
      );
      return { status: 'list', annotations: updated };
    }

    case 'DELETE_ANNOTATION':
      return {
        status: 'list',
        annotations: state.annotations.filter((a) => a.id !== action.annotationId),
      };

    case 'START_SEND':
      return { status: 'sending', annotations: state.annotations };

    case 'SEND_SUCCESS':
      return { status: 'sent', annotations: state.annotations };

    case 'SEND_ERROR':
      return { status: 'list', annotations: state.annotations };

    case 'SET_ANNOTATIONS':
      return { ...state, annotations: action.annotations };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMmSs(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnnotationPanelProps {
  videoId: string;
  annotations: Annotation[];
  accessToken: string;
  apiUrl: string;
  onAnnotationsChange: (a: Annotation[]) => void;
  status?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnnotationPanel({
  videoId,
  annotations: initialAnnotations,
  accessToken,
  apiUrl,
  onAnnotationsChange,
  status: videoStatus,
}: AnnotationPanelProps) {
  // Vidstack hooks — MUST be called inside MediaPlayer subtree (Risk 2 mitigation)
  const paused = useMediaState('paused');
  const currentTime = useMediaState('currentTime') ?? 0;
  const remote = useMediaRemote();

  const [state, dispatch] = useReducer(annotationReducer, {
    status: 'list',
    annotations: initialAnnotations,
  });

  const [text, setText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);

  // GSAP entrance — exact VocalRetourPanel pattern
  useEffect(() => {
    if (panelRef.current) {
      gsap.from(panelRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  // Composer slide-in when entering composing/editing state
  useEffect(() => {
    if ((state.status === 'composing' || state.status === 'editing') && composerRef.current) {
      gsap.from(composerRef.current, { x: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
    if (state.status === 'composing') {
      setText('');
    }
    if (state.status === 'editing') {
      setText(state.content);
    }
  }, [state.status]);

  // Sent confirmation animation
  useEffect(() => {
    if (state.status === 'sent' && sentRef.current) {
      gsap.from(sentRef.current, { scale: 0.95, opacity: 0, duration: 0.25, ease: 'back.out(1.4)' });
    }
  }, [state.status]);

  // Keep parent in sync when annotations change
  useEffect(() => {
    if (state.status !== 'composing' && state.status !== 'editing') {
      onAnnotationsChange(state.annotations);
    }
  }, [state.annotations]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!text.trim()) return;
    const timestamp_s = state.status === 'composing' ? state.timestamp_s : 0;
    setErrorMessage('');
    try {
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ timestamp_s, content: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Impossible de sauvegarder. Réessayez.' }));
        setErrorMessage((data as { error?: string }).error ?? 'Impossible de sauvegarder. Réessayez.');
        return;
      }
      const annotation: Annotation = await res.json();
      dispatch({ type: 'SAVE_SUCCESS', annotation });
      setText('');
    } catch {
      setErrorMessage('Impossible de sauvegarder. Réessayez.');
    }
  }

  async function handleUpdate() {
    if (state.status !== 'editing') return;
    if (!text.trim()) return;
    setErrorMessage('');
    try {
      const res = await fetch(
        `${apiUrl}/coach/videos/${videoId}/annotations/${state.annotationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ content: text.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Impossible de sauvegarder. Réessayez.' }));
        setErrorMessage((data as { error?: string }).error ?? 'Impossible de sauvegarder. Réessayez.');
        return;
      }
      const annotation: Annotation = await res.json();
      dispatch({ type: 'UPDATE_SUCCESS', annotation });
      setText('');
    } catch {
      setErrorMessage('Impossible de sauvegarder. Réessayez.');
    }
  }

  async function handleDelete(annotId: string) {
    setErrorMessage('');
    try {
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/annotations/${annotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Impossible de supprimer. Réessayez.' }));
        setErrorMessage((data as { error?: string }).error ?? 'Impossible de supprimer. Réessayez.');
        return;
      }
      dispatch({ type: 'DELETE_ANNOTATION', annotationId: annotId });
    } catch {
      setErrorMessage('Impossible de supprimer. Réessayez.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSend() {
    if (sendBtnRef.current) {
      gsap.to(sendBtnRef.current, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1 });
    }
    dispatch({ type: 'START_SEND' });
    setErrorMessage('');
    try {
      const res = await fetch(`${apiUrl}/coach/videos/${videoId}/send-feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Échec de l\'envoi. Veuillez réessayer.' }));
        setErrorMessage((data as { error?: string }).error ?? "Échec de l'envoi. Veuillez réessayer.");
        dispatch({ type: 'SEND_ERROR', message: "Échec de l'envoi. Veuillez réessayer." });
        return;
      }
      dispatch({ type: 'SEND_SUCCESS' });
    } catch {
      setErrorMessage("Échec de l'envoi. Veuillez réessayer.");
      dispatch({ type: 'SEND_ERROR', message: "Échec de l'envoi. Veuillez réessayer." });
    }
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const annotations = state.annotations;
  const isSent = state.status === 'sent';
  const isSending = state.status === 'sending';
  const isComposing = state.status === 'composing';
  const isEditing = state.status === 'editing';
  const isComposerVisible = isComposing || isEditing;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={panelRef}
      className="bg-white rounded-lg border border-[#E2E0DA] shadow-sm flex flex-col h-[calc(100vh-220px)] min-h-[400px] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E2E0DA] flex items-center justify-between flex-shrink-0">
        <h2 className="text-[18px] font-semibold text-[#1C1A17]">
          {isComposing ? 'Nouvelle annotation' : isEditing ? "Modifier l'annotation" : 'Annotations'}
        </h2>
        {!isComposerVisible && annotations.length > 0 && (
          <span className="bg-[#F0EFE9] text-[#C2410C] text-xs font-medium px-2 py-0.5 rounded">
            {annotations.length}
          </span>
        )}
      </div>

      {/* Body */}
      {isComposerVisible ? (
        // Composer state (composing or editing)
        <div ref={composerRef} className="flex-1 overflow-y-auto px-4 py-4">
          {/* Timestamp chip */}
          <div className="mb-4">
            <p className="text-[12px] text-[#6B6963] mb-1">Moment</p>
            <span className="inline-block bg-[#FFF0E8] text-[#C2410C] border border-[#FF5C1A] rounded px-2 py-1 font-mono text-[12px]">
              {formatMmSs(
                isComposing
                  ? (state as { status: 'composing'; timestamp_s: number }).timestamp_s
                  : (state as { status: 'editing'; timestamp_s: number }).timestamp_s,
              )}
            </span>
          </div>

          {/* Textarea */}
          <div>
            <p className="text-[12px] text-[#6B6963] mb-1">Commentaire</p>
            <textarea
              rows={6}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Décrivez ce que vous observez..."
              className="w-full bg-[#F0EFE9] border border-[#E2E0DA] focus:border-[#FF5C1A] outline-none resize-none rounded-md px-3 py-2 text-[14px] text-[#1C1A17] placeholder-[#6B6963]"
            />
            <p className="text-[12px] text-[#6B6963] text-right mt-1">
              {text.length}/2000
            </p>
          </div>

          {errorMessage && (
            <p className="text-[12px] text-[#EF4444] mt-2">{errorMessage}</p>
          )}
        </div>
      ) : (
        // List state
        <div className="flex-1 overflow-y-auto">
          {annotations.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 h-full">
              <MessageSquare size={32} className="text-[#E2E0DA]" />
              <p className="text-[14px] font-semibold text-[#1C1A17]">Aucune annotation</p>
              <p className="text-[12px] text-[#6B6963] text-center">
                Mettez la vidéo en pause, puis cliquez sur &apos;Annoter à ce moment&apos; pour
                ajouter votre premier commentaire.
              </p>
            </div>
          ) : (
            annotations.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 border-b border-[#E2E0DA] last:border-0 group flex items-start gap-3 cursor-pointer hover:bg-[#F0EFE9] transition-colors duration-100 relative"
                onClick={() => remote.seek(a.timestamp_s)}
              >
                {/* Left accent strip — always shown for consistency */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF5C1A] rounded-r opacity-0 group-hover:opacity-100 transition-opacity duration-100" />

                {/* Timestamp chip */}
                <span className="flex-shrink-0 font-mono text-[12px] bg-[#FFF0E8] text-[#C2410C] px-1.5 py-0.5 rounded">
                  {formatMmSs(a.timestamp_s)}
                </span>

                {/* Annotation text */}
                <p className="text-[14px] text-[#1C1A17] flex-1 line-clamp-3 overflow-hidden">
                  {a.content.slice(0, 120)}{a.content.length > 120 ? '...' : ''}
                </p>

                {/* Action icons */}
                {deletingId === a.id ? (
                  <div
                    className="flex items-center gap-2 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="text-[12px] text-[#EF4444] hover:text-[#DC2626]"
                      onClick={() => handleDelete(a.id)}
                    >
                      Supprimer ?
                    </button>
                    <button
                      className="text-[12px] text-[#6B6963] hover:text-[#1C1A17]"
                      onClick={() => setDeletingId(null)}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      aria-label="Modifier l'annotation"
                      className="text-[#6B6963] hover:text-[#1C1A17] transition-colors"
                      onClick={() =>
                        dispatch({
                          type: 'START_EDIT',
                          annotationId: a.id,
                          content: a.content,
                          timestamp_s: a.timestamp_s,
                        })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label="Supprimer l'annotation"
                      className="text-[#EF4444] hover:text-[#DC2626] transition-colors"
                      onClick={() => setDeletingId(a.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#E2E0DA] flex flex-col gap-2">
        {isComposerVisible ? (
          // Composer footer
          <div className="flex gap-2">
            <button
              className="w-1/2 border border-[#E2E0DA] text-[#6B6963] bg-white text-sm font-medium py-2 rounded-md hover:bg-[#F0EFE9] transition-colors duration-100"
              onClick={() => {
                dispatch({ type: 'CANCEL_COMPOSE' });
                setText('');
                setErrorMessage('');
              }}
            >
              Annuler
            </button>
            <button
              className={`w-1/2 text-sm font-medium py-2 rounded-md transition-colors duration-100 ${
                text.trim()
                  ? 'bg-[#FF5C1A] text-white hover:bg-[#E04E14]'
                  : 'bg-[#E2E0DA] text-[#6B6963] cursor-not-allowed'
              }`}
              disabled={!text.trim()}
              onClick={isEditing ? handleUpdate : handleSave}
            >
              {isEditing ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        ) : (
          // List footer
          <>
            {/* Annoter à ce moment button */}
            <button
              disabled={!paused}
              title={!paused ? 'Mettez la vidéo en pause d\'abord' : undefined}
              className={`w-full flex items-center justify-center gap-1 text-sm font-medium py-2 rounded-md transition-colors duration-100 ${
                paused
                  ? 'border border-[#FF5C1A] text-[#FF5C1A] bg-white hover:bg-[#FFF0E8]'
                  : 'opacity-40 cursor-not-allowed border border-[#E2E0DA] text-[#6B6963]'
              }`}
              onClick={() => {
                if (!paused) return;
                dispatch({ type: 'START_COMPOSE', timestamp_s: currentTime });
              }}
            >
              <Plus size={14} />
              Annoter à ce moment
            </button>

            {/* Envoyer le retour button — hidden when no annotations */}
            {annotations.length > 0 && (
              isSent ? (
                <div
                  ref={sentRef}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#DCFCE7] text-[#166534] rounded-md text-sm font-medium cursor-not-allowed pointer-events-none"
                >
                  <CheckCircle size={14} />
                  Retour envoyé
                </div>
              ) : (
                <button
                  ref={sendBtnRef}
                  disabled={isSending}
                  className={`w-full flex items-center justify-center gap-1 text-sm font-medium py-2 rounded-md transition-colors duration-100 ${
                    isSending
                      ? 'bg-[#FF5C1A] text-white opacity-80 pointer-events-none'
                      : 'bg-[#FF5C1A] text-white hover:bg-[#E04E14]'
                  }`}
                  onClick={handleSend}
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Envoyer le retour
                    </>
                  )}
                </button>
              )
            )}

            {errorMessage && (
              <p className="text-[12px] text-[#EF4444]">{errorMessage}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
