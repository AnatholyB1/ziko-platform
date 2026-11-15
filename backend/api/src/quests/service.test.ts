/**
 * Phase 14 (v1.20) - QUEST-03/04/05/06/08 : orchestration des quetes IA (mocks, aucun appel reseau).
 * Prouve : declenchement decide par la reservation SQL (niveau / plus de quete / plafond / quota quotidien),
 * nombre cree = places libres, identite envoyee au modele (QUEST-08), cout journalise (ziko_ai_cost_log,
 * source quest_generation) y compris en echec, aucun appel IA quand `proceed` est faux, outil du chat
 * (plafond, metrique indisponible, quete invalide).
 * Ne prouve PAS : la reservation et le plafond SQL eux-memes (scripts/uat/p14-quests-sql), ni le vrai modele.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/models.js', () => ({ AGENT_MODEL: { modelId: 'test-model' } }));
vi.mock('ai', () => ({ generateObject: vi.fn() }));
vi.mock('../tools/db.js', () => ({ clientForUser: vi.fn() }));

import { allowedMetrics, buildGenerationPrompt, createQuestFromChat, listQuestsForChat, loadIdentity, refreshQuestsAuto } from './service.js';

interface Seed {
  claim?: unknown;
  claimError?: string;
  create?: unknown;
  createError?: string;
  plugins?: string[];
  quests?: any[];
  level?: number;
}

function makeDb(seed: Seed = {}) {
  const calls: Array<{ rpc: string; args: any }> = [];
  const costRows: any[] = [];
  const tableData: Record<string, unknown> = {
    ziko_user_profiles: { name: 'Léa', goal: 'perte de poids', age: 31, weight_kg: 68, height_cm: 168 },
    ziko_athlete_state: { readiness: 'building', current_focus_summary: 'régularité', onboarding_profile: { experience: 'beginner' } },
    ziko_user_gamification: { level: seed.level ?? 4 },
    ziko_user_plugins: (seed.plugins ?? ['hydration', 'nutrition', 'habits']).map((p) => ({ plugin_id: p })),
    ziko_user_quests: seed.quests ?? [{ title: 'Terminer une séance', status: 'completed', scope: 'daily' }],
  };
  const db: any = {
    rpc: vi.fn(async (name: string, args: any) => {
      calls.push({ rpc: name, args });
      if (name === 'ziko_quest_ai_claim') {
        return seed.claimError ? { data: null, error: { message: seed.claimError } } : { data: seed.claim, error: null };
      }
      if (name === 'ziko_create_ai_quests') {
        return seed.createError
          ? { data: null, error: { message: seed.createError } }
          : { data: seed.create ?? { created: args.p_quests.map((_: unknown, i: number) => `id${i}`), skipped: 0, slots_before: 3 }, error: null };
      }
      throw new Error(`rpc inattendue ${name}`);
    }),
    from: vi.fn((table: string) => {
      if (table === 'ziko_ai_cost_log') return { insert: (row: any) => { costRows.push(row); return Promise.resolve({ error: null }); } };
      const value = { data: tableData[table] ?? null, error: null };
      const c: any = {};
      for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
      c.maybeSingle = () => Promise.resolve(value);
      c.then = (res: any, rej?: any) => Promise.resolve(value).then(res, rej);
      return c;
    }),
  };
  return { db, calls, costRows };
}

const GEN_OK = {
  object: {
    quests: [
      { title: 'Boire 2,5 L', metric: 'hydration_ml', target: 2500, scope: 'daily', duration_hours: 24, reward_coins: 15, icon: 'water' },
      { title: '3 séances', metric: 'workout_sessions', target: 3, scope: 'weekly', duration_hours: 168, reward_coins: 50 },
      { title: '2 repas notés', metric: 'nutrition_logs', target: 2, scope: 'daily', duration_hours: 24, reward_coins: 10 },
    ],
  },
  usage: { inputTokens: 320, outputTokens: 140 },
};

beforeEach(() => vi.clearAllMocks());

describe('refreshQuestsAuto', () => {
  it('niveau gagne avec 2 places libres : cree 2 quetes sur 3 proposees, journalise le cout', async () => {
    const { db, calls, costRows } = makeDb({ claim: { proceed: true, reason: 'level_up', slots: 2, level: 4, active: 1 } });
    const generate = vi.fn(async () => GEN_OK);
    const out = await refreshQuestsAuto('u1', { db, generate });
    expect(out).toMatchObject({ status: 'created', reason: 'level_up', level: 4 });
    const create = calls.find((c) => c.rpc === 'ziko_create_ai_quests')!;
    expect(create.args.p_user_id).toBe('u1');
    expect(create.args.p_quests).toHaveLength(2);
    expect(create.args.p_quests[0].ai_meta).toMatchObject({ trigger: 'level_up', level: 4 });
    expect(costRows).toEqual([{ user_id: 'u1', model: 'test-model', input_tokens: 320, output_tokens: 140, source: 'quest_generation' }]);
    // La reservation est faite en mode automatique (non force) avec le quota quotidien.
    expect(calls[0]).toEqual({ rpc: 'ziko_quest_ai_claim', args: { p_user_id: 'u1', p_daily_cap: 2, p_force: false } });
  });

  it('plus aucune quete : declenche, prompt = identite complete (QUEST-08)', async () => {
    const { db } = makeDb({ claim: { proceed: true, reason: 'no_quest', slots: 3, level: 2, active: 0 } });
    const generate = vi.fn(async () => GEN_OK);
    await refreshQuestsAuto('u1', { db, generate });
    const { prompt, system } = (generate.mock.calls[0] as any)[0];
    expect(prompt).toContain('declencheur: no_quest');
    expect(prompt).toContain('objectif: perte de poids');
    expect(prompt).toContain('age: 31; poids_kg: 68');
    expect(prompt).toContain('focus_coaching: régularité');
    expect(prompt).toContain('beginner');
    expect(prompt).toContain('Terminer une séance [daily, completed]');
    expect(prompt).toContain('nombre_de_quetes_a_creer: 3');
    expect(system).toContain('aucune pénalité');
  });

  for (const reason of ['not_needed', 'full', 'daily_cap', 'not_initialized']) {
    it(`reservation refusee (${reason}) : aucun appel IA, aucun cout, aucune creation`, async () => {
      const { db, calls, costRows } = makeDb({ claim: { proceed: false, reason, slots: 0, level: 3, active: 3 } });
      const generate = vi.fn(async () => GEN_OK);
      const out = await refreshQuestsAuto('u1', { db, generate });
      expect(out).toEqual({ status: 'skipped', reason });
      expect(generate).not.toHaveBeenCalled();
      expect(calls.map((c) => c.rpc)).toEqual(['ziko_quest_ai_claim']);
      expect(costRows).toHaveLength(0);
    });
  }

  it('echec du modele : rien cree, tentative journalisee (cout 0), erreur claire', async () => {
    const { db, calls, costRows } = makeDb({ claim: { proceed: true, reason: 'no_quest', slots: 3, level: 1, active: 0 } });
    const generate = vi.fn(async () => { throw new Error('boom'); });
    const out = await refreshQuestsAuto('u1', { db, generate });
    expect(out).toEqual({ status: 'error', reason: 'generation_failed' });
    expect(calls.find((c) => c.rpc === 'ziko_create_ai_quests')).toBeUndefined();
    expect(costRows).toEqual([{ user_id: 'u1', model: 'test-model', input_tokens: 0, output_tokens: 0, source: 'quest_generation' }]);
  });

  it('sortie du modele inexploitable ou metrique non disponible : rien cree', async () => {
    const { db, calls } = makeDb({ claim: { proceed: true, reason: 'no_quest', slots: 3, level: 1, active: 0 }, plugins: [] });
    const hydrationOnly = { object: { quests: [{ ...GEN_OK.object.quests[0], metric: 'nutrition_logs' }] }, usage: {} };
    const out = await refreshQuestsAuto('u1', { db, generate: async () => hydrationOnly });
    expect(out).toEqual({ status: 'error', reason: 'generation_failed' });
    expect(calls.find((c) => c.rpc === 'ziko_create_ai_quests')).toBeUndefined();
  });

  it('reservation en erreur SQL : erreur, jamais d\'appel IA', async () => {
    const { db } = makeDb({ claimError: 'db down' });
    const generate = vi.fn(async () => GEN_OK);
    expect(await refreshQuestsAuto('u1', { db, generate })).toEqual({ status: 'error', reason: 'claim_failed' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('erreur SQL a la creation : create_failed', async () => {
    const { db } = makeDb({ claim: { proceed: true, reason: 'no_quest', slots: 3, level: 1, active: 0 }, createError: 'invalid_target' });
    expect(await refreshQuestsAuto('u1', { db, generate: async () => GEN_OK })).toEqual({ status: 'error', reason: 'create_failed' });
  });
});

describe('createQuestFromChat (appel declenche par l\'utilisateur)', () => {
  const quest = { title: 'Boire 2 L', metric: 'hydration_ml', target: 2000, scope: 'daily', duration_hours: 24, reward_coins: 15 };

  it('cree une quete : reservation forcee (pas de quota auto), duree et recompense presentes', async () => {
    const { db, calls, costRows } = makeDb({ claim: { proceed: true, reason: 'requested', slots: 2, level: 4, active: 1 } });
    const res: any = await createQuestFromChat('u1', quest, { db });
    expect(res.success).toBe(true);
    expect(res.quest).toMatchObject({ duration_hours: 24, reward_coins: 15 });
    expect(res.free_slots_left).toBe(1);
    expect(calls[0].args.p_force).toBe(true);
    expect(costRows).toHaveLength(0); // le cout du chat passe par creditCheck/creditDeduct, pas par ai_cost_log autonome
  });

  it('3 deja actives : refuse sans creer, message clair', async () => {
    const { db, calls } = makeDb({ claim: { proceed: false, reason: 'full', slots: 0, level: 4, active: 3 } });
    const res: any = await createQuestFromChat('u1', quest, { db });
    expect(res).toMatchObject({ success: false, error: 'max_active_quests', active_count: 3, max_active: 3 });
    expect(calls.find((c) => c.rpc === 'ziko_create_ai_quests')).toBeUndefined();
  });

  it('base : la creation renvoie 0 (course perdue sous verrou) => max_active_quests', async () => {
    const { db } = makeDb({ claim: { proceed: true, reason: 'requested', slots: 1, level: 4, active: 2 }, create: { created: [], skipped: 1, slots_before: 0 } });
    expect(((await createQuestFromChat('u1', quest, { db })) as any).error).toBe('max_active_quests');
  });

  it('quete invalide ou metrique sans plugin : erreur, aucune reservation consommee', async () => {
    const { db, calls } = makeDb({ claim: { proceed: true, reason: 'requested', slots: 3, level: 1, active: 0 }, plugins: ['nutrition'] });
    expect(((await createQuestFromChat('u1', { ...quest, metric: 'steps' }, { db })) as any).error).toBe('invalid_quest');
    expect(((await createQuestFromChat('u1', { ...quest, metric: 'habit_logs' }, { db })) as any).error).toBe('metric_unavailable');
    expect(calls).toHaveLength(0);
  });

  it('hydration_ml reste disponible sans le plugin Hydratation (UAT run2 : plus de metric_unavailable)', async () => {
    const { db } = makeDb({ claim: { proceed: true, reason: 'requested', slots: 3, level: 1, active: 0 }, plugins: ['coach'] });
    const res: any = await createQuestFromChat('u1', quest, { db });
    expect(res.error).not.toBe('metric_unavailable');
  });
});

describe('listQuestsForChat', () => {
  it('compte les places libres, quetes echues en libelle neutre', async () => {
    const future = new Date(Date.now() + 5 * 3600_000).toISOString();
    const past = new Date(Date.now() - 5 * 3600_000).toISOString();
    const base = { scope: 'daily', metric: 'habit_logs', target: 3, progress: 1, unit: 'habitudes', reward_coins: 10 };
    const { db } = makeDb({
      quests: [
        { ...base, title: 'A', status: 'active', expires_at: future },
        { ...base, title: 'B', status: 'expired', expires_at: past },
        { ...base, title: 'C', status: 'active', expires_at: past },
      ],
    });
    const res: any = await listQuestsForChat('u1', { db });
    expect(res.active_count).toBe(1);
    expect(res.free_slots).toBe(2);
    expect(res.quests.filter((q: any) => q.label === 'Non terminée')).toHaveLength(2);
    expect(JSON.stringify(res)).not.toMatch(/échec|echec|perdu/i);
  });
});

describe('helpers', () => {
  it('allowedMetrics suit les plugins actifs, les metriques du socle restent ouvertes', () => {
    // Quick Log accueil = hydratation + mesures sans plugin ; nutrition/habitudes exigent leur plugin.
    expect(allowedMetrics([])).toEqual(['workout_sessions', 'hydration_ml', 'measurement_logs']);
    expect(allowedMetrics(['coach'])).toContain('hydration_ml');
    expect(allowedMetrics(['hydration', 'habits'])).toEqual(['workout_sessions', 'hydration_ml', 'habit_logs', 'measurement_logs']);
    expect(allowedMetrics(['nutrition'])).toContain('nutrition_logs');
    expect(allowedMetrics([])).not.toContain('nutrition_logs');
  });
  it('loadIdentity applique des valeurs par defaut (profil vide)', async () => {
    const { db } = makeDb({ plugins: [], quests: [] });
    db.from = vi.fn(() => {
      const c: any = {};
      for (const m of ['select', 'eq', 'order', 'limit']) c[m] = () => c;
      c.maybeSingle = () => Promise.resolve({ data: null, error: null });
      c.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res);
      return c;
    });
    const id = await loadIdentity(db, 'u1');
    expect(id).toMatchObject({ goal: null, level: 1, plugins: [], history: [] });
    expect(buildGenerationPrompt(id, 3, 'no_quest', ['workout_sessions'])).toContain('objectif: non renseigné');
  });
});
