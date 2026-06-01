import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path, Rect, Defs, ClipPath } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';

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

const INFO_BLUE = '#2E7BF6';
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

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

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

  // Custom sheet state
  const [showCustomSheet, setShowCustomSheet] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  // Goal edit sheet state
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // Flash confirmation state
  const [flashingButton, setFlashingButton] = useState<null | number>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .from('hydration_logs')
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
        .from('hydration_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Fetch goal from user_profiles
  const { data: goalMl = DEFAULT_GOAL } = useQuery<number>({
    queryKey: ['hydration_goals', userId],
    queryFn: async () => {
      if (!userId) return DEFAULT_GOAL;
      const { data } = await supabase
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      return data?.settings?.hydration_goal_ml ?? DEFAULT_GOAL;
    },
    enabled: !!userId,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const logMutation = useMutation({
    mutationFn: async (amount_ml: number) => {
      if (!userId) throw new Error('Non authentifié');
      // Security: validate amount > 0 and <= 5000 (T-37-02-01)
      if (!amount_ml || amount_ml <= 0 || amount_ml > 5000 || isNaN(amount_ml)) {
        throw new Error('Quantité invalide (1–5000 ml)');
      }
      const { error } = await supabase
        .from('hydration_logs')
        .insert({ user_id: userId, amount_ml, date: today });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hydration_today', userId, today] });
      queryClient.invalidateQueries({ queryKey: ['hydration_history', userId] });
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
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      const newSettings = { ...(existing?.settings ?? {}), hydration_goal_ml: newGoal };
      const { error } = await supabase
        .from('user_profiles')
        .update({ settings: newSettings })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hydration_goals', userId] });
      setShowGoalSheet(false);
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible de sauvegarder');
    },
  });

  // ─── Derived data ────────────────────────────────────────────────────────────

  const todayMl = todayLogs.reduce((sum, l) => sum + l.amount_ml, 0);
  const fillRatio = Math.min(1, todayMl / goalMl);
  const remainingL = Math.max(0, (goalMl - todayMl) / 1000);

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

  const handleQuickLog = (amount: number) => {
    // Flash effect
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    setFlashingButton(amount);
    flashTimeout.current = setTimeout(() => setFlashingButton(null), 300);
    logMutation.mutate(amount);
  };

  const handleCustomLog = () => {
    const parsed = parseInt(customAmount, 10);
    if (!parsed || parsed <= 0 || parsed > 5000 || isNaN(parsed)) {
      showAlert('Erreur', 'Saisissez une quantité valide entre 1 et 5000 ml.');
      return;
    }
    logMutation.mutate(parsed);
    setCustomAmount('');
    setShowCustomSheet(false);
  };

  const handleSaveGoal = () => {
    const parsed = parseInt(goalInput, 10);
    if (!parsed || parsed < 1000 || parsed > 5000) {
      showAlert('Erreur', "L'objectif doit être entre 1000 et 5000 ml.");
      return;
    }
    saveGoalMutation.mutate(parsed);
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
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {[250, 500, 750].map((amount) => (
          <TouchableOpacity
            key={amount}
            onPress={() => handleQuickLog(amount)}
            style={[
              CARD_SHADOW,
              {
                flex: 1,
                backgroundColor: flashingButton === amount
                  ? 'rgba(46,123,246,0.20)'
                  : 'rgba(46,123,246,0.12)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                paddingVertical: 16,
                paddingHorizontal: 8,
                alignItems: 'center',
                gap: 4,
              },
            ]}
          >
            <Ionicons
              name="water-outline"
              size={amount === 250 ? 16 : amount === 500 ? 20 : 24}
              color={INFO_BLUE}
            />
            <Text style={{ fontSize: 11, fontWeight: '700', color: INFO_BLUE }}>
              +{amount}ml
            </Text>
          </TouchableOpacity>
        ))}
        {/* Custom button */}
        <TouchableOpacity
          onPress={() => setShowCustomSheet(true)}
          style={[
            CARD_SHADOW,
            {
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              paddingVertical: 16,
              paddingHorizontal: 8,
              alignItems: 'center',
              gap: 4,
            },
          ]}
        >
          <Ionicons name="add-circle-outline" size={20} color={INFO_BLUE} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: INFO_BLUE }}>Personnalisé</Text>
        </TouchableOpacity>
      </View>

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
          text="Tes journées de séance tu bois +30% : ton corps réclame plus. On adapte la cible les jours d'entraînement ?"
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
          {(goalMl / 1000).toFixed(1)}L
        </Text>
        <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
          recommandé selon ton poids et activité
        </Text>
        <TouchableOpacity
          onPress={() => {
            setGoalInput(String(goalMl));
            setShowGoalSheet(true);
          }}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: INFO_BLUE,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>Modifier</Text>
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
        {[
          { icon: 'notifications-outline' as const, label: 'Rappels intelligents', sub: 'Toutes les 90 min, 8h-21h' },
          { icon: 'water-outline' as const, label: 'Taille de verre par défaut', sub: '250 ml' },
          { icon: 'cafe-outline' as const, label: 'Compter le café/thé', sub: 'Oui (à 50%)' },
          { icon: 'barbell-outline' as const, label: 'Bonus jour de séance', sub: '+500 ml' },
        ].map((row, idx) => (
          <View
            key={idx}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderTopWidth: idx === 0 ? 0 : 1,
              borderTopColor: theme.border,
            }}
          >
            <Ionicons name={row.icon} size={16} color={theme.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: theme.text }}>{row.label}</Text>
              <Text style={{ fontSize: 11, color: theme.muted }}>{row.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </View>
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

      {/* Custom amount BottomSheet */}
      <Modal
        visible={showCustomSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomSheet(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          activeOpacity={1}
          onPress={() => setShowCustomSheet(false)}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Quantité personnalisée</Text>
            <TouchableOpacity onPress={() => setShowCustomSheet(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder="Quantité en ml (ex: 350)"
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            style={{
              backgroundColor: theme.background,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 17,
              color: theme.text,
              marginBottom: 16,
            }}
            autoFocus
          />
          <TouchableOpacity
            onPress={handleCustomLog}
            style={{
              backgroundColor: INFO_BLUE,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Logger</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Goal edit sheet */}
      <Modal
        visible={showGoalSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalSheet(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
          activeOpacity={1}
          onPress={() => setShowGoalSheet(false)}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 40,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>Objectif quotidien</Text>
            <TouchableOpacity onPress={() => setShowGoalSheet(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={goalInput}
            onChangeText={setGoalInput}
            placeholder="Objectif en ml (1000–5000)"
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            style={{
              backgroundColor: theme.background,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 17,
              color: theme.text,
              marginBottom: 16,
            }}
            autoFocus
          />
          <TouchableOpacity
            onPress={handleSaveGoal}
            style={{
              backgroundColor: INFO_BLUE,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Sauvegarder</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
