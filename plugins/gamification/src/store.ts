import { create } from 'zustand';

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
  category: 'title' | 'badge' | 'theme';
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
function computeLevelProgress(xp: number, levels: LevelDef[]) {
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

// ── Ensure profile exists ───────────────────────────────
async function ensureProfile(supabase: any, userId: string): Promise<GamificationProfile> {
  const { data } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) return data;

  const { data: created } = await supabase
    .from('user_gamification')
    .insert({ user_id: userId })
    .select('*')
    .single();

  return created;
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
      supabase.from('level_definitions').select('*').order('level'),
      supabase.from('xp_transactions').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('coin_transactions').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('shop_items').select('*').eq('is_active', true).order('price'),
      supabase.from('user_inventory').select('*'),
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
    .from('user_gamification')
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
        await addXP(supabase, userId, xpAmount, 'streak_bonus', null, `🔥 Streak ${milestone} jours !`);
      }
      if (coinAmount > 0) {
        await addCoins(supabase, userId, coinAmount, 'streak_bonus', null, `🔥 Bonus streak ${milestone} jours`);
      }
    }
  }

  return data ?? profile;
}

// ── Add XP (with level-up check) ────────────────────────
async function addXP(
  supabase: any,
  userId: string,
  amount: number,
  source: string,
  sourceId: string | null,
  description: string,
) {
  // Record transaction
  await supabase.from('xp_transactions').insert({
    user_id: userId, amount, source, source_id: sourceId, description,
  });

  // Get current profile
  const { data: profile } = await supabase
    .from('user_gamification')
    .select('xp, level')
    .eq('user_id', userId)
    .single();

  if (!profile) return;

  const newXP = profile.xp + amount;

  // Check level up
  const { data: levels } = await supabase
    .from('level_definitions')
    .select('*')
    .lte('xp_required', newXP)
    .order('level', { ascending: false })
    .limit(1);

  const newLevel = levels?.[0]?.level ?? profile.level;
  const leveledUp = newLevel > profile.level;

  await supabase
    .from('user_gamification')
    .update({ xp: newXP, level: newLevel, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Level-up bonus coins
  if (leveledUp) {
    const { data: levelDef } = await supabase
      .from('level_definitions')
      .select('reward_coins, title')
      .eq('level', newLevel)
      .single();

    if (levelDef?.reward_coins > 0) {
      await addCoins(supabase, userId, levelDef.reward_coins, 'level_up', null,
        `🎉 Niveau ${newLevel} atteint : ${levelDef.title} !`);
    }
  }
}

// ── Add Coins ───────────────────────────────────────────
async function addCoins(
  supabase: any,
  userId: string,
  amount: number,
  source: string,
  sourceId: string | null,
  description: string,
) {
  await supabase.from('coin_transactions').insert({
    user_id: userId, amount, source, source_id: sourceId, description,
  });

  // Update balance
  const { data: profile } = await supabase
    .from('user_gamification')
    .select('coins')
    .eq('user_id', userId)
    .single();

  if (profile) {
    await supabase
      .from('user_gamification')
      .update({ coins: profile.coins + amount, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }
}

// ── Award Workout Completion ────────────────────────────
export async function awardWorkoutXP(supabase: any, sessionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);

  // Update streak
  await updateStreak(supabase, user.id, profile);

  // Award XP
  await addXP(supabase, user.id, XP_REWARDS.workout, 'workout', sessionId,
    `💪 Séance terminée : +${XP_REWARDS.workout} XP`);

  // Award coins
  await addCoins(supabase, user.id, COIN_REWARDS.workout, 'workout', sessionId,
    `💰 Séance terminée : +${COIN_REWARDS.workout} pièces`);
}

// ── Award Habit Completion ──────────────────────────────
export async function awardHabitXP(supabase: any, habitName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await ensureProfile(supabase, user.id);

  // Update streak
  await updateStreak(supabase, user.id, profile);

  // Award XP
  await addXP(supabase, user.id, XP_REWARDS.habit, 'habit', null,
    `✅ ${habitName} : +${XP_REWARDS.habit} XP`);

  // Award coins
  await addCoins(supabase, user.id, COIN_REWARDS.habit, 'habit', null,
    `💰 ${habitName} : +${COIN_REWARDS.habit} pièces`);
}

// ── Purchase Item ───────────────────────────────────────
export async function purchaseItem(supabase: any, itemId: string): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Non connecté' };

  const profile = await ensureProfile(supabase, user.id);

  // Get item
  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (!item) return { success: false, error: 'Article introuvable' };
  if (profile.level < item.level_required) return { success: false, error: `Niveau ${item.level_required} requis` };
  if (profile.coins < item.price) return { success: false, error: 'Pas assez de pièces' };

  // Check if already owned
  const { data: existing } = await supabase
    .from('user_inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single();

  if (existing) return { success: false, error: 'Déjà possédé' };

  // Deduct coins
  await addCoins(supabase, user.id, -item.price, 'purchase', itemId,
    `🛒 Achat : ${item.name}`);

  // Add to inventory
  await supabase.from('user_inventory').insert({
    user_id: user.id,
    item_id: itemId,
  });

  return { success: true };
}

// ── Equip Item ──────────────────────────────────────────
export async function equipItem(supabase: any, itemId: string, category: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Unequip all items in this category
  const { data: ownedInCategory } = await supabase
    .from('user_inventory')
    .select('id, item_id, shop_items(category)')
    .eq('user_id', user.id)
    .eq('is_equipped', true);

  if (ownedInCategory) {
    for (const item of ownedInCategory) {
      if ((item.shop_items as any)?.category === category) {
        await supabase
          .from('user_inventory')
          .update({ is_equipped: false })
          .eq('id', item.id);
      }
    }
  }

  // Equip this one
  await supabase
    .from('user_inventory')
    .update({ is_equipped: true })
    .eq('user_id', user.id)
    .eq('item_id', itemId);

  // If it's a title, update equipped_title
  if (category === 'title') {
    const { data: shopItem } = await supabase
      .from('shop_items')
      .select('name')
      .eq('id', itemId)
      .single();

    if (shopItem) {
      await supabase
        .from('user_gamification')
        .update({ equipped_title: shopItem.name, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
  }

  // If it's a badge, update equipped_badge
  if (category === 'badge') {
    const { data: shopItem } = await supabase
      .from('shop_items')
      .select('icon')
      .eq('id', itemId)
      .single();

    if (shopItem) {
      await supabase
        .from('user_gamification')
        .update({ equipped_badge: shopItem.icon, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
  }
}
