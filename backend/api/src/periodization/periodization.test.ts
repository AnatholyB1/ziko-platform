/**
 * Phase 24 (v1.20) - ATEL-07/08/09 : periodisation et relance automatique (double de base en memoire, aucun appel IA).
 * Prouve : fin de programme neutre (calendaire ou toutes les seances), resultats calcules et sans vocabulaire
 * d'echec, suite ordonnee (statuts), cloture + suite + brouillon + relance IDEMPOTENTS, proposition IA unique
 * (course double => 1 seul appel), plafond journalier, panne modele => relance conservee sans proposition,
 * publication rattachee a la suite (position suivante, inactive), et AUCUNE ecriture hors tables attendues
 * (rien sur credits/gamification/serie : regle non punitive).
 * Ne prouve PAS : le SQL des migrations (non execute), la semantique PostgREST/RLS, le vrai modele.
 */
import { describe, it, expect, vi } from 'vitest';
import { createFakeDb } from '../workshop/fakeDb.testutil.js';
import { evaluateProgress, weeksCountOf, sessionsPerWeekOf } from './progress.js';
import { computeResults, hintFor, renderResultsForPrompt } from './results.js';
import { buildSequenceItems } from './sequence.js';
import { runRelaunchCheck, runRelaunchPropose, dismissRelaunch, getOpenRelaunch, previousResultsBlock, type RelaunchModelRunner } from './relaunch.js';
import { publishDraft, loadDraft } from '../workshop/store.js';
import { PROGRAM_RELAUNCH_DAILY_CAP } from './limits.js';

const U = 'user-1';
const NOW = new Date('2026-12-20T10:00:00Z');
const DAY = 86400000;
const iso = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();

const PROGRAM_DATA = {
  weeks_count: 2,
  weeks: [
    { w: 1, sessions: [{ name: 'A', day_of_week: 1, exercises: [] }, { name: 'B', day_of_week: 4, exercises: [] }] },
    { w: 2, sessions: [{ name: 'A', day_of_week: 1, exercises: [] }, { name: 'B', day_of_week: 4, exercises: [] }] },
  ],
};

function seed(overrides: Record<string, any[]> = {}) {
  return {
    ziko_ai_generated_programs: [
      {
        id: 'p1', user_id: U, name: 'Bloc de volume', goal: 'strength', days_per_week: 2, is_active: true, completed_at: null,
        started_at: iso(30), created_at: iso(31), sequence_id: null, sequence_position: null, program_data: PROGRAM_DATA, results: null,
      },
    ],
    ziko_workout_sessions: [
      { id: 's1', user_id: U, started_at: iso(28), ended_at: iso(28), total_volume_kg: 5000 },
      { id: 's2', user_id: U, started_at: iso(25), ended_at: iso(25), total_volume_kg: 5200 },
      { id: 's3', user_id: U, started_at: iso(20), ended_at: iso(20), total_volume_kg: 5400 },
      { id: 's4', user_id: U, started_at: iso(17), ended_at: iso(17), total_volume_kg: 5600 },
      { id: 's5', user_id: U, started_at: iso(10), ended_at: null, total_volume_kg: 0 }, // jamais terminee : ignoree
    ],
    ziko_session_sets: [
      { session_id: 's1', exercise_id: 'e-squat', reps: 5, weight_kg: 120, completed: true },
      { session_id: 's2', exercise_id: 'e-squat', reps: 5, weight_kg: 122.5, completed: true },
      { session_id: 's3', exercise_id: 'e-squat', reps: 5, weight_kg: 130, completed: true },
      { session_id: 's4', exercise_id: 'e-squat', reps: 5, weight_kg: 135, completed: true },
    ],
    ziko_exercises: [{ id: 'e-squat', name: 'Squat' }],
    ...overrides,
  };
}

describe('progress (fin de programme, neutre)', () => {
  const t = { startedAt: iso(30), createdAt: iso(31), programData: PROGRAM_DATA, daysPerWeek: 2 };
  it('lit semaines et seances par semaine', () => {
    expect(weeksCountOf(PROGRAM_DATA)).toBe(2);
    expect(weeksCountOf({ weeks_count: '6' })).toBe(6);
    expect(weeksCountOf({ weeks: 8 })).toBeNull(); // forme historique de l'assistant 4 etapes : pas de cloture auto
    expect(sessionsPerWeekOf(null, PROGRAM_DATA)).toBe(2);
  });
  it('fini a la date prevue meme avec 0 seance : aucun retard ni penalite', () => {
    const ev = evaluateProgress(t, 0, NOW);
    expect(ev.state).toBe('ended');
    expect(ev.reason).toBe('calendar');
    expect(ev.plannedSessions).toBe(4);
  });
  it('en cours avant la date ; fini plus tot si toutes les seances sont faites', () => {
    const early = { ...t, startedAt: iso(5) };
    expect(evaluateProgress(early, 1, NOW).state).toBe('in_progress');
    const done = evaluateProgress(early, 4, NOW);
    expect(done.state).toBe('ended');
    expect(done.reason).toBe('all_sessions');
  });
  it('duree inconnue : jamais cloture automatiquement', () => {
    expect(evaluateProgress({ ...t, programData: { weeks: 8 } }, 99, NOW).state).toBe('unknown');
  });
  it('repli sur created_at quand started_at est null (programmes actifs avant la migration)', () => {
    const ev = evaluateProgress({ ...t, startedAt: null }, 0, NOW);
    expect(ev.startedAt).toBe(t.createdAt);
    expect(ev.state).toBe('ended');
  });
});

describe('results (resultats neutres)', () => {
  const sessions = [
    { id: 'a', started_at: iso(28), total_volume_kg: 1000 },
    { id: 'b', started_at: iso(20), total_volume_kg: 1200 },
  ];
  const sets = [
    { session_id: 'a', exercise: 'Squat', weight_kg: 100, reps: 5 },
    { session_id: 'b', exercise: 'Squat', weight_kg: 110, reps: 5 },
  ];
  it('adherence, volume et evolution du 1RM estime (1ere moitie -> 2eme moitie)', () => {
    const r = computeResults({ from: iso(30), to: iso(16), sessions, sets, plannedSessions: 4 });
    expect(r.sessions_done).toBe(2);
    expect(r.adherence_pct).toBe(50);
    expect(r.total_volume_kg).toBe(2200);
    expect(r.lifts[0]).toMatchObject({ exercise: 'Squat', start_e1rm_kg: 116.7, end_e1rm_kg: 128.3 });
    expect(r.lifts[0]!.delta_kg).toBeGreaterThan(0);
    expect(r.hint).toBe('consolidate');
  });
  it('conseil de direction : jamais un malus', () => {
    expect(hintFor(100, 8)).toBe('progress');
    expect(hintFor(65, 5)).toBe('consolidate');
    expect(hintFor(20, 1)).toBe('reentry');
    expect(hintFor(null, 0)).toBe('reentry');
  });
  it('aucune seance : bilan valide, reprise douce, sans vocabulaire d\'echec', () => {
    const r = computeResults({ from: iso(30), to: iso(16), sessions: [], sets: [], plannedSessions: 4 });
    expect(r.hint).toBe('reentry');
    expect(r.lifts).toEqual([]);
    const text = renderResultsForPrompt('Bloc', null, r);
    expect(text).not.toMatch(/fail|echec|échec|missed|lazy|penal|behind|poor/i);
  });
});

describe('sequence (suite ordonnee)', () => {
  it('statuts done / active / next / planned, un seul actif', () => {
    const base = { goal: null, started_at: null, results: null };
    const items = buildSequenceItems([
      { ...base, id: 'c', name: 'C', sequence_position: 3, is_active: false, completed_at: null },
      { ...base, id: 'a', name: 'A', sequence_position: 1, is_active: false, completed_at: iso(1) },
      { ...base, id: 'b', name: 'B', sequence_position: 2, is_active: true, completed_at: null },
      { ...base, id: 'd', name: 'D', sequence_position: 4, is_active: false, completed_at: null },
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(items.map((i) => i.status)).toEqual(['done', 'active', 'next', 'planned']);
    expect(items.filter((i) => i.status === 'active')).toHaveLength(1);
  });
});

const tablesTouched = (db: any) => new Set<string>(db.calls.map((c: any) => c.table));
const makeConv = () => vi.fn(async () => 'conv-1');

describe('runRelaunchCheck (cloture + relance, sans IA)', () => {
  it('programme en cours : rien ne change', async () => {
    const db: any = createFakeDb(seed({
      ziko_ai_generated_programs: [{ id: 'p1', user_id: U, name: 'X', goal: null, days_per_week: 2, is_active: true, completed_at: null, started_at: iso(3), created_at: iso(3), program_data: PROGRAM_DATA }],
    }));
    const createConversation = makeConv();
    const out = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation });
    expect(out).toEqual({ relaunch: null, closed_program_id: null });
    expect(createConversation).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(0);
  });

  it('programme termine : cloture inactive, suite creee, brouillon lie, relance creee, resultats stockes', async () => {
    const db: any = createFakeDb(seed());
    const out = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation: makeConv() });
    expect(out.closed_program_id).toBe('p1');
    const prog = db.tables.ziko_ai_generated_programs.find((p: any) => p.id === 'p1');
    expect(prog.is_active).toBe(false);
    expect(prog.completed_at).toBe(NOW.toISOString());
    expect(prog.sequence_position).toBe(1);
    expect(prog.results.sessions_done).toBe(4);
    expect(prog.results.sessions_planned).toBe(4);
    expect(prog.results.adherence_pct).toBe(100);
    expect(prog.results.hint).toBe('progress');
    expect(prog.results.lifts[0].exercise).toBe('Squat');
    expect(db.tables.ziko_program_sequences).toHaveLength(1);
    const draft = db.tables.ziko_workshop_drafts[0];
    expect(draft).toMatchObject({ sequence_id: prog.sequence_id, previous_program_id: 'p1', status: 'draft' });
    expect(out.relaunch).toMatchObject({ status: 'pending', program_id: 'p1', draft_id: draft.id, program_name: 'Bloc de volume' });
    // jamais d'activation automatique du suivant : aucune ligne `ai` active
    expect(db.tables.ziko_ai_generated_programs.filter((p: any) => p.is_active)).toHaveLength(0);
  });

  it('idempotent : un second check ne recree ni relance, ni brouillon, ni suite', async () => {
    const db: any = createFakeDb(seed());
    const createConversation = makeConv();
    await runRelaunchCheck({ db, userId: U, now: NOW, createConversation });
    const again = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation });
    expect(again.closed_program_id).toBeNull();
    expect(again.relaunch?.status).toBe('pending');
    expect(db.tables.ziko_program_relaunches).toHaveLength(1);
    expect(db.tables.ziko_workshop_drafts).toHaveLength(1);
    expect(db.tables.ziko_program_sequences).toHaveLength(1);
    expect(createConversation).toHaveBeenCalledTimes(1);
  });

  it('reprise apres cloture interrompue : la relance existante est reutilisee', async () => {
    const db: any = createFakeDb(seed());
    const createConversation = makeConv();
    await runRelaunchCheck({ db, userId: U, now: NOW, createConversation });
    // simule un echec de closeProgram apres la creation de la relance : l'UPDATE est atomique : le programme est encore actif, sans results
    Object.assign(db.tables.ziko_ai_generated_programs[0], { is_active: true, completed_at: null, results: null });
    await runRelaunchCheck({ db, userId: U, now: NOW, createConversation });
    expect(db.tables.ziko_program_relaunches).toHaveLength(1);
    expect(db.tables.ziko_workshop_drafts).toHaveLength(1);
    expect(db.tables.ziko_ai_generated_programs[0].is_active).toBe(false);
  });

  it('zero seance : le programme se termine quand meme, relance proposee (reprise douce), aucune penalite', async () => {
    const db: any = createFakeDb(seed({ ziko_workout_sessions: [], ziko_session_sets: [] }));
    const out = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation: makeConv() });
    expect(out.relaunch?.results?.hint).toBe('reentry');
    expect(out.relaunch?.results?.sessions_done).toBe(0);
  });

  it('non punitif : aucune ecriture hors programmes, suites, brouillons, relances', async () => {
    const db: any = createFakeDb(seed());
    await runRelaunchCheck({ db, userId: U, now: NOW, createConversation: makeConv() });
    const touched = [...tablesTouched(db)];
    expect(touched.every((t) => ['ziko_ai_generated_programs', 'ziko_program_sequences', 'ziko_workshop_drafts', 'ziko_program_relaunches'].includes(t))).toBe(true);
    expect(touched.join(',')).not.toMatch(/credit|xp|streak|gamif|quest|coin/);
  });
});

function fakeRunner(opts: { setDraft?: boolean; throws?: boolean } = {}) {
  const calls: any[] = [];
  const runner: RelaunchModelRunner = async (args) => {
    calls.push(args);
    if (opts.throws) throw new Error('model down');
    if (opts.setDraft !== false) {
      await (args.tools.workshop_set_draft as any).execute(
        {
          program: {
            name: 'Bloc de force',
            goal: 'strength',
            weeks: [{ sessions: [{ name: 'Squat', day_of_week: 1, exercises: [{ name: 'Squat', sets: 4, reps: '3', pct_1rm: 85, rpe: 8 }] }] }],
          },
        },
        { toolCallId: 't', messages: [] },
      );
    }
    return { text: 'Bilan neutre et suite proposee.', usage: { inputTokens: 1200, outputTokens: 800 } };
  };
  return { runner, calls };
}

async function closedState() {
  const db: any = createFakeDb(seed());
  const check = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation: makeConv() });
  return { db, relaunchId: check.relaunch!.id };
}

describe('runRelaunchPropose (UN appel IA automatique, absorbe)', () => {
  it('ecrit le brouillon du programme suivant, journalise le cout, sans web ni credit', async () => {
    const { db, relaunchId } = await closedState();
    const { runner, calls } = fakeRunner();
    const appendMessages = vi.fn(async () => undefined);
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner, appendMessages });
    expect(out.status).toBe('proposed');
    expect(calls).toHaveLength(1);
    expect(Object.keys(calls[0].tools)).not.toContain('workshop_web_search');
    expect(Object.keys(calls[0].tools)).toContain('workshop_set_draft');
    expect(calls[0].system).toContain('PREVIOUS PROGRAM RESULTS');
    expect(calls[0].system).toContain('Squat');
    expect(calls[0].system).toMatch(/Never frame the previous program as a failure/);
    const draft = db.tables.ziko_workshop_drafts[0];
    expect(draft.program_data.weeks).toHaveLength(1);
    expect(db.tables.ziko_program_relaunches[0].status).toBe('proposed');
    expect(appendMessages).toHaveBeenCalledWith('conv-1', [expect.objectContaining({ role: 'user' }), expect.objectContaining({ role: 'assistant' })]);
    await new Promise((r) => setTimeout(r, 0)); // logAutonomousCost est fire-and-forget
    expect(db.tables.ziko_ai_cost_log).toEqual([expect.objectContaining({ user_id: U, source: 'program_relaunch', input_tokens: 1200, output_tokens: 800 })]);
    expect([...tablesTouched(db)].join(',')).not.toMatch(/credit_trans|xp|streak|gamif|quest|coin/);
  });

  it('idempotent : un second appel ne rappelle pas le modele', async () => {
    const { db, relaunchId } = await closedState();
    const { runner, calls } = fakeRunner();
    const deps = { db, userId: U, relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) };
    await runRelaunchPropose(deps);
    const second = await runRelaunchPropose(deps);
    expect(second).toMatchObject({ status: 'proposed', already: true });
    expect(calls).toHaveLength(1);
  });

  it('course : deux appels simultanes => un seul appel modele (compare-and-set)', async () => {
    const { db, relaunchId } = await closedState();
    const { runner, calls } = fakeRunner();
    const deps = { db, userId: U, relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) };
    const [a, b] = await Promise.all([runRelaunchPropose(deps), runRelaunchPropose(deps)]);
    expect(calls).toHaveLength(1);
    expect([a.status, b.status].sort()).toEqual(['pending', 'proposed']);
    expect([a, b].find((x) => x.status === 'pending')).toMatchObject({ skipped: 'busy' });
  });

  it('plafond journalier atteint : aucun appel modele, la relance reste utilisable (pending)', async () => {
    const { db, relaunchId } = await closedState();
    for (let i = 0; i < PROGRAM_RELAUNCH_DAILY_CAP; i++) {
      db.tables.ziko_ai_cost_log = [...(db.tables.ziko_ai_cost_log ?? []), { user_id: U, source: 'program_relaunch', created_at: NOW.toISOString() }];
    }
    const { runner, calls } = fakeRunner();
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) });
    expect(out).toMatchObject({ status: 'pending', skipped: 'daily_cap' });
    expect(calls).toHaveLength(0);
    expect(db.tables.ziko_program_relaunches[0].status).toBe('pending');
  });

  it('un cout de la VEILLE ne compte pas dans le plafond du jour', async () => {
    const { db, relaunchId } = await closedState();
    db.tables.ziko_ai_cost_log = [{ user_id: U, source: 'program_relaunch', created_at: iso(1) }];
    const { runner, calls } = fakeRunner();
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) });
    expect(out.status).toBe('proposed');
    expect(calls).toHaveLength(1);
  });

  it('panne du modele : relance conservee (pending), brouillon vide, aucune ecriture de credit', async () => {
    const { db, relaunchId } = await closedState();
    const { runner } = fakeRunner({ throws: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) });
    expect(out).toMatchObject({ status: 'pending', skipped: 'ai_error' });
    expect(db.tables.ziko_program_relaunches[0].status).toBe('pending');
    expect(db.tables.ziko_workshop_drafts[0].program_data).toEqual({});
  });

  it('revue B M4 : une panne du modele consomme le plafond du jour (pas de rappel en boucle vers le fournisseur)', async () => {
    const { db, relaunchId } = await closedState();
    const failing = fakeRunner({ throws: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = { db, userId: U, relaunchId, now: NOW, runner: failing.runner, appendMessages: vi.fn(async () => undefined) };
    await runRelaunchPropose(deps);
    expect(db.tables.ziko_ai_cost_log).toEqual([expect.objectContaining({ user_id: U, source: 'program_relaunch', input_tokens: 0 })]);
    for (let i = 0; i < 5; i++) {
      const again = await runRelaunchPropose(deps);
      expect(again).toMatchObject({ status: 'pending', skipped: 'daily_cap' });
    }
    expect(failing.calls).toHaveLength(1);
  });

  it('revue B M4 : la reservation est faite AVANT l\'appel (le plafond est deja pris pendant que le modele tourne)', async () => {
    const { db, relaunchId } = await closedState();
    let seenDuringCall = -1;
    const slow = async (args: any) => {
      seenDuringCall = (db.tables.ziko_ai_cost_log ?? []).filter((r: any) => r.source === 'program_relaunch').length;
      return fakeRunner().runner(args);
    };
    await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner: slow as any, appendMessages: vi.fn(async () => undefined) });
    expect(seenDuringCall).toBe(1);
  });

  it('le modele n\'a rien ecrit dans le brouillon : pending, pas de message d\'historique', async () => {
    const { db, relaunchId } = await closedState();
    const { runner } = fakeRunner({ setDraft: false });
    const append = vi.fn(async () => undefined);
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner, appendMessages: append });
    expect(out).toMatchObject({ status: 'pending', skipped: 'ai_error' });
    expect(append).not.toHaveBeenCalled();
  });

  it('relance d\'un autre utilisateur : introuvable', async () => {
    const { db, relaunchId } = await closedState();
    const { runner, calls } = fakeRunner();
    const out = await runRelaunchPropose({ db, userId: 'intrus', relaunchId, now: NOW, runner, appendMessages: vi.fn(async () => undefined) });
    expect(out.status).toBe('not_found');
    expect(calls).toHaveLength(0);
  });
});

describe('publication, suite et relance ignoree', () => {
  it('enregistrer le brouillon de relance : programme INACTIF a la position suivante de la suite', async () => {
    const { db, relaunchId } = await closedState();
    await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner: fakeRunner().runner, appendMessages: vi.fn(async () => undefined) });
    const draft = await loadDraft(db, U, db.tables.ziko_workshop_drafts[0].id);
    const res = await publishDraft(db, U, draft!);
    expect('programId' in res).toBe(true);
    const next = db.tables.ziko_ai_generated_programs.find((p: any) => p.name === 'Bloc de force');
    expect(next).toMatchObject({ is_active: false, sequence_position: 2 });
    expect(next.sequence_id).toBe(db.tables.ziko_ai_generated_programs.find((p: any) => p.id === 'p1').sequence_id);
    // une fois enregistree, la relance n'est plus "ouverte"
    expect(await getOpenRelaunch(db, U)).toBeNull();
  });

  it('un brouillon manuel (sans suite) se publie comme avant (P23 inchange)', async () => {
    const db: any = createFakeDb({});
    const row: any = { id: 'd1', user_id: U, status: 'draft', saved_program_id: null, sequence_id: null, previous_program_id: null, program: { name: 'N', goal: 'g', split_type: 'x', days_per_week: 1, weeks_count: 1, weeks: [{ w: 1, sessions: [] }] } };
    await publishDraft(db, U, row);
    expect(db.tables.ziko_ai_generated_programs[0].sequence_id).toBeUndefined();
  });

  it('programme reactive apres sa cloture : pas re-clos, relance traitee, bandeau disparu (run5 P24)', async () => {
    const { db, relaunchId } = await closedState();
    const p = db.tables.ziko_ai_generated_programs.find((x: any) => x.id === 'p1');
    expect(p.completed_at).toBeTruthy();
    expect((await getOpenRelaunch(db, U))?.id).toBe(relaunchId); // programme termine : bandeau affiche
    // reactivation (RPC P7) : is_active=true, completed_at=NULL, `results` conserve
    p.is_active = true;
    p.completed_at = null;
    expect(await getOpenRelaunch(db, U)).toBeNull();
    const check = await runRelaunchCheck({ db, userId: U, now: NOW, createConversation: makeConv() });
    expect(check.closed_program_id).toBeNull();
    expect(check.relaunch).toBeNull();
    expect(p).toMatchObject({ is_active: true, completed_at: null });
    expect(db.tables.ziko_program_relaunches[0].status).toBe('dismissed');
  });

  it('ignorer la relance : aucune consequence, plus proposee', async () => {
    const { db, relaunchId } = await closedState();
    expect(await dismissRelaunch(db, U, relaunchId)).toBe(true);
    expect(await getOpenRelaunch(db, U)).toBeNull();
    expect(await dismissRelaunch(db, 'intrus', relaunchId)).toBe(false);
    const out = await runRelaunchPropose({ db, userId: U, relaunchId, now: NOW, runner: fakeRunner().runner, appendMessages: vi.fn(async () => undefined) });
    expect(out.status).toBe('dismissed');
  });

  it('tour manuel suivant : les resultats du programme precedent sont injectes', async () => {
    const { db } = await closedState();
    const draft = await loadDraft(db, U, db.tables.ziko_workshop_drafts[0].id);
    const block = await previousResultsBlock(db, U, draft!);
    expect(block).toContain('PREVIOUS PROGRAM RESULTS');
    expect(block).toContain('Bloc de volume');
    expect(await previousResultsBlock(db, U, { ...draft!, previous_program_id: null })).toBeNull();
  });
});
