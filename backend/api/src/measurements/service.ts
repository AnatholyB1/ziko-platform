// v1.20 Phase 16 (MEAS-02/03/07/08/09) - outil de gestion des mesures et objectifs, cote backend.
//
// Appele par l'agent (chat, outil `measurements_goals`) et par l'onboarding (outil `set_measure_goal`).
// Credits : appel declenche par l'utilisateur, deja couvert par creditCheck/creditDeduct de la route de chat ;
// l'onboarding est un flux obligatoire non credite, journalise `onboarding_assess`. Aucun appel modele ici.
// Ecriture : uniquement par les RPC service_role (creation, modification encadree) ; la table reste en lecture
// seule pour les clients. Les regles pures sont dans ./rules.ts.
import { clientForUser } from '../tools/db.js';
import { createQuestFromChat } from '../quests/service.js';
import {
  MEASURE_KEYS,
  MEASURE_META,
  REVISION_REASONS,
  checkRevisionReason,
  progressFraction,
  validateNewGoal,
  type GoalForRules,
  type MeasureKey,
  type Reading,
} from './rules.js';

type Db = ReturnType<typeof clientForUser>;
export interface Deps {
  db?: Db;
  /** YYYY-MM-DD (injectable pour les tests). */
  today?: string;
}

const todayIso = () => new Date().toISOString().split('T')[0];

interface GoalRow {
  id: string;
  measure_key: MeasureKey;
  start_value: number | string;
  target_value: number | string;
  unit: string;
  status: string;
  start_date: string;
  target_date: string | null;
  achieved_at?: string | null;
}

function toRules(g: GoalRow): GoalForRules {
  return {
    measure_key: g.measure_key,
    start_value: Number(g.start_value),
    target_value: Number(g.target_value),
    start_date: g.start_date,
    target_date: g.target_date,
  };
}

function isMeasureKey(v: unknown): v is MeasureKey {
  return typeof v === 'string' && (MEASURE_KEYS as readonly string[]).includes(v);
}

async function latestValue(db: Db, userId: string, key: MeasureKey): Promise<{ date: string; value: number } | null> {
  const { data } = await db
    .from('ziko_body_measurements')
    .select(`date, ${key}`)
    .eq('user_id', userId)
    .not(key, 'is', null)
    .order('date', { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  return row ? { date: String(row.date), value: Number(row[key]) } : null;
}

async function readingsFor(db: Db, userId: string, key: MeasureKey, fromIso: string): Promise<Reading[]> {
  const { data } = await db
    .from('ziko_body_measurements')
    .select(`date, ${key}`)
    .eq('user_id', userId)
    .not(key, 'is', null)
    .gte('date', fromIso)
    .order('date', { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({ date: String(r.date), value: Number(r[key]) }));
}

async function activeGoal(db: Db, userId: string, params: Record<string, unknown>): Promise<GoalRow | null> {
  let q = db
    .from('ziko_athlete_goals')
    .select('id, measure_key, start_value, target_value, unit, status, start_date, target_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('measure_key', 'is', null);
  if (typeof params.goal_id === 'string') q = q.eq('id', params.goal_id);
  else if (isMeasureKey(params.measure_key)) q = q.eq('measure_key', params.measure_key);
  else return null;
  const { data } = await q.limit(1);
  return ((data ?? [])[0] as GoalRow | undefined) ?? null;
}

// ── list ────────────────────────────────────────────────────────────────

export async function listGoals(userId: string, deps: Deps = {}): Promise<unknown> {
  const db = deps.db ?? clientForUser();
  const { data: goals, error } = await db
    .from('ziko_athlete_goals')
    .select('id, measure_key, start_value, target_value, unit, status, start_date, target_date, achieved_at')
    .eq('user_id', userId)
    .not('measure_key', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (goals ?? []) as GoalRow[];
  const out = [];
  for (const g of rows) {
    const cur = g.status === 'active' ? await latestValue(db, userId, g.measure_key) : null;
    const pct =
      g.status === 'achieved' ? 100 : cur ? Math.min(99, Math.round(progressFraction(toRules(g), cur.value) * 100)) : 0;
    out.push({
      goal_id: g.id,
      measure: MEASURE_META[g.measure_key]?.label ?? g.measure_key,
      measure_key: g.measure_key,
      status: g.status,
      start_value: Number(g.start_value),
      target_value: Number(g.target_value),
      unit: g.unit,
      target_date: g.target_date,
      current_value: cur?.value ?? null,
      last_measured_on: cur?.date ?? null,
      progress_pct: pct,
    });
  }
  const { data: revs } = await db
    .from('ziko_goal_revisions')
    .select('goal_id, reason, old_target, new_target, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  return {
    goals: out,
    recent_revisions: revs ?? [],
    rules:
      'Un objectif en cours ne se modifie que pour : stagnation (>= 4 semaines), rythme trop rapide/lent, blessure/pause declaree, ou changement d\'objectif principal. Preveniens toujours la personne avec la raison.',
  };
}

// ── create (chat + onboarding) ─────────────────────────────────────────

export async function createGoal(userId: string, params: Record<string, unknown>, deps: Deps = {}): Promise<Record<string, unknown>> {
  const db = deps.db ?? clientForUser();
  const today = deps.today ?? todayIso();
  const key = params.measure_key;
  if (!isMeasureKey(key)) return { success: false, error: 'invalid_measure', hint: `measure_key parmi ${MEASURE_KEYS.join(', ')}` };
  const target = Number(params.target_value);
  let start = params.start_value == null ? NaN : Number(params.start_value);
  if (!Number.isFinite(start)) {
    const last = await latestValue(db, userId, key);
    if (!last) {
      return { success: false, error: 'start_value_required', hint: 'Aucune mesure enregistree : demande la valeur actuelle a la personne.' };
    }
    start = last.value;
  }
  const targetDate = typeof params.target_date === 'string' && params.target_date ? params.target_date : null;
  const invalid = validateNewGoal({ measure_key: key, start_value: start, target_value: target, target_date: targetDate }, today);
  if (invalid) return { success: false, error: invalid };

  const { data, error } = await db.rpc('ziko_ai_create_measurement_goal', {
    p_user_id: userId,
    p_measure_key: key,
    p_start_value: start,
    p_target_value: target,
    p_target_date: targetDate,
  });
  if (error) {
    console.error('[Measurements] create goal failed:', error.message);
    return { success: false, error: 'unavailable' };
  }
  const res = (data ?? {}) as { success?: boolean; goal_id?: string; error?: string };
  if (!res.success) return { success: false, error: res.error ?? 'unavailable' };
  const meta = MEASURE_META[key];
  return {
    success: true,
    goal_id: res.goal_id,
    goal: { measure_key: key, measure: meta.label, start_value: start, target_value: target, unit: meta.unit, target_date: targetDate },
    note: "L'objectif est enregistre ; la personne ne peut plus le modifier elle-meme tant qu'il est en cours.",
  };
}

// ── revise (MEAS-07 / MEAS-08) ─────────────────────────────────────────

const REVISION_MESSAGES: Record<string, string> = {
  revision_too_soon: 'Une modification a deja eu lieu il y a moins de 14 jours : pas de nouvelle modification pour le moment.',
  direction_change_not_allowed: "Le sens de l'objectif (baisse/hausse) ne change que pour un changement d'objectif principal.",
  goal_not_found_or_inactive: 'Aucun objectif de mesure en cours correspondant.',
  no_change: 'La cible et la date proposees sont identiques a celles en cours.',
  out_of_range: 'Cible hors de la plage plausible pour cette mesure.',
  target_equals_start: 'La cible doit etre differente du point de depart.',
  target_date_in_past: 'La date cible doit etre dans le futur.',
  reason_not_allowed: `Motif non autorise : ${REVISION_REASONS.join(', ')} uniquement.`,
  user_statement_required: "Reprends la phrase de l'utilisateur dans user_statement.",
};

export async function reviseGoal(userId: string, params: Record<string, unknown>, deps: Deps = {}): Promise<Record<string, unknown>> {
  const db = deps.db ?? clientForUser();
  const today = deps.today ?? todayIso();
  const reason = String(params.reason ?? '');
  const goal = await activeGoal(db, userId, params);
  if (!goal) return { success: false, error: 'goal_not_found_or_inactive', hint: REVISION_MESSAGES.goal_not_found_or_inactive };

  const newTarget = params.new_target_value == null ? null : Number(params.new_target_value);
  const newDate = typeof params.new_target_date === 'string' && params.new_target_date ? params.new_target_date : null;
  if ((newTarget == null || !Number.isFinite(newTarget)) && !newDate) {
    return { success: false, error: 'nothing_to_change', hint: 'Fournis new_target_value et/ou new_target_date.' };
  }
  if (newDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return { success: false, error: 'invalid_date' };

  const readings = await readingsFor(db, userId, goal.measure_key, goal.start_date);
  const verdict = checkRevisionReason({
    reason,
    goal: toRules(goal),
    readings,
    today,
    userStatement: typeof params.user_statement === 'string' ? params.user_statement : null,
  });
  if (!verdict.allowed) {
    return { success: false, error: 'reason_not_met', code: verdict.code, detail: verdict.detail, hint: 'Ne modifie pas l\'objectif ; explique-le a la personne si besoin.' };
  }

  const { data, error } = await db.rpc('ziko_ai_revise_measurement_goal', {
    p_user_id: userId,
    p_goal_id: goal.id,
    p_reason: reason,
    p_new_target: newTarget != null && Number.isFinite(newTarget) ? newTarget : null,
    p_new_target_date: newDate,
    p_reason_detail: verdict.detail,
    p_user_statement: typeof params.user_statement === 'string' ? params.user_statement : null,
  });
  if (error) {
    console.error('[Measurements] revise goal failed:', error.message);
    return { success: false, error: 'unavailable' };
  }
  const res = (data ?? {}) as Record<string, unknown>;
  if (!res.success) {
    const code = String(res.error ?? 'unavailable');
    return { success: false, error: code, hint: REVISION_MESSAGES[code] };
  }
  return {
    success: true,
    revision_id: res.revision_id,
    goal_id: goal.id,
    measure: MEASURE_META[goal.measure_key].label,
    old_target: res.old_target,
    new_target: res.new_target,
    old_target_date: res.old_target_date ?? null,
    new_target_date: res.new_target_date ?? null,
    reason,
    reason_detail: verdict.detail,
    must_tell_user:
      "OBLIGATOIRE : annonce a la personne dans ta reponse que tu as ajuste son objectif, avec l'ancienne et la nouvelle cible et la raison (en francais, ton bienveillant). Une banniere l'en informe aussi dans l'onglet Objectifs.",
  };
}

// ── quest coupling (MEAS-09) ───────────────────────────────────────────

export async function createGoalQuest(userId: string, params: Record<string, unknown>, deps: Deps = {}): Promise<unknown> {
  const db = deps.db ?? clientForUser();
  const goal = await activeGoal(db, userId, params);
  if (!goal) return { success: false, error: 'goal_not_found_or_inactive', hint: REVISION_MESSAGES.goal_not_found_or_inactive };
  const meta = MEASURE_META[goal.measure_key];
  const scope = params.scope === 'daily' ? 'daily' : 'weekly';
  const target = Number.isFinite(Number(params.target)) && Number(params.target) > 0 ? Number(params.target) : scope === 'daily' ? 1 : 2;
  return createQuestFromChat(
    userId,
    {
      title: typeof params.title === 'string' && params.title.trim() ? params.title : `Mets à jour : ${meta.label.toLowerCase()}`,
      description: `Enregistre une mesure pour suivre ton objectif (${meta.label}).`,
      icon: 'body',
      metric: 'measurement_logs',
      target,
      scope,
      duration_hours: Number(params.duration_hours) || (scope === 'daily' ? 24 : 168),
      reward_coins: Number(params.reward_coins) || (scope === 'daily' ? 15 : 40),
    },
    { db, meta: { source: 'measurement_goal', goal_id: goal.id, measure_key: goal.measure_key } },
  );
}

// ── dispatch de l'outil de l'agent ─────────────────────────────────────

export async function manageMeasurementGoals(params: Record<string, unknown>, userId: string, deps: Deps = {}): Promise<unknown> {
  switch (params.action) {
    case 'list':
      return listGoals(userId, deps);
    case 'create':
      return createGoal(userId, params, deps);
    case 'revise':
      return reviseGoal(userId, params, deps);
    case 'quest':
      return createGoalQuest(userId, params, deps);
    default:
      return { success: false, error: 'invalid_action', hint: 'action parmi list, create, revise, quest' };
  }
}
