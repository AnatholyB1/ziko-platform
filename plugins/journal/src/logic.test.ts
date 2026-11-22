import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTEXTS,
  CONTEXT_VALUES,
  MOODS,
  normalizeContext,
  buildTrend,
  weekStats,
  classifySaveError,
  saveJournalEntry,
  getTodayGeneral,
  localDateKey,
  setDraft,
  getDraft,
  clearDraft,
  trendDescription,
} from './logic';

const CHECK = ['pre_workout', 'post_workout', 'morning', 'evening', 'general'];
const U = 'u1';
const D = '2026-11-12';

/** Faux client Supabase en memoire : select/eq/order/limit/insert/update. */
function fakeDb(rows: any[] = [], failWith?: { message: string; code?: string }) {
  const table = { rows: [...rows] };
  const client = {
    table,
    from: (_t: string) => {
      let filters: [string, any][] = [];
      let op: 'select' | 'update' | 'insert' = 'select';
      let patch: any = null;
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: any) => {
          filters.push([c, v]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        insert: (r: any) => {
          op = 'insert';
          patch = r;
          return chain;
        },
        update: (p: any) => {
          op = 'update';
          patch = p;
          return chain;
        },
        then: (res: any) => {
          if (failWith) return res({ data: null, error: failWith });
          const match = table.rows.filter((r) => filters.every(([c, v]) => r[c] === v));
          if (op === 'insert') {
            if (!CHECK.includes(patch.context)) return res({ data: null, error: { message: 'violates check constraint' } });
            table.rows.push({ id: `r${table.rows.length + 1}`, ...patch });
            return res({ data: null, error: null });
          }
          if (op === 'update') {
            match.forEach((r) => Object.assign(r, patch));
            return res({ data: null, error: null });
          }
          return res({ data: match, error: null });
        },
      };
      return chain;
    },
  };
  return client;
}

const base = { mood: 4, energy: 3, stress: 2, notes: ' ok ' };

describe('contextes (JR-3)', () => {
  it('les 5 moments valent exactement les valeurs du CHECK', () => {
    expect([...CONTEXT_VALUES].sort()).toEqual([...CHECK].sort());
    expect(CONTEXTS).toHaveLength(5);
  });
  it('normalizeContext ne laisse passer que des valeurs du CHECK (afternoon, ancien libelle...)', () => {
    for (const bad of ['afternoon', 'Post-séance', 'post_séance', '', null, undefined, 42]) {
      expect(CHECK).toContain(normalizeContext(bad));
    }
    expect(normalizeContext('afternoon')).toBe('general');
    for (const v of CHECK) expect(normalizeContext(v)).toBe(v);
  });
  it('un moment de chaque type s ecrit tel quel en base, jamais autre chose', async () => {
    for (const c of CONTEXTS) {
      const db = fakeDb();
      await saveJournalEntry(db, U, { ...base, context: c.value }, D);
      expect(db.table.rows[0].context).toBe(c.value);
    }
  });
});

describe('icones d humeur (JR-1)', () => {
  it('les 5 noms Ionicons du contrat', () => {
    expect(MOODS.map((m) => m.icon)).toEqual(['sad-outline', 'sad', 'remove-circle', 'happy', 'happy-outline']);
    expect(MOODS.map((m) => m.label)).toEqual(['Mauvais', 'Bof', 'Moyen', 'Bien', 'Super']);
  });
  it('0 emoji et 0 violet dans les sources du plugin (JR-1, JR-5)', () => {
    const dir = __dirname;
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts')) files.push(p);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src.match(/\p{Extended_Pictographic}/gu), `emoji dans ${f}`).toBeNull();
      expect(src.toLowerCase().includes('#7b5bd0'), `violet dans ${f}`).toBe(false);
      expect(src.includes('123,91,208'), `violet rgba dans ${f}`).toBe(false);
    }
  });
});

describe('enregistrement : 1 entree general / jour (JR-4)', () => {
  it('insere puis met a jour la meme ligne general du jour', async () => {
    const db = fakeDb();
    expect(await saveJournalEntry(db, U, { ...base, context: 'general' }, D)).toBe('inserted');
    expect(await saveJournalEntry(db, U, { ...base, mood: 2, context: 'general' }, D)).toBe('updated');
    expect(db.table.rows).toHaveLength(1);
    expect(db.table.rows[0]).toMatchObject({ mood: 2, context: 'general', date: D, notes: 'ok' });
  });
  it('met a jour l humeur posee depuis l accueil (ligne Quick Log sans energie)', async () => {
    const db = fakeDb([{ id: 'q1', user_id: U, mood: 3, energy: null, stress: null, context: 'general', date: D, notes: null }]);
    expect((await getTodayGeneral(db, U, D))?.id).toBe('q1');
    await saveJournalEntry(db, U, { ...base, mood: 5, context: 'general' }, D);
    expect(db.table.rows).toHaveLength(1);
    expect(db.table.rows[0]).toMatchObject({ mood: 5, energy: 3 });
  });
  it('un autre moment cree une entree distincte et ne touche pas general', async () => {
    const db = fakeDb([{ id: 'q1', user_id: U, mood: 3, context: 'general', date: D }]);
    expect(await saveJournalEntry(db, U, { ...base, context: 'evening' }, D)).toBe('inserted');
    expect(db.table.rows).toHaveLength(2);
    expect(db.table.rows[0].mood).toBe(3);
  });
  it('ne confond ni les jours ni les utilisateurs', async () => {
    const db = fakeDb([
      { id: 'a', user_id: U, mood: 3, context: 'general', date: '2026-11-11' },
      { id: 'b', user_id: 'other', mood: 3, context: 'general', date: D },
    ]);
    expect(await getTodayGeneral(db, U, D)).toBeNull();
    await saveJournalEntry(db, U, { ...base, context: 'general' }, D);
    expect(db.table.rows).toHaveLength(3);
  });
  it('refuse une valeur hors 1-5 et propage les erreurs de base', async () => {
    await expect(saveJournalEntry(fakeDb(), U, { ...base, mood: 6, context: 'general' }, D)).rejects.toThrow();
    await expect(saveJournalEntry(fakeDb([], { message: 'boom' }), U, { ...base, context: 'morning' }, D)).rejects.toMatchObject({ message: 'boom' });
  });
});

describe('classification des erreurs d enregistrement (JR-2, JR-6)', () => {
  it('session expiree', () => {
    const e = new Error('Session expirée');
    e.name = 'SessionExpiredError';
    expect(classifySaveError(e)).toBe('expired');
    expect(classifySaveError({ code: 'PGRST301', message: 'x' })).toBe('expired');
    expect(classifySaveError({ message: 'JWT expired' })).toBe('expired');
    expect(classifySaveError({ status: 401, message: 'x' })).toBe('expired');
  });
  it('hors ligne', () => {
    expect(classifySaveError(new TypeError('Network request failed'))).toBe('offline');
    expect(classifySaveError({ message: 'Failed to fetch' })).toBe('offline');
  });
  it('erreur serveur / RLS / CHECK', () => {
    expect(classifySaveError({ message: 'new row violates row-level security policy', code: '42501' })).toBe('server');
    expect(classifySaveError({ message: 'violates check constraint' })).toBe('server');
  });
});

describe('tendance 7 jours (JR-7)', () => {
  const today = new Date(2026, 10, 12, 10, 0, 0); // 12 nov 2026 local
  it('jour sans entree = avg null (barre absente), moyenne du jour sinon', () => {
    const t = buildTrend(
      [
        { mood: 2, date: '2026-11-12' },
        { mood: 4, date: '2026-11-12' },
        { mood: 5, date: '2026-11-10' },
        { mood: 1, date: '2026-11-01' }, // hors fenetre
      ],
      today,
    );
    expect(t).toHaveLength(7);
    expect(t[6]).toMatchObject({ key: '2026-11-12', avg: 3, today: true });
    expect(t.find((d) => d.key === '2026-11-10')?.avg).toBe(5);
    expect(t.filter((d) => d.avg === null)).toHaveLength(5);
    expect(t[0].key).toBe('2026-11-06');
  });
  it('description textuelle pour l accessibilite', () => {
    const d = trendDescription(buildTrend([{ mood: 4, date: '2026-11-12' }], today));
    expect(d).toContain('Humeur des 7 derniers jours');
    expect(d).toContain('jeudi 4,0');
    expect(d).toContain('aucune entrée');
  });
  it('moyenne de la semaine et ecart a la semaine passee', () => {
    const s = weekStats(
      [
        { mood: 4, date: '2026-11-12' },
        { mood: 4, date: '2026-11-11' },
        { mood: 2, date: '2026-11-04' },
      ],
      today,
    );
    expect(s.current).toBe(4);
    expect(s.previous).toBe(2);
    expect(s.delta).toBe(2);
    expect(weekStats([], today).current).toBeNull();
  });
  it('utilise la date locale quand seule created_at existe', () => {
    const t = buildTrend([{ mood: 3, created_at: new Date(2026, 10, 12, 23, 30).toISOString() }], today);
    expect(t[6].avg).toBe(3);
  });
  it('localDateKey est locale, pas UTC', () => {
    expect(localDateKey(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12');
    expect(localDateKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('brouillon conserve (JR-6)', () => {
  it('survit entre deux montages jusqu a clearDraft', () => {
    clearDraft();
    expect(getDraft()).toBeNull();
    setDraft({ mood: 2, energy: 1, stress: 5, context: 'evening', notes: 'dur' });
    expect(getDraft()).toMatchObject({ mood: 2, notes: 'dur' });
    clearDraft();
    expect(getDraft()).toBeNull();
  });
});
