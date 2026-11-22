/**
 * Phase 23 (v1.20) - ATEL-02/03/04/05 : outils de l'atelier (double de base en memoire, aucun appel IA).
 * Prouve : le brouillon est ecrit/edite par les outils avec revision optimiste (et un retry si l'utilisateur
 * a edite entre-temps), les skills se chargent, la recherche web est plafonnee par message et par jour et
 * journalisee (source workshop_web_search), le contexte athlete est calcule depuis les series reelles.
 * Ne prouve PAS : l'outil natif web_search d'Anthropic (runner injecte), ni le choix d'outil du vrai modele.
 */
import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from './fakeDb.testutil.js';
import { createWorkshopTools, toolLabel } from './tools.js';
import { createDraft, loadDraft, saveDraftProgram, publishDraft, publishedProgramId } from './store.js';
import { fetchWorkshopContext, renderContext, epley, contextCounts } from './context.js';
import { WORKSHOP_WEB_SEARCH_DAILY_CAP } from './limits.js';
import { runWebSearch } from './webSearch.js';
import { normalizeProgram } from './draft.js';
import { TRAINING_SKILLS, getSkill } from './skills.js';

const U = 'user-1';
const opts = { toolCallId: 't1', messages: [] } as any;
const program = {
  name: 'Force 4 semaines',
  goal: 'strength',
  weeks: [
    { sessions: [{ name: 'A', day_of_week: 1, exercises: [{ name: 'Squat', sets: 5, reps: '5', pct_1rm: 80, rpe: 8 }] }] },
    { sessions: [{ name: 'A', day_of_week: 1, exercises: [{ name: 'Squat', sets: 5, reps: '5', pct_1rm: 82.5, rpe: 8 }] }] },
  ],
};

async function setup(seed: Record<string, any[]> = {}) {
  const db: any = createFakeDb(seed);
  const draft = await createDraft(db, U, 'conv-1');
  const emitted: any[] = [];
  const tools = createWorkshopTools({
    db,
    userId: U,
    draftId: draft.id,
    getContext: async () => fetchWorkshopContext(db, U),
    emitDraft: (d) => emitted.push(d),
    searchRunner: async (q) => ({ text: `Resultat pour ${q}`, sources: [{ title: 'IPF', url: 'https://ipf.example/rules' }], usage: { inputTokens: 10, outputTokens: 20 } }),
  });
  return { db, draft, tools, emitted };
}

describe('draft tools', () => {
  it('workshop_set_draft creates revision 1 and emits the program', async () => {
    const { db, draft, tools, emitted } = await setup();
    const res: any = await tools.workshop_set_draft.execute!({ program }, opts);
    expect(res).toMatchObject({ ok: true, revision: 1, weeks: 2 });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].program.weeks[1].sessions[0].exercises[0].pct_1rm).toBe(82.5);
    const stored = await loadDraft(db, U, draft.id);
    expect(stored?.revision).toBe(1);
    expect(stored?.name).toBe('Force 4 semaines');
  });

  it('workshop_edit_draft edits in place and bumps the revision', async () => {
    const { db, draft, tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    const res: any = await tools.workshop_edit_draft.execute!(
      { ops: [{ op: 'update_exercise', week: 2, session: 0, index: 0, patch: { sets: 6 } }] },
      opts,
    );
    expect(res).toMatchObject({ ok: true, revision: 2 });
    const stored = await loadDraft(db, U, draft.id);
    expect(stored?.program?.weeks[1].sessions[0].exercises[0].sets).toBe(6);
    expect(stored?.program?.weeks[0].sessions[0].exercises[0].sets).toBe(5);
  });

  it('edit before any draft returns an error the model can read (no throw)', async () => {
    const { tools } = await setup();
    const res: any = await tools.workshop_edit_draft.execute!({ ops: [{ op: 'rename', name: 'x' }] }, opts);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no draft yet/);
  });

  it('invalid ops come back as ok:false', async () => {
    const { tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    const res: any = await tools.workshop_edit_draft.execute!({ ops: [{ op: 'remove_exercise', week: 1, session: 0, index: 9 }] }, opts);
    expect(res.ok).toBe(false);
  });

  it("keeps the user's concurrent manual edit: the AI edit is re-applied on the fresh revision", async () => {
    const { db, draft, tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    // user edits by hand (revision 1 -> 2) before the AI's edit lands
    const cur = await loadDraft(db, U, draft.id);
    const manual = normalizeProgram({ ...cur!.program, name: 'Nom manuel' });
    expect((await saveDraftProgram(db, U, draft.id, manual, 1)).ok).toBe(true);
    const res: any = await tools.workshop_edit_draft.execute!(
      { ops: [{ op: 'update_exercise', week: 1, session: 0, index: 0, patch: { sets: 4 } }] },
      opts,
    );
    expect(res).toMatchObject({ ok: true, revision: 3 });
    const stored = await loadDraft(db, U, draft.id);
    expect(stored?.program?.name).toBe('Nom manuel');
    expect(stored?.program?.weeks[0].sessions[0].exercises[0].sets).toBe(4);
  });

  it('a stale manual write is rejected (optimistic revision)', async () => {
    const { db, draft, tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    const cur = await loadDraft(db, U, draft.id);
    const res = await saveDraftProgram(db, U, draft.id, cur!.program!, 0);
    expect(res).toEqual({ ok: false, reason: 'conflict' });
  });

  it('never touches another user\'s draft', async () => {
    const { db, draft } = await setup();
    expect(await loadDraft(db, 'someone-else', draft.id)).toBeNull();
    expect(await saveDraftProgram(db, 'someone-else', draft.id, normalizeProgram(program), 0)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('publishDraft', () => {
  it('inserts an INACTIVE program, marks the draft saved, and is idempotent', async () => {
    const { db, draft, tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    const rec = (await loadDraft(db, U, draft.id))!;
    const a: any = await publishDraft(db, U, rec);
    expect(a.programId).toBeTruthy();
    const row = db.tables.ziko_ai_generated_programs[0];
    expect(row.is_active).toBe(false);
    expect(row.user_id).toBe(U);
    const saved = (await loadDraft(db, U, draft.id))!;
    expect(saved.status).toBe('saved');
    const b: any = await publishDraft(db, U, saved);
    expect(b.programId).toBe(a.programId);
    expect(db.tables.ziko_ai_generated_programs).toHaveLength(1);
  });

  it('revue B M6 : deux "Enregistrer" concurrents creent UN seul programme (meme id, pas de doublon ni de 500)', async () => {
    const { db, draft, tools } = await setup();
    await tools.workshop_set_draft.execute!({ program }, opts);
    const rec = (await loadDraft(db, U, draft.id))!;
    const [a, b, c]: any[] = await Promise.all([publishDraft(db, U, rec), publishDraft(db, U, rec), publishDraft(db, U, rec)]);
    expect(a.programId).toBeTruthy();
    expect(b.programId).toBe(a.programId);
    expect(c.programId).toBe(a.programId);
    expect(db.tables.ziko_ai_generated_programs).toHaveLength(1);
    expect((await loadDraft(db, U, draft.id))!.saved_program_id).toBe(a.programId);
    expect(publishedProgramId(draft.id)).toBe(a.programId);
    expect(publishedProgramId(draft.id)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(publishedProgramId('other')).not.toBe(a.programId);
  });

  it('refuses an empty draft', async () => {
    const { db, draft } = await setup();
    const rec = (await loadDraft(db, U, draft.id))!;
    expect(await publishDraft(db, U, rec)).toEqual({ error: 'empty_draft' });
  });

  it('archives the oldest drafts beyond the cap (G-3)', async () => {
    const db: any = createFakeDb();
    for (let i = 0; i < 7; i++) await createDraft(db, U, `c${i}`);
    const active = db.tables.ziko_workshop_drafts.filter((d: any) => d.status === 'draft');
    expect(active.length).toBeLessThanOrEqual(5);
  });
});

describe('skills and web search', () => {
  it('lists and loads skills; unknown id lists the available ones', async () => {
    const { tools } = await setup();
    const list: any = await tools.workshop_list_skills.execute!({}, opts);
    expect(list.skills.length).toBe(TRAINING_SKILLS.length);
    expect(list.skills[0].body).toBeUndefined();
    const s: any = await tools.workshop_load_skill.execute!({ id: 'powerlifting-peaking' }, opts);
    expect(s.body).toContain('pct_1rm');
    const bad: any = await tools.workshop_load_skill.execute!({ id: 'nope' }, opts);
    expect(bad.error).toBe('unknown skill');
    expect(bad.available).toContain('hypertrophy-ppl');
    expect(getSkill('powerlifting-peaking')?.id).toBe('powerlifting-peaking');
  });

  it('web search logs an absorbed cost row and returns sources', async () => {
    const { db, tools } = await setup();
    const res: any = await tools.workshop_web_search.execute!({ query: 'IPF equipped weight classes' }, opts);
    expect(res.ok).toBe(true);
    expect(res.sources[0].url).toBe('https://ipf.example/rules');
    await Promise.resolve();
    const row = db.tables.ziko_ai_cost_log[0];
    expect(row).toMatchObject({ user_id: U, source: 'workshop_web_search', input_tokens: 10, output_tokens: 20 });
  });

  it('caps web searches at 2 per message (no cost row for the 3rd)', async () => {
    const { db, tools } = await setup();
    await tools.workshop_web_search.execute!({ query: 'first query' }, opts);
    await tools.workshop_web_search.execute!({ query: 'second query' }, opts);
    const third: any = await tools.workshop_web_search.execute!({ query: 'third query' }, opts);
    expect(third.ok).toBe(false);
    expect(db.tables.ziko_ai_cost_log).toHaveLength(2);
  });

  it('refuses beyond the daily cap without calling the runner', async () => {
    const today = new Date().toISOString();
    const rows = Array.from({ length: WORKSHOP_WEB_SEARCH_DAILY_CAP }, (_, i) => ({ id: `r${i}`, user_id: U, source: 'workshop_web_search', created_at: today }));
    const runner = vi.fn();
    const db: any = createFakeDb({ ziko_ai_cost_log: rows });
    const draft = await createDraft(db, U, 'c');
    const tools = createWorkshopTools({ db, userId: U, draftId: draft.id, getContext: async () => fetchWorkshopContext(db, U), emitDraft: () => {}, searchRunner: runner as any });
    const res: any = await tools.workshop_web_search.execute!({ query: 'anything here' }, opts);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('daily_cap');
    expect(runner).not.toHaveBeenCalled();
  });

  it('a runner failure is absorbed as ok:false (the turn continues)', async () => {
    const db: any = createFakeDb();
    const draft = await createDraft(db, U, 'c');
    const tools = createWorkshopTools({
      db, userId: U, draftId: draft.id, getContext: async () => fetchWorkshopContext(db, U), emitDraft: () => {},
      searchRunner: async () => { throw new Error('boom'); },
    });
    const res: any = await tools.workshop_web_search.execute!({ query: 'anything here' }, opts);
    expect(res).toMatchObject({ ok: false, reason: 'error' });
    // Revue B (M5) : l'appel en echec consomme quand meme un slot (la recherche a pu etre facturee).
    expect(db.tables.ziko_ai_cost_log).toEqual([expect.objectContaining({ user_id: U, source: 'workshop_web_search', input_tokens: 0, output_tokens: 0 })]);
  });

  it('revue B M5 : 30 recherches simultanees -> au plus le plafond du jour part au fournisseur', async () => {
    const db: any = createFakeDb();
    const runner = vi.fn(async () => ({ text: 'ok', sources: [], usage: { inputTokens: 1, outputTokens: 1 } }));
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => runWebSearch(db, U, `parallel query ${i}`, runner as any)));
    expect(runner).toHaveBeenCalledTimes(WORKSHOP_WEB_SEARCH_DAILY_CAP);
    expect(results.filter((r) => r.ok)).toHaveLength(WORKSHOP_WEB_SEARCH_DAILY_CAP);
    expect(results.filter((r) => !r.ok && r.reason === 'daily_cap')).toHaveLength(30 - WORKSHOP_WEB_SEARCH_DAILY_CAP);
  });

  it('revue B M5 : les echecs consomment le plafond (20 echecs => la 21e recherche est refusee sans appel)', async () => {
    const db: any = createFakeDb();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runner = vi.fn(async () => { throw new Error('provider down'); });
    const base = Date.now();
    for (let i = 0; i < WORKSHOP_WEB_SEARCH_DAILY_CAP; i++) await runWebSearch(db, U, `failing query ${i}`, runner as any, new Date(base + i * 1000));
    const res = await runWebSearch(db, U, 'one more query', runner as any, new Date(base + 60_000));
    expect(res).toMatchObject({ ok: false, reason: 'daily_cap' });
    expect(runner).toHaveBeenCalledTimes(WORKSHOP_WEB_SEARCH_DAILY_CAP);
  });

  it('labels tools for the UI chips', () => {
    expect(toolLabel('workshop_web_search')).toBe('Recherche web');
    expect(toolLabel('workshop_load_skill', { id: 'hypertrophy-ppl' })).toContain('Hypertrophie');
  });
});

describe('athlete context (ATEL-04)', () => {
  const seed = {
    ziko_user_profiles: [{ id: U, name: 'Alex', age: 29, weight_kg: 90, height_cm: 180, goal: 'strength' }],
    ziko_workout_sessions: [
      { id: 's1', user_id: U, name: 'Squat day', started_at: new Date().toISOString(), total_volume_kg: 5000 },
      { id: 's-other', user_id: 'other', name: 'Not mine', started_at: new Date().toISOString(), total_volume_kg: 1 },
    ],
    ziko_session_sets: [
      { session_id: 's1', exercise_id: 'e1', reps: 5, weight_kg: 140, completed: true },
      { session_id: 's1', exercise_id: 'e1', reps: 3, weight_kg: 150, completed: true },
      { session_id: 's1', exercise_id: 'e1', reps: 20, weight_kg: 60, completed: true },
    ],
    ziko_exercises: [{ id: 'e1', name: 'Squat' }],
    ziko_ai_generated_programs: [
      { user_id: U, name: 'Ancien PPL', goal: 'hypertrophy', is_active: true, created_at: '2026-09-01T00:00:00Z' },
      { user_id: 'other', name: 'Other', goal: 'x', is_active: false, created_at: '2026-09-01T00:00:00Z' },
    ],
  };

  it('computes Epley e1RM, ignores >12 reps, other users and unfinished sets', async () => {
    expect(epley(140, 5)).toBe(163.3);
    expect(epley(60, 20)).toBeNull();
    const db: any = createFakeDb(seed);
    const ctx = await fetchWorkshopContext(db, U);
    expect(ctx.records).toEqual([{ exercise: 'Squat', e1rm_kg: 165, best_set: '150 kg x 3' }]);
    expect(ctx.recentSessions).toHaveLength(1);
    expect(ctx.recentSessions[0].top_sets[0]).toMatchObject({ exercise: 'Squat', weight_kg: 150 });
    expect(ctx.programs.map((p) => p.name)).toEqual(['Ancien PPL']);
    expect(contextCounts(ctx)).toEqual({ sessions: 1, programs: 1, records: 1 });
  });

  it('renders a bounded text and asks for maxes when no records exist', async () => {
    const db: any = createFakeDb(seed);
    const text = renderContext(await fetchWorkshopContext(db, U), 400);
    expect(text).toContain('e1RM 165');
    expect(text.length).toBeLessThanOrEqual(430);
    const empty = renderContext(await fetchWorkshopContext(createFakeDb() as any, U));
    expect(empty).toContain('ask for current maxes');
  });

  it('workshop_get_context filters by exercise', async () => {
    const db: any = createFakeDb(seed);
    const draft = await createDraft(db, U, 'c');
    const tools = createWorkshopTools({ db, userId: U, draftId: draft.id, getContext: async () => fetchWorkshopContext(db, U), emitDraft: () => {} });
    const res: any = await tools.workshop_get_context.execute!({ exercise: 'squat' }, opts);
    expect(res.records[0].exercise).toBe('Squat');
    const none: any = await tools.workshop_get_context.execute!({ exercise: 'bench' }, opts);
    expect(none.records).toHaveLength(0);
  });
});
