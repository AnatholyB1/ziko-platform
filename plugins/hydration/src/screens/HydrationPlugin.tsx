import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path, Rect, Defs, ClipPath } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, getActionPrimary } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import {
  type HydrationSettings, DEFAULT_SETTINGS, QUICK_AMOUNTS, MAX_LOG_ML, localDateKey,
  fetchSettings, saveSettings, hasWorkoutOnDay, effectiveGoalMl, coffeeCountedMl,
  remindersRowValue, glassRowValue, coffeeRowValue, bonusRowValue, formatLitres,
} from '../settings';
import { loadNotifModule, getReminderPermission, syncHydrationReminders, type PermissionState } from '../reminders';
import { lightImpact } from '../haptics';
import {
  WATER, RemindersSheet, GlassSheet, CoffeeSheet, BonusSheet, GoalSheet, AmountSheet,
} from './HydrationSheets';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HydrationLog {
  id: string;
  user_id: string;
  amount_ml: number;
  date: string;
  created_at: string;
}

interface HydrationPluginProps {
  supabase: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INFO_BLUE = WATER; // #2563C9 (contrat lot E : 5,67:1 sur blanc)
const TABS = ["Aujourd'hui", 'Historique', 'Réglages'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_BAR_ML = 3000;
const DEFAULT_GOAL = 2000;

// ─── Card shadow style ─────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Dates LOCALES (comme le Quick Log de l'accueil, P8) : jamais UTC.
function getToday(): string {
  return localDateKey();
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(localDateKey(d));
  }
  return days;
}

type SheetKind = null | 'goal' | 'custom' | 'coffee-add' | 'reminders' | 'glass' | 'coffee' | 'bonus';

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}h${m}`;
}

// ─── SVG Bottle ───────────────────────────────────────────────────────────────

function BottleSvg({ fillRatio }: { fillRatio: number }) {
  const ratio = Math.min(1, Math.max(0, fillRatio));
  const fillY = 140 - ratio * 120;

  return (
    <Svg width={80} height={140} viewBox="0 0 80 140">
      <Defs>
        <ClipPath id="bottle-clip">
          <Path d="M28 8h24v14l8 14v100a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V36l8-14V8z" />
        </ClipPath>
      </Defs>
      {/* Fill rect (water level) */}
      <Rect
        x={0}
        y={fillY}
        width={80}
        height={ratio * 120}
        fill={INFO_BLUE}
        opacity={0.25}
        clipPath="url(#bottle-clip)"
      />
      {/* Surface line */}
      <Rect
        x={0}
        y={fillY}
        width={80}
        height={4}
        fill={INFO_BLUE}
        opacity={0.85}
        clipPath="url(#bottle-clip)"
      />
      {/* Bottle outline */}
      <Path
        d="M28 8h24v14l8 14v100a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V36l8-14V8z"
        fill="none"
        stroke={INFO_BLUE}
        strokeWidth={2}
      />
    </Svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HydrationPlugin({ supabase }: HydrationPluginProps) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState("Aujourd'hui");

  // Feuille ouverte (une seule a la fois)
  const [sheet, setSheet] = useState<SheetKind>(null);

  // Anti double-ajout (300 ms) + toast d'annulation (5 s)
  const [tilesLocked, setTilesLocked] = useState(false);
  const lockTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<null | { id: string; ml: number }>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [writeError, setWriteError] = useState<null | string>(null);
  const [permission, setPermission] = useState<PermissionState>('granted');

  useEffect(() => () => {
    if (lockTimeout.current) clearTimeout(lockTimeout.current);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  // ─── Queries ────────────────────────────────────────────────────────────────

  // Fetch current user
  const { data: userInfo } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });
  const userId = userInfo?.id ?? null;
  const today = getToday();

  // Fetch today's hydration logs
  const { data: todayLogs = [], isLoading: loadingToday } = useQuery<HydrationLog[]>({
    queryKey: ['hydration_today', userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('ziko_hydration_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Fetch last 7 days
  const { data: historyLogs = [] } = useQuery<HydrationLog[]>({
    queryKey: ['hydration_history', userId],
    queryFn: async () => {
      if (!userId) return [];
      const sevenDaysAgo = getLast7Days()[0];
      const { data, error } = await supabase
        .from('ziko_hydration_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Reglages persistes (table ziko_hydration_settings)
  const { data: settings = DEFAULT_SETTINGS } = useQuery<HydrationSettings>({
    queryKey: ['hydration_settings', userId],
    queryFn: () => fetchSettings(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Jour de seance : au moins une seance dont started_at est dans le jour local
  const { data: workoutToday = false } = useQuery<boolean>({
    queryKey: ['hydration_workout_today', userId, today],
    queryFn: () => hasWorkoutOnDay(supabase, userId as string),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Objectif de base depuis user_profiles (inchange)
  const { data: baseGoalMl = DEFAULT_GOAL } = useQuery<number>({
    queryKey: ['hydration_goals', userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_GOAL;
      const { data } = await supabase
        .from('ziko_user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      return data?.settings?.hydration_goal_ml ?? DEFAULT_GOAL;
    },
    enabled: !!userId,
  });

  // Objectif affiche = base + bonus les jours de seance (HYDR-05)
  const goalMl = effectiveGoalMl(baseGoalMl, workoutToday, settings);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const logMutation = useMutation({
    mutationFn: async (amount_ml: number): Promise<{ id: string; ml: number }> => {
      if (!userId) throw new Error('Non authentifié');
      // Security: validate amount > 0 and <= 5000 (T-37-02-01)
      if (!amount_ml || amount_ml <= 0 || amount_ml > MAX_LOG_ML || isNaN(amount_ml)) {
        throw new Error('Quantité invalide (1–5000 ml)');
      }
      const { data, error } = await supabase
        .from('ziko_hydration_logs')
        .insert({ user_id: userId, amount_ml, date: today })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id as string, ml: amount_ml };
    },
    onSuccess: (res) => {
      setWriteError(null);
      setToast(res);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setToast(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['hydration_today', userId, today] });
      queryClient.invalidateQueries({ queryKey: ['hydration_history', userId] });
    },
    onError: () => {
      setWriteError('Impossible d\'enregistrer. Vérifie ta connexion.');
    },
  });

  const undoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ziko_hydration_logs').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      setToast(null);
      queryClient.invalidateQueries({ queryKey: ['hydration_today', userId, today] });
      queryClient.invalidateQueries({ queryKey: ['hydration_history', userId] });
    },
    onError: () => setWriteError('Impossible d\'annuler. Vérifie ta connexion.'),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (next: HydrationSettings) => {
      if (!userId) throw new Error('Non authentifié');
      const saved = await saveSettings(supabase, userId, next);
      // Rappels : replanifies a chaque enregistrement (le goal atteint coupe le reste du jour)
      const n = loadNotifModule();
      if (n) {
        const reached = todayLogs.reduce((s, l) => s + l.amount_ml, 0) >= goalMl;
        await syncHydrationReminders(n, saved, { goalReachedToday: reached });
      }
      return saved;
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(['hydration_settings', userId], saved);
      setSheet(null);
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible de sauvegarder');
    },
  });

  const saveGoalMutation = useMutation({
    mutationFn: async (newGoal: number) => {
      if (!userId) throw new Error('Non authentifié');
      // Upsert settings in user_profiles
      const { data: existing } = await supabase
        .from('ziko_user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      const newSettings = { ...(existing?.settings ?? {}), hydration_goal_ml: newGoal };
      const { error } = await supabase
        .from('ziko_user_profiles')
        .update({ settings: newSettings })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hydration_goals', userId] });
      setSheet(null);
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible de sauvegarder');
    },
  });

  // ─── Derived data ────────────────────────────────────────────────────────────

  const todayMl = todayLogs.reduce((sum, l) => sum + l.amount_ml, 0);
  const fillRatio = Math.min(1, todayMl / goalMl);
  const remainingL = Math.max(0, (goalMl - todayMl) / 1000);
  const goalReached = todayMl >= goalMl;

  // Resynchronise les rappels a l'ouverture / quand l'objectif est atteint (HY-5 : 0 rappel
  // pour le reste du jour une fois atteint ; les DAILY reviennent a la prochaine ouverture).
  useEffect(() => {
    if (!userId || loadingToday || !settings.remindersEnabled) return;
    const n = loadNotifModule();
    if (!n) return;
    let cancelled = false;
    (async () => {
      const p = await getReminderPermission(n, false);
      if (cancelled || p !== 'granted') return;
      await syncHydrationReminders(n, settings, { goalReachedToday: goalReached });
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId, loadingToday, settings, goalReached]);

  // Compute 7-day sums
  const last7Days = getLast7Days();
  const dailySums: Record<string, number> = {};
  last7Days.forEach((d) => { dailySums[d] = 0; });
  historyLogs.forEach((l) => {
    if (dailySums[l.date] !== undefined) dailySums[l.date] += l.amount_ml;
  });

  // Streak: consecutive days from today backward where sum >= goal
  const streak = (() => {
    let s = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      if (dailySums[last7Days[i]] >= goalMl) s++;
      else break;
    }
    return s;
  })();

  // Average ml over last 7 days
  const avgMl = Object.values(dailySums).reduce((a, b) => a + b, 0) / 7;

  // AI suggestion rule: if most logs are after 14h00
  const mostLogsAfternoon = todayLogs.length > 0 &&
    todayLogs.filter(l => new Date(l.created_at).getHours() >= 14).length > todayLogs.length / 2;

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // Un appui = une ligne ; tuiles verrouillees 300 ms et tant que l'ecriture est en cours.
  const handleQuickLog = (amount: number) => {
    if (tilesLocked || logMutation.isPending) return;
    setTilesLocked(true);
    if (lockTimeout.current) clearTimeout(lockTimeout.current);
    lockTimeout.current = setTimeout(() => setTilesLocked(false), 300);
    lightImpact();
    logMutation.mutate(amount);
  };

  const handleCustomLog = (ml: number) => {
    logMutation.mutate(ml);
    setSheet(null);
  };

  // Cafe / the : n'ajoute que la part comptee (0 si le reglage est eteint)
  const handleCoffeeLog = (drinkMl: number) => {
    const counted = coffeeCountedMl(drinkMl, settings);
    setSheet(null);
    if (counted <= 0) return;
    logMutation.mutate(counted);
  };

  const requestReminderPermission = async (): Promise<PermissionState> => {
    const p = await getReminderPermission(loadNotifModule(), true);
    setPermission(p);
    return p;
  };

  const openReminders = async () => {
    setPermission(await getReminderPermission(loadNotifModule(), false));
    setSheet('reminders');
  };

  // ─── Tab: Aujourd'hui ────────────────────────────────────────────────────────

  const renderToday = () => (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
    >
      {/* Bottle + Stats Card */}
      <View
        style={[
          CARD_SHADOW,
          {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            flexDirection: 'row',
            gap: 16,
            alignItems: 'center',
            marginBottom: 12,
          },
        ]}
      >
        {/* SVG bottle with overlay */}
        <View style={{ width: 80, height: 140, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <BottleSvg fillRatio={fillRatio} />
          {/* Text overlay — absolute centered */}
          <View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: INFO_BLUE, textAlign: 'center' }}>
              {(todayMl / 1000).toFixed(1)}L
            </Text>
            <Text style={{ fontSize: 11, color: theme.muted, textAlign: 'center' }}>
              / {(goalMl / 1000).toFixed(1)}L
            </Text>
          </View>
        </View>

        {/* Stat column */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: INFO_BLUE, letterSpacing: 0.06, textTransform: 'uppercase' }}>
            HYDRATATION
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '700', color: theme.text, marginTop: 4 }}>
            {todayMl >= goalMl ? 'Objectif atteint !' : `Encore ${remainingL.toFixed(1)}L`}
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 20, marginTop: 4 }}>
            {todayMl >= goalMl
              ? `Tu as bu ${(todayMl / 1000).toFixed(1)}L aujourd'hui.`
              : streak > 0
              ? `Allez, c'est presque plié. ${streak} jour${streak > 1 ? 's' : ''} d'affilée à objectif`
              : "Commence bien ta journée en t'hydratant régulièrement."}
          </Text>
          {streak > 0 && (
            <View
              style={{
                marginTop: 8,
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(46,123,246,0.10)',
                borderRadius: 999,
                paddingVertical: 4,
                paddingHorizontal: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="flame-outline" size={12} color={INFO_BLUE} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: INFO_BLUE }}>Streak {streak}j</Text>
            </View>
          )}
        </View>
      </View>

      {/* AISuggestion */}
      <View style={{ marginBottom: 12 }}>
        <AISuggestion
          text={
            mostLogsAfternoon
              ? "Tu bois surtout en fin de journée. Mets une bouteille à ton bureau et bois 250ml toutes les heures."
              : todayMl < goalMl * 0.5
              ? "Tu es encore loin de ton objectif. Pense à boire régulièrement tout au long de la journée."
              : "Bonne hydratation. Continue sur cette lancée pour atteindre ton objectif."
          }
          actionLabel={mostLogsAfternoon ? "Activer rappels" : undefined}
          onAction={mostLogsAfternoon ? () => setActiveTab('Réglages') : undefined}
          tintColor={INFO_BLUE}
        />
      </View>

      {/* Logger rapide */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
        Logger rapide
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        {QUICK_AMOUNTS.map((amount, i) => (
          <Pressable
            key={amount}
            onPress={() => handleQuickLog(amount)}
            disabled={tilesLocked || logMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${amount} millilitres`}
            style={({ pressed }) => [
              pressed ? undefined : CARD_SHADOW,
              {
                flex: 1,
                height: 132,
                backgroundColor: pressed ? '#F0EFE9' : theme.surface,
                borderRadius: 16,
                borderWidth: pressed ? 2 : 1,
                borderColor: pressed ? getActionPrimary(theme) : theme.border,
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 12,
                paddingHorizontal: 4,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: tilesLocked && !pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={{ height: 14, justifyContent: 'center' }}>
              {settings.glassMl === amount ? (
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '800', color: '#B53D05' }}>PAR DÉFAUT</Text>
              ) : null}
            </View>
            <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="water" size={[24, 30, 36][i]} color={INFO_BLUE} />
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>+{amount}</Text>
              <Text style={{ fontSize: 14, color: theme.muted }}>ml</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Actions texte sous les tuiles : quantite libre, cafe ou the */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginBottom: 8 }}>
        <TouchableOpacity
          onPress={() => setSheet('custom')}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#B53D05' }}>Autre quantité</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSheet('coffee-add')}
          accessibilityRole="button"
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#B53D05' }}>Ajouter un café ou un thé</Text>
        </TouchableOpacity>
      </View>

      {writeError ? (
        <View accessibilityRole="alert" style={{ backgroundColor: '#FDECEA', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 14, color: '#B3261E' }}>{writeError}</Text>
          <TouchableOpacity onPress={() => setWriteError(null)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#B53D05' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {toast ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ backgroundColor: theme.text, borderRadius: 12, paddingLeft: 16, paddingRight: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ flex: 1, fontSize: 14, color: '#FFFFFF' }}>{`+${toast.ml} ml ajoutés`}</Text>
          <TouchableOpacity
            onPress={() => undoMutation.mutate(toast.id)}
            accessibilityRole="button"
            style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFB48A' }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Today log list */}
      {todayLogs.length > 0 && (
        <>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
            Aujourd'hui
          </Text>
          {todayLogs.map((log) => (
            <View
              key={log.id}
              style={[
                CARD_SHADOW,
                {
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                },
              ]}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(46,123,246,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="water-outline" size={16} color={INFO_BLUE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
                  {log.amount_ml}ml · Eau
                </Text>
                <Text style={{ fontSize: 11, color: theme.muted }}>
                  {formatTime(log.created_at)}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {todayLogs.length === 0 && !loadingToday && (
        <View style={{ alignItems: 'center', paddingTop: 16 }}>
          <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center' }}>
            Aucune entrée pour l'instant. Commence par ton verre du matin.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── Tab: Historique ─────────────────────────────────────────────────────────

  const renderHistorique = () => {
    // Compute day-of-week labels aligned to last7Days
    const barData = last7Days.map((date, idx) => {
      const dayOfWeek = new Date(date).getDay(); // 0=Sun,1=Mon,...
      const label = DAY_LABELS[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
      const sum = dailySums[date] ?? 0;
      const isToday = date === today;
      const barHeight = Math.max(4, (sum / MAX_BAR_ML) * 112);
      const reachedGoal = sum >= goalMl;
      const bgColor = isToday
        ? INFO_BLUE
        : reachedGoal
        ? 'rgba(46,123,246,0.35)'
        : 'rgba(46,123,246,0.18)';
      return { date, label, sum, isToday, barHeight, bgColor };
    });

    const streakRecord = streak; // using current streak as record placeholder

    return (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
      >
        {/* 7-day bar chart */}
        <View
          style={[
            CARD_SHADOW,
            {
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 16,
              marginBottom: 12,
            },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 12 }}>
            7 derniers jours
          </Text>
          <View style={{ height: 112, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            {barData.map((bar, idx) => (
              <View key={idx} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View
                  style={{
                    flex: 1,
                    width: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      height: bar.barHeight,
                      backgroundColor: bar.bgColor,
                      borderRadius: 4,
                      minHeight: 4,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: bar.isToday ? INFO_BLUE : theme.muted,
                  }}
                >
                  {bar.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats 2-up */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View
            style={[
              CARD_SHADOW,
              {
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 12,
              },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>
              MOYENNE 7J
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: INFO_BLUE, marginTop: 4 }}>
              {(avgMl / 1000).toFixed(1)}L/j
            </Text>
          </View>
          <View
            style={[
              CARD_SHADOW,
              {
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 12,
              },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>
              STREAK RECORD
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: theme.text, marginTop: 4 }}>
              {streakRecord}j
            </Text>
          </View>
        </View>

        {/* AISuggestion */}
        <AISuggestion
          text={`Les jours de séance, ton objectif passe à +${settings.workoutBonusMl} ml : ton corps réclame plus. On adapte le bonus ?`}
          actionLabel="Adapter"
          onAction={() => setActiveTab('Réglages')}
          tintColor={INFO_BLUE}
        />
      </ScrollView>
    );
  };

  // ─── Tab: Réglages ───────────────────────────────────────────────────────────

  const renderReglages = () => (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
    >
      {/* Daily goal card */}
      <View
        style={[
          CARD_SHADOW,
          {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 12,
          },
        ]}
      >
        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.06 }}>
          OBJECTIF QUOTIDIEN
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: INFO_BLUE, marginTop: 4 }}>
          {formatLitres(baseGoalMl)}
        </Text>
        <Text style={{ fontSize: 14, color: theme.muted, marginTop: 2 }}>
          {settings.workoutBonusMl > 0
            ? `+ ${(settings.workoutBonusMl / 1000).toFixed(1).replace('.', ',')} L les jours de séance`
            : 'Aucun bonus les jours de séance'}
        </Text>
        <TouchableOpacity
          onPress={() => setSheet('goal')}
          accessibilityRole="button"
          accessibilityLabel="Modifier l'objectif quotidien"
          style={{
            marginTop: 12,
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: getActionPrimary(theme),
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Modifier</Text>
        </TouchableOpacity>
      </View>

      {/* Settings list card */}
      <View
        style={[
          CARD_SHADOW,
          {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          },
        ]}
      >
        {([
          { icon: 'notifications-outline' as const, label: 'Rappels intelligents', sub: remindersRowValue(settings), onPress: openReminders },
          { icon: 'water-outline' as const, label: 'Taille de verre par défaut', sub: glassRowValue(settings), onPress: () => setSheet('glass') },
          { icon: 'cafe-outline' as const, label: 'Compter le café/thé', sub: coffeeRowValue(settings), onPress: () => setSheet('coffee') },
          { icon: 'barbell-outline' as const, label: 'Bonus jour de séance', sub: bonusRowValue(settings), onPress: () => setSheet('bonus') },
        ]).map((row, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={row.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, ${row.sub}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderTopWidth: idx === 0 ? 0 : 1,
              borderTopColor: theme.border,
            }}
          >
            <Ionicons name={row.icon} size={18} color={theme.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#B53D05' }}>{row.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader
        title="Hydratation"
        onBack={() => router.back()}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <SubTabs
          tabs={TABS}
          active={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {activeTab === "Aujourd'hui" && renderToday()}
      {activeTab === 'Historique' && renderHistorique()}
      {activeTab === 'Réglages' && renderReglages()}

      {/* Feuilles : quantite libre, cafe/the, reglages, objectif (au-dessus du clavier) */}
      <AmountSheet theme={theme} visible={sheet === 'custom'} title="Autre quantité" saveLabel="Ajouter" onClose={() => setSheet(null)} onSave={handleCustomLog} />
      <AmountSheet
        theme={theme}
        visible={sheet === 'coffee-add'}
        title="Ajouter un café ou un thé"
        saveLabel="Ajouter"
        hint={(ml) => (!settings.countCoffeeTea
          ? 'Le café et le thé ne sont pas comptés (réglage éteint) : rien ne sera ajouté.'
          : ml ? `${ml} ml ajoutent ${coffeeCountedMl(ml, settings)} ml (${settings.coffeeTeaPct} % comptés).` : `${settings.coffeeTeaPct} % de la quantité est compté.`)}
        onClose={() => setSheet(null)}
        onSave={handleCoffeeLog}
      />
      <GoalSheet theme={theme} visible={sheet === 'goal'} goalMl={baseGoalMl} saving={saveGoalMutation.isPending} onClose={() => setSheet(null)} onSave={(g) => saveGoalMutation.mutate(g)} />
      <RemindersSheet theme={theme} visible={sheet === 'reminders'} settings={settings} permission={permission} saving={saveSettingsMutation.isPending}
        onClose={() => setSheet(null)} onSave={(s) => saveSettingsMutation.mutate(s)} onRequestPermission={requestReminderPermission} />
      <GlassSheet theme={theme} visible={sheet === 'glass'} settings={settings} saving={saveSettingsMutation.isPending} onClose={() => setSheet(null)} onSave={(s) => saveSettingsMutation.mutate(s)} />
      <CoffeeSheet theme={theme} visible={sheet === 'coffee'} settings={settings} saving={saveSettingsMutation.isPending} onClose={() => setSheet(null)} onSave={(s) => saveSettingsMutation.mutate(s)} />
      <BonusSheet theme={theme} visible={sheet === 'bonus'} settings={settings} baseGoalMl={baseGoalMl} saving={saveSettingsMutation.isPending} onClose={() => setSheet(null)} onSave={(s) => saveSettingsMutation.mutate(s)} />
    </SafeAreaView>
  );
}
