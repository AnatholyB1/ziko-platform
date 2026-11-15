/**
 * Phase 23 (v1.20) - ATEL-05/06 : modele du brouillon (module pur).
 * Prouve : normalisation tolerante, jours ISO distincts, edition typee, programme powerlifter
 * (S1-S8, %1RM, RPE, repos), conversion vers la ligne inactive de ziko_ai_generated_programs.
 * Ne prouve PAS la qualite du programme genere par le modele.
 */
import { describe, it, expect } from 'vitest';
import { normalizeProgram, applyOps, applyOp, toProgramRow, renderDraftForPrompt, DraftError, LIMITS } from './draft.js';

const pctSession = (name: string, day: number, pct: number) => ({
  name,
  day_of_week: day,
  exercises: [
    { name: 'Squat', sets: 4, reps: '3', pct_1rm: pct, rpe: 8, rest_seconds: 240 },
    { name: 'Bench press', sets: 4, reps: 3, pct_1rm: pct - 5, rpe: 8, rest_seconds: 180 },
  ],
});

function powerlifterProgram() {
  return {
    name: 'Peak 8 semaines',
    goal: 'powerlifting meet',
    weeks: Array.from({ length: 8 }, (_, i) => ({
      label: i === 7 ? 'Deload' : `Bloc ${i + 1}`,
      sessions: [pctSession('Squat', 1, 75 + i * 2), pctSession('Bench', 3, 75 + i * 2), pctSession('Deadlift', 5, 75 + i * 2)],
    })),
  };
}

describe('normalizeProgram', () => {
  it('keeps an 8-week powerlifter program with %1RM, RPE and rest', () => {
    const p = normalizeProgram(powerlifterProgram());
    expect(p.weeks_count).toBe(8);
    expect(p.days_per_week).toBe(3);
    expect(p.weeks[0].w).toBe(1);
    expect(p.weeks[7].w).toBe(8);
    const squat = p.weeks[2].sessions[0].exercises[0];
    expect(squat).toMatchObject({ name: 'Squat', sets: 4, reps: '3', pct_1rm: 79, rpe: 8, rest_seconds: 240 });
  });

  it('assigns distinct ISO days when the model repeats or omits them', () => {
    const p = normalizeProgram({
      name: 'x',
      weeks: [
        {
          sessions: [
            { name: 'A', day_of_week: 1, exercises: [{ name: 'Squat', sets: 3, reps: 5 }] },
            { name: 'B', day_of_week: 1, exercises: [{ name: 'Row', sets: 3, reps: 8 }] },
            { name: 'C', exercises: [{ name: 'Press', sets: 3, reps: 8 }] },
          ],
        },
      ],
    });
    const days = p.weeks[0].sessions.map((s) => s.day_of_week);
    expect(new Set(days).size).toBe(3);
    days.forEach((d) => expect(d >= 1 && d <= 7).toBe(true));
  });

  it('clamps absurd values and truncates collections', () => {
    const p = normalizeProgram({
      name: 'x'.repeat(500),
      weeks: Array.from({ length: 40 }, () => ({
        sessions: [{ name: 'A', exercises: [{ name: 'Squat', sets: 999, reps: '5', pct_1rm: 900, rpe: 99, rest_seconds: 99999 }] }],
      })),
    });
    expect(p.name.length).toBe(80);
    expect(p.weeks.length).toBe(LIMITS.maxWeeks);
    const e = p.weeks[0].sessions[0].exercises[0];
    expect(e.sets).toBe(LIMITS.maxSets);
    expect(e.pct_1rm).toBe(120);
    expect(e.rpe).toBe(10);
    expect(e.rest_seconds).toBe(LIMITS.maxRestSeconds);
  });

  it('accepts a flat sessions list repeated weeks_count times', () => {
    const p = normalizeProgram({ name: 'x', weeks_count: 4, sessions: [{ name: 'A', exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] });
    expect(p.weeks_count).toBe(4);
  });

  it('rejects empty programs and exercises without a name', () => {
    expect(() => normalizeProgram({ name: 'x', weeks: [] })).toThrow(DraftError);
    expect(() => normalizeProgram({ name: 'x', weeks: [{ sessions: [{ name: 'A', exercises: [{ sets: 3 }] }] }] })).toThrow(DraftError);
  });
});

describe('applyOps (shared by the AI and manual edits)', () => {
  const base = () => normalizeProgram(powerlifterProgram());

  it('updates one exercise in one week without touching the others', () => {
    const next = applyOps(base(), [{ op: 'update_exercise', week: 3, session: 0, index: 0, patch: { sets: 5, pct_1rm: 82.5 } }]);
    expect(next.weeks[2].sessions[0].exercises[0]).toMatchObject({ sets: 5, pct_1rm: 82.5, name: 'Squat' });
    expect(next.weeks[1].sessions[0].exercises[0].sets).toBe(4);
  });

  it("applies to 'all' weeks", () => {
    const next = applyOps(base(), [{ op: 'update_exercise', week: 'all', session: 1, index: 1, patch: { rest_seconds: 120 } }]);
    expect(next.weeks.every((w) => w.sessions[1].exercises[1].rest_seconds === 120)).toBe(true);
  });

  it('adds, removes exercises and sessions, renames', () => {
    let p = applyOps(base(), [{ op: 'add_exercise', week: 1, session: 0, exercise: { name: 'Pause squat', sets: 3, reps: 4 }, index: 1 }]);
    expect(p.weeks[0].sessions[0].exercises.map((e) => e.name)).toEqual(['Squat', 'Pause squat', 'Bench press']);
    p = applyOps(p, [
      { op: 'remove_exercise', week: 1, session: 0, index: 1 },
      { op: 'rename', name: 'Nouveau nom' },
    ]);
    expect(p.weeks[0].sessions[0].exercises).toHaveLength(2);
    expect(p.name).toBe('Nouveau nom');
    p = applyOps(p, [{ op: 'remove_session', week: 'all', session: 2 }]);
    expect(p.days_per_week).toBe(2);
  });

  it('does not mutate its input and throws DraftError on bad indices', () => {
    const b = base();
    const snapshot = JSON.stringify(b);
    expect(() => applyOp(b, { op: 'update_exercise', week: 99, session: 0, index: 0, patch: {} })).toThrow(DraftError);
    expect(() => applyOp(b, { op: 'remove_exercise', week: 1, session: 0, index: 9 })).toThrow(DraftError);
    applyOp(b, { op: 'rename', name: 'z' });
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('refuses empty or oversized op lists', () => {
    expect(() => applyOps(base(), [])).toThrow(DraftError);
    expect(() => applyOps(base(), Array.from({ length: 51 }, () => ({ op: 'rename', name: 'a' } as const)))).toThrow(DraftError);
  });
});

describe('toProgramRow / renderDraftForPrompt', () => {
  it('builds an INACTIVE row with the weeks[].sessions shape P6 can start', () => {
    const row = toProgramRow('user-1', normalizeProgram(powerlifterProgram()));
    expect(row.is_active).toBe(false);
    expect(row.user_id).toBe('user-1');
    expect(row.days_per_week).toBe(3);
    expect(row.program_data.workshop).toBe(true);
    expect(row.program_data.weeks).toHaveLength(8);
    expect(row.program_data.weeks[0].sessions[0].day_of_week).toBe(1);
  });

  it('renders 0-based indices for the model and is bounded', () => {
    const text = renderDraftForPrompt(normalizeProgram(powerlifterProgram()), 500);
    expect(text).toContain('[0] Squat');
    expect(text.length).toBeLessThanOrEqual(520);
    expect(renderDraftForPrompt(null)).toBe('No draft yet.');
  });
});
