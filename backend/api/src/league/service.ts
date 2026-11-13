// v1.20 Phase 26 (LEAG-03) - orchestration de la Ligue cote backend.
//
// refreshLeague : 1) cloture les semaines echues (ziko_league_sync, deterministe, en base) ; 2) si la personne est
// eligible a la transition Habitudes -> Performance, reserve UN appel IA (ziko_league_ai_claim : pre-filtre + plafond
// quotidien) ; 3) le modele decide sur un contexte BORNE ; 4) la base re-verifie le pre-filtre et applique.
// Le cout est ABSORBE par la plateforme : aucun creditCheck/creditDeduct, journalise dans ziko_ai_cost_log (source
// 'league_transition'), meme en cas d'echec. Un echec du modele ne change rien (on reste en piste Habitudes).
import { generateObject } from 'ai';
import { z } from 'zod';
import { AGENT_MODEL } from '../config/models.js';
import { logAutonomousCost, SOURCES } from '../lib/autonomousCost.js';
import { clientForUser } from '../tools/db.js';
import {
  LEAGUE_AI_DAILY_CAP,
  LEAGUE_SYSTEM_PROMPT,
  buildTransitionPrompt,
  normalizeDecision,
  parseClaim,
} from './rules.js';

type Db = ReturnType<typeof clientForUser>;

/** Point d'injection des tests : le vrai appel est generateObject (jamais appele par les tests). */
export interface TransitionGenerator {
  (args: { system: string; prompt: string }): Promise<{ object: unknown; usage?: { inputTokens?: number; outputTokens?: number } }>;
}

const DecisionZod = z.object({
  transition: z.boolean().describe('true = passer en piste Performance'),
  reason: z.string().describe('Une phrase en français, bienveillante, sur sa régularité (max 200 caractères)'),
});

const defaultGenerator: TransitionGenerator = async ({ system, prompt }) => {
  const { object, usage } = await generateObject({ model: AGENT_MODEL, temperature: 0, schema: DecisionZod, system, prompt });
  return { object, usage };
};

export type AiOutcome =
  | { ai: 'skipped'; reason: string }
  | { ai: 'declined' }
  | { ai: 'applied'; transition_id: string | null }
  | { ai: 'error'; reason: 'generation_failed' | 'apply_failed' };

export type LeagueRefreshOutcome =
  | ({ status: 'ok'; league: Record<string, unknown> } & AiOutcome)
  | { status: 'error'; reason: 'sync_failed' };

export interface RefreshDeps {
  db?: Db;
  generate?: TransitionGenerator;
}

async function syncLeague(db: Db, userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.rpc('ziko_league_sync', { p_user: userId });
  if (error || !data || typeof data !== 'object') {
    console.error('[League] sync failed:', error?.message);
    return null;
  }
  return data as Record<string, unknown>;
}

export async function refreshLeague(userId: string, deps: RefreshDeps = {}): Promise<LeagueRefreshOutcome> {
  const db = deps.db ?? clientForUser();
  const league = await syncLeague(db, userId);
  if (!league) return { status: 'error', reason: 'sync_failed' };
  if (league.unlocked !== true) return { status: 'ok', league, ai: 'skipped', reason: 'locked' };

  const claimRes = await db.rpc('ziko_league_ai_claim', { p_user: userId, p_daily_cap: LEAGUE_AI_DAILY_CAP });
  if (claimRes.error) {
    console.error('[League] claim failed:', claimRes.error.message);
    return { status: 'ok', league, ai: 'skipped', reason: 'claim_failed' };
  }
  const claim = parseClaim(claimRes.data);
  if (!claim) return { status: 'ok', league, ai: 'skipped', reason: 'claim_invalid' };
  if (!claim.proceed || !claim.evidence) return { status: 'ok', league, ai: 'skipped', reason: claim.reason };

  const generate = deps.generate ?? defaultGenerator;
  let object: unknown;
  let usage: { inputTokens?: number; outputTokens?: number } | undefined;
  try {
    ({ object, usage } = await generate({ system: LEAGUE_SYSTEM_PROMPT, prompt: buildTransitionPrompt(claim.evidence) }));
  } catch (err) {
    console.error('[League] generation failed:', err);
    // Tentative journalisee meme en echec : trace du quota consomme.
    logAutonomousCost(db, { userId, model: AGENT_MODEL.modelId, usage: null, source: SOURCES.leagueTransition });
    return { status: 'ok', league, ai: 'error', reason: 'generation_failed' };
  }
  logAutonomousCost(db, {
    userId,
    model: AGENT_MODEL.modelId,
    usage: { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
    source: SOURCES.leagueTransition,
  });

  const decision = normalizeDecision(object);
  if (!decision || !decision.transition) return { status: 'ok', league, ai: 'declined' };

  const applied = await db.rpc('ziko_league_apply_transition', { p_user: userId, p_reason: decision.reason });
  const res = (applied.data ?? {}) as { applied?: boolean; id?: string };
  if (applied.error) {
    console.error('[League] apply failed:', applied.error.message);
    return { status: 'ok', league, ai: 'error', reason: 'apply_failed' };
  }
  if (res.applied !== true) return { status: 'ok', league, ai: 'declined' };

  // Etat frais (piste performance + celebration en attente) pour que l'ecran reagisse sans second aller-retour.
  const fresh = (await syncLeague(db, userId)) ?? league;
  return { status: 'ok', league: fresh, ai: 'applied', transition_id: res.id ?? null };
}
