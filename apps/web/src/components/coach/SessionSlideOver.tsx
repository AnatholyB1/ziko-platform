'use client';
import { useEffect } from 'react';
import type { ProgramSession, ProgramExercise } from '@ziko/coach-sdk';
import { ExerciseTypeahead } from './ExerciseTypeahead';

const DAY_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export interface SessionSlideOverProps {
  session: ProgramSession | null;
  onClose: () => void;
  onSessionChange: (updated: ProgramSession) => void;
  apiUrl: string;
  accessToken: string;
}

export function SessionSlideOver({
  session,
  onClose,
  onSessionChange,
  apiUrl,
  accessToken,
}: SessionSlideOverProps) {
  // Escape key listener
  useEffect(() => {
    if (!session) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [session, onClose]);

  const updateSession = (patch: Partial<ProgramSession>) => {
    if (!session) return;
    onSessionChange({ ...session, ...patch });
  };

  const updateExercise = (index: number, patch: Partial<ProgramExercise>) => {
    if (!session) return;
    const updated = session.exercises.map((ex, i) =>
      i === index ? { ...ex, ...patch } : ex
    );
    onSessionChange({ ...session, exercises: updated });
  };

  const deleteExercise = (index: number) => {
    if (!session) return;
    const updated = session.exercises.filter((_, i) => i !== index);
    onSessionChange({ ...session, exercises: updated });
  };

  const addExercise = (ex: { exercise_id: string | null; exercise_name: string; category?: string }) => {
    if (!session) return;
    const newExercise: ProgramExercise = {
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      sets: 3,
      reps: null,
      duration_seconds: null,
      target_rpe: null,
      target_rir: null,
      rest_seconds: null,
      notes: null,
    };
    onSessionChange({ ...session, exercises: [...session.exercises, newExercise] });
  };

  const numToNull = (val: string): number | null => {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  const floatToNull = (val: string): number | null => {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  return (
    <>
      {/* Transparent backdrop — click closes */}
      {session && (
        <div
          className="fixed inset-0 bg-transparent z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-name-heading"
        className={`fixed right-0 top-0 h-full w-[480px] bg-white border-l border-border shadow-xl z-40 flex flex-col transition-transform duration-200 ease-out ${
          session ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {session && (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <input
                  id="session-name-heading"
                  type="text"
                  value={session.session_name}
                  onChange={(e) => updateSession({ session_name: e.target.value })}
                  className="text-base font-bold text-text w-full border-transparent focus:border-border focus:ring-0 rounded-lg px-2 py-1 -ml-2 outline-none focus:bg-background"
                  placeholder="Nom de la séance"
                />
                {/* Day chips */}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {DAY_LABELS.slice(1).map((label, i) => {
                    const day = i + 1;
                    const isSelected = session.day_of_week === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => updateSession({ day_of_week: day as ProgramSession['day_of_week'] })}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-normal ${
                          isSelected
                            ? 'bg-primary text-white border-primary font-bold'
                            : 'bg-background text-muted border-border hover:border-primary hover:text-primary'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-background transition-colors shrink-0"
                aria-label="Fermer"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Exercise table */}
            <div className="flex-1 overflow-y-auto">
              <table className="table-fixed w-full text-sm">
                <thead>
                  <tr className="bg-background">
                    <th className="py-2 px-3 text-left text-xs font-bold text-muted uppercase tracking-wide w-[180px]">
                      Exercice
                    </th>
                    <th className="py-2 px-1 text-center text-xs font-bold text-muted uppercase tracking-wide w-14">
                      Séries
                    </th>
                    <th className="py-2 px-1 text-center text-xs font-bold text-muted uppercase tracking-wide w-16">
                      Rép.
                    </th>
                    <th className="py-2 px-1 text-center text-xs font-bold text-muted uppercase tracking-wide w-16">
                      RPE/RIR
                    </th>
                    <th className="py-2 px-1 text-center text-xs font-bold text-muted uppercase tracking-wide w-16">
                      Repos
                    </th>
                    <th className="py-2 px-2 text-left text-xs font-bold text-muted uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {session.exercises.map((ex, idx) => (
                    <tr key={idx} className="h-11 border-b border-border hover:bg-background">
                      <td className="px-3 py-1">
                        <input
                          type="text"
                          value={ex.exercise_name}
                          onChange={(e) => updateExercise(idx, { exercise_name: e.target.value })}
                          className="w-full text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                          placeholder="Exercice"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={ex.sets ?? ''}
                          min={1}
                          max={20}
                          onChange={(e) => updateExercise(idx, { sets: parseInt(e.target.value, 10) || 1 })}
                          className="w-14 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={ex.reps ?? ''}
                          min={1}
                          max={100}
                          onChange={(e) => updateExercise(idx, { reps: numToNull(e.target.value) })}
                          className="w-14 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={ex.target_rpe ?? ex.target_rir ?? ''}
                          step="0.5"
                          min={0}
                          max={10}
                          onChange={(e) => {
                            const val = floatToNull(e.target.value);
                            // Treat as target_rpe; clear target_rir
                            updateExercise(idx, { target_rpe: val, target_rir: null });
                          }}
                          className="w-14 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={ex.rest_seconds ?? ''}
                          min={0}
                          max={600}
                          onChange={(e) => updateExercise(idx, { rest_seconds: numToNull(e.target.value) })}
                          className="w-14 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={ex.notes ?? ''}
                          onChange={(e) =>
                            updateExercise(idx, { notes: e.target.value || null })
                          }
                          className="w-full text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded-lg px-2 py-1 outline-none"
                          placeholder="—"
                          maxLength={300}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => deleteExercise(idx)}
                          className="text-muted hover:text-danger transition-colors"
                          aria-label="Supprimer l'exercice"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                            <path
                              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {session.exercises.length === 0 && (
                <p className="text-sm text-muted italic text-center py-6">
                  Aucun exercice. Ajoutez-en un ci-dessous.
                </p>
              )}
            </div>

            {/* ExerciseTypeahead footer */}
            <div className="px-3 py-2 border-t border-dashed border-border shrink-0">
              <ExerciseTypeahead
                onAdd={addExercise}
                apiUrl={apiUrl}
                accessToken={accessToken}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
