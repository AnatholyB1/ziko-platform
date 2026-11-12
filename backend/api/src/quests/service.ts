// v1.20 Phase 14 (QUEST-03..08) - orchestration des quetes IA cote backend.
//
// Deux portes d'entree, une seule logique de plafond (en base) :
//  - refreshQuestsAuto : appel AUTOMATIQUE (passage de niveau, plus aucune quete). Pas de credit : la plateforme
//    absorbe le cout, borne par un quota quotidien (ziko_quest_ai_claim) et journalise dans ziko_ai_cost_log
//    (source 'quest_generation'), meme si l'appel echoue.
//  - createQuestFromChat / listQuestsForChat : outils de l'agent, deja couverts par creditCheck/creditDeduct('chat')
//    de la route de conversation (appel declenche par l'utilisateur).
// L'utilisateur ne peut ni refuser ni supprimer une quete (QUEST-06) : aucune fonction de suppression n'existe,
// la table est en SELECT seul pour les clients, et ces fonctions n'ecrivent qu'en service_role.
import { generateObject } from 'ai';
import { z } from 'zod';
import { AGENT_MODEL } from '../config/models.js';
import { logAutonomousCost, SOURCES } from '../lib/autonomousCost.js';
import { clientForUser } from '../tools/db.js';
import {
  AUTO_GENERATION_DAILY_CAP,
  DURATION_HOURS,
  MAX_ACTIVE_QUESTS,
  METRIC_RULES,
  QUEST_METRICS,
  REWARD_COINS,
  describeQuest,
  normalizeProposal,
  normalizeProposals,
  parseClaim,
  type ClaimResult,
  type QuestMetric,
  type QuestProposal,
  type QuestRow,
} from './rules.js';

type Db = ReturnType<typeof clientForUser>;

/** Metrique -> plugin qui l'alimente (workout_sessions : fonction de base, toujours disponible). */
const METRIC_PLUGIN: Record<QuestMetric, string | null> = {
  workout_sessions: null,
  hydration_ml: 'hydration',
  nutrition_logs: 'nutrition',
  habit_logs: 'habits',
};

/** Metriques proposables a cette personne : on ne lui demande pas de logger de l'eau sans le plugin Hydratation. */
export function allowedMetrics(installedPlugins: readonly string[]): QuestMetric[] {
  return QUEST_METRICS.filter((m) => {
    const p = METRIC_PLUGIN[m];
    return p === null || installedPlugins.includes(p);
  });
}

export interface QuestIdentity {
  name: string | null;
  goal: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  level: number;
  readiness: string | null;
  focus: string | null;
  onboarding: Record<string, unknown> | null;
  plugins: string[];
  history: Array<{ title: string; status: string; scope: string }>;
}

/** Identite de la personne (QUEST-08) : profil, etat coaching, niveau, plugins actifs, quetes recentes. */
export async function loadIdentity(db: Db, userId: string): Promise<QuestIdentity> {
  const [profile, athlete, gami, plugins, hist] = await Promise.all([
    db.from('ziko_user_profiles').select('name, goal, age, weight_kg, height_cm').eq('id', userId).maybeSingle(),
    db
      .from('ziko_athlete_state')
      .select('readiness, current_focus_summary, onboarding_profile')
      .eq('user_id', userId)
      .maybeSingle(),
    db.from('ziko_user_gamification').select('level').eq('user_id', userId).maybeSingle(),
    db.from('ziko_user_plugins').select('plugin_id').eq('user_id', userId).eq('is_enabled', true),
    db
      .from('ziko_user_quests')
      .select('title, status, scope')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  const p = (profile.data ?? {}) as Record<string, any>;
  const a = (athlete.data ?? {}) as Record<string, any>;
  return {
    name: p.name ?? null,
    goal: p.goal ?? null,
    age: p.age ?? null,
    weight_kg: p.weight_kg ?? null,
    height_cm: p.height_cm ?? null,
    level: Number((gami.data as any)?.level ?? 1),
    readiness: a.readiness ?? null,
    focus: a.current_focus_summary ?? null,
    onboarding: a.onboarding_profile && Object.keys(a.onboarding_profile).length ? a.onboarding_profile : null,
    plugins: ((plugins.data ?? []) as Array<{ plugin_id: string }>).map((r) => r.plugin_id),
    history: ((hist.data ?? []) as Array<{ title: string; status: string; scope: string }>).map((r) => ({
      title: r.title,
      status: r.status,
      scope: r.scope,
    })),
  };
}

// ── Generation automatique ─────────────────────────────────────────────

const GeneratedZod = z.object({
  quests: z.array(
    z.object({
      title: z.string().describe('Titre court en français, ton encourageant'),
      description: z.string().optional().describe('Une phrase en français'),
      icon: z.string().optional().describe('Nom Ionicons en minuscules avec tirets (ex. water, barbell), jamais un emoji'),
      metric: z.enum(QUEST_METRICS),
      target: z.number(),
      scope: z.enum(['daily', 'weekly']),
      duration_hours: z.number().describe('Durée limite en heures'),
      reward_coins: z.number(),
    }),
  ),
});

export const QUEST_GENERATION_SYSTEM_PROMPT =
  "Tu proposes de nouvelles quêtes personnalisées à une personne qui s'entraîne, dans l'application Ziko. " +
  'Chaque quête mesure une métrique réelle (liste imposée), a une cible atteignable pour CETTE personne, ' +
  'une durée limite et une petite récompense en pièces. Ton bienveillant, jamais culpabilisant : une quête non ' +
  'terminée n\'entraîne aucune pénalité. Varie les métriques, évite de répéter les quêtes récentes, adapte la ' +
  "difficulté à son niveau, son objectif et son historique (si elle réussit tout, monte un peu ; si elle laisse " +
  'expirer, baisse). Réponds uniquement avec la structure demandée.';

export function buildGenerationPrompt(identity: QuestIdentity, slots: number, reason: string, metrics: QuestMetric[]): string {
  const lines = [
    `declencheur: ${reason}`,
    `nombre_de_quetes_a_creer: ${slots} (maximum ${MAX_ACTIVE_QUESTS} actives en tout)`,
    `niveau: ${identity.level}`,
    `objectif: ${identity.goal ?? 'non renseigné'}`,
    `age: ${identity.age ?? 'non renseigné'}; poids_kg: ${identity.weight_kg ?? 'non renseigné'}; taille_cm: ${identity.height_cm ?? 'non renseignée'}`,
    `focus_coaching: ${identity.focus ?? 'aucun'}; disposition: ${identity.readiness ?? 'inconnue'}`,
    `profil_onboarding: ${identity.onboarding ? JSON.stringify(identity.onboarding).slice(0, 600) : 'aucun'}`,
    'metriques_autorisees:',
    ...metrics.map((m) => {
      const r = METRIC_RULES[m];
      return `  - ${m} (${r.label}) cible ${r.min}..${r.max} ${r.unit}`;
    }),
    `durees: daily ${DURATION_HOURS.daily.min}..${DURATION_HOURS.daily.max} h, weekly ${DURATION_HOURS.weekly.min}..${DURATION_HOURS.weekly.max} h`,
    `pieces: daily ${REWARD_COINS.daily.min}..${REWARD_COINS.daily.max}, weekly ${REWARD_COINS.weekly.min}..${REWARD_COINS.weekly.max}`,
    'quetes_recentes (ne pas répéter, ajuster la difficulté):',
    ...(identity.history.length ? identity.history.map((h) => `  - ${h.title} [${h.scope}, ${h.status}]`) : ['  (aucune)']),
  ];
  return lines.join('\n');
}

/** Point d'injection des tests : le vrai appel est generateObject (jamais appele par les tests). */
export interface QuestGenerator {
  (args: { system: string; prompt: string }): Promise<{ object: unknown; usage?: { inputTokens?: number; outputTokens?: number } }>;
}

const defaultGenerator: QuestGenerator = async ({ system, prompt }) => {
  const { object, usage } = await generateObject({ model: AGENT_MODEL, temperature: 0.7, schema: GeneratedZod, system, prompt });
  return { object, usage };
};

export type RefreshOutcome =
  | { status: 'created'; reason: string; created: number; skipped: number; level: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; reason: 'claim_failed' | 'generation_failed' | 'create_failed' };

export interface RefreshDeps {
  db?: Db;
  generate?: QuestGenerator;
}

export async function claimGeneration(db: Db, userId: string, force: boolean): Promise<ClaimResult | null> {
  const { data, error } = await db.rpc('ziko_quest_ai_claim', {
    p_user_id: userId,
    p_daily_cap: AUTO_GENERATION_DAILY_CAP,
    p_force: force,
  });
  if (error) {
    console.error('[Quests] claim failed:', error.message);
    return null;
  }
  return parseClaim(data);
}

async function insertCapped(db: Db, userId: string, proposals: QuestProposal[]): Promise<{ created: number; skipped: number } | null> {
  const { data, error } = await db.rpc('ziko_create_ai_quests', { p_user_id: userId, p_quests: proposals });
  if (error) {
    console.error('[Quests] create failed:', error.message);
    return null;
  }
  const d = (data ?? {}) as { created?: unknown[]; skipped?: number };
  return { created: Array.isArray(d.created) ? d.created.length : 0, skipped: Number(d.skipped ?? 0) };
}

/**
 * Generation automatique : appelee par l'app a l'ouverture de l'onglet Quetes / apres un gain de niveau.
 * Le declenchement est decide cote serveur (jamais confie au client) : un appel sans raison de generer
 * (`not_needed`, `full`, `daily_cap`...) ne coute rien.
 */
export async function refreshQuestsAuto(userId: string, deps: RefreshDeps = {}): Promise<RefreshOutcome> {
  const db = deps.db ?? clientForUser();
  const claim = await claimGeneration(db, userId, false);
  if (!claim) return { status: 'error', reason: 'claim_failed' };
  if (!claim.proceed) return { status: 'skipped', reason: claim.reason };

  const identity = await loadIdentity(db, userId);
  const metrics = allowedMetrics(identity.plugins);
  const prompt = buildGenerationPrompt(identity, claim.slots, claim.reason, metrics);
  const generate = deps.generate ?? defaultGenerator;

  let object: unknown;
  let usage: { inputTokens?: number; outputTokens?: number } | undefined;
  try {
    ({ object, usage } = await generate({ system: QUEST_GENERATION_SYSTEM_PROMPT, prompt }));
  } catch (err) {
    console.error('[Quests] generation failed:', err);
    // Tentative journalisee meme en echec (cout nul connu) : trace du quota consomme.
    logAutonomousCost(db, { userId, model: AGENT_MODEL.modelId, usage: null, source: SOURCES.questGeneration });
    return { status: 'error', reason: 'generation_failed' };
  }
  logAutonomousCost(db, {
    userId,
    model: AGENT_MODEL.modelId,
    usage: { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
    source: SOURCES.questGeneration,
  });

  const raw = (object as { quests?: unknown } | null)?.quests;
  const meta = { trigger: claim.reason, level: claim.level, model: 'agent', generated_at: new Date().toISOString() };
  const proposals = normalizeProposals(raw, claim.slots, meta).filter((p) => metrics.includes(p.metric));
  if (proposals.length === 0) return { status: 'error', reason: 'generation_failed' };

  const res = await insertCapped(db, userId, proposals);
  if (!res) return { status: 'error', reason: 'create_failed' };
  return { status: 'created', reason: claim.reason, created: res.created, skipped: res.skipped, level: claim.level };
}

// ── Outils de l'agent (appel declenche par l'utilisateur) ──────────────

export async function listQuestsForChat(userId: string, deps: { db?: Db; now?: Date } = {}): Promise<unknown> {
  const db = deps.db ?? clientForUser();
  const now = deps.now ?? new Date();
  const { data, error } = await db
    .from('ziko_user_quests')
    .select('title, scope, metric, target, progress, unit, status, expires_at, reward_coins')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as QuestRow[];
  const live = rows.filter((r) => r.status === 'active' && new Date(r.expires_at) > now);
  return {
    active_count: live.length,
    free_slots: Math.max(0, MAX_ACTIVE_QUESTS - live.length),
    max_active: MAX_ACTIVE_QUESTS,
    quests: rows.map((r) => describeQuest(r, now)),
    note: 'Une quête non terminée est affichée neutre (Non terminée), sans pénalité. Le joueur ne peut pas refuser une quête.',
  };
}

export async function createQuestFromChat(
  userId: string,
  params: Record<string, unknown>,
  deps: { db?: Db } = {},
): Promise<unknown> {
  const db = deps.db ?? clientForUser();
  const proposal = normalizeProposal(params, { trigger: 'chat', model: 'agent', generated_at: new Date().toISOString() });
  if (!proposal) {
    return { success: false, error: 'invalid_quest', hint: `metric parmi ${QUEST_METRICS.join(', ')}, titre et cible > 0 requis` };
  }
  const identity = await loadIdentity(db, userId);
  if (!allowedMetrics(identity.plugins).includes(proposal.metric)) {
    return { success: false, error: 'metric_unavailable', hint: 'Le plugin qui mesure cette métrique n\'est pas activé pour cette personne.' };
  }
  const claim = await claimGeneration(db, userId, true);
  if (!claim) return { success: false, error: 'unavailable' };
  if (!claim.proceed) {
    return {
      success: false,
      error: 'max_active_quests',
      active_count: claim.active,
      max_active: MAX_ACTIVE_QUESTS,
      hint: 'Déjà 3 quêtes actives : une nouvelle quête sera possible quand une se termine ou expire.',
    };
  }
  const res = await insertCapped(db, userId, [proposal]);
  if (!res) return { success: false, error: 'unavailable' };
  if (res.created === 0) return { success: false, error: 'max_active_quests', max_active: MAX_ACTIVE_QUESTS };
  return {
    success: true,
    quest: { title: proposal.title, scope: proposal.scope, metric: proposal.metric, target: proposal.target, duration_hours: proposal.duration_hours, reward_coins: proposal.reward_coins },
    free_slots_left: Math.max(0, claim.slots - res.created),
    note: 'La quête a une durée limite et ne peut pas être refusée ; si elle expire, elle reste visible Non terminée, sans pénalité.',
  };
}
