// Run3 : la forme publiee par l'atelier (draft -> toProgramRow -> program_data) doit etre lue a
// l'identique par TOUS les lecteurs : P6 (workoutPlan), P7 (programShape) et P24 (progress/relaunch).
// Aller-retour complet : brut modele -> normalizeProgram -> toProgramRow -> JSON (JSONB) -> lecteurs.
// Ne prouve pas : le stockage Postgres reel (JSONB conserve les tableaux tels quels).
import { describe, it, expect } from 'vitest';
import { normalizeProgram, toProgramRow } from '../../backend/api/src/workshop/draft';
import { weeksCountOf, sessionsPerWeekOf, evaluateProgress } from '../../backend/api/src/periodization/progress';
import { normalizePlanSessions } from '../../apps/mobile/src/lib/workoutPlan';
import {
  getProgramWeekCount,
  getProgramSessionsPerWeek,
  getProgramSessionList,
} from '../../plugins/ai-programs/src/lib/programShape';

const raw = {
  name: 'Force 4 semaines',
  goal: 'strength',
  weeks: [1, 2, 3, 4].map((n) => ({
    label: `S${n}`,
    sessions: [
      { name: 'Bas du corps', day_of_week: 1, exercises: [{ name: 'Squat', sets: 5, reps: '5', pct_1rm: 75 + n, rest_seconds: 180 }] },
      { name: 'Haut du corps', day_of_week: 3, exercises: [{ name: 'Développé couché', sets: 4, reps: 6 }] },
      { name: 'Tirage', day_of_week: 5, exercises: [{ name: 'Tractions', sets: 3, reps: '8' }, { name: 'Rowing', sets: 3, reps: '10' }] },
    ],
  })),
};

// JSONB : serialisation/deserialisation, comme a travers PostgREST.
const stored = JSON.parse(JSON.stringify(toProgramRow('u1', normalizeProgram(raw)))).program_data;

describe('forme publiee par l atelier == forme lue par P6 / P7 / P24', () => {
  it('forme canonique : weeks[] de { w, sessions[] } + weeks_count coherent', () => {
    expect(Array.isArray(stored.weeks)).toBe(true);
    expect(stored.weeks.map((w: any) => w.w)).toEqual([1, 2, 3, 4]);
    expect(stored.weeks_count).toBe(stored.weeks.length);
    expect(stored.weeks.every((w: any) => Array.isArray(w.sessions))).toBe(true);
  });

  it('P6 workoutPlan : seances, jours ISO distincts, exercices de chaque semaine', () => {
    for (const week of [1, 2, 3, 4]) {
      const plan = normalizePlanSessions(stored, week);
      expect(plan.map((s) => s.name)).toEqual(['Bas du corps', 'Haut du corps', 'Tirage']);
      expect(plan.map((s) => s.dayIndex)).toEqual([0, 2, 4]); // lun / mer / ven
      expect(plan[0].exercises[0]).toMatchObject({ name: 'Squat', sets: 5, reps: '5', rest_seconds: 180 });
      expect(plan[2].exercises).toHaveLength(2);
    }
  });

  it('P7 programShape : 4 semaines, 3 seances/semaine, 12 seances au total', () => {
    expect(getProgramWeekCount(stored)).toBe(4);
    expect(getProgramSessionsPerWeek(stored)).toBe(3);
    expect(getProgramSessionList(stored)).toHaveLength(12);
  });

  it('P24 progress : meme nombre de semaines et de seances/semaine, fin calendaire a +4 semaines', () => {
    expect(weeksCountOf(stored)).toBe(4);
    expect(sessionsPerWeekOf(3, stored)).toBe(3);
    expect(sessionsPerWeekOf(null, stored)).toBe(3);
    const start = '2026-10-05T08:00:00Z';
    const ev = evaluateProgress({ startedAt: start, createdAt: start, programData: stored, daysPerWeek: 3 }, 0, new Date('2026-10-20T00:00:00Z'));
    expect(ev).toMatchObject({ state: 'in_progress', weeksCount: 4, plannedSessions: 12 });
    expect(evaluateProgress({ startedAt: start, createdAt: start, programData: stored, daysPerWeek: 3 }, 0, new Date('2026-11-03T00:00:00Z')).state).toBe('ended');
  });

  it('un programme plat (sessions[] sans weeks) est normalise en weeks[] repete', () => {
    const flat = normalizeProgram({ name: 'Plat', weeks_count: 3, sessions: [{ name: 'A', exercises: [{ name: 'Squat', sets: 3, reps: 5 }] }] });
    const s = JSON.parse(JSON.stringify(toProgramRow('u1', flat))).program_data;
    expect(getProgramWeekCount(s)).toBe(3);
    expect(weeksCountOf(s)).toBe(3);
    expect(normalizePlanSessions(s, 2)).toHaveLength(1);
  });
});
