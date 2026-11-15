// Logique pure de l'onglet Quetes (P13) : parsing du retour de `ziko_sync_quests`, regroupement,
// libelles. Aucune donnee en dur : tout vient de la base. Tests : apps/mobile/src/lib/__tests__/quests.test.ts

export type QuestScope = 'daily' | 'weekly';
export type QuestStatus = 'active' | 'completed' | 'expired';

export interface Quest {
  id: string;
  slug: string;
  source: 'starter' | 'ai';
  scope: QuestScope;
  title: string;
  description: string | null;
  icon: string;
  metric: string;
  target: number;
  unit: string | null;
  rewardCoins: number;
  periodStart: string;
  expiresAt: string;
  status: QuestStatus;
  progress: number;
  completedAt: string | null;
}

export interface QuestCompletion {
  id: string;
  title: string;
  coins: number;
}

export interface QuestSync {
  quests: Quest[];
  newlyCompleted: QuestCompletion[];
}

/** Valide et normalise le retour jsonb ; une ligne invalide est ignoree (jamais de quete fantome). */
export function parseQuestSync(data: unknown): QuestSync {
  const d = (data ?? {}) as any;
  const rows: any[] = Array.isArray(d.quests) ? d.quests : [];
  const quests: Quest[] = [];
  for (const r of rows) {
    if (!r || typeof r.id !== 'string' || typeof r.title !== 'string') continue;
    const target = Number(r.target);
    if (!(target > 0)) continue;
    const status: QuestStatus = r.status === 'completed' || r.status === 'expired' ? r.status : 'active';
    quests.push({
      id: r.id,
      slug: String(r.slug ?? r.id),
      source: r.source === 'ai' ? 'ai' : 'starter',
      scope: r.scope === 'weekly' ? 'weekly' : 'daily',
      title: r.title,
      description: r.description ?? null,
      icon: typeof r.icon === 'string' && r.icon ? r.icon : 'flag',
      metric: String(r.metric ?? ''),
      target,
      unit: r.unit ?? null,
      rewardCoins: Math.max(0, Number(r.reward_coins) || 0),
      periodStart: String(r.period_start ?? ''),
      expiresAt: String(r.expires_at ?? ''),
      status,
      progress: Math.max(0, Number(r.progress) || 0),
      completedAt: r.completed_at ?? null,
    });
  }
  const done: any[] = Array.isArray(d.newly_completed) ? d.newly_completed : [];
  const newlyCompleted: QuestCompletion[] = done
    .filter((c) => c && typeof c.id === 'string')
    .map((c) => ({ id: c.id, title: String(c.title ?? ''), coins: Math.max(0, Number(c.coins) || 0) }));
  return { quests, newlyCompleted };
}

export interface QuestSections {
  daily: Quest[];
  weekly: Quest[];
  /** Quetes non terminees a l'echeance et pas encore remplacees : information neutre, hors des actives. */
  expired: Quest[];
}

export function groupQuests(quests: Quest[]): QuestSections {
  const live = quests.filter((q) => q.status !== 'expired');
  return {
    daily: live.filter((q) => q.scope === 'daily'),
    weekly: live.filter((q) => q.scope === 'weekly'),
    expired: quests.filter((q) => q.status === 'expired'),
  };
}

export function activeCount(quests: Quest[]): number {
  return quests.filter((q) => q.status === 'active').length;
}

/** Plafond de quetes actives (QUEST-05) : copie d'affichage, la regle est appliquee en base (P14). */
export const MAX_ACTIVE_QUESTS = 3;

/** Une place est libre : le serveur decide s'il y a lieu de generer (niveau gagne / plus de quete). */
export function hasFreeQuestSlot(quests: Quest[]): boolean {
  return activeCount(quests) < MAX_ACTIVE_QUESTS;
}

/** Ratio 0..1 de la barre de progression. */
export function questRatio(q: Pick<Quest, 'progress' | 'target' | 'status'>): number {
  if (q.status === 'completed') return 1;
  if (q.target <= 0) return 0;
  return Math.max(0, Math.min(1, q.progress / q.target));
}

function fmtNum(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return String(rounded).replace('.', ',');
}

/**
 * Valeur mesuree affichee sous le titre. Eau : litres ("1,3 / 2 L"). Autres : "1 / 3" uniquement
 * si la cible depasse 1 (une quete "faire X une fois" n'affiche pas de compteur, maquette B12).
 */
export function progressText(q: Pick<Quest, 'progress' | 'target' | 'unit' | 'metric'>): string | null {
  if (q.metric === 'hydration_ml' || q.unit === 'ml') {
    return `${fmtNum(q.progress / 1000)} / ${fmtNum(q.target / 1000)} L`;
  }
  if (q.target <= 1) return null;
  return `${fmtNum(Math.min(q.progress, q.target))} / ${fmtNum(q.target)}`;
}

/** "Se renouvelle dans 6 h" / "dans 25 min" (jamais negatif). */
export function renewLabel(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  if (minutes < 60) return `dans ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `dans ${hours} h`;
  return `dans ${Math.round(hours / 24)} j`;
}

export function dailyHeading(quests: Quest[], now: number = Date.now()): string {
  const first = quests[0];
  return first ? `Aujourd'hui · se renouvelle ${renewLabel(first.expiresAt, now)}` : "Aujourd'hui";
}

/** Sous-titre d'une quete terminee (maquette B12) : "Terminé · +60 pièces récupérées". */
export function completedNote(q: Pick<Quest, 'rewardCoins'>): string {
  return q.rewardCoins > 0 ? `Terminé · +${q.rewardCoins} pièces récupérées` : 'Terminé';
}

/** Libelle neutre d'une quete echue (regle non punitive v1.18 : ni "echec" ni pertes). */
export function expiredNote(): string {
  return 'Non terminée · aucune pénalité';
}

export function questToastText(done: QuestCompletion[]): string {
  if (done.length === 0) return '';
  const coins = done.reduce((s, d) => s + d.coins, 0);
  if (done.length === 1) {
    return coins > 0 ? `Quête terminée : ${done[0].title} (+${coins} pièces)` : `Quête terminée : ${done[0].title}`;
  }
  return `${done.length} quêtes terminées${coins > 0 ? ` (+${coins} pièces)` : ''}`;
}
