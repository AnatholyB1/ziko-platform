// v1.20 Phase 14 (QUEST-03..08) - regles pures des quetes IA (aucune I/O, aucune horloge, aucun modele).
//
// Tout ce qui est borne vit ici : la liste blanche de metriques (miroir du CHECK SQL de la phase 13),
// les plages de cible / duree / recompense, et la normalisation d'une proposition (du modele ou du chat).
// Le plafond de 3 quetes actives est applique en base (ziko_create_ai_quests, sous verrou) ; MAX_ACTIVE_QUESTS
// n'est qu'une copie pour les prompts et les messages.

export const MAX_ACTIVE_QUESTS = 3;
/** Appels IA automatiques (niveau / plus de quete) absorbes par la plateforme : plafond par jour et par personne. */
export const AUTO_GENERATION_DAILY_CAP = 2;

export const QUEST_METRICS = ['workout_sessions', 'hydration_ml', 'nutrition_logs', 'habit_logs', 'measurement_logs'] as const;
export type QuestMetric = (typeof QUEST_METRICS)[number];
export type QuestScope = 'daily' | 'weekly';

interface MetricRule {
  min: number;
  max: number;
  unit: string;
  label: string;
}

/** Plages de cible par metrique (reglage unique : pas de valeur codee ailleurs). */
export const METRIC_RULES: Record<QuestMetric, MetricRule> = {
  workout_sessions: { min: 1, max: 6, unit: 'séances', label: 'séances d\'entraînement terminées (au moins une série)' },
  hydration_ml: { min: 500, max: 4000, unit: 'ml', label: 'eau bue, en millilitres' },
  nutrition_logs: { min: 1, max: 6, unit: 'repas', label: 'repas enregistrés' },
  habit_logs: { min: 1, max: 10, unit: 'habitudes', label: 'habitudes cochées' },
  // v1.20 P16 (MEAS-09) : saisies de mesures corporelles (quête liée à un objectif de mesure).
  measurement_logs: { min: 1, max: 7, unit: 'mesures', label: 'saisies de mesures corporelles' },
};

/** Duree limite (QUEST-06) : toujours presente, bornee selon la portee. */
export const DURATION_HOURS: Record<QuestScope, { min: number; max: number; default: number }> = {
  daily: { min: 12, max: 48, default: 24 },
  weekly: { min: 72, max: 336, default: 168 },
};

/** Recompense en pieces, bornee par portee (la base accepte 0..500 : on reste bien en dessous). */
export const REWARD_COINS: Record<QuestScope, { min: number; max: number; default: number }> = {
  daily: { min: 5, max: 40, default: 15 },
  weekly: { min: 20, max: 120, default: 50 },
};

export const DEFAULT_ICON = 'flag';

export interface QuestProposal {
  title: string;
  description?: string;
  icon?: string;
  metric: QuestMetric;
  target: number;
  unit?: string;
  scope: QuestScope;
  duration_hours: number;
  reward_coins: number;
  ai_meta?: Record<string, unknown>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
}

/** Icone = nom Ionicons (jamais un emoji) : on ne garde que [a-z0-9-]. */
export function sanitizeIcon(v: unknown): string {
  return typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 40 ? v : DEFAULT_ICON;
}

/**
 * Normalise une proposition brute (sortie du modele ou parametres de l'outil de chat).
 * Renvoie null si elle est inexploitable (titre vide, metrique hors liste blanche, cible non numerique) :
 * jamais de valeur inventee pour une donnee essentielle. Les plages (cible, duree, pieces) sont recadrees.
 */
export function normalizeProposal(raw: unknown, meta?: Record<string, unknown>): QuestProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 60);
  const metric = r.metric as QuestMetric;
  if (!title || !QUEST_METRICS.includes(metric)) return null;
  const targetNum = Number(r.target);
  if (!Number.isFinite(targetNum) || targetNum <= 0) return null;
  const scope: QuestScope = r.scope === 'daily' ? 'daily' : 'weekly';
  const rule = METRIC_RULES[metric];
  const target = metric === 'hydration_ml' ? Math.round(clamp(targetNum, rule.min, rule.max) / 50) * 50 : Math.round(clamp(targetNum, rule.min, rule.max));
  const dur = DURATION_HOURS[scope];
  const hoursNum = Number(r.duration_hours);
  const duration_hours = Number.isFinite(hoursNum) && hoursNum > 0 ? Math.round(clamp(hoursNum, dur.min, dur.max)) : dur.default;
  const rew = REWARD_COINS[scope];
  const rewardNum = Number(r.reward_coins);
  const reward_coins = Number.isFinite(rewardNum) ? Math.round(clamp(rewardNum, rew.min, rew.max)) : rew.default;
  return {
    title,
    description: str(r.description, 160),
    icon: sanitizeIcon(r.icon),
    metric,
    target,
    unit: str(r.unit, 16) ?? rule.unit,
    scope,
    duration_hours,
    reward_coins,
    ...(meta ? { ai_meta: meta } : {}),
  };
}

/**
 * Normalise une liste : ignore les entrees invalides, une seule quete par couple (metrique, portee)
 * (variete), et ne garde que `max` elements.
 */
export function normalizeProposals(raw: unknown, max: number, meta?: Record<string, unknown>): QuestProposal[] {
  if (!Array.isArray(raw) || max <= 0) return [];
  const seen = new Set<string>();
  const out: QuestProposal[] = [];
  for (const item of raw) {
    const p = normalizeProposal(item, meta);
    if (!p) continue;
    const key = `${p.metric}:${p.scope}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export type ClaimReason =
  | 'requested'
  | 'no_quest'
  | 'level_up'
  | 'full'
  | 'not_needed'
  | 'not_initialized'
  | 'daily_cap';

export interface ClaimResult {
  proceed: boolean;
  reason: ClaimReason;
  slots: number;
  level: number;
  active: number;
}

export function parseClaim(data: unknown): ClaimResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.proceed !== 'boolean' || typeof d.reason !== 'string') return null;
  return {
    proceed: d.proceed,
    reason: d.reason as ClaimReason,
    slots: Number(d.slots ?? 0),
    level: Number(d.level ?? 1),
    active: Number(d.active ?? 0),
  };
}

/** Libelle neutre d'une quete echue (v1.18, D-04 phase 13) : jamais « echec », « perdu » ou une penalite. */
export const EXPIRED_LABEL = 'Non terminée';

export interface QuestRow {
  title: string;
  scope: string;
  metric: string;
  target: number;
  progress: number;
  unit: string | null;
  status: 'active' | 'completed' | 'expired';
  expires_at: string;
  reward_coins: number;
}

/** Vue lisible par l'agent : statut neutre pour les quetes echues, duree restante pour les actives. */
export function describeQuest(q: QuestRow, now: Date): Record<string, unknown> {
  const msLeft = new Date(q.expires_at).getTime() - now.getTime();
  const base = {
    title: q.title,
    scope: q.scope,
    metric: q.metric,
    progress: `${q.progress}/${q.target}${q.unit ? ` ${q.unit}` : ''}`,
    reward_coins: q.reward_coins,
  };
  if (q.status === 'active' && msLeft > 0) {
    return { ...base, status: 'active', hours_left: Math.max(1, Math.round(msLeft / 3_600_000)) };
  }
  if (q.status === 'completed') return { ...base, status: 'completed' };
  // `active` mais echue (pas encore synchronisee) ou `expired` : meme libelle neutre, sans penalite.
  return { ...base, status: 'not_completed', label: EXPIRED_LABEL, penalty: 'none' };
}
