import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../src/stores/authStore';
import { useWorkoutStore } from '../../src/stores/workoutStore';
import { supabase } from '../../src/lib/supabase';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../src/stores/themeStore';
import { format, startOfDay, differenceInCalendarDays, addDays, getDay } from 'date-fns';
import type { ProgramExercise } from '@ziko/plugin-sdk';
import { SearchOverlay } from '../../src/components/SearchOverlay';
import { ErrorScreen } from '../../src/components/ErrorScreen';

// Cross-plugin stores (optional, fail gracefully)
let useSleepStore: any = null;
try { useSleepStore = require('@ziko/plugin-sleep').useSleepStore; } catch {}
let useHydrationStore: any = null;
try { useHydrationStore = require('@ziko/plugin-hydration').useHydrationStore; } catch {}
let useJournalStore: any = null;
try { useJournalStore = require('@ziko/plugin-journal').useJournalStore; } catch {}
let useMeasurementsStore: any = null;
try { useMeasurementsStore = require('@ziko/plugin-measurements').useMeasurementsStore; } catch {}

const PLUGIN_COLORS: Record<string, string> = {
  habits: '#FF5C1A', nutrition: '#FF5C1A', persona: '#FF6584', stats: '#E8A33A',
  gamification: '#FF5C1A', community: '#2E7BF6', stretching: '#FF5C1A', sleep: '#7B5BD0',
  measurements: '#2E9E5B', timer: '#FF5C1A', 'ai-programs': '#2E7BF6', journal: '#FF5C1A',
  hydration: '#2E7BF6', cardio: '#E94B3C', supplements: '#2E9E5B', wearables: '#E91E63',
  rpe: '#7B5BD0',
};

const AI_TIPS = [
  { tag: 'Pré-séance', text: 'Tu as bien récupéré cette nuit. Bon créneau pour pousser sur les charges — vise +2.5 kg sur ta dernière série.' },
  { tag: 'Hydratation', text: "Pense à boire 500 ml supplémentaires avant 14h pour optimiser ta récupération musculaire." },
  { tag: 'Nutrition', text: "Il te manque environ 600 kcal pour atteindre ta cible. Prépare un repas protéiné pour ce soir." },
];

const EMPTY: any[] = [];

// ── FormRing ──────────────────────────────────────────────────────────────────
function FormRing({ parts }: { parts: { value: number; color: string }[] }) {
  const SIZE = 140;
  const STROKE = 11;
  const r = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle
        cx={SIZE / 2} cy={SIZE / 2} r={r}
        stroke="rgba(28,26,23,0.06)" strokeWidth={STROKE} fill="none"
      />
      {parts.map((p, i) => {
        const portion = total > 0 ? (p.value / total) * 0.92 : 0;
        const len = C * portion;
        const gap = C - len;
        const dashOffset = -(offset * C) - (C * 0.25);
        const el = (
          <Circle key={i}
            cx={SIZE / 2} cy={SIZE / 2} r={r}
            stroke={p.color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={[len, gap]}
            strokeDashoffset={dashOffset}
            fill="none"
          />
        );
        offset += portion + 0.02;
        return el;
      })}
    </Svg>
  );
}

// ── FormeDuJour ───────────────────────────────────────────────────────────────
function FormeDuJour({
  sleepPct, waterPct, nutritionPct, loadPct,
  sleepSub, waterSub, nutritionSub,
}: {
  sleepPct: number; waterPct: number; nutritionPct: number; loadPct: number;
  sleepSub: string; waterSub: string; nutritionSub: string;
}) {
  const theme = useThemeStore((s) => s.theme);
  const score = Math.round((sleepPct + waterPct + nutritionPct + loadPct) / 4);
  const parts = [
    { value: sleepPct, color: theme.violet, icon: 'moon-outline' as const, label: 'Sommeil', sub: sleepSub },
    { value: waterPct, color: theme.info, icon: 'water-outline' as const, label: 'Hydratation', sub: waterSub },
    { value: nutritionPct, color: theme.primary, icon: 'restaurant-outline' as const, label: 'Nutrition', sub: nutritionSub },
    { value: loadPct, color: theme.success, icon: 'flash-outline' as const, label: 'Charge', sub: 'Récup OK' },
  ];

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 16,
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: theme.muted }}>
        Forme du jour
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 }}>
        {score >= 80 ? 'Tu es en forme !' : score >= 60 ? 'Bonne journée' : 'Prends soin de toi'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
        <View style={{ width: 140, height: 140, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          <FormRing parts={parts} />
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: theme.text, lineHeight: 36 }}>{score}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>/100</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          {parts.map((p) => (
            <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                backgroundColor: p.color + '22',
              }}>
                <Ionicons name={p.icon} size={13} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{p.label}</Text>
                <Text style={{ fontSize: 10, color: theme.muted }}>{p.sub}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: p.color }}>{p.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── MissionCard ───────────────────────────────────────────────────────────────
function MissionCard({
  programName, workoutName, exercises, onStart,
}: {
  programName: string;
  workoutName: string;
  exercises: Array<{ name: string; detail: string }>;
  onStart: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      backgroundColor: theme.cardDark, borderRadius: 20, overflow: 'hidden', position: 'relative',
    }}>
      <Svg width="100%" height={180} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={300} cy={-20} r={160} fill="#FF5C1A" opacity={0.14} />
      </Svg>
      <View style={{ padding: 18 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,250,246,0.6)' }}>
          Mission du jour
        </Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.cardDarkText, marginTop: 6, lineHeight: 26 }}>
          {workoutName}
        </Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.55)', marginTop: 4 }}>
          {programName} · {exercises.length} exercices
        </Text>
        <View style={{ gap: 6, marginTop: 14, marginBottom: 14 }}>
          {exercises.slice(0, 3).map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                width: 18, height: 18, borderRadius: 5, backgroundColor: 'rgba(255,92,26,0.18)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFB287' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: 'rgba(255,250,246,0.9)', fontSize: 12.5 }}>{e.name}</Text>
              <Text style={{ color: 'rgba(255,250,246,0.5)', fontSize: 11 }}>{e.detail}</Text>
            </View>
          ))}
          {exercises.length > 3 && (
            <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.45)', paddingLeft: 26 }}>
              +{exercises.length - 3} autres exercices
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onStart} activeOpacity={0.8} style={{
            flex: 1, backgroundColor: theme.primary, borderRadius: 14,
            paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Allez, c'est parti !</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={{
            backgroundColor: 'rgba(255,250,246,0.1)', borderRadius: 14,
            paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="chevron-down" size={16} color={theme.cardDarkText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── AICoachInline ─────────────────────────────────────────────────────────────
function AICoachInline({ creditBalance }: { creditBalance: number }) {
  const theme = useThemeStore((s) => s.theme);
  const [idx, setIdx] = React.useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((x) => (x + 1) % AI_TIPS.length), 6500);
    return () => clearInterval(t);
  }, []);
  const tip = AI_TIPS[idx];
  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 14,
      borderWidth: 1, borderColor: theme.primary + '38',
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: theme.cardDark, alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Ionicons name="sparkles" size={16} color="#FFE6D9" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Coach Ziko
          </Text>
          <Text style={{ fontSize: 10, color: theme.muted }}>· {tip.tag}</Text>
          <View style={{ flex: 1 }} />
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 3,
            backgroundColor: theme.cardDark + '12', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
          }}>
            <Ionicons name="flash" size={10} color={theme.muted} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.muted }}>{creditBalance}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: theme.text }}>{tip.text}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <TouchableOpacity activeOpacity={0.75} style={{
            backgroundColor: theme.cardDark, borderRadius: 99,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700' }}>J'applique</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.75} style={{
            backgroundColor: theme.border, borderRadius: 99,
            paddingHorizontal: 12, paddingVertical: 6,
          }}>
            <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: '600' }}>Plus tard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── QuickLogSheet ─────────────────────────────────────────────────────────────
function QuickLogSheet({
  visible, title, onClose, children,
}: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{
        backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36, gap: 16,
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 4 }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

// ── QuickLogRow ───────────────────────────────────────────────────────────────
function QuickLogRow({
  onLogWater, onLogMood, onLogWeight, onLogMeal,
}: {
  onLogWater: () => void; onLogMood: () => void;
  onLogWeight: () => void; onLogMeal: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const items = [
    { label: '+250ml', icon: 'water-outline' as const, color: theme.info, onPress: onLogWater },
    { label: 'Humeur', icon: 'happy-outline' as const, color: theme.success, onPress: onLogMood },
    { label: 'Poids', icon: 'scale-outline' as const, color: theme.warn, onPress: onLogWeight },
    { label: 'Repas', icon: 'restaurant-outline' as const, color: theme.primary, onPress: onLogMeal },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <TouchableOpacity key={it.label} onPress={it.onPress} activeOpacity={0.7} style={{
          flex: 1, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1,
          borderColor: theme.border, padding: 10, alignItems: 'center', gap: 4,
          shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
        }}>
          <View style={{
            width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
            backgroundColor: it.color + '22',
          }}>
            <Ionicons name={it.icon} size={15} color={it.color} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── WeekStrip ─────────────────────────────────────────────────────────────────
function WeekStrip({
  weeklyCount, weeklyGoal, sessionDates,
}: { weeklyCount: number; weeklyGoal: number; sessionDates: Set<string> }) {
  const theme = useThemeStore((s) => s.theme);
  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const today = startOfDay(new Date());
  const jsToday = getDay(today);
  const mondayOffset = jsToday === 0 ? -6 : 1 - jsToday;
  const monday = addDays(today, mondayOffset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const key = format(date, 'yyyy-MM-dd');
    const isToday = differenceInCalendarDays(date, today) === 0;
    const done = sessionDates.has(key);
    return { label: DAY_LABELS[i], num: format(date, 'd'), isToday, done };
  });

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 20, padding: 14,
      shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
          Semaine · <Text style={{ color: theme.primary }}>{weeklyCount}/{weeklyGoal}</Text>
        </Text>
        {weeklyGoal - weeklyCount > 0 && (
          <Text style={{ fontSize: 11, color: theme.muted }}>+{weeklyGoal - weeklyCount} pour l'objectif</Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {days.map((d, i) => {
          let bg = 'transparent';
          let textColor = theme.muted;
          let borderStyle: object = { borderWidth: 1, borderColor: theme.border };
          if (d.done) { bg = theme.success; textColor = '#fff'; borderStyle = {}; }
          else if (d.isToday) { bg = theme.cardDark; textColor = '#fff'; borderStyle = {}; }
          return (
            <View key={i} style={[{
              flex: 1, aspectRatio: 1, borderRadius: 10, backgroundColor: bg,
              alignItems: 'center', justifyContent: 'center',
            }, borderStyle]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: textColor, opacity: 0.7 }}>{d.label}</Text>
              {d.done ? (
                <Ionicons name="checkmark" size={12} color="#fff" style={{ marginTop: 2 }} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '800', color: textColor, marginTop: 2 }}>{d.num}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── PluginsDrawer ─────────────────────────────────────────────────────────────
function PluginsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const manifests = usePluginRegistry((s) => s.manifests);
  if (!open) return null;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} activeOpacity={1} onPress={onClose} />
      <View style={{
        backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 20, paddingBottom: 36, maxHeight: '75%',
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>Tous mes outils</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>{enabledPlugins.length} modules installés</Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{
            width: 32, height: 32, borderRadius: 10, backgroundColor: theme.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="close" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {enabledPlugins.map((pid) => {
              const manifest = manifests[pid];
              const mainRoute = manifest?.routes.find((r) => r.showInTabBar) ?? manifest?.routes[0];
              const destination = mainRoute?.path ?? `/(app)/store/${pid}`;
              const color = PLUGIN_COLORS[pid] ?? theme.primary;
              return (
                <TouchableOpacity key={pid} onPress={() => { onClose(); router.push(destination as any); }}
                  activeOpacity={0.75}
                  style={{ width: '20%', alignItems: 'center', gap: 6 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: color + '18', borderWidth: 1, borderColor: theme.border,
                  }}>
                    <Ionicons name={(manifest?.icon as any) ?? 'grid'} size={24} color={color} />
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 10, fontWeight: '600', color: theme.muted, textAlign: 'center' }}>
                    {manifest?.name ?? pid}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── DashboardScreen ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { t, tExercise } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const recentSessions = useWorkoutStore((s) => s.recentSessions);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);
  const activeProgram = useWorkoutStore((s) => s.activeProgram);
  const loadPrograms = useWorkoutStore((s) => s.loadPrograms);
  const startSession = useWorkoutStore((s) => s.startSession);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [quickSheet, setQuickSheet] = React.useState<null | 'water' | 'mood' | 'weight'>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  // Cross-plugin: wellness data
  const sleepLogs: any[] = useSleepStore ? useSleepStore((s: any) => s.logs) : EMPTY;
  const hydrationLogs: any[] = useHydrationStore ? useHydrationStore((s: any) => s.logs) : EMPTY;
  const hydrationGoal: number = useHydrationStore ? useHydrationStore((s: any) => s.goalMl) : 2500;
  const journalEntries: any[] = useJournalStore ? useJournalStore((s: any) => s.entries) : EMPTY;

  const sleepRecovery = React.useMemo(() => {
    if (!sleepLogs?.length) return 0;
    const recent = sleepLogs.slice(0, 3);
    const avgQuality = recent.reduce((s: number, l: any) => s + (l.quality ?? 0), 0) / recent.length;
    const avgDuration = recent.reduce((s: number, l: any) => s + (l.duration_hours ?? 0), 0) / recent.length;
    return Math.round(Math.min(avgDuration / 8, 1) * 60 + (avgQuality / 5) * 40);
  }, [sleepLogs]);

  const hydrationTodayMl = React.useMemo(() => {
    if (!hydrationLogs?.length) return 0;
    const today = new Date().toISOString().split('T')[0];
    return hydrationLogs.filter((l: any) => l.date === today).reduce((s: number, l: any) => s + (l.amount_ml ?? 0), 0);
  }, [hydrationLogs]);
  const waterPct = hydrationGoal > 0 ? Math.round(Math.min(hydrationTodayMl / hydrationGoal, 1) * 100) : 0;

  useEffect(() => {
    Promise.all([
      loadRecentSessions(30),
      loadPrograms(),
      useHydrationStore?.getState().loadToday?.(supabase),
      useSleepStore?.getState().loadRecent?.(supabase),
      useJournalStore?.getState().loadRecent?.(supabase),
    ]).catch(() => setLoadError(true));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (useHydrationStore) useHydrationStore.setState({ _loaded: false });
    if (useSleepStore) useSleepStore.setState({ _loaded: false });
    if (useJournalStore) useJournalStore.setState({ _loaded: false });
    await Promise.all([
      loadRecentSessions(30),
      loadPrograms(),
      useHydrationStore?.getState().loadToday?.(supabase),
      useSleepStore?.getState().loadRecent?.(supabase),
      useJournalStore?.getState().loadRecent?.(supabase),
    ]);
    setRefreshing(false);
  };

  const streak = React.useMemo(() => {
    if (!recentSessions.length) return 0;
    const uniqueDays = new Set(recentSessions.map((s) => format(new Date(s.started_at), 'yyyy-MM-dd')));
    let current = 0;
    let date = startOfDay(new Date());
    while (uniqueDays.has(format(date, 'yyyy-MM-dd'))) {
      current++;
      date = new Date(date.getTime() - 86400000);
    }
    return current;
  }, [recentSessions]);

  const todaySession = recentSessions.find(
    (s) => differenceInCalendarDays(new Date(), new Date(s.started_at)) === 0,
  );
  const weeklyCount = recentSessions.filter(
    (s) => differenceInCalendarDays(new Date(), new Date(s.started_at)) < 7,
  ).length;
  const weeklyGoal = 4;

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting.morning');
    if (h < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  }, []);

  // Today's workout from active program
  const jsToDb = (jsDay: number) => (jsDay === 0 ? 7 : jsDay);
  const todayDbDay = jsToDb(getDay(new Date()));
  const todaysWorkout = React.useMemo(() => {
    if (!activeProgram?.program_workouts) return null;
    return activeProgram.program_workouts.find((w) => w.day_of_week === todayDbDay) ?? null;
  }, [activeProgram, todayDbDay]);

  const formatExerciseDetail = (pe: ProgramExercise) => {
    const parts: string[] = [];
    if (pe.sets) parts.push(`${pe.sets}×`);
    if (pe.reps) parts.push(`${pe.reps}`);
    else if (pe.reps_min && pe.reps_max) parts.push(`${pe.reps_min}-${pe.reps_max}`);
    else if (pe.duration_seconds) parts.push(`${pe.duration_seconds}s`);
    if (pe.weight_kg) parts.push(`@ ${pe.weight_kg}kg`);
    return parts.join(' ');
  };

  const missionExercises = React.useMemo(() => {
    if (!todaysWorkout?.program_exercises) return [];
    return todaysWorkout.program_exercises
      .sort((a, b) => a.order_index - b.order_index)
      .map((pe) => ({ name: tExercise(pe.exercises?.name ?? 'Exercise'), detail: formatExerciseDetail(pe) }));
  }, [todaysWorkout]);

  const sessionDates = React.useMemo(() => {
    return new Set(recentSessions.map((s) => format(new Date(s.started_at), 'yyyy-MM-dd')));
  }, [recentSessions]);

  const handleStartWorkout = async (workout: typeof todaysWorkout) => {
    if (!workout) return;
    await startSession(workout.id, workout.name);
    router.push('/(app)/workout/session');
  };

  if (loadError) {
    return (
      <ErrorScreen kind="error" onAction={() => { setLoadError(false); onRefresh(); }} />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SearchOverlay visible={showSearch} onClose={() => setShowSearch(false)} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 20 + insets.top, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>{greeting}</Text>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 }}>
              {profile?.name ?? 'Athlete'}<Text style={{ color: theme.primary }}>.</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {streak > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.warn + '20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                <Text style={{ fontSize: 12 }}>{'\uD83D\uDD25'}</Text>
                <Text style={{ color: theme.warn, fontWeight: '700', fontSize: 12 }}>{streak}j</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setShowSearch(true)}
              style={{
                width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="search-outline" size={16} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(app)/notifications' as any)}
              style={{
                width: 36, height: 36, borderRadius: 12, backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={16} color={theme.text} />
            </TouchableOpacity>
            <View style={{
              width: 36, height: 36, borderRadius: 12, backgroundColor: theme.primary,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                {(profile?.name ?? 'A').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── FormeDuJour ────────────────────────────────── */}
        <View style={{ marginBottom: 12 }}>
          <FormeDuJour
            sleepPct={sleepRecovery || 50}
            waterPct={waterPct || 30}
            nutritionPct={50}
            loadPct={weeklyCount >= weeklyGoal ? 95 : Math.round((weeklyCount / weeklyGoal) * 80)}
            sleepSub={sleepRecovery > 0 ? `Récup. ${sleepRecovery}%` : 'Pas de données'}
            waterSub={hydrationTodayMl > 0 ? `${(hydrationTodayMl / 1000).toFixed(1)}L / ${(hydrationGoal / 1000).toFixed(1)}L` : 'Pas de données'}
            nutritionSub="Loggue ton repas"
          />
        </View>

        {/* ── MissionCard ────────────────────────────────── */}
        {activeProgram && todaysWorkout ? (
          <View style={{ marginBottom: 12 }}>
            <MissionCard
              programName={activeProgram.name}
              workoutName={todaysWorkout.name}
              exercises={missionExercises}
              onStart={() => handleStartWorkout(todaysWorkout)}
            />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/(app)/workout')}
            style={{
              backgroundColor: theme.surface, borderRadius: 20, padding: 18,
              borderWidth: 1, borderColor: theme.border, marginBottom: 12,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}
          >
            <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>Créer un programme</Text>
              <Text style={{ color: theme.muted, fontSize: 12 }}>Démarre ton premier plan d'entraînement</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        )}

        {/* ── AICoachInline ──────────────────────────────── */}
        <View style={{ marginBottom: 20 }}>
          <AICoachInline creditBalance={47} />
        </View>

        {/* ── QuickLogRow ────────────────────────────────── */}
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Quick log</Text>
        <View style={{ marginBottom: 20 }}>
          <QuickLogRow
            onLogWater={() => setQuickSheet('water')}
            onLogMood={() => setQuickSheet('mood')}
            onLogWeight={() => setQuickSheet('weight')}
            onLogMeal={() => router.push('/(app)/(plugins)/nutrition/log' as any)}
          />
        </View>

        {/* ── WeekStrip ──────────────────────────────────── */}
        <View style={{ marginBottom: 20 }}>
          <WeekStrip weeklyCount={weeklyCount} weeklyGoal={weeklyGoal} sessionDates={sessionDates} />
        </View>

        {/* ── Recent ─────────────────────────────────────── */}
        {recentSessions.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Récent</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Tout voir</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {recentSessions.slice(0, 3).map((session) => (
                <View key={session.id} style={{
                  backgroundColor: theme.surface, borderRadius: 14, padding: 12,
                  borderWidth: 1, borderColor: theme.border,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: theme.primary + '18',
                  }}>
                    <Ionicons name="barbell-outline" size={16} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{session.name ?? 'Workout'}</Text>
                    <Text style={{ color: theme.muted, fontSize: 11 }}>{format(new Date(session.started_at), 'EEE, d MMM')}</Text>
                  </View>
                  {session.total_volume_kg != null && (
                    <Text style={{ color: theme.success, fontWeight: '700', fontSize: 13 }}>
                      {session.total_volume_kg.toLocaleString()} kg
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Tous mes outils ────────────────────────────── */}
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          activeOpacity={0.75}
          style={{
            backgroundColor: theme.surface, borderRadius: 18, padding: 14,
            borderWidth: 1, borderColor: theme.border,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}
        >
          <View style={{
            width: 38, height: 38, borderRadius: 11,
            backgroundColor: theme.cardDark + '12', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="grid-outline" size={18} color={theme.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Tous mes outils</Text>
            <Text style={{ color: theme.muted, fontSize: 11 }}>Garde-manger, sommeil, mesures…</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── Modals ─────────────────────────────────────── */}
      <PluginsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <QuickLogSheet visible={quickSheet === 'water'} title="+250 ml d'eau" onClose={() => setQuickSheet(null)}>
        <Text style={{ color: theme.muted, fontSize: 14 }}>Confirmer l'ajout de 250 ml</Text>
        <TouchableOpacity
          onPress={() => {
            useHydrationStore?.getState().logWater?.(supabase, 250);
            setQuickSheet(null);
          }}
          style={{ backgroundColor: theme.info, borderRadius: 14, padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ajouter +250 ml</Text>
        </TouchableOpacity>
      </QuickLogSheet>

      <QuickLogSheet visible={quickSheet === 'mood'} title="Comment tu te sens ?" onClose={() => setQuickSheet(null)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {[1, 2, 3, 4, 5].map((m) => (
            <TouchableOpacity key={m} onPress={() => {
              useJournalStore?.getState().logMood?.(supabase, m);
              setQuickSheet(null);
            }} style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 28 }}>{['😞', '😕', '😐', '🙂', '😄'][m - 1]}</Text>
              <Text style={{ fontSize: 11, color: theme.muted }}>{m}/5</Text>
            </TouchableOpacity>
          ))}
        </View>
      </QuickLogSheet>

      <QuickLogSheet visible={quickSheet === 'weight'} title="Log ton poids" onClose={() => setQuickSheet(null)}>
        <TouchableOpacity
          onPress={() => {
            setQuickSheet(null);
            router.push('/(app)/(plugins)/measurements/dashboard' as any);
          }}
          style={{ backgroundColor: theme.warn, borderRadius: 14, padding: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ouvrir Mesures</Text>
        </TouchableOpacity>
      </QuickLogSheet>
    </View>
  );
}
