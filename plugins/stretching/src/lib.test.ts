import { describe, it, expect } from 'vitest';
import {
  computeStats, buildMonthGrid, calendarCellLabel, localDateKey, startOfWeek, lastSessionLabel,
  moveItem, applyDefault, clearDefault, pickDefaultRoutine, shouldShowDefaultCard, shouldAutoLaunchDefault,
  filterLibrary, filterCounts, normalizeRoutineExercise, normalizeRoutine, formatMeasure,
  routineSeconds, routineMinutes, routineSummary, validateExerciseDraft, exerciseFromLibrary,
  type LibraryExercise, type LogRow,
} from './lib';

const lib = (over: Partial<LibraryExercise>): LibraryExercise => ({
  id: 'x', user_id: null, name: 'X', muscle_group: 'back', measure: 'duration',
  duration_seconds: 30, reps: null, sides: 1, instructions: '', ...over,
});

describe('suivi : semaine, minutes, serie (fuseau local)', () => {
  // jeudi 12 novembre 2026 (semaine lundi 9 -> dimanche 15)
  const now = new Date(2026, 10, 12, 10, 0, 0);
  const logs: LogRow[] = [
    { date: '2026-11-11', duration_sec: 660, routine_name: 'Détente du soir' }, // hier
    { date: '2026-11-12', duration_sec: 360, routine_name: 'Réveil articulaire' }, // aujourd'hui
    { date: '2026-11-08', duration_sec: 600, routine_name: 'Dimanche precedent' }, // semaine d'avant
  ];

  it('2 seances cette semaine, 17 min, serie 2 jours (maquette C06)', () => {
    const s = computeStats(logs, now);
    expect(s.weekSessions).toBe(2);
    expect(s.weekMinutes).toBe(17);
    expect(s.streak).toBe(2);
    expect(s.last?.date).toBe('2026-11-12');
  });

  it('dimanche appartient a la semaine qui finit, pas a la suivante', () => {
    const sunday = new Date(2026, 10, 15, 23, 59, 0);
    const s = computeStats([{ date: '2026-11-09', duration_sec: 60 }, { date: '2026-11-15', duration_sec: 60 }], sunday);
    expect(s.weekSessions).toBe(2);
    const monday = new Date(2026, 10, 16, 0, 5, 0);
    expect(computeStats([{ date: '2026-11-15', duration_sec: 60 }], monday).weekSessions).toBe(0);
  });

  it('zeros honnetes sans log (C07)', () => {
    const s = computeStats([], now);
    expect(s).toMatchObject({ weekSessions: 0, weekMinutes: 0, streak: 0, last: null });
  });

  it('la serie n est pas cassee tant qu aujourd hui n a pas de seance, mais l est apres un jour manque', () => {
    expect(computeStats([{ date: '2026-11-11', duration_sec: 60 }, { date: '2026-11-10', duration_sec: 60 }], now).streak).toBe(2);
    expect(computeStats([{ date: '2026-11-10', duration_sec: 60 }], now).streak).toBe(0);
  });

  it('plusieurs logs le meme jour = 1 jour de serie, 2 seances', () => {
    const s = computeStats([{ date: '2026-11-12', duration_sec: 60 }, { date: '2026-11-12', duration_sec: 60 }], now);
    expect(s.streak).toBe(1);
    expect(s.weekSessions).toBe(2);
  });

  it('pas de decalage UTC : 00:30 locale compte pour le jour local (G-05)', () => {
    const justAfterMidnight = new Date(2026, 10, 12, 0, 30, 0);
    expect(localDateKey(justAfterMidnight)).toBe('2026-11-12');
    expect(computeStats([{ date: '2026-11-12', duration_sec: 90 }], justAfterMidnight).streak).toBe(1);
  });

  it('serie sur un changement de mois et d heure d ete/hiver', () => {
    const d = new Date(2026, 9, 26, 12, 0, 0); // 26 oct 2026 (passage heure d hiver 25 oct)
    const l: LogRow[] = ['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23'].map((date) => ({ date, duration_sec: 60 }));
    expect(computeStats(l, d).streak).toBe(4);
  });

  it('startOfWeek = lundi', () => {
    expect(localDateKey(startOfWeek(now))).toBe('2026-11-09');
    expect(localDateKey(startOfWeek(new Date(2026, 10, 15)))).toBe('2026-11-09');
  });

  it('libelle derniere seance', () => {
    expect(lastSessionLabel('2026-11-12', now)).toBe("Aujourd'hui");
    expect(lastSessionLabel('2026-11-11', now)).toBe('Hier');
    expect(lastSessionLabel('2026-11-07', now)).toBe('Il y a 5 j');
  });
});

describe('calendrier du mois', () => {
  const now = new Date(2026, 10, 12);
  const days = new Set(['2026-11-11', '2026-11-12']);
  const grid = buildMonthGrid(now, days);
  const flat = grid.flat();

  it('semaines lundi-dimanche couvrant novembre 2026 (1er = dimanche)', () => {
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0].key).toBe('2026-10-26');
    expect(grid[0][6].key).toBe('2026-11-01');
    expect(flat.filter((c) => c.inMonth)).toHaveLength(30);
  });

  it('jours avec seance = jours des logs ; aujourd hui marque ; un seul aujourd hui', () => {
    expect(flat.filter((c) => c.hasSession).map((c) => c.key)).toEqual(['2026-11-11', '2026-11-12']);
    expect(flat.filter((c) => c.isToday)).toHaveLength(1);
    expect(flat.find((c) => c.isToday)!.key).toBe('2026-11-12');
  });

  it('libelle accessible sans couleur seule', () => {
    const c = flat.find((x) => x.key === '2026-11-12')!;
    expect(calendarCellLabel(c)).toBe('12 novembre, séance réalisée');
    expect(calendarCellLabel(flat.find((x) => x.key === '2026-11-13')!)).toBe('13 novembre');
  });
});

describe('routine : ordre, duree, defaut unique', () => {
  it('moveItem monte / descend et ne sort pas des bornes', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    const src = ['a', 'b'];
    moveItem(src, 0, 1);
    expect(src).toEqual(['a', 'b']); // pur
  });

  it('une 2e routine par defaut retire le defaut de la 1re : exactement 1 (ST-3)', () => {
    const rs = [{ id: 'r1', is_default: true }, { id: 'r2', is_default: false }, { id: 'r3', is_default: false }];
    const next = applyDefault(rs, 'r2');
    expect(next.filter((r) => r.is_default).map((r) => r.id)).toEqual(['r2']);
    expect(applyDefault(next, 'r3').filter((r) => r.is_default)).toHaveLength(1);
    expect(clearDefault(next).filter((r) => r.is_default)).toHaveLength(0);
    expect(pickDefaultRoutine(next)?.id).toBe('r2');
    expect(pickDefaultRoutine(clearDefault(next))).toBeNull();
  });

  it('carte de debut de seance : absente sans defaut, absente apres Passer, absente si routine vide (ST-4)', () => {
    const r = { exercises: [{}] };
    expect(shouldShowDefaultCard(r, false)).toBe(true);
    expect(shouldShowDefaultCard(r, true)).toBe(false);
    expect(shouldShowDefaultCard(null, false)).toBe(false);
    expect(shouldShowDefaultCard(undefined, false)).toBe(false);
    expect(shouldShowDefaultCard({ exercises: [] }, false)).toBe(false);
  });

  it('duree et resume : 45 s + 10 reps (3 s) + 30 s x 2 cotes', () => {
    const ex = [
      normalizeRoutineExercise({ name: 'a', measure: 'duration', duration_seconds: 45 }),
      normalizeRoutineExercise({ name: 'b', measure: 'reps', reps: 10 }),
      normalizeRoutineExercise({ name: 'c', measure: 'duration', duration_seconds: 30, sides: 2 }),
    ];
    expect(routineSeconds(ex)).toBe(45 + 30 + 60);
    expect(routineMinutes(ex)).toBe(2);
    expect(routineSummary(ex)).toBe('3 exercices · 2 min');
    expect(routineSummary([ex[0]])).toBe('1 exercice · 1 min');
    expect(routineMinutes([])).toBe(0);
  });

  it('formatMeasure', () => {
    expect(formatMeasure({ measure: 'duration', duration_seconds: 45, reps: 10, sides: 1 })).toBe('45 s');
    expect(formatMeasure({ measure: 'duration', duration_seconds: 30, reps: 10, sides: 2 })).toBe('30 s par côté');
    expect(formatMeasure({ measure: 'reps', duration_seconds: 30, reps: 10, sides: 1 })).toBe('10 répétitions');
    expect(formatMeasure({ measure: 'reps', duration_seconds: 30, reps: 1, sides: 2 })).toBe('1 répétition par côté');
  });

  it('anciennes routines (sans measure/sides/is_default) restent lisibles', () => {
    const r = normalizeRoutine({ id: 'old', name: 'Ancienne', exercises: [{ name: 'Etirement', duration_seconds: 20, muscle_group: 'quads' }] });
    expect(r.is_default).toBe(false);
    expect(r.exercises[0]).toMatchObject({ measure: 'duration', duration_seconds: 20, sides: 1 });
    expect(normalizeRoutine({ id: 'x', name: 'x', exercises: null }).exercises).toEqual([]);
  });

  it('exerciseFromLibrary garde la reference au catalogue', () => {
    const e = exerciseFromLibrary(lib({ id: 'abc', name: 'Cobra', measure: 'reps', reps: 8, duration_seconds: null, sides: 2 }));
    expect(e).toMatchObject({ exercise_id: 'abc', measure: 'reps', reps: 8, sides: 2 });
  });
});

describe('bibliotheque : filtres et compteurs (ST-1)', () => {
  const list = [
    lib({ id: '1', muscle_group: 'back' }),
    lib({ id: '2', muscle_group: 'back' }),
    lib({ id: '3', muscle_group: 'legs' }),
    lib({ id: '4', muscle_group: 'hips', user_id: 'u1' }),
  ];
  it('le compteur de Tous = nombre de lignes ; chaque filtre reduit la liste', () => {
    const c = filterCounts(list);
    expect(c.all).toBe(filterLibrary(list, 'all').length);
    expect(c.all).toBe(4);
    expect(c.back).toBe(2);
    expect(filterLibrary(list, 'back')).toHaveLength(c.back);
    expect(filterLibrary(list, 'legs')).toHaveLength(1);
    expect(c.shoulders).toBe(0);
  });
  it('Mes exercices = uniquement les exercices perso (C02 : 0 si aucun)', () => {
    expect(filterLibrary(list, 'mine').map((e) => e.id)).toEqual(['4']);
    expect(filterLibrary(list.slice(0, 3), 'mine')).toEqual([]);
    expect(filterCounts(list.slice(0, 3)).mine).toBe(0);
  });
});

describe('creation d exercice : validation', () => {
  const ok = { name: 'Pigeon sur le dos', zone: 'hips' as const, measure: 'duration' as const, duration_seconds: 40, reps: 10, sides: 2 as const, instructions: '' };
  it('valide', () => expect(validateExerciseDraft(ok)).toBeNull());
  it('refuse nom vide, zone absente, bornes', () => {
    expect(validateExerciseDraft({ ...ok, name: '   ' })).toMatch(/nom/);
    expect(validateExerciseDraft({ ...ok, zone: null })).toMatch(/zone/);
    expect(validateExerciseDraft({ ...ok, duration_seconds: 2 })).toMatch(/durée/);
    expect(validateExerciseDraft({ ...ok, measure: 'reps', reps: 0 })).toMatch(/répétitions/);
    expect(validateExerciseDraft({ ...ok, measure: 'reps', reps: 8, duration_seconds: 0 })).toBeNull();
  });
});

describe('shouldAutoLaunchDefault (STRE-06, revue B M9)', () => {
  const r = { exercises: [{}] };
  it('lance seulement si le reglage est actif, routine non vide, non passee, pas deja lance', () => {
    expect(shouldAutoLaunchDefault({ enabled: true, routine: r, skipped: false, alreadyLaunched: false })).toBe(true);
    expect(shouldAutoLaunchDefault({ enabled: false, routine: r, skipped: false, alreadyLaunched: false })).toBe(false);
    expect(shouldAutoLaunchDefault({ enabled: true, routine: r, skipped: true, alreadyLaunched: false })).toBe(false);
    expect(shouldAutoLaunchDefault({ enabled: true, routine: r, skipped: false, alreadyLaunched: true })).toBe(false);
    expect(shouldAutoLaunchDefault({ enabled: true, routine: null, skipped: false, alreadyLaunched: false })).toBe(false);
    expect(shouldAutoLaunchDefault({ enabled: true, routine: { exercises: [] }, skipped: false, alreadyLaunched: false })).toBe(false);
  });
});
