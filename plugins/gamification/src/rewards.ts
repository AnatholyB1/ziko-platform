// Logique pure de l'ecran Recompenses (phase 12 / v1.20). Aucun import React Native :
// tout ce qui est calcule ici est testable sous vitest en environnement node.

// ── Charte lot B ─────────────────────────────────────────
export const GOLD = '#9A6F00';
export const GOLD_TINT = '#FBF1D3';
export const GOLD_BORDER = '#EBD9A0';
export const SKELETON = '#ECEAE4';

// ── Succes ───────────────────────────────────────────────
export interface BadgeDefinition {
  slug: string;
  name: string;
  description: string;
  icon?: string | null; // emoji en base : jamais rendu (D-06)
  condition_type: string;
  condition_value: number;
  tier: number | null;
}

export interface EarnedBadge {
  badge_slug: string;
  earned_at: string | null;
}

export interface BadgeProgressRow {
  slug: string;
  current: number;
  reward_coins: number;
}

export interface AchievementView {
  slug: string;
  name: string;
  description: string;
  iconName: string;
  conditionType: string;
  target: number; // N
  current: number; // min(n, N)
  remaining: number;
  rewardCoins: number;
  unlocked: boolean;
  earnedAt: string | null;
}

/** D-07 : slug -> Ionicons. 11 slugs, 11 icones distinctes. Inconnu = `ribbon`, jamais l'emoji. */
export const BADGE_ICONS: Record<string, string> = {
  first_session: 'barbell',
  ten_sessions: 'fitness',
  fifty_sessions: 'flame',
  hundred_sessions: 'trophy',
  streak_7: 'flash',
  streak_30: 'star',
  streak_100: 'ribbon',
  first_pr: 'medal',
  ten_prs: 'diamond',
  profile_complete: 'checkmark-circle',
  first_friend: 'people',
};
export const FALLBACK_BADGE_ICON = 'ribbon';

export function badgeIconName(slug: string): string {
  return BADGE_ICONS[slug] ?? FALLBACK_BADGE_ICON;
}

/** Miroir de `ziko_badge_tier_coins` (SQL) : sert uniquement de repli si la progression manque. */
export function tierCoins(tier: number | null | undefined): number {
  const t = tier ?? 1;
  return t === 1 ? 25 : t === 2 ? 50 : 100;
}

export function buildAchievements(
  defs: BadgeDefinition[],
  earned: EarnedBadge[],
  progress: BadgeProgressRow[],
): { locked: AchievementView[]; unlocked: AchievementView[]; total: number; unlockedCount: number; pct: number } {
  const earnedMap = new Map(earned.map((e) => [e.badge_slug, e.earned_at]));
  const progMap = new Map(progress.map((p) => [p.slug, p]));

  const all: AchievementView[] = defs.map((d) => {
    const isUnlocked = earnedMap.has(d.slug);
    const target = Math.max(1, d.condition_value);
    const p = progMap.get(d.slug);
    const raw = isUnlocked ? target : Math.max(0, p?.current ?? 0);
    const current = Math.min(raw, target);
    return {
      slug: d.slug,
      name: d.name,
      description: d.description,
      iconName: badgeIconName(d.slug),
      conditionType: d.condition_type,
      target,
      current,
      remaining: Math.max(0, target - current),
      rewardCoins: p?.reward_coins ?? tierCoins(d.tier),
      unlocked: isUnlocked,
      earnedAt: isUnlocked ? earnedMap.get(d.slug) ?? null : null,
    };
  });

  // A debloquer : tries par proximite (ratio decroissant, puis reste croissant, puis nom).
  const locked = all
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.current / b.target - a.current / a.target || a.remaining - b.remaining || a.name.localeCompare(b.name));
  // Debloques : le plus recent d'abord.
  const unlocked = all
    .filter((a) => a.unlocked)
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? ''));

  const total = all.length;
  return {
    locked,
    unlocked,
    total,
    unlockedCount: unlocked.length,
    pct: total === 0 ? 0 : Math.round((unlocked.length / total) * 100),
  };
}

/** `Encore 2 jours d'entraînement ou de check-in.` (Q8 = A : serie visible). */
export function remainingHint(a: AchievementView): string {
  const n = a.remaining;
  if (n <= 0) return '';
  switch (a.conditionType) {
    case 'streak':
      return `Encore ${n} jour${n > 1 ? 's' : ''} d'entraînement ou de check-in.`;
    case 'sessions':
      return `Encore ${n} séance${n > 1 ? 's' : ''} à terminer.`;
    case 'prs':
      return `Encore ${n} record${n > 1 ? 's' : ''} à battre.`;
    case 'friends':
      return `Encore ${n} ami${n > 1 ? 's' : ''} à ajouter.`;
    case 'profile_complete':
      return 'Complète ton profil : photo, bio et objectif.';
    default:
      return '';
  }
}

export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `Débloqué le 3 sept.` ; vide si la date est absente (jamais de date inventee). */
export function unlockedShort(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? `Débloqué le ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : '';
}

/** `Débloqué le 18 septembre 2026`. */
export function unlockedLong(iso: string | null | undefined): string {
  const d = parseDate(iso);
  return d ? `Débloqué le ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}` : '';
}

export interface AwardedBadge {
  slug: string;
  name: string;
  coins: number;
}

/** Normalise le retour jsonb de `ziko_check_and_award_badges` (tableau, null, ou ancienne forme void). */
export function parseAwarded(raw: unknown): AwardedBadge[] {
  if (!Array.isArray(raw)) return [];
  const out: AwardedBadge[] = [];
  for (const r of raw) {
    if (r && typeof r === 'object' && typeof (r as any).slug === 'string') {
      out.push({
        slug: (r as any).slug,
        name: typeof (r as any).name === 'string' ? (r as any).name : (r as any).slug,
        coins: Number((r as any).coins) || 0,
      });
    }
  }
  return out;
}

export function awardToastText(awarded: AwardedBadge[]): string {
  if (awarded.length === 0) return '';
  if (awarded.length === 1) {
    const a = awarded[0];
    return a.coins > 0 ? `Succès débloqué : ${a.name} (+${a.coins} pièces)` : `Succès débloqué : ${a.name}`;
  }
  const coins = awarded.reduce((s, a) => s + a.coins, 0);
  return `${awarded.length} succès débloqués${coins > 0 ? ` (+${coins} pièces)` : ''}`;
}

// ── Boutique ─────────────────────────────────────────────
export type ShopCategory = 'title' | 'badge' | 'theme' | 'banner';

export const CATEGORY_ORDER: ShopCategory[] = ['title', 'badge', 'theme', 'banner'];
export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  title: 'Titres',
  badge: 'Badges',
  theme: 'Thèmes',
  banner: 'Bannières',
};
export const CATEGORY_SINGULAR: Record<ShopCategory, string> = {
  title: 'Titre',
  badge: 'Badge',
  theme: 'Thème',
  banner: 'Bannière',
};
export const CATEGORY_ICON: Record<ShopCategory, string> = {
  title: 'text',
  badge: 'shield-checkmark',
  theme: 'color-palette',
  banner: 'image',
};

export interface ShopItemLite {
  id: string;
  name: string;
  description: string | null;
  category: ShopCategory;
  price: number;
  level_required: number;
}

export interface InventoryLite {
  item_id: string;
  is_equipped: boolean;
}

export type ShopItemState =
  | { kind: 'owned'; equipped: boolean }
  | { kind: 'level_locked'; level: number }
  | { kind: 'insufficient'; missing: number }
  | { kind: 'available' };

/** 4 etats visibles par mot : prix / Possede / Niveau N / Il manque N pieces (D-04). */
export function shopItemState(
  item: ShopItemLite,
  ctx: { coins: number; level: number; inventory: InventoryLite[] },
): ShopItemState {
  const inv = ctx.inventory.find((i) => i.item_id === item.id);
  if (inv) return { kind: 'owned', equipped: inv.is_equipped };
  if (ctx.level < item.level_required) return { kind: 'level_locked', level: item.level_required };
  if (ctx.coins < item.price) return { kind: 'insufficient', missing: item.price - ctx.coins };
  return { kind: 'available' };
}

/** Compteur reel par categorie (R-5) : nombre d'objets actifs, jamais plafonne. */
export function categoryCounts(items: ShopItemLite[]): Record<ShopCategory, number> {
  const out: Record<ShopCategory, number> = { title: 0, badge: 0, theme: 0, banner: 0 };
  for (const i of items) if (i.category in out) out[i.category] += 1;
  return out;
}

export function itemsInCategory<T extends ShopItemLite>(items: T[], cat: ShopCategory): T[] {
  return items.filter((i) => i.category === cat).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

/** `Il te manque 160 pièces. Gagne-en en t'entraînant.` (contrat §3). */
export function missingCoinsText(missing: number): string {
  return `Il te manque ${missing} pièce${missing > 1 ? 's' : ''}. Gagne-en en t'entraînant.`;
}

/** Libelle court de la ligne boutique : `Il manque 460 pièces`. */
export function missingCoinsShort(missing: number): string {
  return `Il manque ${missing} pièce${missing > 1 ? 's' : ''}`;
}

export function priceLabel(price: number): string {
  return `Acheter pour ${price} pièce${price > 1 ? 's' : ''}`;
}

/** Mes objets : groupes par categorie, ordre fixe, equipe en premier. */
export function ownedByCategory<T extends ShopItemLite>(
  items: T[],
  inventory: InventoryLite[],
): Array<{ category: ShopCategory; items: Array<T & { equipped: boolean }> }> {
  const inv = new Map(inventory.map((i) => [i.item_id, i.is_equipped]));
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: items
      .filter((i) => i.category === category && inv.has(i.id))
      .map((i) => ({ ...i, equipped: !!inv.get(i.id) }))
      .sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** Invariant R-8 : au plus 1 objet equipe par categorie. Renvoie les categories en infraction. */
export function equippedViolations(items: ShopItemLite[], inventory: InventoryLite[]): ShopCategory[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const count: Record<string, number> = {};
  for (const inv of inventory) {
    if (!inv.is_equipped) continue;
    const cat = byId.get(inv.item_id)?.category;
    if (cat) count[cat] = (count[cat] ?? 0) + 1;
  }
  return CATEGORY_ORDER.filter((c) => (count[c] ?? 0) > 1);
}

/** Q6 : le branding du coach prime ; le theme achete reste equipe et s'applique au delien. */
export function themeEquipNote(coachBrandingActive: boolean): string | null {
  return coachBrandingActive
    ? 'Les couleurs de ton coach restent affichées tant que tu es lié à lui. Ton thème reste équipé.'
    : null;
}

export const EQUIP_NOTE: Record<ShopCategory, string> = {
  title: 'Un seul titre est affiché à la fois. Les autres restent à toi.',
  badge: 'Un seul badge est affiché à la fois. Les autres restent à toi.',
  theme: 'Un seul thème est actif à la fois. Les autres restent à toi.',
  banner: 'Une seule bannière est affichée à la fois. Les autres restent à toi.',
};

// ── Historique des gains ─────────────────────────────────
export interface CoinTx {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  created_at: string;
}

const EMOJI_RE = /[←-⯿️‍]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g;

/** Retire les emoji stockes en base (jamais rendus) et les espaces residuels. */
export function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

const SOURCE_LABEL: Record<string, string> = {
  workout: 'Séance terminée',
  habit: 'Habitude validée',
  streak_bonus: 'Bonus de série',
  level_up: 'Niveau atteint',
  purchase: 'Achat',
  refund: 'Remboursement',
  achievement: 'Succès',
};

export function historyLabel(tx: Pick<CoinTx, 'source' | 'description'>): string {
  const cleaned = tx.description ? stripEmoji(tx.description) : '';
  return cleaned || SOURCE_LABEL[tx.source] || 'Gain';
}

export function formatAmount(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function relativeDay(iso: string, now: Date = new Date()): string {
  const d = parseDate(iso);
  if (!d) return '';
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Antechronologique, stable. Pas de plafond (D-14) : la pagination est faite par l'appelant. */
export function sortHistory<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ── Niveau ───────────────────────────────────────────────
export function xpLine(xp: number, nextXp: number | null): string {
  return nextXp === null ? `${xp} XP` : `${xp} / ${nextXp} XP`;
}
