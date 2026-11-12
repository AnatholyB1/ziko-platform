import { describe, it, expect } from 'vitest';
import {
  nightDurationMin, validateNight, formatDurationMin, formatDurationH, stepTime, resolveNight, homeSleepLabel,
  buildWeekBars, weekAverageH, weekAccessibilityLabel, parseSettings, settingsToJson, stepGoal, EMPTY_SETTINGS,
  mapHealthConnectStages, healthStages, type ManualNight, type HealthNight,
  localDateKey, shiftDateKey, lastNDays, nightLabel, dayInitial,
} from './sleep';

const manual: ManualNight = { date: '2026-11-12', bedtime: '23:00', wake_time: '06:45', duration_hours: 7.75, quality: 4, awakenings: 1 };
const health: HealthNight = {
  date: '2026-11-12', sleep_hours: 6.5, sleep_bedtime: '23:30:00', sleep_wake_time: '06:00:00',
  sleep_deep_min: 80, sleep_light_min: 200, sleep_rem_min: 90, sleep_awake_min: 20,
};
const noStages = { sleep_deep_min: null, sleep_light_min: null, sleep_rem_min: null, sleep_awake_min: null };

describe('duree et validation (SL-6, D-02, D-15)', () => {
  it('franchit minuit : 23:00 -> 06:45 = 7 h 45', () => {
    expect(nightDurationMin('23:00', '06:45')).toBe(465);
    expect(formatDurationMin(465)).toBe('7 h 45');
  });
  it('19:00 -> 12:30 = 17 h 30 : refuse avec le message exact du contrat', () => {
    const v = validateNight('19:00', '12:30', 4);
    expect(v.durationMin).toBe(17 * 60 + 30);
    expect(v.ok).toBe(false);
    expect(v.error).toBe('Cette nuit dure 17 h 30. Vérifie le coucher et le lever (maximum 16 h).');
  });
  it('exactement 16 h est accepte, 16 h 15 refuse', () => {
    expect(validateNight('20:00', '12:00', 3).ok).toBe(true);
    expect(validateNight('20:00', '12:15', 3).ok).toBe(false);
  });
  it('qualite obligatoire : sans qualite, pas valide mais aucun message', () => {
    const v = validateNight('23:00', '07:00', null);
    expect(v.ok).toBe(false);
    expect(v.error).toBeNull();
  });
  it('steppers de 15 min, modulo 24 h', () => {
    expect(stepTime('23:50', 15)).toBe('00:05');
    expect(stepTime('00:05', -15)).toBe('23:50');
  });
  it('formats : 8 h, 7 h 05', () => {
    expect(formatDurationH(8)).toBe('8 h');
    expect(formatDurationMin(425)).toBe('7 h 05');
  });
});

describe('resolveNight : source connectee prime (SL-3, SL-4)', () => {
  it('rien -> null (etat vide, SL-1)', () => {
    expect(resolveNight(null, null, null)).toBeNull();
    expect(homeSleepLabel(null)).toEqual({ primary: 'Aucune nuit enregistrée', secondary: null });
  });
  it('saisie seule : pas de phases, qualite presente', () => {
    const r = resolveNight(manual, null, null)!;
    expect(r.source).toBe('manual');
    expect(r.stages).toBeNull();
    expect(r.quality).toBe(4);
    expect(homeSleepLabel(r)).toEqual({ primary: '7 h 45', secondary: 'qualité 4 / 5' });
  });
  it('source + saisie : la source gagne, duree de la source, saisie conservee mais masquee', () => {
    const r = resolveNight(manual, health, null)!;
    expect(r.source).toBe('health');
    expect(r.durationH).toBe(6.5);
    expect(r.stages).toEqual({ deepMin: 80, lightMin: 200, remMin: 90, awakeMin: 20 });
    expect(r.hiddenManualDurationH).toBe(7.75);
  });
  it('reglage manual force la saisie meme avec une source', () => {
    const r = resolveNight(manual, health, 'manual')!;
    expect(r.source).toBe('manual');
    expect(r.durationH).toBe(7.75);
  });
  it('source sans phases : pas de liste de phases', () => {
    const r = resolveNight(null, { ...health, ...noStages }, null)!;
    expect(r.source).toBe('health');
    expect(r.stages).toBeNull();
    expect(healthStages({ ...health, ...noStages })).toBeNull();
  });
  it('ligne source sans duree : ignoree, repli sur la saisie', () => {
    expect(resolveNight(manual, { ...health, sleep_hours: null }, null)!.source).toBe('manual');
    expect(resolveNight(null, { ...health, sleep_hours: null }, null)).toBeNull();
  });
});

describe('graphe 7 nuits (D-05)', () => {
  const days = ['06', '07', '08', '09', '10', '11', '12'].map((d) => `2026-11-${d}`);
  it('jour sans nuit = barre absente (null), jamais 0', () => {
    const bars = buildWeekBars(days, { '2026-11-12': 7.75, '2026-11-10': 6.5, '2026-11-09': 0 });
    expect(bars.map((b) => b.hours)).toEqual([null, null, null, null, 6.5, null, 7.75]);
  });
  it('moyenne sur les seules nuits presentes', () => {
    const bars = buildWeekBars(days, { '2026-11-12': 8, '2026-11-11': 7 });
    expect(weekAverageH(bars)).toBe(7.5);
    expect(weekAverageH(buildWeekBars(days, {}))).toBeNull();
  });
  it('accessibilityLabel recapitulatif', () => {
    expect(weekAccessibilityLabel(7.333, 8)).toBe('Moyenne 7 h 20, cible 8 h');
    expect(weekAccessibilityLabel(7.5, null)).toBe('Moyenne 7 h 30');
    expect(weekAccessibilityLabel(null, 8)).toBe('Aucune nuit sur les 7 derniers jours');
  });
});

describe('reglages (SL-5, D-09)', () => {
  it('compte neuf : aucune cible inventee', () => {
    expect(parseSettings(undefined)).toEqual(EMPTY_SETTINGS);
    expect(parseSettings({}).goalHours).toBeNull();
  });
  it('aller-retour persiste exactement', () => {
    const s = { goalHours: 7.5, reminderEnabled: true, reminderTime: '22:15', smartWake: true, source: 'health' as const, routine: ['screens', 'reading'] };
    expect(parseSettings(settingsToJson(s))).toEqual(s);
  });
  it('anciennes donnees : sleep_goal_hours seul est repris', () => {
    expect(parseSettings({ sleep_goal_hours: 8 }).goalHours).toBe(8);
  });
  it('valeurs hors bornes ignorees', () => {
    expect(parseSettings({ sleep_goal_hours: 40, source: 'x', bedtime_reminder: { enabled: true, time: '99:99' } })).toMatchObject({
      goalHours: null, source: null, reminderTime: '22:30', reminderEnabled: true,
    });
  });
  it('stepper de cible : premier appui = 8 h, pas de 30 min, bornes 4..12', () => {
    expect(stepGoal(null, 1)).toBe(8);
    expect(stepGoal(8, 1)).toBe(8.5);
    expect(stepGoal(4, -1)).toBe(4);
    expect(stepGoal(12, 1)).toBe(12);
  });
});

describe('dates locales', () => {
  it('shift / 7 jours / libelle de nuit', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(lastNDays('2026-11-12')).toHaveLength(7);
    expect(lastNDays('2026-11-12')[0]).toBe('2026-11-06');
    expect(nightLabel('2026-11-12')).toBe('Du 11 au 12 nov.');
    expect(nightLabel('2026-12-01')).toBe('Du 30 nov. au 1 déc.');
    expect(dayInitial('2026-11-12')).toBe('J');
    expect(localDateKey(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12');
  });
});

describe('mapping stades Health Connect (D-12)', () => {
  const t = (m: number) => new Date(Date.UTC(2026, 10, 12, 0, m)).toISOString();
  it('somme les minutes par stade', () => {
    const r = mapHealthConnectStages([
      { stage: 5, startTime: t(0), endTime: t(60) },
      { stage: 4, startTime: t(60), endTime: t(180) },
      { stage: 6, startTime: t(180), endTime: t(240) },
      { stage: 1, startTime: t(240), endTime: t(250) },
      { stage: 5, startTime: t(250), endTime: t(280) },
    ]);
    expect(r).toEqual({ deepMin: 90, lightMin: 120, remMin: 60, awakeMin: 10 });
  });
  it('sans stades -> null (pas de phases fabriquees)', () => {
    expect(mapHealthConnectStages([])).toBeNull();
    expect(mapHealthConnectStages(undefined)).toBeNull();
    expect(mapHealthConnectStages([{ stage: 0, startTime: t(0), endTime: t(10) }])).toBeNull();
  });
});
