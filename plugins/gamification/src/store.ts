import { create } from 'zustand';
import {
  buildAchievements, parseAwarded,
  type AwardedBadge, type BadgeDefinition, type BadgeProgressRow, type EarnedBadge,
} from './rewards';
import { parseQuestSync, type QuestSync } from './quests';

// ── Types ────────────────────────────────────────────────
export interface LevelDef {
  level: number;
  xp_required: number;
  title: string;
  reward_coins: number;
}

export interface GamificationProfile {
  user_id: string;
  xp: number;
  level: number;
  coins: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  equipped_title: string;
  equipped_badge: string | null;
  equipped_banner_name: string | null;
  equipped_theme: string | null;
}

export interface Transaction {
  id: string;
  amount: number;
  source: string;
  description: string | null;
  created_at: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  category: 'title' | 'badge' | 'theme' | 'banner';
  price: number;
  icon: string | null;
  level_required: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface InventoryItem {
  id: string;
  item_id: string;
  is_equipped: boolean;
  purchased_at: string;
}

// ── XP Rewards Config ───────────────────────────────────
const XP_REWARDS = {
  workout: 50,
  habit: 10,
  streak_7: 100,
  streak_14: 150,
  streak_30: 500,
  streak_60: 800,
  streak_90: 1200,
};

const COIN_REWARDS = {
  workout: 25,
  habit: 5,
  streak_7: 50,
  streak_14: 100,
  streak_30: 200,
  streak_60: 350,
  streak_90: 500,
};

const STREAK_MILESTONES = [7, 14, 30, 60, 90];

export const HISTORY_PAGE_SIZE = 50;

// ── Store ────────────────────────────────────────────────
interface GamificationState {
  profile: GamificationProfile | null;
  levels: LevelDef[];
  recentXP: Transaction[];
  recentCoins: Transaction[];
  shopItems: ShopItem[];
  inventory: InventoryItem[];
  isLoading: boolean;
  nextLevel: LevelDef | null;
  xpToNext: number;
  xpProgress: number; // 0-1

  setProfile: (p: GamificationProfile) => void;
  setLoading: (v: boolean) => void;
  setData: (d: Partial<GamificationState>) => void;
}

export const useGamificationStore = create<GamificationState>()((set) => ({
  profile: null,
  levels: [],
  recentXP: [],
  recentCoins: [],
  shopItems: [],
  inventory: [],
  isLoading: false,
  nextLevel: null,
  xpToNext: 0,
  xpProgress: 0,

  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setData: (data) => set(data),
}));

// ── Helpers ─────────────────────────────────────────────
export function computeLevelProgress(xp: number, levels: LevelDef[]) {
  if (levels.length === 0) {
    return { currentLevel: { level: 1, xp_required: 0, title: 'Débutant', reward_coins: 0 } as LevelDef, nextLevel: null, xpToNext: 0, xpProgress: 1 };
  }
  const sorted = [...levels].sort((a, b) => a.xp_required - b.xp_required);
  let currentLevel = sorted[0];
  let nextLevel: LevelDef | null = null;

  for (let i = 0; i < sorted.length; i++) {
    if (xp >= sorted[i].xp_required) {
      currentLevel = sorted[i];
      nextLevel = sorted[i + 1] ?? null;
    }
  }

  const xpInLevel = xp - currentLevel.xp_required;
  const xpForLevel = nextLevel ? nextLevel.xp_required - currentLevel.xp_required : 1;
  const xpToNext = nextLevel ? nextLevel.xp_required - xp : 0;
  const xpProgress = nextLevel ? Math.min(xpInLevel / xpForLevel, 1) : 1;

  return { currentLevel, nextLevel, xpToNext, xpProgress };
}

// ── Ensure profile exists (server-side, bypasses the now-locked-down INSERT) ──
export async function ensureProfile(supabase: any, userId: string): Promise<GamificationProfile> {
  const { data } = await supabase.rpc('ziko_ensure_gamification_profile', { p_user_id: userId });
  return data;
}

// ── Load all gamification data ──────────────────────────
export async function loadGamification(supabase: any) {
  const store = useGamificationStore.getState();
  store.setLoading(true);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profile, levelsRes, xpRes, coinsRes, shopRes, invRes] = await Promise.all([
      ensureProfile(supabase, user.id),
      supabase.from('ziko_level_definitions').select('*').order('level'),
      supabase.from('ziko_xp_transactions').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('ziko_coin_transactions').select('*').order('created_at', { ascending: false }).limit(HISTORY_PAGE_SIZE),
      supabase.from('ziko_shop_items').select('*').eq('is_active', true).order('price'),
      supabase.from('ziko_user_inventory').select('*'),
    ]);

    const levels: LevelDef[] = levelsRes.data ?? [];
    const { nextLevel, xpToNext, xpProgress } = computeLevelProgress(profile.xp, levels);

    store.setData({
      profile,
      levels,
      recentXP: xpRes.data ?? [],
      recentCoins: coinsRes.data ?? [],
      shopItems: shopRes.data ?? [],
      inventory: invRes.data ?? [],
      nextLevel,
      xpToNext,
      xpProgress,
    });
  } finally {
    store.setLoading(false);
  }
}

// ── Update streak ───────────────────────────────────────
async function updateStreak(supabase: any, userId: string, profile: GamificationProfile) {
  const today = new Date().toISOString().split('T')[0];
  if (profile.last_activity_date === today) return profile;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = 1;
  if (profile.last_activity_date === yesterdayStr) {
    newStreak = profile.current_streak + 1;
  }

  const longestStreak = Math.max(profile.longest_streak, newStreak);

  const { data } = await supabase
    .from('ziko_user_gamification')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single();

  // Check streak milestones
  for (const milestone of STREAK_MILESTONES) {
    if (newStreak === milestone && profile.current_streak < milestone) {
      const xpKey = `streak_${milestone}` as keyof typeof XP_REWARDS;
      const coinKey = `streak_${milestone}` as keyof typeof COIN_REWARDS;
      const xpAmount = XP_REWARDS[xpKey] ?? 0;
      const coinAmount = COIN_REWARDS[coinKey] ?? 0;

      if (xpAmount > 0) {
        await supabase.rpc('ziko_award_xp', {
          p_user_id: userId, p_amount: xpAmount, p_source: 'streak_bonus',
          p_source_id: null, p_description: `Streak ${milestone} jours !`,
        });
      }
      if (coinAmount > 0) {
        await supabase.rpc('ziko_award_coins', {
          p_user_id: userId, p_amount: coinAmount, p_source: 'streak_bonus',
          p_source_id: null, p_description: `Bonus streak ${milestone} jours`,
        });
      }
    }
  }

  return data ?? profile;
}

// ── Award Workout Completion ────────────────────────────
export async function awardWorkoutXP(supabase: any, sessionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);
  await updateStreak(supabase, user.id, profile);

  await supabase.rpc('ziko_award_xp', {
    p_user_id: user.id, p_amount: XP_REWARDS.workout, p_source: 'workout',
    p_source_id: sessionId, p_description: `Séance terminée : +${XP_REWARDS.workout} XP`,
  });
  await supabase.rpc('ziko_award_coins', {
    p_user_id: user.id, p_amount: COIN_REWARDS.workout, p_source: 'workout',
    p_source_id: sessionId, p_description: `Séance terminée : +${COIN_REWARDS.workout} pièces`,
  });
  // D-08 : l'attribution des succes suit la fin de seance (jamais bloquant).
  await awardBadges(supabase);
  // P13 : la progression des quetes suit la fin de seance (jamais bloquant).
  await syncQuestsQuiet(supabase);
}

// ── Award Habit Completion ──────────────────────────────
export async function awardHabitXP(supabase: any, habitName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);
  await updateStreak(supabase, user.id, profile);

  await supabase.rpc('ziko_award_xp', {
    p_user_id: user.id, p_amount: XP_REWARDS.habit, p_source: 'habit',
    p_source_id: null, p_description: `${habitName} : +${XP_REWARDS.habit} XP`,
  });
  await supabase.rpc('ziko_award_coins', {
    p_user_id: user.id, p_amount: COIN_REWARDS.habit, p_source: 'habit',
    p_source_id: null, p_description: `${habitName} : +${COIN_REWARDS.habit} pièces`,
  });
}

// ── Purchase Item ───────────────────────────────────────
export async function purchaseItem(supabase: any, itemId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non connecté' };

  const { data, error } = await supabase.rpc('ziko_purchase_shop_item', {
    p_user_id: user.id,
    p_item_id: itemId,
  });

  if (error) return { success: false, error: error.message };
  return data as { success: boolean; error?: string };
}

// ── Equip Item (atomique cote base : ziko_equip_item, D-12) ─────────
export async function equipItem(supabase: any, itemId: string): Promise<{ success: boolean; error?: string; category?: string }> {
  const { data, error } = await supabase.rpc('ziko_equip_item', { p_item_id: itemId });
  if (error) return { success: false, error: error.message };
  return (data ?? { success: false, error: 'Réponse vide' }) as { success: boolean; error?: string; category?: string };
}

// ── Succes : attribution + chargement (D-08, D-09) ─────────────────
/**
 * Verifie et attribue les succes (RPC SECURITY DEFINER). Ne leve jamais : un echec renvoie [].
 * Les succes nouvellement debloques servent au toast.
 */
export async function awardBadges(supabase: any): Promise<AwardedBadge[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase.rpc('ziko_check_and_award_badges', { p_user_id: user.id });
    if (error) return [];
    return parseAwarded(data);
  } catch {
    return [];
  }
}

/**
 * Charge definitions + succes obtenus + progression. LEVE en cas d'erreur reseau/serveur :
 * l'ecran affiche alors la carte d'erreur, jamais une liste de secours (REWD-10).
 */
export async function fetchAchievements(supabase: any, userId: string) {
  const [defsRes, earnedRes, progRes] = await Promise.all([
    supabase.from('ziko_badge_definitions').select('slug, name, description, icon, condition_type, condition_value, tier'),
    supabase.from('ziko_user_badges').select('badge_slug, earned_at').eq('user_id', userId),
    supabase.rpc('ziko_get_badge_progress', { p_user_id: userId }),
  ]);
  if (defsRes.error) throw defsRes.error;
  if (earnedRes.error) throw earnedRes.error;
  if (progRes.error) throw progRes.error;
  const defs = (defsRes.data ?? []) as BadgeDefinition[];
  const earned = (earnedRes.data ?? []) as EarnedBadge[];
  const progress = ((progRes.data as any)?.badges ?? []) as BadgeProgressRow[];
  return buildAchievements(defs, earned, progress);
}

// ── Quetes (P13) ───────────────────────────────────────────────────
/**
 * Synchronise les quetes (RPC SECURITY DEFINER `ziko_sync_quests`) : cree les quetes de depart de la
 * periode, mesure la progression sur les donnees reelles, termine et credite. LEVE en cas d'erreur :
 * l'onglet affiche la carte d'erreur, jamais de quete de secours (REWD-10).
 */
export async function syncQuests(supabase: any): Promise<QuestSync> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not-authenticated');
  const { data, error } = await supabase.rpc('ziko_sync_quests', { p_user_id: user.id });
  if (error) throw error;
  return parseQuestSync(data);
}

/**
 * P14 (QUEST-04) : demande au backend de generer des quetes IA. Le declenchement (passage de niveau, plus aucune
 * quete) et le plafond de 3 sont decides cote serveur : si rien n'est a creer, la reponse est `skipped` et aucun
 * appel IA n'a lieu. Ne leve jamais ; renvoie true si au moins une quete a ete creee.
 */
export async function requestAiQuests(supabase: any): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/quests/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: '{}',
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.status === 'created' && Number(body.created) > 0;
  } catch {
    return false;
  }
}

/** Variante silencieuse (ex. fin de seance) : ne leve jamais, renvoie les quetes terminees. */
export async function syncQuestsQuiet(supabase: any): Promise<QuestSync | null> {
  try {
    return await syncQuests(supabase);
  } catch {
    return null;
  }
}

// ── Historique des gains (pagine, D-14) ────────────────────────────
export async function fetchCoinHistory(supabase: any, page: number, pageSize = HISTORY_PAGE_SIZE) {
  const from = page * pageSize;
  const { data, error } = await supabase
    .from('ziko_coin_transactions')
    .select('id, amount, source, description, created_at')
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}
