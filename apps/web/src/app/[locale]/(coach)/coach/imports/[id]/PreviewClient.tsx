'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import {
  IoChevronBackOutline,
  IoChevronDownOutline,
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoTrashOutline,
  IoAddOutline,
  IoCloudUploadOutline,
} from 'react-icons/io5';
import type { ImportRow } from './page';

// ─── Parsed program types ──────────────────────────────────────────────────

interface ParsedExercise {
  name: string;
  sets: number;
  reps: number;
  target_rpe?: number | null;
  target_rir?: number | null;
  rest_seconds?: number | null;
  notes?: string | null;
  confidence?: number | null;
}

interface ParsedSession {
  name: string;
  day_of_week?: number | null;
  exercises: ParsedExercise[];
  notes?: string | null;
}

interface ParsedWeek {
  week_number: number;
  sessions: ParsedSession[];
  notes?: string | null;
}

interface ParsedProgram {
  name: string;
  description?: string | null;
  goal?: string | null;
  weeks: ParsedWeek[];
  overall_confidence?: number | null;
}

type DiffStatus = 'new' | 'removed' | 'changed' | 'unchanged';

interface DiffExercise extends ParsedExercise {
  diffStatus: DiffStatus;
  prevValues?: Partial<ParsedExercise>;
}

// ─── Helper utilities ──────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function computeDiff(
  prev: ParsedProgram,
  next: ParsedProgram
): ParsedWeek[] {
  return next.weeks.map((nextWeek) => {
    const prevWeek = prev.weeks.find((w) => w.week_number === nextWeek.week_number);
    return {
      ...nextWeek,
      sessions: nextWeek.sessions.map((nextSession) => {
        const prevSession = prevWeek?.sessions.find((s) => s.name === nextSession.name);
        const diffExercises: DiffExercise[] = nextSession.exercises.map((nextEx) => {
          const prevEx = prevSession?.exercises.find((e) => e.name === nextEx.name);
          if (!prevEx) {
            return { ...nextEx, diffStatus: 'new' as DiffStatus };
          }
          const changed =
            prevEx.sets !== nextEx.sets ||
            prevEx.reps !== nextEx.reps ||
            prevEx.target_rpe !== nextEx.target_rpe ||
            prevEx.target_rir !== nextEx.target_rir ||
            prevEx.rest_seconds !== nextEx.rest_seconds;
          if (changed) {
            return {
              ...nextEx,
              diffStatus: 'changed' as DiffStatus,
              prevValues: {
                sets: prevEx.sets,
                reps: prevEx.reps,
                target_rpe: prevEx.target_rpe,
                target_rir: prevEx.target_rir,
                rest_seconds: prevEx.rest_seconds,
              },
            };
          }
          return { ...nextEx, diffStatus: 'unchanged' as DiffStatus };
        });
        // Add removed exercises
        if (prevSession) {
          for (const prevEx of prevSession.exercises) {
            const stillExists = nextSession.exercises.find((e) => e.name === prevEx.name);
            if (!stillExists) {
              diffExercises.push({ ...prevEx, diffStatus: 'removed' as DiffStatus });
            }
          }
        }
        return { ...nextSession, exercises: diffExercises as ParsedExercise[] };
      }),
    };
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatusChip({ status }: { status: ImportRow['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    pending: { background: '#F0EFE9', color: '#6B6963', border: '1px solid #E2E0DA' },
    uploaded: { background: '#F0EFE9', color: '#6B6963', border: '1px solid #E2E0DA' },
    parsing: { background: '#DBEAFE', color: '#1E40AF', border: '1px solid #93C5FD' },
    ready: { background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' },
    failed: { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' },
    committed: { background: '#EDE9FE', color: '#5B21B6', border: '1px solid #C4B5FD' },
  };
  const labels: Record<string, string> = {
    pending: 'En attente',
    uploaded: 'Uploadé',
    parsing: 'Analyse…',
    ready: 'Prêt',
    failed: 'Échoué',
    committed: 'Validé',
  };
  const style = styles[status] ?? styles.pending;
  return (
    <span
      className={status === 'parsing' ? 'parsing-chip' : ''}
      style={{
        ...style,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        padding: '2px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {status === 'parsing' && (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            border: '2px solid #DBEAFE',
            borderTop: '2px solid #3B82F6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {labels[status] ?? status}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span style={{ fontSize: 12, color: '#6B6963' }}>—</span>;
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? '#22C55E' : value >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color }}>{pct}%</span>
  );
}

function OverallConfidenceBanner({ confidence }: { confidence: number | null | undefined }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  let bg: string, borderColor: string, textColor: string, copy: string;
  let Icon = IoCheckmarkCircleOutline;
  if (confidence >= 0.8) {
    bg = '#DCFCE7'; borderColor = '#22C55E'; textColor = '#166534';
    copy = `Extraction réussie — confiance globale ${pct}%`;
    Icon = IoCheckmarkCircleOutline;
  } else if (confidence >= 0.5) {
    bg = '#FEF9C3'; borderColor = '#F59E0B'; textColor = '#92400E';
    copy = `Extraction partielle — vérifiez les champs en jaune (confiance ${pct}%)`;
    Icon = IoWarningOutline;
  } else {
    bg = '#FEE2E2'; borderColor = '#EF4444'; textColor = '#B91C1C';
    copy = `Extraction incertaine — revue manuelle recommandée (confiance ${pct}%)`;
    Icon = IoAlertCircleOutline;
  }
  return (
    <div
      style={{
        background: bg,
        borderLeft: `4px solid ${borderColor}`,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
      }}
    >
      <Icon size={18} color={borderColor} />
      <span style={{ fontSize: 14, color: textColor, fontWeight: 500 }}>{copy}</span>
    </div>
  );
}

interface ExerciseRowProps {
  exercise: ParsedExercise & { diffStatus?: DiffStatus; prevValues?: Partial<ParsedExercise> };
  onUpdate: (field: keyof ParsedExercise, value: string | number | null) => void;
  onDelete: () => void;
  diffMode: boolean;
  editedFields: Set<string>;
  onFieldEdited: (field: string) => void;
  rowIndex: number;
}

function ExerciseRow({
  exercise,
  onUpdate,
  onDelete,
  diffMode,
  editedFields,
  onFieldEdited,
  rowIndex,
}: ExerciseRowProps) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const diffStatus = exercise.diffStatus;

  function getRowStyle(): React.CSSProperties {
    if (!diffMode) return {};
    if (diffStatus === 'new') return { background: '#DCFCE7', borderLeft: '3px solid #22C55E' };
    if (diffStatus === 'removed') return { background: '#FEE2E2', borderLeft: '3px solid #EF4444', opacity: 0.85 };
    if (diffStatus === 'changed') return { background: '#FFFFFF' };
    return { opacity: 0.6 }; // unchanged
  }

  function cellBg(field: string): string {
    if (diffMode) return 'transparent';
    const conf = exercise.confidence ?? 1;
    if (conf < 0.7 && !editedFields.has(field)) return '#FEF9C3';
    return 'transparent';
  }

  function handleBlur(field: keyof ParsedExercise, raw: string) {
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') {
      onUpdate(field, num);
    } else if (raw.trim() === '') {
      onUpdate(field, null);
    } else {
      onUpdate(field, raw);
    }
    onFieldEdited(`${rowIndex}-${field}`);
  }

  function DiffCell({
    field,
    value,
    prevValue,
  }: {
    field: keyof ParsedExercise;
    value: string | number | null | undefined;
    prevValue?: string | number | null;
  }) {
    if (diffMode && diffStatus === 'changed' && prevValue !== undefined && prevValue !== value) {
      return (
        <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ textDecoration: 'line-through', color: '#6B6963', fontSize: 12 }}>{prevValue ?? '—'}</span>
          <span style={{ color: '#6B6963' }}>→</span>
          <span style={{ color: '#1C1A17', fontWeight: 600 }}>{value ?? '—'}</span>
        </div>
      );
    }
    if (diffMode && diffStatus === 'removed') {
      return (
        <span style={{ textDecoration: 'line-through', color: '#B91C1C', fontSize: 13 }}>
          {value ?? '—'}
        </span>
      );
    }
    // Editable cell
    return (
      <div
        style={{
          position: 'relative',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={() => {
          const conf = exercise.confidence ?? 1;
          if (!diffMode && conf < 0.7 && !editedFields.has(`${rowIndex}-${field}`)) {
            setTooltip(`${field}`);
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <input
          defaultValue={value?.toString() ?? ''}
          readOnly={diffMode}
          style={{
            width: '100%',
            background: cellBg(String(field)),
            border: '1px solid transparent',
            borderRadius: 4,
            fontSize: 13,
            color: '#1C1A17',
            padding: '2px 4px',
            outline: 'none',
            cursor: diffMode ? 'default' : 'text',
          }}
          onFocus={(e) => {
            if (!diffMode) {
              e.currentTarget.style.border = '2px solid #FF5C1A';
              e.currentTarget.style.background = '#FFFFFF';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1px solid transparent';
            e.currentTarget.style.background = cellBg(String(field));
            if (!diffMode) handleBlur(field, e.currentTarget.value);
          }}
        />
        {tooltip === String(field) && (
          <div
            className="confidence-tooltip"
            style={{
              position: 'absolute',
              top: -32,
              left: 0,
              background: '#1C1A17',
              color: '#FFFFFF',
              fontSize: 12,
              borderRadius: 4,
              padding: '4px 8px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            Confiance: {Math.round((exercise.confidence ?? 0) * 100)}% — vérifiez cette valeur
          </div>
        )}
      </div>
    );
  }

  const diffBadge = () => {
    if (!diffMode) return null;
    const badges: Record<string, { label: string; bg: string; color: string }> = {
      new: { label: 'NEW', bg: '#BBF7D0', color: '#166534' },
      removed: { label: 'SUPPRIMÉ', bg: '#FECACA', color: '#B91C1C' },
      changed: { label: 'MODIFIÉ', bg: '#FEF9C3', color: '#92400E' },
    };
    const b = diffStatus ? badges[diffStatus] : null;
    if (!b) return null;
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: b.color,
          background: b.bg,
          borderRadius: 4,
          padding: '4px 8px',
          marginRight: 8,
        }}
      >
        {b.label}
      </span>
    );
  };

  const prevVals = exercise.prevValues ?? {};

  return (
    <tr
      className="diff-row"
      style={{
        ...getRowStyle(),
        minHeight: 44,
      }}
    >
      <td style={{ padding: '4px 8px', minWidth: 160 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {diffBadge()}
          {diffMode && diffStatus === 'removed' ? (
            <span style={{ textDecoration: 'line-through', color: '#B91C1C', fontSize: 13 }}>
              {exercise.name}
            </span>
          ) : (
            <input
              defaultValue={exercise.name}
              readOnly={diffMode}
              style={{
                background: cellBg('name'),
                border: '1px solid transparent',
                borderRadius: 4,
                fontSize: 13,
                color: '#1C1A17',
                padding: '2px 4px',
                width: '100%',
                cursor: diffMode ? 'default' : 'text',
              }}
              onFocus={(e) => {
                if (!diffMode) {
                  e.currentTarget.style.border = '2px solid #FF5C1A';
                  e.currentTarget.style.background = '#FFFFFF';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = '1px solid transparent';
                e.currentTarget.style.background = cellBg('name');
                if (!diffMode) {
                  onUpdate('name', e.currentTarget.value);
                  onFieldEdited(`${rowIndex}-name`);
                }
              }}
            />
          )}
        </div>
      </td>
      <td style={{ padding: '4px 8px', width: 60 }}>
        <DiffCell field="sets" value={exercise.sets} prevValue={prevVals.sets} />
      </td>
      <td style={{ padding: '4px 8px', width: 80 }}>
        <DiffCell field="reps" value={exercise.reps} prevValue={prevVals.reps} />
      </td>
      <td style={{ padding: '4px 8px', width: 60 }}>
        <DiffCell field="target_rpe" value={exercise.target_rpe ?? null} prevValue={prevVals.target_rpe} />
      </td>
      <td style={{ padding: '4px 8px', width: 80 }}>
        <DiffCell
          field="rest_seconds"
          value={exercise.rest_seconds != null ? `${exercise.rest_seconds}s` : null}
          prevValue={prevVals.rest_seconds != null ? `${prevVals.rest_seconds}s` : null}
        />
      </td>
      {!diffMode && (
        <td style={{ padding: '4px 8px', width: 32 }}>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6963', padding: 4 }}
            title="Supprimer cet exercice"
          >
            <IoTrashOutline size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}

// ─── Diff summary computation ─────────────────────────────────────────────

function computeDiffSummary(prev: ParsedProgram, next: ParsedProgram) {
  let added = 0, removed = 0, changed = 0;
  for (const nextWeek of next.weeks) {
    const prevWeek = prev.weeks.find((w) => w.week_number === nextWeek.week_number);
    for (const nextSession of nextWeek.sessions) {
      const prevSession = prevWeek?.sessions.find((s) => s.name === nextSession.name);
      for (const nextEx of nextSession.exercises) {
        const prevEx = prevSession?.exercises.find((e) => e.name === nextEx.name);
        if (!prevEx) { added++; continue; }
        const c =
          prevEx.sets !== nextEx.sets ||
          prevEx.reps !== nextEx.reps ||
          prevEx.target_rpe !== nextEx.target_rpe ||
          prevEx.rest_seconds !== nextEx.rest_seconds;
        if (c) changed++;
      }
      if (prevSession) {
        for (const prevEx of prevSession.exercises) {
          if (!nextSession.exercises.find((e) => e.name === prevEx.name)) removed++;
        }
      }
    }
  }
  return { added, removed, changed };
}

// ─── Main PreviewClient ────────────────────────────────────────────────────

interface PreviewClientProps {
  importRow: ImportRow;
  locale: string;
  accessToken: string;

}

export function PreviewClient({ importRow, locale, accessToken }: PreviewClientProps) {
  const router = useRouter();
  const [data, setData] = useState<ImportRow>(importRow);
  const [editedProgram, setEditedProgram] = useState<ParsedProgram | null>(() => {
    if (importRow.status === 'ready' || importRow.status === 'committed') {
      return deepClone(importRow.parsed_data as unknown as ParsedProgram ?? null);
    }
    return null;
  });
  const [diffMode, setDiffMode] = useState(false);
  const [prevParsedData, setPrevParsedData] = useState<ParsedProgram | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [commitLoading, setCommitLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [showAllUnchanged, setShowAllUnchanged] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const errorCardRef = useRef<HTMLDivElement>(null);

  // ── Polling (parsing state) ─────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/coach/imports/${data.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        const updated: ImportRow = json.import ?? json;
        if (updated.status === 'ready' || updated.status === 'failed') {
          stopPolling();
          setData(updated);
          if (updated.status === 'ready' && updated.parsed_data) {
            setEditedProgram(deepClone(updated.parsed_data as unknown as ParsedProgram));
          }
        }
      } catch {
        // network error — keep polling
      }
    }, 2000);
  }, [accessToken, data.id]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── GSAP: parsing progress bar ──────────────────────────────────────────
  useEffect(() => {
    if (data.status !== 'parsing') return;

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    // Start polling
    startPolling();

    // GSAP progress bar
    if (progressBarRef.current) {
      const fillTween = gsap.to(progressBarRef.current, {
        width: '90%',
        duration: 55,
        ease: 'none',
        onComplete: () => {
          gsap.to(progressBarRef.current!, {
            opacity: 0.7,
            duration: 0.6,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
          });
        },
      });
      return () => {
        fillTween.kill();
        stopPolling();
      };
    }
    return () => stopPolling();
  }, [data.status, startPolling, stopPolling]);

  // ── GSAP: failed shake ──────────────────────────────────────────────────
  useEffect(() => {
    if (data.status !== 'failed' || !errorCardRef.current) return;
    gsap.to(errorCardRef.current, {
      keyframes: { x: [-8, 8, -6, 6, -3, 3, 0] },
      duration: 0.4,
      ease: 'none',
    });
  }, [data.status]);

  // ── GSAP: diff rows reveal ──────────────────────────────────────────────
  useEffect(() => {
    if (!diffMode) return;
    gsap.from('.diff-row', {
      x: -8,
      opacity: 0,
      duration: 0.25,
      stagger: 0.03,
      ease: 'power2.out',
    });
    gsap.from('.diff-banner', {
      y: -16,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.out',
    });
  }, [diffMode]);

  // ── Accordion toggle with GSAP ──────────────────────────────────────────
  function toggleWeek(weekNumber: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
        // GSAP animate accordion body — trigger after React renders
        setTimeout(() => {
          const el = document.querySelector(`[data-week="${weekNumber}"] .accordion-body`);
          if (el) {
            gsap.from(el, { opacity: 0, y: 6, duration: 0.2, ease: 'power2.out', clearProps: 'all' });
          }
        }, 0);
      }
      return next;
    });
  }

  // ── Edit helpers ────────────────────────────────────────────────────────
  function updateExercise(
    weekIdx: number,
    sessionIdx: number,
    exIdx: number,
    field: keyof ParsedExercise,
    value: string | number | null
  ) {
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next.weeks[weekIdx].sessions[sessionIdx].exercises[exIdx] as any)[field] = value;
      return next;
    });
  }

  function addExercise(weekIdx: number, sessionIdx: number) {
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.weeks[weekIdx].sessions[sessionIdx].exercises.push({
        name: 'Nouvel exercice',
        sets: 3,
        reps: 10,
        confidence: 1,
      });
      return next;
    });
  }

  function deleteExercise(weekIdx: number, sessionIdx: number, exIdx: number) {
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.weeks[weekIdx].sessions[sessionIdx].exercises.splice(exIdx, 1);
      return next;
    });
  }

  function addSession(weekIdx: number) {
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.weeks[weekIdx].sessions.push({ name: 'Nouvelle séance', exercises: [] });
      return next;
    });
  }

  function deleteSession(weekIdx: number, sessionIdx: number) {
    if (!window.confirm('Supprimer cette séance ?\nCette action supprimera la séance et tous ses exercices. Continuer ?')) return;
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.weeks[weekIdx].sessions.splice(sessionIdx, 1);
      return next;
    });
  }

  function addWeek() {
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      const maxWeek = Math.max(0, ...next.weeks.map((w) => w.week_number));
      next.weeks.push({ week_number: maxWeek + 1, sessions: [] });
      return next;
    });
  }

  function deleteWeek(weekIdx: number) {
    if (!window.confirm('Supprimer cette semaine ?\nCette action supprimera la semaine et toutes ses séances. Continuer ?')) return;
    setEditedProgram((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.weeks.splice(weekIdx, 1);
      return next;
    });
  }

  // ── Commit ──────────────────────────────────────────────────────────────
  async function handleCommit() {
    if (!editedProgram) return;
    setCommitLoading(true);
    try {
      const res = await fetch(`/api/coach/imports/${data.id}/commit`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parsed_data: editedProgram,
          program_name: editedProgram.name,
        }),
      });
      if (res.ok) {
        router.push(`/${locale}/coach/programs`);
      }
    } catch (err) {
      console.error('[PreviewClient] commit error:', err);
    } finally {
      setCommitLoading(false);
    }
  }

  // ── Retry parse ─────────────────────────────────────────────────────────
  async function handleRetry() {
    try {
      const res = await fetch(`/api/coach/imports/${data.id}/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setData((prev) => ({ ...prev, status: 'parsing', error_message: null }));
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error('[PreviewClient] retry error:', err);
    }
  }

  // ── Re-upload ───────────────────────────────────────────────────────────
  async function handleReuploadFile(file: File) {
    try {
      // Get signed URL for new import
      const createRes = await fetch(`/api/coach/imports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
          mode: data.mode,
          re_upload_source_id: data.id,
        }),
      });
      if (!createRes.ok) return;
      const { import: newImport, upload_url } = await createRes.json();

      // Upload file directly to storage
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) return;

      // Mark as uploaded
      await fetch(`/api/coach/imports/${newImport.id}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'uploaded' }),
      });

      // Trigger parse
      const parseRes = await fetch(`/api/coach/imports/${newImport.id}/parse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!parseRes.ok) return;

      // Poll until ready, then enter diff mode
      const pollInterval = setInterval(async () => {
        const pollRes = await fetch(`/api/coach/imports/${newImport.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (!pollRes.ok) return;
        const pollJson = await pollRes.json();
        const pollData: ImportRow = pollJson.import ?? pollJson;
        if (pollData.status === 'ready' && pollData.parsed_data) {
          clearInterval(pollInterval);
          setPrevParsedData(deepClone(data.parsed_data as unknown as ParsedProgram ?? null));
          setEditedProgram(deepClone(pollData.parsed_data as unknown as ParsedProgram));
          setDiffMode(true);
        } else if (pollData.status === 'failed') {
          clearInterval(pollInterval);
        }
      }, 2000);
    } catch (err) {
      console.error('[PreviewClient] re-upload error:', err);
    }
  }

  // ── Header section (shared across states) ───────────────────────────────
  const headerSection = (
    <div style={{ marginBottom: 24 }}>
      <nav style={{ fontSize: 12, color: '#6B6963', marginBottom: 12 }}>
        <a
          href={`/${locale}/coach/imports`}
          style={{ color: '#6B6963', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IoChevronBackOutline size={12} />
          Imports
        </a>
        <span style={{ margin: '0 6px' }}>›</span>
        <span style={{ color: '#1C1A17' }}>{data.original_filename}</span>
      </nav>
      <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1C1A17', marginBottom: 8 }}>
        {data.original_filename}
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <StatusChip status={data.status} />
        <ConfidenceBadge
          value={(data.parsed_data as unknown as ParsedProgram | null)?.overall_confidence}
        />
        {data.page_count != null && (
          <span style={{ fontSize: 12, color: '#6B6963' }}>{data.page_count} page{data.page_count !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────
  // STATE: PARSING
  // ────────────────────────────────────────────────────────────────────────
  if (data.status === 'parsing' || data.status === 'pending' || data.status === 'uploaded') {
    return (
      <div>
        {headerSection}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E0DA',
            borderRadius: 12,
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              height: 8,
              background: '#E2E0DA',
              borderRadius: 9999,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <div
              ref={progressBarRef}
              className="parse-bar-fill"
              style={{
                height: '100%',
                width: '10%',
                background: '#FF5C1A',
                borderRadius: 9999,
                transition: 'none',
              }}
            />
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1C1A17', textAlign: 'center', marginBottom: 12 }}>
            Analyse en cours avec l&apos;IA…
          </h2>
          <p style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', marginBottom: 12 }}>
            Cela peut prendre jusqu&apos;à 60 secondes pour les PDFs multi-pages.
          </p>
          <p style={{ fontSize: 14, color: '#6B6963', textAlign: 'center', marginBottom: 24 }}>
            {formatElapsed(elapsedSeconds)}
          </p>
          <button
            onClick={stopPolling}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              color: '#6B6963',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // STATE: FAILED
  // ────────────────────────────────────────────────────────────────────────
  if (data.status === 'failed') {
    const errorMsg =
      data.error_message ??
      'Le fichier ne semble pas contenir un programme d\'entraînement structuré.';
    return (
      <div>
        {headerSection}
        <div
          ref={errorCardRef}
          className="error-card"
          style={{
            background: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderLeft: '4px solid #EF4444',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <IoAlertCircleOutline size={40} color="#EF4444" />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#B91C1C' }}>
            Échec de l&apos;analyse
          </h2>
          <p style={{ fontSize: 14, color: '#7F1D1D', textAlign: 'center' }}>
            {errorMsg}
          </p>
          <p style={{ fontSize: 12, color: '#6B6963', fontStyle: 'italic' }}>
            Aucun crédit n&apos;a été débité pour cet import.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleRetry}
              style={{
                background: '#FF5C1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Réessayer l&apos;analyse
            </button>
            <button
              onClick={() => router.push(`/${locale}/coach/imports`)}
              style={{
                background: '#FFFFFF',
                color: '#1C1A17',
                border: '1px solid #E2E0DA',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Uploader un autre fichier
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // STATE: COMMITTED
  // ────────────────────────────────────────────────────────────────────────
  if (data.status === 'committed') {
    return (
      <div>
        {headerSection}
        <div
          style={{
            background: '#DCFCE7',
            border: '1px solid #86EFAC',
            borderLeft: '4px solid #22C55E',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <IoCheckmarkCircleOutline size={32} color="#22C55E" />
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#166534' }}>
              Programme créé avec succès
            </p>
            {data.committed_program_id && (
              <a
                href={`/${locale}/coach/programs`}
                style={{ fontSize: 14, color: '#166534', textDecoration: 'underline' }}
              >
                Voir dans Programmes →
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // STATE: READY (editor + diff view)
  // ────────────────────────────────────────────────────────────────────────
  const program = editedProgram;
  if (!program) {
    return (
      <div>
        {headerSection}
        <p style={{ color: '#6B6963' }}>Données du programme non disponibles.</p>
      </div>
    );
  }

  const displayWeeks = diffMode && prevParsedData
    ? computeDiff(prevParsedData, program)
    : program.weeks;

  const diffSummary =
    diffMode && prevParsedData ? computeDiffSummary(prevParsedData, program) : null;

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {headerSection}

      {/* Overall confidence banner */}
      <OverallConfidenceBanner
        confidence={program.overall_confidence ?? (data.parsed_data as unknown as ParsedProgram | null)?.overall_confidence}
      />

      {/* Diff banner */}
      {diffMode && diffSummary && (
        <div
          className="diff-banner"
          style={{
            background: '#F0EFE9',
            border: '1px solid #E2E0DA',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 14, color: '#1C1A17', margin: 0 }}>
              +{diffSummary.added} exercices · -{diffSummary.removed} exercices · {diffSummary.changed} modifications
            </p>
            <p style={{ fontSize: 12, color: '#6B6963', margin: 0, marginTop: 2 }}>
              Nouvelle version vs. upload précédent
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setDiffMode(false);
                setPrevParsedData(null);
              }}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E0DA',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#1C1A17',
              }}
            >
              Annuler
            </button>
            <button
              onClick={() => {
                setDiffMode(false);
                setPrevParsedData(null);
              }}
              style={{
                background: '#FF5C1A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Confirmer les modifications
            </button>
          </div>
        </div>
      )}

      {/* Weeks accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {displayWeeks.map((week, weekIdx) => {
          const isExpanded = expandedWeeks.has(week.week_number);
          return (
            <div key={week.week_number} data-week={week.week_number} style={{ position: 'relative', zIndex: isExpanded ? 1 : 0 }}>
              {/* Week header */}
              <div
                onClick={() => toggleWeek(week.week_number)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E0DA',
                  borderRadius: isExpanded ? '8px 8px 0 0' : 8,
                  borderBottom: isExpanded ? 'none' : '1px solid #E2E0DA',
                  padding: '0 16px',
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IoChevronDownOutline
                    size={16}
                    style={{
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                      color: '#6B6963',
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>
                    Semaine {week.week_number} — {week.sessions.length} séance{week.sessions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {!diffMode && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); addSession(weekIdx); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: '#FF5C1A',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <IoAddOutline size={14} />
                        Ajouter une séance
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWeek(weekIdx); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6963', padding: 4 }}
                        title="Supprimer cette semaine"
                      >
                        <IoTrashOutline size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Accordion body */}
              {isExpanded && (
                <div
                  className="accordion-body"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E0DA',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {week.sessions.map((session, sessionIdx) => (
                    <div
                      key={`${week.week_number}-${sessionIdx}`}
                      style={{
                        background: '#F0EFE9',
                        border: '1px solid #E2E0DA',
                        borderRadius: 8,
                        padding: '12px 16px',
                      }}
                    >
                      {/* Session header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17' }}>
                          {session.name}
                        </span>
                        {!diffMode && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              onClick={() => addExercise(weekIdx, sessionIdx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: '#FF5C1A',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <IoAddOutline size={13} />
                              Ajouter un exercice
                            </button>
                            <button
                              onClick={() => deleteSession(weekIdx, sessionIdx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6963', padding: 4 }}
                              title="Supprimer cette séance"
                            >
                              <IoTrashOutline size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Exercise table */}
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ fontSize: 12, fontWeight: 600, color: '#6B6963', textAlign: 'left', padding: '4px 8px' }}>Exercice</th>
                            <th style={{ fontSize: 12, fontWeight: 600, color: '#6B6963', textAlign: 'left', padding: '4px 8px', width: 60 }}>Séries</th>
                            <th style={{ fontSize: 12, fontWeight: 600, color: '#6B6963', textAlign: 'left', padding: '4px 8px', width: 80 }}>Reps</th>
                            <th style={{ fontSize: 12, fontWeight: 600, color: '#6B6963', textAlign: 'left', padding: '4px 8px', width: 60 }}>RPE</th>
                            <th style={{ fontSize: 12, fontWeight: 600, color: '#6B6963', textAlign: 'left', padding: '4px 8px', width: 80 }}>Repos</th>
                            {!diffMode && <th style={{ width: 32 }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {session.exercises.map((exercise, exIdx) => {
                            const diffEx = exercise as ParsedExercise & { diffStatus?: DiffStatus };
                            const isUnchanged = diffMode && diffEx.diffStatus === 'unchanged';
                            const hiddenByCollapse = isUnchanged && !showAllUnchanged;
                            if (hiddenByCollapse && exIdx > 2) return null;
                            return (
                              <ExerciseRow
                                key={`${week.week_number}-${sessionIdx}-${exIdx}`}
                                exercise={exercise as ParsedExercise & { diffStatus?: DiffStatus; prevValues?: Partial<ParsedExercise> }}
                                onUpdate={(field, value) =>
                                  updateExercise(weekIdx, sessionIdx, exIdx, field, value)
                                }
                                onDelete={() => deleteExercise(weekIdx, sessionIdx, exIdx)}
                                diffMode={diffMode}
                                editedFields={editedFields}
                                onFieldEdited={(f) =>
                                  setEditedFields((prev) => new Set([...prev, f]))
                                }
                                rowIndex={exIdx}
                              />
                            );
                          })}
                          {/* Show "tout afficher" for unchanged rows in diff mode */}
                          {diffMode &&
                            session.exercises.filter(
                              (e) => (e as ParsedExercise & { diffStatus?: DiffStatus }).diffStatus === 'unchanged'
                            ).length > 3 && (
                              <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '8px 0' }}>
                                  <button
                                    onClick={() => setShowAllUnchanged((v) => !v)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      color: '#6B6963',
                                      textDecoration: 'underline',
                                    }}
                                  >
                                    {showAllUnchanged ? 'Réduire' : 'tout afficher'}
                                  </button>
                                </td>
                              </tr>
                            )}
                          {/* Add exercise row */}
                          {!diffMode && (
                            <tr>
                              <td
                                colSpan={6}
                                onClick={() => addExercise(weekIdx, sessionIdx)}
                                style={{
                                  borderTop: '1px dashed #E2E0DA',
                                  height: 44,
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: '#FF5C1A',
                                  fontWeight: 600,
                                }}
                              >
                                + Ajouter un exercice
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add week zone */}
      {!diffMode && (
        <button
          onClick={addWeek}
          style={{
            width: '100%',
            height: 52,
            border: '2px dashed #E2E0DA',
            borderRadius: 8,
            background: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: '#6B6963',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 80,
          }}
        >
          <IoAddOutline size={16} />
          + Ajouter une semaine
        </button>
      )}

      {/* Sticky footer CTA */}
      {!diffMode && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 240,
            right: 0,
            background: '#FFFFFF',
            borderTop: '1px solid #E2E0DA',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            zIndex: 50,
          }}
        >
          {/* Hidden file input for re-upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleReuploadFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#FFFFFF',
              color: '#1C1A17',
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              padding: '10px 20px',
              height: 40,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <IoCloudUploadOutline size={16} />
            Re-upload nouvelle version
          </button>
          <button
            onClick={handleCommit}
            disabled={commitLoading}
            style={{
              background: commitLoading ? '#FFA07A' : '#FF5C1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              height: 40,
              fontSize: 14,
              fontWeight: 600,
              cursor: commitLoading ? 'not-allowed' : 'pointer',
            }}
            onMouseDown={(e) => {
              if (!commitLoading) {
                gsap.to(e.currentTarget, { scale: 0.97, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.in' });
              }
            }}
          >
            {commitLoading ? 'Création…' : 'Créer le template'}
          </button>
        </div>
      )}
    </div>
  );
}
