import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '@ziko/plugin-sdk';
import {
  HISTORY_PAGE_SIZE, awardBadges, computeLevelProgress, ensureProfile, equipItem, fetchAchievements,
  fetchCoinHistory, purchaseItem, requestAiQuests, syncQuests, type LevelDef, type ShopItem,
} from '../store';
import {
  awardToastText, sortHistory, themeEquipNote, type CoinTx, type InventoryLite, type ShopItemLite,
} from '../rewards';
import { RewardsHeader, RewardsTabs, Toast, type RewardsTab } from './rewards/chrome';
import { AchievementsTab } from './rewards/AchievementsTab';
import { ShopTab } from './rewards/ShopTab';
import { HistoryView, LevelTab, type LevelData } from './rewards/LevelTab';
import { QuestsTab } from './rewards/QuestsTab';
import { hasFreeQuestSlot, questToastText } from '../quests';

// Onglet Quetes : `./rewards/QuestsTab` (P13, D-01). Lecture base via `syncQuests`, aucune quete factice.

export interface GamificationPluginProps {
  supabase: any;
  /** Onglet ouvert au demarrage (la route `gamification/shop` ouvre `Boutique`). */
  initialTab?: RewardsTab;
  /** Applique un theme / une banniere equipes (la route decide : le branding du coach prime, Q6). */
  onEquip?: (item: ShopItem) => void;
  /** Vrai si un branding de coach est actif (le theme achete reste equipe mais ne s'applique pas). */
  coachBrandingActive?: boolean;
}

export default function GamificationPlugin({ supabase, initialTab = 'Niveau', onEquip, coachBrandingActive = false }: GamificationPluginProps) {
  const theme = useThemeStore((s) => s.theme);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<RewardsTab>(initialTab);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const awardedOnce = useRef(false);

  const { data: userId } = useQuery({
    queryKey: ['auth-session-gamif'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return (data?.session?.user?.id ?? null) as string | null;
    },
  });
  const enabled = !!userId;

  // ── Profil + niveaux (solde permanent) ─────────────────
  const profileQ = useQuery({
    queryKey: ['rewards-profile', userId],
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const [profile, levelsRes] = await Promise.all([
        ensureProfile(supabase, userId as string),
        supabase.from('ziko_level_definitions').select('*').order('level'),
      ]);
      if (!profile) throw new Error('profile');
      if (levelsRes.error) throw levelsRes.error;
      const levels = (levelsRes.data ?? []) as LevelDef[];
      const { currentLevel, nextLevel, xpToNext, xpProgress } = computeLevelProgress(profile.xp, levels);
      const level: LevelData = {
        xp: profile.xp,
        level: profile.level,
        title: profile.equipped_title || currentLevel.title,
        nextLevel: nextLevel?.level ?? null,
        nextXp: nextLevel?.xp_required ?? null,
        xpToNext,
        xpProgress,
        streak: profile.current_streak ?? 0,
      };
      return { coins: profile.coins ?? 0, playerLevel: profile.level ?? 1, level };
    },
  });

  const nameQ = useQuery({
    queryKey: ['rewards-name', userId],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from('ziko_user_profiles').select('name').eq('id', userId).maybeSingle();
      return (data?.name as string | null) ?? null;
    },
  });

  // ── Succes (aucune liste de secours : erreur = carte B05) ─
  const achQ = useQuery({
    queryKey: ['rewards-achievements', userId],
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
    retryDelay: 300,
    queryFn: () => fetchAchievements(supabase, userId as string),
  });

  // ── Quetes (P13) : sync a chaque ouverture/retour sur l'onglet ; la progression vient des donnees reelles ─
  const questsQ = useQuery({
    queryKey: ['rewards-quests', userId],
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
    retryDelay: 300,
    queryFn: async () => {
      let res = await syncQuests(supabase);
      // P14 : une place libre => le backend decide (niveau gagne / plus de quete) ; si des quetes IA sont creees, re-mesure.
      if (hasFreeQuestSlot(res.quests) && (await requestAiQuests(supabase))) {
        const again = await syncQuests(supabase);
        res = { quests: again.quests, newlyCompleted: [...res.newlyCompleted, ...again.newlyCompleted] };
      }
      if (res.newlyCompleted.length > 0) {
        setToast(questToastText(res.newlyCompleted));
        // Les pieces gagnees changent le solde, l'historique et le niveau.
        void qc.invalidateQueries({ queryKey: ['rewards-profile', userId] });
        void qc.invalidateQueries({ queryKey: ['rewards-recent', userId] });
        void qc.invalidateQueries({ queryKey: ['rewards-history', userId] });
      }
      return res.quests;
    },
  });
  // Retour sur l'onglet Quetes (ex. apres avoir bu de l'eau) : re-mesure.
  const questsTabSeen = useRef(false);
  useEffect(() => {
    if (!questsTabSeen.current) { questsTabSeen.current = true; return; }
    if (enabled && tab === 'Quêtes') void questsQ.refetch();
  }, [tab]);

  // ── Boutique ───────────────────────────────────────────
  const shopQ = useQuery({
    queryKey: ['rewards-shop', userId],
    enabled: enabled && tab === 'Boutique',
    staleTime: 0,
    retry: 1,
    retryDelay: 300,
    queryFn: async () => {
      const [itemsRes, invRes] = await Promise.all([
        supabase.from('ziko_shop_items').select('*').eq('is_active', true).order('price'),
        supabase.from('ziko_user_inventory').select('item_id, is_equipped').eq('user_id', userId),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (invRes.error) throw invRes.error;
      return {
        items: (itemsRes.data ?? []) as ShopItemLite[],
        inventory: (invRes.data ?? []) as InventoryLite[],
      };
    },
  });

  // ── Derniers gains (5) + historique pagine ─────────────
  const recentQ = useQuery({
    queryKey: ['rewards-recent', userId],
    enabled,
    staleTime: 0,
    queryFn: () => fetchCoinHistory(supabase, 0, 5),
  });

  const historyQ = useInfiniteQuery({
    queryKey: ['rewards-history', userId],
    enabled: enabled && showHistory,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchCoinHistory(supabase, pageParam as number),
    getNextPageParam: (last: CoinTx[], all) => (last.length === HISTORY_PAGE_SIZE ? all.length : undefined),
  });

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['rewards-profile', userId] }),
      qc.invalidateQueries({ queryKey: ['rewards-achievements', userId] }),
      qc.invalidateQueries({ queryKey: ['rewards-recent', userId] }),
      qc.invalidateQueries({ queryKey: ['rewards-history', userId] }),
      qc.invalidateQueries({ queryKey: ['rewards-shop', userId] }),
    ]);
  }, [qc, userId]);

  // D-08 (a) : attribution a l'ouverture de l'ecran et de l'onglet Succes (sans relance de l'app, R-3).
  const runAward = useCallback(async () => {
    const awarded = await awardBadges(supabase);
    if (awarded.length > 0) {
      setToast(awardToastText(awarded));
      await invalidateAll();
    }
  }, [supabase, invalidateAll]);

  useEffect(() => {
    if (!enabled) return;
    if (!awardedOnce.current || tab === 'Succès') {
      awardedOnce.current = true;
      void runAward();
    }
  }, [enabled, tab]);

  const hideToast = useCallback(() => setToast(null), []);

  // ── Actions boutique ───────────────────────────────────
  const onBuy = async (item: ShopItemLite) => {
    const res = await purchaseItem(supabase, item.id);
    if (res.success) await invalidateAll();
    return res;
  };

  const onEquipItem = async (item: ShopItemLite) => {
    const res = await equipItem(supabase, item.id);
    if (!res.success) return res;
    // Mise a jour locale immediate : A perd EQUIPE et B le gagne dans le meme rendu (R-8).
    qc.setQueryData(['rewards-shop', userId], (old: any) => {
      if (!old) return old;
      const byId = new Map<string, ShopItemLite>(old.items.map((i: ShopItemLite) => [i.id, i]));
      return {
        ...old,
        inventory: old.inventory.map((inv: InventoryLite) => {
          if (inv.item_id === item.id) return { ...inv, is_equipped: true };
          return byId.get(inv.item_id)?.category === item.category ? { ...inv, is_equipped: false } : inv;
        }),
      };
    });
    // Q6 : le branding du coach prime ; la route n'applique pas le theme dans ce cas.
    onEquip?.(item as unknown as ShopItem);
    if (item.category === 'theme' && coachBrandingActive) setToast(themeEquipNote(true) ?? null);
    else setToast(`${item.name} équipé.`);
    void invalidateAll();
    return res;
  };

  const coins = profileQ.data?.coins ?? null;
  const historyRows = sortHistory((historyQ.data?.pages ?? []).flat());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <RewardsHeader
        title="Récompenses"
        coins={coins}
        onBack={() => (showHistory ? setShowHistory(false) : router.back())}
        onHistory={showHistory ? undefined : () => setShowHistory(true)}
        theme={theme}
      />
      {!showHistory ? <RewardsTabs active={tab} onChange={setTab} theme={theme} /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {showHistory ? (
          <HistoryView
            rows={historyRows}
            loading={historyQ.isLoading}
            error={historyQ.isError}
            hasMore={!!historyQ.hasNextPage}
            loadingMore={historyQ.isFetchingNextPage}
            onLoadMore={() => void historyQ.fetchNextPage()}
            onRetry={() => void historyQ.refetch()}
            onBack={() => setShowHistory(false)}
            theme={theme}
          />
        ) : (
          <View>
            {tab === 'Niveau' && (
              <LevelTab
                data={profileQ.data?.level}
                loading={profileQ.isLoading || !enabled}
                error={profileQ.isError}
                onRetry={() => void profileQ.refetch()}
                unlockedCount={achQ.data ? achQ.data.unlockedCount : null}
                totalAchievements={achQ.data ? achQ.data.total : null}
                recent={recentQ.data ?? []}
                onSeeAll={() => setShowHistory(true)}
                onOpenAchievements={() => setTab('Succès')}
                theme={theme}
              />
            )}
            {tab === 'Succès' && (
              <AchievementsTab
                data={achQ.data}
                loading={achQ.isLoading || !enabled}
                error={achQ.isError}
                onRetry={() => void achQ.refetch()}
                theme={theme}
              />
            )}
            {tab === 'Boutique' && (
              <ShopTab
                data={shopQ.data}
                loading={shopQ.isLoading || !enabled}
                error={shopQ.isError}
                onRetry={() => void shopQ.refetch()}
                coins={profileQ.data?.coins ?? 0}
                level={profileQ.data?.playerLevel ?? 1}
                displayName={nameQ.data ?? 'Toi'}
                coachBrandingActive={coachBrandingActive}
                onBuy={onBuy}
                onEquip={onEquipItem}
                onToast={setToast}
                theme={theme}
              />
            )}
            {tab === 'Quêtes' && (
              <QuestsTab
                quests={questsQ.data}
                loading={questsQ.isLoading || !enabled}
                error={questsQ.isError}
                onRetry={() => void questsQ.refetch()}
                theme={theme}
              />
            )}
          </View>
        )}
      </ScrollView>
      <Toast message={toast} onHide={hideToast} theme={theme} />
    </SafeAreaView>
  );
}
