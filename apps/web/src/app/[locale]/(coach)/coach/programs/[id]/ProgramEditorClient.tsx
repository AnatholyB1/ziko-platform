'use client';
import { useState, useCallback } from 'react';

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
import { WeekAccordion } from '@/components/coach/WeekAccordion';
import { SessionSlideOver } from '@/components/coach/SessionSlideOver';
import { AssignmentModal, type AssignmentClient } from '@/components/coach/AssignmentModal';
import { RevokeConfirmModal } from '@/components/coach/RevokeConfirmModal';
import type { ProgramWeek, ProgramSession } from '@ziko/coach-sdk';

interface ProgramData {
  id: string;
  name: string;
  goal: string | null;
  weeks_data: ProgramWeek[];
  updated_at: string | null;
  created_at: string | null;
}

interface ClientData {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

interface ProgramEditorClientProps {
  program: ProgramData;
  clients: ClientData[];
  accessToken: string;
  apiUrl: string;
  locale: string;
}

function formatLastSaved(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin === 0) return 'Sauvegardé à l\'instant';
  if (diffMin === 1) return 'Modifié il y a 1 min';
  return `Modifié il y a ${diffMin} min`;
}

export function ProgramEditorClient({
  program,
  clients,
  accessToken,
  apiUrl,
  locale,
}: ProgramEditorClientProps) {
  const [name, setName] = useState(program.name);
  const rawWeeksData = program.weeks_data as unknown;
  const rawArray = (
    Array.isArray(rawWeeksData)
      ? rawWeeksData
      : Array.isArray((rawWeeksData as Record<string, unknown>)?.weeks)
        ? ((rawWeeksData as Record<string, unknown>).weeks as unknown[])
        : []
  ) as Record<string, unknown>[];
  // Normalize corrupt rows (e.g. pre-fix imports stored in old ImportedProgram format).
  const initialWeeks: ProgramWeek[] = rawArray.map((week) => ({
    week_number: Number(week.week_number),
    sessions: (Array.isArray(week.sessions) ? (week.sessions as Record<string, unknown>[]) : []).map((s) => ({
      session_id: String(s.session_id ?? genId()),
      session_name: String(s.session_name ?? s.name ?? 'Séance'),
      day_of_week: Number(s.day_of_week ?? 1),
      exercises: (Array.isArray(s.exercises) ? (s.exercises as Record<string, unknown>[]) : []).map((ex) => ({
        exercise_id: ex.exercise_id != null ? String(ex.exercise_id) : null,
        exercise_name: String(ex.exercise_name ?? ex.name ?? ''),
        sets: Number(ex.sets ?? 1),
        reps: ex.reps != null ? Number(ex.reps) : null,
        duration_seconds: ex.duration_seconds != null ? Number(ex.duration_seconds) : null,
        target_rpe: ex.target_rpe != null ? Number(ex.target_rpe) : null,
        target_rir: ex.target_rir != null ? Number(ex.target_rir) : null,
        rest_seconds: ex.rest_seconds != null ? Number(ex.rest_seconds) : null,
        notes: ex.notes != null ? String(ex.notes) : null,
      })),
    })),
  }));
  const [weeks, setWeeks] = useState<ProgramWeek[]>(initialWeeks);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(
    program.updated_at ? new Date(program.updated_at) : null
  );

  const markDirty = useCallback(() => setIsDirty(true), []);

  // Find active session across all weeks
  const activeSession: ProgramSession | null =
    activeSessionId
      ? weeks.flatMap((w) => w.sessions).find((s) => s.session_id === activeSessionId) ?? null
      : null;

  // ── Week callbacks ──────────────────────────────────────────────

  const handleAddWeek = useCallback(() => {
    setWeeks((prev) => [
      ...prev,
      { week_number: prev.length + 1, sessions: [] },
    ]);
    markDirty();
  }, [markDirty]);

  const handleAddSession = useCallback(
    (weekNumber: number) => {
      const newSession: ProgramSession = {
        session_id: crypto.randomUUID(),
        session_name: 'Nouvelle séance',
        day_of_week: 1,
        exercises: [],
      };
      setWeeks((prev) =>
        prev.map((w) =>
          w.week_number === weekNumber
            ? { ...w, sessions: [...w.sessions, newSession] }
            : w
        )
      );
      setActiveSessionId(newSession.session_id);
      markDirty();
    },
    [markDirty]
  );

  const handleDuplicateWeek = useCallback(
    (weekNumber: number) => {
      setWeeks((prev) => {
        const source = prev.find((w) => w.week_number === weekNumber);
        if (!source) return prev;
        const clone = structuredClone(source);
        clone.week_number = prev.length + 1;
        // Give each session a new UUID
        clone.sessions = clone.sessions.map((s) => ({
          ...s,
          session_id: crypto.randomUUID(),
        }));
        return [...prev, clone];
      });
      markDirty();
    },
    [markDirty]
  );

  const handleDeleteWeek = useCallback(
    (weekNumber: number) => {
      setWeeks((prev) => {
        const filtered = prev.filter((w) => w.week_number !== weekNumber);
        // Renumber weeks
        return filtered.map((w, i) => ({ ...w, week_number: i + 1 }));
      });
      setActiveSessionId((prev) => {
        // If active session was in deleted week, clear
        return prev; // will naturally become null since session won't exist
      });
      markDirty();
    },
    [markDirty]
  );

  const handleDuplicateSession = useCallback(
    (sessionId: string) => {
      setWeeks((prev) =>
        prev.map((w) => {
          const idx = w.sessions.findIndex((s) => s.session_id === sessionId);
          if (idx < 0) return w;
          const clone = structuredClone(w.sessions[idx]);
          clone.session_id = crypto.randomUUID();
          const sessions = [...w.sessions];
          sessions.splice(idx + 1, 0, clone);
          return { ...w, sessions };
        })
      );
      markDirty();
    },
    [markDirty]
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      setWeeks((prev) =>
        prev.map((w) => ({
          ...w,
          sessions: w.sessions.filter((s) => s.session_id !== sessionId),
        }))
      );
      if (activeSessionId === sessionId) setActiveSessionId(null);
      markDirty();
    },
    [activeSessionId, markDirty]
  );

  const handleSessionChange = useCallback(
    (updated: ProgramSession) => {
      setWeeks((prev) =>
        prev.map((w) => ({
          ...w,
          sessions: w.sessions.map((s) =>
            s.session_id === updated.session_id ? updated : s
          ),
        }))
      );
      markDirty();
    },
    [markDirty]
  );

  // ── Save ────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${apiUrl}/coach/programs/${program.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, weeks_data: weeks }),
      });
      if (res.ok) {
        setIsDirty(false);
        setLastSaved(new Date());
      }
    } catch (err) {
      console.error('[ProgramEditorClient] save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Clients for assignment modal ─────────────────────────────────
  const assignmentClients: AssignmentClient[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    avatar_url: c.avatar_url,
  }));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky header */}
      <header className="sticky top-0 bg-white z-20 border-b border-border px-6 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); markDirty(); }}
            className="text-xl font-bold text-text border-transparent focus:border-border focus:ring-0 rounded-lg px-2 py-1 -ml-2 outline-none focus:bg-background w-full"
          />
          <div className="flex items-center gap-3 mt-0.5 pl-2">
            {program.goal && (
              <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-normal">
                {program.goal}
              </span>
            )}
            <span className="text-xs text-muted">
              {weeks.length} semaine{weeks.length !== 1 ? 's' : ''}
            </span>
            {lastSaved && (
              <span className="text-xs text-muted">{formatLastSaved(lastSaved)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-normal hover:bg-background disabled:opacity-40 transition-colors"
            >
              {isSaving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAssignModalOpen(true)}
            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Assigner
          </button>
          {/* Context menu (Supprimer) */}
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="p-2 rounded-lg text-muted hover:text-danger hover:bg-background border border-border transition-colors"
            aria-label="Supprimer le programme"
            title="Supprimer le programme"
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
        </div>
      </header>

      {/* Main editor area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Week accordion (shrinks when slide-over open) */}
        <div
          className={`flex-1 min-w-0 overflow-y-auto p-6 transition-all duration-200 ${
            activeSession ? 'mr-[480px]' : ''
          }`}
        >
          <WeekAccordion
            weeks={weeks}
            activeSessionId={activeSessionId}
            onSessionSelect={setActiveSessionId}
            onAddWeek={handleAddWeek}
            onAddSession={handleAddSession}
            onDuplicateWeek={handleDuplicateWeek}
            onDeleteWeek={handleDeleteWeek}
            onDuplicateSession={handleDuplicateSession}
            onDeleteSession={handleDeleteSession}
          />
        </div>

        {/* Session slide-over */}
        <SessionSlideOver
          session={activeSession}
          onClose={() => setActiveSessionId(null)}
          onSessionChange={handleSessionChange}
          apiUrl={apiUrl}
          accessToken={accessToken}
        />
      </div>

      {/* Assignment modal */}
      <AssignmentModal
        open={assignModalOpen}
        programId={program.id}
        programName={name}
        clients={assignmentClients}
        onClose={() => setAssignModalOpen(false)}
        onSuccess={() => setAssignModalOpen(false)}
        apiUrl={apiUrl}
        accessToken={accessToken}
      />

      {/* Delete confirmation */}
      <RevokeConfirmModal
        open={deleteModalOpen}
        title="Supprimer ce programme ?"
        body="Cette action est irréversible. Tapez COACH pour confirmer."
        confirmLabel='Tapez "COACH" pour confirmer'
        confirmCta="Supprimer"
        cancelLabel="Annuler"
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={async () => {
          const res = await fetch(`${apiUrl}/coach/programs/${program.id}?confirmed=true`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            window.location.href = `/${locale}/coach/programs`;
          }
        }}
      />
    </div>
  );
}
