import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_SETTINGS, normalizeSettings, computeReminderTimes, formatHM, reminderSummary,
  coffeeCountedMl, effectiveGoalMl, validateGoalMl, validateAmountMl, remindersRowValue,
  glassRowValue, coffeeRowValue, bonusRowValue, localDayBoundsIso, localDateKey,
  rowToSettings, settingsToRow, fetchSettings, saveSettings, hasWorkoutOnDay,
  DEFAULT_GOAL_ML, baseGoalFromProfileSettings, fetchEffectiveGoalMl,
} from './settings';

describe('rappels', () => {
  it('08:00-21:00 / 90 min = 9 rappels, premier 08:00, dernier 20:00 (HY-5)', () => {
    const t = computeReminderTimes({ reminderIntervalMin: 90, reminderStartMin: 480, reminderEndMin: 1260 });
    expect(t).toHaveLength(9);
    expect(formatHM(t[0])).toBe('08:00');
    expect(formatHM(t[8])).toBe('20:00');
  });
  it('plage inversee ou intervalle nul = 0 rappel', () => {
    expect(computeReminderTimes({ reminderIntervalMin: 90, reminderStartMin: 600, reminderEndMin: 480 })).toEqual([]);
    expect(computeReminderTimes({ reminderIntervalMin: 0, reminderStartMin: 480, reminderEndMin: 1260 })).toEqual([]);
  });
  it('debut = fin = 1 rappel ; le dernier ne depasse jamais la fin', () => {
    expect(computeReminderTimes({ reminderIntervalMin: 60, reminderStartMin: 480, reminderEndMin: 480 })).toEqual([480]);
    const t = computeReminderTimes({ reminderIntervalMin: 120, reminderStartMin: 480, reminderEndMin: 1260 });
    expect(t[t.length - 1]).toBeLessThanOrEqual(1260);
  });
  it('resume calcule', () => {
    expect(reminderSummary({ ...DEFAULT_SETTINGS, remindersEnabled: true })).toContain('9 rappels par jour : 08:00, 09:30, 11:00 ... 20:00');
  });
});

describe('cafe / the (HY-7)', () => {
  it('250 ml a 50 % = 125 ml', () => expect(coffeeCountedMl(250, { countCoffeeTea: true, coffeeTeaPct: 50 })).toBe(125));
  it('interrupteur eteint = 0', () => expect(coffeeCountedMl(250, { countCoffeeTea: false, coffeeTeaPct: 50 })).toBe(0));
  it('quantite invalide = 0', () => expect(coffeeCountedMl(0, { countCoffeeTea: true, coffeeTeaPct: 100 })).toBe(0));
});

describe('bonus seance (HY-8)', () => {
  it('base + bonus le jour de seance, base sinon', () => {
    expect(effectiveGoalMl(2000, true, { workoutBonusMl: 500 })).toBe(2500);
    expect(effectiveGoalMl(2000, false, { workoutBonusMl: 500 })).toBe(2000);
    expect(effectiveGoalMl(2000, true, { workoutBonusMl: 700 })).toBe(2700);
  });
  it('bornes locales du jour : 24 h hors changement d\'heure', () => {
    const { startIso, endIso } = localDayBoundsIso(new Date(2026, 5, 10, 15, 30));
    expect(new Date(startIso).getHours()).toBe(0);
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(86_400_000);
  });
  it('localDateKey = date locale, pas UTC', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('validation objectif / quantite', () => {
  it('bornes 1500-4000', () => {
    expect(validateGoalMl('2500').ok).toBe(true);
    expect(validateGoalMl('1499').ok).toBe(false);
    expect(validateGoalMl('4001').error).toBe('Choisis une valeur entre 1500 et 4000 ml.');
    expect(validateGoalMl('').ok).toBe(false);
  });
  it('quantite 1-5000', () => {
    expect(validateAmountMl('350')).toBe(350);
    expect(validateAmountMl('0')).toBeNull();
    expect(validateAmountMl('5001')).toBeNull();
  });
});

describe('normalisation et libelles (HY-10)', () => {
  it('valeurs hors liste retombent sur le defaut, bonus arrondi et borne', () => {
    const s = normalizeSettings({ reminderIntervalMin: 77, glassMl: 999, coffeeTeaPct: 10, workoutBonusMl: 9999 });
    expect(s.reminderIntervalMin).toBe(90);
    expect(s.glassMl).toBe(250);
    expect(s.coffeeTeaPct).toBe(50);
    expect(s.workoutBonusMl).toBe(1500);
    expect(normalizeSettings({ workoutBonusMl: 740 }).workoutBonusMl).toBe(700);
  });
  it('fin jamais avant le debut', () => {
    const s = normalizeSettings({ reminderStartMin: 600, reminderEndMin: 480 });
    expect(s.reminderEndMin).toBeGreaterThanOrEqual(s.reminderStartMin);
  });
  it('libelles derives des reglages', () => {
    const s = normalizeSettings({ remindersEnabled: true, reminderIntervalMin: 120, glassMl: 300, coffeeTeaPct: 75, workoutBonusMl: 700 });
    expect(remindersRowValue(s)).toBe('Toutes les 120 min, 08:00-21:00');
    expect(glassRowValue(s)).toBe('300 ml');
    expect(coffeeRowValue(s)).toBe('Oui (à 75%)');
    expect(bonusRowValue(s)).toBe('+700 ml');
    expect(coffeeRowValue({ ...s, countCoffeeTea: false })).toBe('Non');
    expect(remindersRowValue({ ...s, remindersEnabled: false })).toBe('Désactivés');
  });
});

describe('persistance (client simule)', () => {
  it('aller-retour ligne <-> reglages', () => {
    const s = normalizeSettings({ remindersEnabled: true, glassMl: 330, workoutBonusMl: 300 });
    const row = settingsToRow('u1', s);
    expect(row.user_id).toBe('u1');
    expect(rowToSettings(row)).toEqual(s);
    expect(rowToSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
  it('fetchSettings lit la ligne de l\'utilisateur', async () => {
    const eq = vi.fn().mockReturnValue({ maybeSingle: () => Promise.resolve({ data: { glass_ml: 500 }, error: null }) });
    const client = { from: vi.fn().mockReturnValue({ select: () => ({ eq }) }) };
    const s = await fetchSettings(client, 'u1');
    expect(client.from).toHaveBeenCalledWith('ziko_hydration_settings');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(s.glassMl).toBe(500);
  });
  it('saveSettings upsert sur user_id et rejette sur erreur', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) };
    await saveSettings(client, 'u1', DEFAULT_SETTINGS);
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
    const bad = { from: () => ({ upsert: () => Promise.resolve({ error: { message: 'boom' } }) }) };
    await expect(saveSettings(bad, 'u1', DEFAULT_SETTINGS)).rejects.toThrow('boom');
  });
  it('hasWorkoutOnDay : vrai si une seance, faux sinon', async () => {
    const mk = (rows: unknown[]) => ({
      from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lt: () => ({ limit: () => Promise.resolve({ data: rows, error: null }) }) }) }) }) }),
    });
    expect(await hasWorkoutOnDay(mk([{ id: 'x' }]), 'u1')).toBe(true);
    expect(await hasWorkoutOnDay(mk([]), 'u1')).toBe(false);
  });
});

describe('objectif unique accueil/plugin (UAT run1 #4)', () => {
  // Client simule route par table : profil, reglages, seances.
  const mk = (profileSettings: any, hydrationRow: any, sessions: any[]) => ({
    from: (table: string) => {
      if (table === 'ziko_user_profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { settings: profileSettings }, error: null }) }) }) };
      }
      if (table === 'ziko_hydration_settings') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: hydrationRow, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ gte: () => ({ lt: () => ({ limit: () => Promise.resolve({ data: sessions, error: null }) }) }) }) }) };
    },
  });

  it('sans reglage profil : 2.0 L (pas 2.5 L) pour tout le monde', async () => {
    expect(DEFAULT_GOAL_ML).toBe(2000);
    expect(await fetchEffectiveGoalMl(mk({}, null, []), 'u1')).toBe(2000);
  });
  it('objectif profil + bonus du jour de seance', async () => {
    const c = mk({ hydration_goal_ml: 3000 }, { workout_bonus_ml: 500 }, [{ id: 's' }]);
    expect(await fetchEffectiveGoalMl(c, 'u1')).toBe(3500);
  });
  it('valeur profil hors bornes -> defaut', () => {
    expect(baseGoalFromProfileSettings({ hydration_goal_ml: 99999 })).toBe(2000);
    expect(baseGoalFromProfileSettings(null)).toBe(2000);
  });
});
