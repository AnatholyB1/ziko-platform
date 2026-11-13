// Phase 24 (v1.20) - ATEL-08/09 : detection de fin de programme + relance automatique de l'atelier.
//
// Deux temps (D-07), tous deux idempotents :
//   runRelaunchCheck   : detection + cloture + suite + brouillon + ligne de relance. AUCUN appel IA.
//   runRelaunchPropose : UN appel IA automatique (absorbe : pas de creditCheck/creditDeduct, plafond
//                        journalier, journalise ziko_ai_cost_log source 'program_relaunch').
// Non punitif (D-06) : ce module n'importe aucun service de credits/gamification/serie.
import { generateText, stepCountIs } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { reserveCostSlot, settleCostSlot } from '../lib/costReservation.js';
import { fetchWorkshopContext, type WorkshopDb } from '../workshop/context.js';
import { createDraft, loadDraft, type DraftRecord } from '../workshop/store.js';
import { createWorkshopTools } from '../workshop/tools.js';
import { WORKSHOP_MAX_STEPS } from '../workshop/limits.js';
import { PROGRAM_RELAUNCH_COST_SOURCE, PROGRAM_RELAUNCH_DAILY_CAP } from './limits.js';
import { evaluateProgress, effectiveStart } from './progress.js';
import { computeResults, renderResultsForPrompt, type ProgramResults } from './results.js';
import { buildRelaunchSystemPrompt, RELAUNCH_USER_MESSAGE } from './prompt.js';
import {
  attachDraftSequence,
  claimPropose,
  closeProgram,
  countAutoCallsToday,
  createRelaunch,
  ensureSequence,
  fetchSessionsSince,
  fetchSets,
  listRecentRelaunches,
  loadActiveProgram,
  loadCurrentSequence,
  loadProgram,
  loadRelaunch,
  loadRelaunchByProgram,
  setRelaunchStatus,
  type RelaunchRow,
} from './store.js';

export interface RelaunchView {
  id: string;
  status: RelaunchRow['status'];
  draft_id: string | null;
  program_id: string;
  program_name: string | null;
  sequence_id: string | null;
  results: ProgramResults | null;
}

async function toView(db: WorkshopDb, userId: string, r: RelaunchRow): Promise<RelaunchView> {
  const p = await loadProgram(db, userId, r.program_id);
  return {
    id: r.id,
    status: r.status,
    draft_id: r.draft_id,
    program_id: r.program_id,
    program_name: p?.name ?? null,
    sequence_id: r.sequence_id,
    results: r.results ?? p?.results ?? null,
  };
}

/** Relance encore ouverte : non ignoree et dont le brouillon n'est pas deja enregistre. */
async function findOpenRelaunch(db: WorkshopDb, userId: string): Promise<RelaunchRow | null> {
  for (const r of await listRecentRelaunches(db, userId)) {
    if (r.status === 'dismissed') continue;
    // Programme reactive (actif, non termine) : la relance qui le concerne n'a plus lieu d'etre affichee.
    const prog = await loadProgram(db, userId, r.program_id);
    if (prog && prog.is_active === true && !prog.completed_at) continue;
    if (r.draft_id) {
      const d = await loadDraft(db, userId, r.draft_id);
      if (!d || d.status !== 'draft') continue;
    }
    return r;
  }
  return null;
}

/** Lecture seule : relance ouverte (sans detection ni ecriture). */
export async function getOpenRelaunch(db: WorkshopDb, userId: string): Promise<RelaunchView | null> {
  const open = await findOpenRelaunch(db, userId);
  return open ? toView(db, userId, open) : null;
}

export interface CheckDeps {
  db: WorkshopDb;
  userId: string;
  now?: Date;
  /** Cree la conversation de l'atelier (route : getOrCreateConversation avec le jeton utilisateur). */
  createConversation: () => Promise<string>;
}

export async function runRelaunchCheck(deps: CheckDeps): Promise<{ relaunch: RelaunchView | null; closed_program_id: string | null }> {
  const { db, userId } = deps;
  const now = deps.now ?? new Date();
  let closedId: string | null = null;

  const active = await loadActiveProgram(db, userId);
  if (active && active.results) {
    // Programme REACTIVE apres sa cloture (closeProgram a ecrit `results`, la RPC de reactivation a remis
    // completed_at a NULL) : l'athlete a choisi de le reprendre. On ne le re-clot pas et la relance qui le
    // concernait est traitee, sinon le bandeau "Programme termine" resterait (run5 P24).
    const rel = await loadRelaunchByProgram(db, userId, active.id);
    if (rel && rel.status !== 'dismissed') await setRelaunchStatus(db, userId, rel.id, 'dismissed');
  } else if (active) {
    const start = effectiveStart({ startedAt: active.started_at, createdAt: active.created_at });
    const sessions = Number.isNaN(start.getTime()) ? [] : await fetchSessionsSince(db, userId, start);
    const progress = evaluateProgress(
      { startedAt: active.started_at, createdAt: active.created_at, programData: active.program_data, daysPerWeek: active.days_per_week },
      sessions.length,
      now,
    );
    if (progress.state === 'ended') {
      // fenetre de resultats : jusqu'a la fin calendaire (les seances plus tardives n'appartiennent pas au programme)
      const to = progress.reason === 'calendar' && progress.endsAt ? new Date(progress.endsAt) : now;
      const inWindow = sessions.filter((s) => new Date(s.started_at).getTime() <= to.getTime());
      const sets = await fetchSets(db, inWindow.map((s) => s.id));
      const results = computeResults({
        from: start.toISOString(),
        to: to.toISOString(),
        sessions: inWindow,
        sets,
        plannedSessions: progress.plannedSessions,
      });
      const sequenceId = await ensureSequence(db, userId, active);
      // Ordre voulu : la relance (idempotente par program_id) est creee AVANT la cloture. Si la cloture echoue,
      // le prochain check retrouve la relance existante et ne recree ni brouillon ni conversation.
      if (!(await loadRelaunchByProgram(db, userId, active.id))) {
        const conversationId = await deps.createConversation();
        const draft = await createDraft(db, userId, conversationId);
        await attachDraftSequence(db, userId, draft.id, sequenceId, active.id);
        await createRelaunch(db, userId, { program_id: active.id, sequence_id: sequenceId, draft_id: draft.id, results });
      }
      await closeProgram(db, userId, active.id, results, now);
      closedId = active.id;
    }
  }

  const open = await findOpenRelaunch(db, userId);
  return { relaunch: open ? await toView(db, userId, open) : null, closed_program_id: closedId };
}

/** Appel modele (injectable : tests, faux Anthropic en UAT passe par ANTHROPIC_BASE_URL). */
export type RelaunchModelRunner = (args: { system: string; prompt: string; tools: Record<string, any> }) => Promise<{
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}>;

export const defaultRelaunchRunner: RelaunchModelRunner = async ({ system, prompt, tools }) => {
  const res: any = await generateText({
    model: AGENT_MODEL,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools,
    stopWhen: stepCountIs(WORKSHOP_MAX_STEPS),
  });
  return { text: String(res.text ?? ''), usage: res.totalUsage ?? res.usage };
};

export interface ProposeDeps {
  db: WorkshopDb;
  userId: string;
  relaunchId: string;
  now?: Date;
  runner?: RelaunchModelRunner;
  /** Persiste les 2 messages dans l'historique de l'atelier (route : appendMessages). */
  appendMessages: (conversationId: string, msgs: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<void>;
}

export type ProposeOutcome =
  | { status: 'proposed'; draft_id: string | null; already?: boolean }
  | { status: 'pending'; draft_id: string | null; skipped: 'daily_cap' | 'ai_error' | 'busy' }
  | { status: 'dismissed' }
  | { status: 'not_found' };

export async function runRelaunchPropose(deps: ProposeDeps): Promise<ProposeOutcome> {
  const { db, userId } = deps;
  const now = deps.now ?? new Date();
  const rel = await loadRelaunch(db, userId, deps.relaunchId);
  if (!rel) return { status: 'not_found' };
  if (rel.status === 'dismissed') return { status: 'dismissed' };
  if (rel.status === 'proposed') return { status: 'proposed', draft_id: rel.draft_id, already: true };
  if (!rel.draft_id) return { status: 'pending', draft_id: null, skipped: 'ai_error' };

  const draft = await loadDraft(db, userId, rel.draft_id);
  if (!draft || draft.status !== 'draft') return { status: 'pending', draft_id: rel.draft_id, skipped: 'ai_error' };
  // un brouillon deja rempli (edite a la main, ou 1er appel interrompu apres ecriture) : rien a payer
  if (draft.program) {
    await setRelaunchStatus(db, userId, rel.id, 'proposed', { proposed_at: now.toISOString() }, now);
    return { status: 'proposed', draft_id: draft.id, already: true };
  }

  if ((await countAutoCallsToday(db, userId, now)) >= PROGRAM_RELAUNCH_DAILY_CAP) {
    return { status: 'pending', draft_id: draft.id, skipped: 'daily_cap' };
  }
  if (!(await claimPropose(db, userId, rel, now))) return { status: 'pending', draft_id: draft.id, skipped: 'busy' };

  // Revue B (M4) : le slot de cout est reserve AVANT l'appel (insert atomique) ; un echec du modele le consomme aussi.
  const slot = await reserveCostSlot(db, {
    userId,
    source: PROGRAM_RELAUNCH_COST_SOURCE,
    model: AGENT_MODEL.modelId,
    dailyCap: PROGRAM_RELAUNCH_DAILY_CAP,
    now,
  });
  if (!slot.ok) {
    await setRelaunchStatus(db, userId, rel.id, 'pending', {}, now);
    return { status: 'pending', draft_id: draft.id, skipped: slot.reason === 'daily_cap' ? 'daily_cap' : 'ai_error' };
  }

  try {
    const results: ProgramResults | null = rel.results ?? (await loadProgram(db, userId, rel.program_id))?.results ?? null;
    const prev = await loadProgram(db, userId, rel.program_id);
    if (!results || !prev) throw new Error('missing results');
    const ctx = await fetchWorkshopContext(db, userId, now);
    const seq = await loadCurrentSequence(db, userId);
    const system = buildRelaunchSystemPrompt(
      ctx,
      renderResultsForPrompt(prev.name, prev.goal, results),
      seq.items.map((i) => i.name),
      null,
    );
    const emitted: DraftRecord[] = [];
    const all = createWorkshopTools({
      db,
      userId,
      draftId: draft.id,
      getContext: async () => ctx,
      emitDraft: (d) => emitted.push(d),
    });
    // G-7 : pas de recherche web dans un tour automatique (cout/latence, aucun arbitrage utilisateur possible)
    const { workshop_web_search: _web, ...tools } = all;
    const out = await (deps.runner ?? defaultRelaunchRunner)({ system, prompt: RELAUNCH_USER_MESSAGE, tools });
    await settleCostSlot(db, slot.id, out.usage);
    const after = await loadDraft(db, userId, draft.id);
    if (!after?.program) {
      await setRelaunchStatus(db, userId, rel.id, 'pending', {}, now);
      return { status: 'pending', draft_id: draft.id, skipped: 'ai_error' };
    }
    if (draft.conversation_id) {
      const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: RELAUNCH_USER_MESSAGE }];
      if (out.text.trim()) msgs.push({ role: 'assistant', content: out.text.trim() });
      await deps.appendMessages(draft.conversation_id, msgs);
    }
    await setRelaunchStatus(db, userId, rel.id, 'proposed', { proposed_at: now.toISOString() }, now);
    return { status: 'proposed', draft_id: draft.id };
  } catch (err) {
    console.error('[relaunch propose] failed:', err instanceof Error ? err.message : err);
    await setRelaunchStatus(db, userId, rel.id, 'pending', {}, now);
    return { status: 'pending', draft_id: draft.id, skipped: 'ai_error' };
  }
}

export async function dismissRelaunch(db: WorkshopDb, userId: string, id: string): Promise<boolean> {
  const rel = await loadRelaunch(db, userId, id);
  if (!rel) return false;
  await setRelaunchStatus(db, userId, id, 'dismissed');
  return true;
}

/** Bloc de resultats ajoute au prompt des tours MANUELS (/stream) d'un brouillon issu d'une relance. */
export async function previousResultsBlock(db: WorkshopDb, userId: string, draft: DraftRecord): Promise<string | null> {
  if (!draft.previous_program_id) return null;
  const prev = await loadProgram(db, userId, draft.previous_program_id);
  if (!prev?.results) return null;
  return `## PREVIOUS PROGRAM RESULTS (this draft is the next phase of the sequence)\n${renderResultsForPrompt(prev.name, prev.goal, prev.results)}`;
}
