// Logique pure du bloc « Quetes du jour » de l'accueil (v1.21 phase 1, contrat de design 01-DESIGN-CONTRACT.md).
// Aucune dependance React / native : testable en node. Les donnees viennent de `ziko_sync_quests` (parseQuestSync).
import { MAX_ACTIVE_QUESTS, type Quest, type QuestCompletion } from '@ziko/plugin-gamification/quests';
import { isPluginRouteLocked } from '@ziko/plugin-sdk';

/** Niveau a partir duquel les pieces (boutique) sont montrees : D-05. */
export const COINS_VISIBLE_LEVEL = 3;
/** Delai avant d'ajouter « Reessayer » a l'etat « Tes quetes se preparent » (contrat §5, etat 6). */
export const CREATING_RETRY_MS = 10_000;

export interface QuestAction {
  /** Verbe du bouton (§4). */
  verb: string;
  /** Route expo-router ; validee par isPluginRouteLocked avant affichage. */
  route: string;
  /** Libelle d'accessibilite du bouton (§8). */
  a11yLabel: string;
  /** Rang d'ordre : eau, repas, seance (CLAR-03 : l'eau d'abord). */
  rank: number;
  /** Action concrete sous le titre (QNEW-04). */
  actionText: string;
}

/** Table metrique -> destination. Toute route doit rester ouverte au niveau 1 (A5, test unitaire). */
export const QUEST_ACTIONS: Record<string, QuestAction> = {
  hydration_ml: {
    verb: 'Boire', route: '/(plugins)/hydration/dashboard', a11yLabel: "Boire de l'eau, ouvrir Hydratation",
    rank: 0, actionText: 'Ajoute chaque verre dans Hydratation.',
  },
  nutrition_logs: {
    verb: 'Ajouter', route: '/(plugins)/nutrition/log', a11yLabel: 'Ajouter un repas, ouvrir Nutrition',
    rank: 1, actionText: 'Note ton premier repas dans Nutrition.',
  },
  workout_sessions: {
    verb: 'Séance', route: '/(app)/workout', a11yLabel: "Lancer une séance, ouvrir l'onglet Séance",
    rank: 2, actionText: "Lance une séance depuis l'onglet Séance.",
  },
  habit_logs: {
    verb: 'Cocher', route: '/(plugins)/habits/dashboard', a11yLabel: 'Cocher une habitude, ouvrir Habitudes',
    rank: 3, actionText: 'Coche tes habitudes du jour.',
  },
};

/** Libelles de bienvenue (contrat §6) pour les quetes de depart, y compris les instances deja creees. */
const STARTER_COPY: Record<string, { title: string; actionText?: string }> = {
  starter_daily_water: { title: "Bois 2 litres d'eau" },
  starter_daily_meal: { title: 'Ajoute un repas' },
  starter_daily_workout: { title: 'Termine une séance' },
};

export interface HomeQuest {
  quest: Quest;
  title: string;
  /** Action concrete : description serveur d'une quete IA, sinon texte de la table. */
  actionText: string;
  action: QuestAction;
  done: boolean;
}

export function questAction(q: Pick<Quest, 'metric'>, level: number): QuestAction | null {
  const a = QUEST_ACTIONS[q.metric];
  if (!a) return null;
  // Filet de securite QNEW-05 : jamais de CTA vers un ecran verrouille (le garde de route le renverrait a l'accueil).
  return isPluginRouteLocked(a.route.split('/'), level) ? null : a;
}

/** Ordre stable pendant la session : les lignes deja vues gardent leur place (pas de saut de mise en page). */
export function orderQuests(quests: Quest[], previousOrder: string[] = []): Quest[] {
  const known = new Map(previousOrder.map((id, i) => [id, i] as const));
  const rank = (q: Quest, i: number): [number, number, number, number] => {
    const k = known.get(q.id);
    if (k !== undefined) return [0, k, 0, 0];
    const done = q.status === 'completed' ? 1 : 0;
    return [1, done * 2 + (q.scope === 'weekly' ? 1 : 0), QUEST_ACTIONS[q.metric]?.rank ?? 9, i];
  };
  return quests
    .map((q, i) => ({ q, r: rank(q, i) }))
    .sort((a, b) => {
      for (let k = 0; k < 4; k++) if (a.r[k] !== b.r[k]) return a.r[k] - b.r[k];
      return 0;
    })
    .map((x) => x.q);
}

/**
 * Quetes affichees : jamais « expired » (QNEW-07), jamais de CTA verrouille (QNEW-05), au plus MAX_ACTIVE_QUESTS,
 * quetes deja vues en tete dans leur ordre, nouvelles : actives d'abord (eau, repas, seance).
 */
export function visibleHomeQuests(quests: Quest[], level: number, previousOrder: string[] = []): HomeQuest[] {
  const out: HomeQuest[] = [];
  for (const q of orderQuests(quests.filter((x) => x.status !== 'expired'), previousOrder)) {
    const action = questAction(q, level);
    if (!action) continue;
    const copy = q.source === 'starter' ? STARTER_COPY[q.slug] : undefined;
    out.push({
      quest: q,
      title: copy?.title ?? q.title,
      actionText: (q.source === 'ai' && q.description ? q.description : copy?.actionText ?? action.actionText),
      action,
      done: q.status === 'completed',
    });
    if (out.length >= MAX_ACTIVE_QUESTS) break;
  }
  return out;
}

export type HomeQuestsState = 'loading' | 'error' | 'creating' | 'allDone' | 'list';

export function homeQuestsState(args: {
  loading: boolean; error: boolean; visible: HomeQuest[];
}): HomeQuestsState {
  if (args.error) return 'error';
  if (args.loading) return 'loading';
  if (args.visible.length === 0) return 'creating';
  if (args.visible.every((v) => v.done)) return 'allDone';
  return 'list';
}

/** « N en cours » ; toutes terminees : « 3 sur 3 ». Jamais de decompte negatif ni de retard. */
export function homeQuestsHeaderCount(visible: HomeQuest[]): string {
  const active = visible.filter((v) => !v.done).length;
  if (active === 0) return `${visible.length} sur ${visible.length}`;
  return `${active} en cours`;
}

export function coinsVisible(level: number): boolean {
  return level >= COINS_VISIBLE_LEVEL;
}

export function totalCoins(visible: HomeQuest[]): number {
  return visible.reduce((s, v) => s + v.quest.rewardCoins, 0);
}

/** Note d'une ligne terminee ; pieces masquees sous le niveau 3 (D-05). */
export function homeCompletedNote(q: Pick<Quest, 'rewardCoins'>, level: number): string {
  return coinsVisible(level) && q.rewardCoins > 0 ? `Terminé · +${q.rewardCoins} pièces récupérées` : 'Terminé';
}

/** Libelle d'accessibilite d'une ligne active (§8). */
export function activeRowLabel(h: HomeQuest, counter: string | null, level: number): string {
  const reward = coinsVisible(level) && h.quest.rewardCoins > 0 ? ` Récompense ${h.quest.rewardCoins} pièces.` : '';
  return `${h.title}. ${counter ?? 'En cours'}.${reward} ${h.action.a11yLabel}`;
}

export function doneRowLabel(h: HomeQuest, level: number): string {
  const coins = coinsVisible(level) && h.quest.rewardCoins > 0 ? `, plus ${h.quest.rewardCoins} pièces récupérées` : '';
  return `${h.title}. Terminé${coins}`;
}

/** Texte du toast / de l'annonce ; sans pieces sous le niveau 3. */
export function homeToastText(done: QuestCompletion[], level: number): string {
  if (done.length === 0) return '';
  const shown = coinsVisible(level);
  const coins = shown ? done.reduce((s, d) => s + d.coins, 0) : 0;
  if (done.length === 1) {
    return coins > 0 ? `Quête terminée : ${done[0].title} (+${coins} pièces)` : `Quête terminée : ${done[0].title}`;
  }
  return `${done.length} quêtes terminées${coins > 0 ? ` (+${coins} pièces)` : ''}`;
}

/**
 * Quetes passees de « active » a « terminee » entre deux lectures (QNEW-06), plus celles que la synchro vient de
 * creditee (newlyCompleted), sans doublon (`announced` = ids deja annonces).
 */
export function detectCompletions(
  previous: Quest[] | undefined,
  next: Quest[],
  newlyCompleted: QuestCompletion[],
  announced: ReadonlySet<string>,
): QuestCompletion[] {
  const out = new Map<string, QuestCompletion>();
  const wasActive = new Set((previous ?? []).filter((q) => q.status === 'active').map((q) => q.id));
  for (const q of next) {
    if (q.status === 'completed' && wasActive.has(q.id) && !announced.has(q.id)) {
      out.set(q.id, { id: q.id, title: STARTER_COPY[q.slug]?.title ?? q.title, coins: q.rewardCoins });
    }
  }
  for (const c of newlyCompleted) {
    if (!announced.has(c.id) && !out.has(c.id)) out.set(c.id, c);
  }
  return [...out.values()];
}
