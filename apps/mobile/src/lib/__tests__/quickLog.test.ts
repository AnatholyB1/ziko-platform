import { describe, it, expect } from 'vitest';
import {
  sumWaterMl, formatLitres, logWater, parseWeightInput, getTodayWeight, saveTodayWeight,
  moodContext, getTodayMood, saveTodayMood, computeFormScore,
} from '../quickLog';

type Row = Record<string, any>;

/** In-memory fake of the supabase query builder (select/eq/order/limit/insert/update). */
function fakeDb(seed: Record<string, Row[]> = {}, failOn?: string) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  let n = 0;
  const client = {
    tables,
    from(table: string) {
      tables[table] ??= [];
      const filters: [string, unknown][] = [];
      let orderKey: string | null = null;
      let asc = true;
      let lim: number | null = null;
      let mode: 'select' | 'update' = 'select';
      let patch: Row = {};
      const run = () => {
        if (failOn === table) return { data: null, error: { message: 'boom' } };
        let rows = tables[table].filter((r) => filters.every(([k, v]) => r[k] === v));
        if (mode === 'update') { rows.forEach((r) => Object.assign(r, patch)); return { data: null, error: null }; }
        if (orderKey) rows = [...rows].sort((a, b) => (a[orderKey!] < b[orderKey!] ? -1 : 1) * (asc ? 1 : -1));
        if (lim != null) rows = rows.slice(0, lim);
        return { data: rows, error: null };
      };
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
        order: (k: string, o: { ascending: boolean }) => { orderKey = k; asc = o.ascending; return q; },
        limit: (l: number) => { lim = l; return q; },
        insert: (row: Row) => {
          if (failOn === table) return Promise.resolve({ data: null, error: { message: 'boom' } });
          n += 1;
          tables[table].push({ id: `id${n}`, created_at: `2026-11-12T10:00:${String(n).padStart(2, '0')}Z`, ...row });
          return Promise.resolve({ data: null, error: null });
        },
        update: (p: Row) => { mode = 'update'; patch = p; return q; },
        then: (res: any) => res(run()),
      };
      return q;
    },
  };
  return client;
}

const U = 'user-1';
const D = '2026-11-12';

describe('eau (QLOG-01)', () => {
  it('somme les logs du jour, sans limite', () => {
    expect(sumWaterMl([{ amount_ml: 250 }, { amount_ml: 250 }, { amount_ml: null }, { amount_ml: 500 }])).toBe(1000);
    expect(sumWaterMl(null)).toBe(0);
    expect(sumWaterMl(Array.from({ length: 50 }, () => ({ amount_ml: 250 })))).toBe(12500);
  });
  it('formate en litres sur 2 decimales', () => {
    expect(formatLitres(0)).toBe('0,00 L');
    expect(formatLitres(250)).toBe('0,25 L');
    expect(formatLitres(1750)).toBe('1,75 L');
  });
  it('logWater insere avec la date locale fournie (pas UTC)', async () => {
    const db = fakeDb();
    await logWater(db, U, 250, D);
    await logWater(db, U, 250, D);
    expect(db.tables.ziko_hydration_logs).toHaveLength(2);
    expect(db.tables.ziko_hydration_logs[0]).toMatchObject({ user_id: U, amount_ml: 250, date: D });
  });
  it('logWater propage une erreur de base (pas de succes silencieux)', async () => {
    await expect(logWater(fakeDb({}, 'ziko_hydration_logs'), U, 250, D)).rejects.toThrow(/hydration insert/);
    await expect(logWater(fakeDb(), U, 0, D)).rejects.toThrow();
  });
});

describe('poids 1/jour (QLOG-02)', () => {
  it('parse virgule/point et refuse hors bornes', () => {
    expect(parseWeightInput('72,46')).toBe(72.5);
    expect(parseWeightInput('72.4')).toBe(72.4);
    expect(parseWeightInput('abc')).toBeNull();
    expect(parseWeightInput('5')).toBeNull();
    expect(parseWeightInput('999')).toBeNull();
  });
  it('1er log insere, 2e log du meme jour met a jour (pas de doublon)', async () => {
    const db = fakeDb();
    expect(await getTodayWeight(db, U, D)).toBeNull();
    expect(await saveTodayWeight(db, U, 72.4, D)).toBe('inserted');
    expect(await saveTodayWeight(db, U, 71.9, D)).toBe('updated');
    expect(db.tables.ziko_body_measurements).toHaveLength(1);
    expect((await getTodayWeight(db, U, D))?.weight_kg).toBe(71.9);
  });
  it('le statut persiste (relecture base) et saute au lendemain', async () => {
    const db = fakeDb();
    await saveTodayWeight(db, U, 72, D);
    expect(await getTodayWeight(db, U, D)).not.toBeNull(); // "relance de l'app" = nouvelle lecture
    expect(await getTodayWeight(db, U, '2026-11-13')).toBeNull();
  });
  it('ignore une ligne du jour sans poids (autre mesure) et ne touche pas les autres users', async () => {
    const db = fakeDb({
      ziko_body_measurements: [
        { id: 'a', user_id: U, date: D, weight_kg: null, waist_cm: 80, created_at: '2026-11-12T08:00:00Z' },
        { id: 'b', user_id: 'other', date: D, weight_kg: 90, created_at: '2026-11-12T08:00:00Z' },
      ],
    });
    expect(await getTodayWeight(db, U, D)).toBeNull();
    await saveTodayWeight(db, U, 70, D);
    expect(db.tables.ziko_body_measurements).toHaveLength(3);
    expect(db.tables.ziko_body_measurements.find((r) => r.id === 'a')?.weight_kg).toBeNull();
  });
  it('refuse un poids invalide', async () => {
    await expect(saveTodayWeight(fakeDb(), U, 5, D)).rejects.toThrow();
  });
});

describe('humeur 1/jour (QLOG-03)', () => {
  it('context respecte le CHECK de la base (jamais "afternoon")', () => {
    const allowed = ['pre_workout', 'post_workout', 'morning', 'evening', 'general'];
    for (let h = 0; h < 24; h++) expect(allowed).toContain(moodContext(h));
    expect(moodContext(9)).toBe('morning');
    expect(moodContext(14)).toBe('general');
    expect(moodContext(21)).toBe('evening');
  });
  it('insere puis met a jour la meme ligne du jour', async () => {
    const db = fakeDb();
    expect(await getTodayMood(db, U, D)).toBeNull();
    expect(await saveTodayMood(db, U, 4, 14, D)).toBe('inserted');
    expect(await saveTodayMood(db, U, 2, 15, D)).toBe('updated');
    expect(db.tables.ziko_journal_entries).toHaveLength(1);
    expect(db.tables.ziko_journal_entries[0]).toMatchObject({ mood: 2, context: 'general', date: D });
    expect(await getTodayMood(db, U, '2026-11-13')).toBeNull();
  });
  it('P22 : l humeur de l accueil est TOUJOURS l entree general du jour (matin comme soir)', async () => {
    for (const h of [8, 14, 21]) {
      const db = fakeDb();
      await saveTodayMood(db, U, 4, h, D);
      expect(db.tables.ziko_journal_entries[0].context).toBe('general');
    }
  });
  it('refuse une humeur hors 1-5', async () => {
    await expect(saveTodayMood(fakeDb(), U, 6, 10, D)).rejects.toThrow();
    await expect(saveTodayMood(fakeDb(), U, 0, 10, D)).rejects.toThrow();
  });
  it('propage une erreur de base', async () => {
    await expect(saveTodayMood(fakeDb({}, 'ziko_journal_entries'), U, 3, 10, D)).rejects.toThrow(/mood/);
  });
});

describe('score Forme du jour (QLOG-05)', () => {
  const base = { sleepH: 0, sleepTargetH: 8, waterMl: 0, waterGoalMl: 2500, kcal: 0, todayDone: false, weeklyCount: 0, weeklyGoal: 4 };
  it('aucune donnee => etat vide (score null, pas 0)', () => {
    const r = computeFormScore(base);
    expect(r.isEmpty).toBe(true);
    expect(r.score).toBeNull();
  });
  it('moyenne des seules composantes avec donnees', () => {
    const r = computeFormScore({ ...base, sleepH: 8, waterMl: 1250 }); // 100 et 50
    expect(r.isEmpty).toBe(false);
    expect(r.score).toBe(75);
  });
  it('seance faite = charge 100 ; objectif hebdo atteint = jour de repos valide', () => {
    expect(computeFormScore({ ...base, todayDone: true }).score).toBe(100);
    expect(computeFormScore({ ...base, weeklyCount: 4 }).score).toBe(100);
    expect(computeFormScore({ ...base, weeklyCount: 3 }).isEmpty).toBe(true);
  });
  it('plafonne a 100 et arrondit', () => {
    const r = computeFormScore({ ...base, sleepH: 12, waterMl: 9999, kcal: 5000 });
    expect(r.parts.every((p) => p.pct <= 100)).toBe(true);
    expect(r.score).toBe(100);
    expect(computeFormScore({ ...base, kcal: 1000 }).score).toBe(50);
    // objectif reel des reglages nutrition (review A #13) : 1300 / 2600 = 50
    expect(computeFormScore({ ...base, kcal: 1300, kcalGoal: 2600 }).score).toBe(50);
  });
});
