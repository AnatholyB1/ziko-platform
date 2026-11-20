import { describe, it, expect, vi } from 'vitest';
import { resolveExercise, matchExercise, searchPatternsFor, normalizeExerciseName } from '../exerciseMatch';
import { plannedStartFeedback, applyPlannedStartFeedback } from '../plannedStartFeedback';

// Echantillon REEL du catalogue ziko_exercises (scripts/exercise_names.txt, 1318 noms) : tous les squats,
// bench press et deadlifts. Il n'y a NI "back squat" NI "squat" dans le catalogue.
const CATALOG = ["band bench press","band one arm single leg split squat","band single leg split squat","band squat","band squat row","band stiff leg deadlift","band straight back stiff leg deadlift","band straight leg deadlift","barbell bench front squat","barbell bench press","barbell bench squat","barbell clean-grip front squat","barbell close-grip bench press","barbell deadlift","barbell decline bench press","barbell front chest squat","barbell front squat","barbell full squat","barbell full squat (back pov)","barbell full squat (side pov)","barbell full zercher squat","barbell guillotine bench press","barbell hack squat","barbell high bar squat","barbell incline bench press","barbell incline close grip bench press","barbell jefferson squat","barbell jm bench press","barbell jump squat","barbell low bar squat","barbell narrow stance squat","barbell one arm side deadlift","barbell one leg squat","barbell overhead squat","barbell reverse close-grip bench press","barbell reverse grip decline bench press","barbell reverse grip incline bench press","barbell romanian deadlift","barbell side split squat","barbell side split squat v. 2","barbell single leg deadlift","barbell single leg split squat","barbell speed squat","barbell split squat v. 2","barbell squat (on knees)","barbell squat jump step rear lunge","barbell straight leg deadlift","barbell sumo deadlift","barbell wide bench press","barbell wide reverse grip bench press","barbell wide squat","barbell zercher squat","bodyweight drop jump squat","bodyweight squatting row","bodyweight squatting row (with towel)","cable bench press","cable deadlift","cable incline bench press","cable squat row (with rope attachment)","cable squatting curl","curtsey squat","dumbbell bench press","dumbbell bench squat","dumbbell biceps curl squat","dumbbell deadlift","dumbbell decline bench press","dumbbell goblet squat","dumbbell incline bench press","dumbbell neutral grip bench press","dumbbell palms in incline bench press","dumbbell plyo squat","dumbbell reverse bench press","dumbbell romanian deadlift","dumbbell single leg deadlift","dumbbell single leg deadlift with stepbox support","dumbbell single leg split squat","dumbbell single leg squat","dumbbell squat","dumbbell step-up split squat","dumbbell stiff leg deadlift","dumbbell straight leg deadlift","dumbbell supported squat","dumbbell twisting bench press","ez barbell jm bench press","ez-bar close-grip bench press","frankenstein squat","jump squat","jump squat v. 2","kettlebell front squat","kettlebell goblet squat","kettlebell pistol squat","kettlebell turkish get up (squat style)","kneeling jump squat","lever deadlift","lever seated squat calf raise on leg press machine","one leg squat","potty squat","potty squat with support","semi squat jump (male)","single leg squat (pistol) male","sissy squat","sled closer hack squat","sled hack squat","sled lying squat","smith bench press","smith chair squat","smith close-grip bench press","smith deadlift","smith decline bench press","smith front squat (clean grip)","smith full squat","smith hack squat","smith incline bench press","smith low bar squat","smith machine decline close grip bench press","smith machine reverse decline close grip bench press","smith single leg split squat","smith squat","smith sumo squat","smith wide grip bench press","smith wide grip decline bench press","split squats","squat jerk","squat on bosu ball","squat to overhead reach","squat to overhead reach with twist","suspended split squat","trap bar deadlift","weighted cossack squats (male)","weighted sissy squat","weighted squat"].map((name, i) => ({ id: 'r' + i, name, name_fr: null }));
const FR = { 'Barbell Bench Press': 'Développé couché' } as Record<string, string>;
const idOf = (q: string, rows: any[] = CATALOG) => resolveExercise(q, rows, FR)?.name ?? null;

describe('normalizeExerciseName', () => {
  it('casse, accents et ponctuation', () => {
    expect(normalizeExerciseName('  Développé-Couché (barre) ')).toBe('developpe couche barre');
  });
});

describe('resolveExercise sur le catalogue reel (P24 run5)', () => {
  it('le catalogue reel n\'a ni "back squat" ni "squat"', () => {
    expect(CATALOG.some((r) => r.name === 'back squat' || r.name === 'squat')).toBe(false);
  });
  it('"Squat" / "Back Squat" / "Squat arriere" / "Squat barre" -> barbell full squat (mouvement de base)', () => {
    for (const q of ['Squat', 'Back Squat', 'Squat arrière', 'squat barre', 'SQUATS', 'Barbell Squat']) {
      expect(idOf(q)).toBe('barbell full squat');
    }
  });
  it('jamais une variante (jump, split, sissy, single leg...) pour "Squat"', () => {
    const got = idOf('Squat') ?? '';
    expect(got).not.toMatch(/jump|split|sissy|single|one leg|pistol|row|curl/);
  });
  it('exact insensible a la casse / accents / pluriel', () => {
    expect(idOf('BARBELL  FRONT SQUAT')).toBe('barbell front squat');
    expect(idOf('split squat')).toBe('split squats');
    expect(matchExercise('Barbell Front Squat', CATALOG, FR)?.kind).toBe('exact');
  });
  it('approx (a signaler par un toast) quand le libelle differe', () => {
    expect(matchExercise('Squat', CATALOG, FR)?.kind).toBe('approx');
  });
  it('variante demandee -> la variante la plus proche du mouvement de base', () => {
    expect(idOf('front squat')).toBe('barbell front squat');
    expect(idOf('goblet squat')).toBe('dumbbell goblet squat'); // egalite haltere / kettlebell : preference de materiel
    expect(idOf('jump squat')).toBe('jump squat');
  });
  it('anglais <-> francais via exerciseNames', () => {
    expect(idOf('Développé couché')).toBe('barbell bench press');
  });
  it('ambigu sans meilleur candidat clair -> null (ne bloque pas la seance)', () => {
    const rows = [
      { id: 'x1', name: 'dumbbell squat' },
      { id: 'x2', name: 'dumbbell squat' },
    ];
    expect(resolveExercise('squat', rows, {})).toBeNull();
  });
  it('inconnu ou vide -> null', () => {
    expect(idOf('Zercher carry')).toBeNull();
    expect(idOf('')).toBeNull();
  });
});

describe('searchPatternsFor', () => {
  it('mot le plus long, alias et equivalent anglais d\'un nom francais', () => {
    expect(searchPatternsFor('Squat', FR)).toContain('%squat%');
    expect(searchPatternsFor('Développé couché', FR)).toContain('%Barbell Bench Press%');
  });
});

describe('plannedStartFeedback', () => {
  it('exercice remplace : toast neutre "remplace par X"', () => {
    const fb = plannedStartFeedback({ ok: true, unresolved: [], replaced: [{ from: 'Squat', to: 'barbell full squat' }] });
    expect(fb.navigate).toBe(true);
    expect(fb.toast).toBe('Exercice remplacé : Squat par barbell full squat');
    expect(fb.alert).toBeUndefined();
  });
  it('seance demarree avec des exercices non resolus : navigue + toast neutre qui les liste', () => {
    const fb = plannedStartFeedback({ ok: true, unresolved: ['Zercher carry'] });
    expect(fb.navigate).toBe(true);
    expect(fb.toast).toContain('Zercher carry');
    expect(fb.alert).toBeUndefined();
  });
  it('tout resolu : aucun message', () => {
    expect(plannedStartFeedback({ ok: true, unresolved: [] })).toEqual({ navigate: true });
  });
  it('aucun exercice resolu : alerte claire + lien vers l\'edition, pas de navigation', () => {
    const deps = { toast: vi.fn(), alert: vi.fn(), openEdit: vi.fn(), openSession: vi.fn() };
    applyPlannedStartFeedback({ ok: false, reason: 'no_exercises', unresolved: ['X', 'Y'] }, deps);
    expect(deps.openSession).not.toHaveBeenCalled();
    expect(deps.alert).toHaveBeenCalledTimes(1);
    const [title, msg, buttons] = deps.alert.mock.calls[0];
    expect(title).toBe('Séance indisponible');
    expect(msg).toContain('X, Y');
    buttons[0].onPress();
    expect(deps.openEdit).toHaveBeenCalled();
  });
});
