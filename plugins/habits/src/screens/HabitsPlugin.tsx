import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubTabs, AISuggestion, PluginHeader, ErrorScreen } from '@ziko/ui';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { router } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Habit {
  id: string;
  user_id: string;
  name: string;
  type: 'boolean' | 'count';
  target: number;
  emoji: string;
  color: string;
  created_at?: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Aujourd'hui", 'Historique', 'Nouvelle'];

const CARD_STYLE = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

const TEMPLATES = [
  { name: 'Méditer', color: 'violet', emoji: 'stretch' },
  { name: 'Lire', color: 'info', emoji: 'smile' },
  { name: 'Marcher 10k pas', color: 'success', emoji: 'shoe' },
  { name: "Pas d'alcool", color: 'warn', emoji: 'x' },
  { name: 'Vitamines', color: 'primary', emoji: 'leaf' },
  { name: 'Étirements', color: 'success', emoji: 'stretch' },
  { name: 'Courir 30 min', color: 'primary', emoji: 'shoe' },
  { name: 'Dormir 8h', color: 'info', emoji: 'moon' },
] as const;

// ─── Helper functions ─────────────────────────────────────────────────────────

const habitColor = (color: string): string =>
  ({
    success: '#2E9E5B',
    violet: '#7B5BD0',
    warn: '#F59E0B',
    primary: '#FF5C1A',
    info: '#2E7BF6',
  }[color] ?? '#FF5C1A');

const habitIcon = (emoji: string): string =>
  ({
    leaf: 'leaf-outline',
    smile: 'happy-outline',
    moon: 'moon-outline',
    x: 'close-outline',
    stretch: 'body-outline',
    shoe: 'footsteps-outline',
    barbell: 'barbell-outline',
  }[emoji] ?? 'checkmark-outline') as string;

function getStreak(habitId: string, monthLogs: HabitLog[]): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const found = monthLogs.some((l) => l.habit_id === habitId && l.date === dateStr);
    if (found) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HabitsPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Aujourd'hui");

  // ── User ID ──────────────────────────────────────────────
  const { data: userId } = useQuery({
    queryKey: ['auth_user_id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: Infinity,
  });

  const today = new Date().toISOString().split('T')[0];

  // ── Habits query ─────────────────────────────────────────
  const { data: habits = [], isLoading: habitsLoading, isError: habitsError, refetch: habitsRefetch } = useQuery<Habit[]>({
    queryKey: ['habits', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Today's logs ─────────────────────────────────────────
  const { data: todayLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ['habit_logs_today', userId, today],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Month logs (last 30 days) ─────────────────────────────
  const since30 = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: monthLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ['habit_logs_month', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('habit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', since30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Completion toggle mutation ────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ habit, isCompleted }: { habit: Habit; isCompleted: boolean }) => {
      if (!userId) throw new Error('Not authenticated');
      if (isCompleted) {
        // DELETE the log
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('habit_id', habit.id)
          .eq('user_id', userId)
          .eq('date', today);
        if (error) throw error;
      } else {
        // INSERT the log (unique constraint on habit_id, date)
        const { error } = await supabase.from('habit_logs').insert({
          habit_id: habit.id,
          user_id: userId,
          date: today,
          count: 1,
        });
        if (error) throw error;
      }
    },
    onMutate: async ({ habit, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: ['habit_logs_today', userId, today] });
      const previous = queryClient.getQueryData<HabitLog[]>(['habit_logs_today', userId, today]);
      queryClient.setQueryData<HabitLog[]>(['habit_logs_today', userId, today], (old = []) => {
        if (isCompleted) {
          return old.filter((l) => l.habit_id !== habit.id);
        } else {
          return [
            ...old,
            { id: 'optimistic', habit_id: habit.id, user_id: userId!, date: today, count: 1 },
          ];
        }
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['habit_logs_today', userId, today], context.previous);
      }
      showAlert('Erreur de sauvegarde', 'Impossible de mettre à jour votre habitude.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit_logs_today', userId, today] });
    },
  });

  // ── Create habit mutation (templates) ────────────────────
  const createHabitMutation = useMutation({
    mutationFn: async ({ name, color, emoji }: { name: string; color: string; emoji: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase.from('habits').insert({
        user_id: userId,
        name: name.trim(),
        type: 'boolean',
        target: 1,
        color,
        emoji,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['habits', userId] });
      showAlert('Habitude ajoutée', `"${vars.name}" a été ajoutée à vos habitudes.`);
    },
    onError: (err: any) => {
      showAlert('Erreur', err.message ?? 'Impossible de créer cette habitude.');
    },
  });

  // ── AISuggestion logic ────────────────────────────────────
  const aiSuggestionText = useMemo(() => {
    if (!habits.length || !monthLogs.length) {
      return 'Établis une routine quotidienne. Même 1 habitude tenue pendant 21 jours change tout.';
    }
    // For each habit, count missed days in last 7 days
    const last7Dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Dates.push(d.toISOString().split('T')[0]);
    }
    let worstHabit: Habit | null = null;
    let worstMissed = 0;
    for (const habit of habits) {
      const doneCount = last7Dates.filter((date) =>
        monthLogs.some((l) => l.habit_id === habit.id && l.date === date)
      ).length;
      const missed = 7 - doneCount;
      if (missed > 3 && missed > worstMissed) {
        worstMissed = missed;
        worstHabit = habit;
      }
    }
    if (worstHabit) {
      return `Tu rates "${worstHabit.name}" ${worstMissed} fois sur 7. On baisse la cible ?`;
    }
    // Generic streak encouragement
    const completedToday = todayLogs.length;
    const total = habits.length;
    if (total > 0 && completedToday === total) {
      return `Toutes tes habitudes sont faites aujourd'hui ! Continue sur cette lancée.`;
    }
    return `Tu es sur la bonne voie. ${completedToday}/${total} habitudes accomplies aujourd'hui.`;
  }, [habits, monthLogs, todayLogs]);

  // ─── Today Tab ──────────────────────────────────────────────────────────────

  function renderTodayTab() {
    const completedIds = new Set(todayLogs.map((l) => l.habit_id));
    const doneCount = habits.filter((h) => completedIds.has(h.id)).length;
    const total = habits.length;

    return (
      <View>
        {/* Summary card */}
        <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
            {doneCount}/{total} habitudes accomplies
          </Text>
          {/* Dot grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {habits.map((h) => (
              <View
                key={h.id}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: completedIds.has(h.id)
                    ? habitColor(h.color)
                    : 'rgba(28,26,23,0.08)',
                }}
              />
            ))}
          </View>
        </View>

        {/* AISuggestion */}
        <View style={{ marginBottom: 12 }}>
          <AISuggestion text={aiSuggestionText} />
        </View>

        {/* Habit list */}
        {habits.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🌱</Text>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 6 }}>
              Aucune habitude
            </Text>
            <Text style={{ color: '#6B6963', fontSize: 14, textAlign: 'center' }}>
              Ajoute tes premières habitudes dans l'onglet "Nouvelle"
            </Text>
          </View>
        ) : (
          habits.map((habit) => {
            const isCompleted = completedIds.has(habit.id);
            const streak = getStreak(habit.id, monthLogs);
            const color = habitColor(habit.color);
            const icon = habitIcon(habit.emoji);
            return (
              <View
                key={habit.id}
                style={{
                  ...CARD_STYLE,
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Completion button */}
                <TouchableOpacity
                  onPress={() => toggleMutation.mutate({ habit, isCompleted })}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: isCompleted ? color : 'transparent',
                    borderWidth: isCompleted ? 0 : 2,
                    borderColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isCompleted ? 'checkmark' : (icon as any)}
                    size={18}
                    color={isCompleted ? '#fff' : color}
                  />
                </TouchableOpacity>

                {/* Name + streak chip */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: '#1C1A17',
                      fontWeight: '600',
                      fontSize: 15,
                      textDecorationLine: isCompleted ? 'line-through' : 'none',
                      opacity: isCompleted ? 0.6 : 1,
                    }}
                  >
                    {habit.name}
                  </Text>
                  {streak > 0 && (
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 4,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 10,
                        backgroundColor: color + '24',
                      }}
                    >
                      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>
                        {streak}j
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  }

  // ─── Historique Tab ──────────────────────────────────────────────────────────

  function renderHistoriqueTab() {
    const screenWidth = Dimensions.get('window').width;
    const cellSize = (screenWidth - 32 - 4 * 9) / 10;

    // Build last 30 days array
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const totalHabits = habits.length;

    // Per-day completion rate
    const dayRates = days.map((date) => {
      if (totalHabits === 0) return 0;
      const done = habits.filter((h) =>
        monthLogs.some((l) => l.habit_id === h.id && l.date === date)
      ).length;
      return done / totalHabits;
    });

    // Overall month completion rate
    const overallRate =
      dayRates.length > 0
        ? Math.round((dayRates.reduce((a, b) => a + b, 0) / dayRates.length) * 100)
        : 0;

    // Per-habit streaks for top list
    const habitStreaks = habits
      .map((h) => ({ habit: h, streak: getStreak(h.id, monthLogs) }))
      .filter((x) => x.streak > 0)
      .sort((a, b) => b.streak - a.streak);

    return (
      <View>
        {/* Month overview card */}
        <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 12 }}>
          <Text
            style={{
              color: '#1C1A17',
              fontWeight: '800',
              fontSize: 32,
              letterSpacing: -0.5,
            }}
          >
            {overallRate}%
          </Text>
          <Text style={{ color: '#6B6963', fontSize: 13, marginTop: 2 }}>
            Taux de complétion ce mois
          </Text>
        </View>

        {/* 30-day heatmap */}
        <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 12 }}>
          <Text
            style={{
              color: '#1C1A17',
              fontWeight: '700',
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            Les 30 derniers jours
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {days.map((date, i) => {
              const rate = dayRates[i];
              const isDone = rate > 0;
              return (
                <View
                  key={date}
                  style={{
                    width: cellSize,
                    aspectRatio: 1,
                    borderRadius: 4,
                    backgroundColor: isDone
                      ? `rgba(255,92,26,${0.5 + rate * 0.5})`
                      : 'rgba(28,26,23,0.05)',
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Top streaks */}
        {habitStreaks.length > 0 && (
          <View style={{ ...CARD_STYLE, padding: 16, marginBottom: 12 }}>
            <Text
              style={{
                color: '#1C1A17',
                fontWeight: '700',
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              Meilleures séries
            </Text>
            {habitStreaks.map(({ habit, streak }) => {
              const color = habitColor(habit.color);
              const icon = habitIcon(habit.emoji);
              return (
                <View
                  key={habit.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: color + '24',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  <Text style={{ flex: 1, color: '#1C1A17', fontWeight: '500', fontSize: 14 }}>
                    {habit.name}
                  </Text>
                  <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{streak}j</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  // ─── Nouvelle Tab ────────────────────────────────────────────────────────────

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<'daily' | 'weekdays'>('daily');

  function handleAddTemplate(template: { name: string; color: string; emoji: string }) {
    createHabitMutation.mutate({
      name: template.name,
      color: template.color,
      emoji: template.emoji,
    });
  }

  function handleCreateCustom() {
    const trimmed = newHabitName.trim();
    if (!trimmed) {
      showAlert('Champ requis', 'Le nom de l\'habitude ne peut pas être vide.');
      return;
    }
    if (trimmed.length > 100) {
      showAlert('Nom trop long', 'Le nom ne peut pas dépasser 100 caractères.');
      return;
    }
    createHabitMutation.mutate({
      name: trimmed,
      color: 'primary',
      emoji: 'barbell',
    });
    setNewHabitName('');
    setShowCreateModal(false);
  }

  function renderNouvelleTab() {
    return (
      <View>
        {/* Template grid */}
        <Text
          style={{
            color: '#6B6963',
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Templates rapides
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 20,
          }}
        >
          {TEMPLATES.map((tpl) => {
            const color = habitColor(tpl.color);
            const icon = habitIcon(tpl.emoji);
            return (
              <TouchableOpacity
                key={tpl.name}
                onPress={() => handleAddTemplate({ name: tpl.name, color: tpl.color, emoji: tpl.emoji })}
                style={{
                  width: '47%',
                  ...CARD_STYLE,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color + '24',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={icon as any} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C1A17', fontWeight: '600', fontSize: 13 }}>
                    {tpl.name}
                  </Text>
                  <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                    + Ajouter
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={{
            backgroundColor: '#FF5C1A',
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
            Créer une habitude perso
          </Text>
        </TouchableOpacity>

        {/* Create modal */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
              }}
            >
              <Text
                style={{
                  color: '#1C1A17',
                  fontWeight: '800',
                  fontSize: 20,
                  marginBottom: 20,
                }}
              >
                Nouvelle habitude
              </Text>

              <Text
                style={{
                  color: '#6B6963',
                  fontSize: 13,
                  fontWeight: '500',
                  marginBottom: 8,
                }}
              >
                Nom
              </Text>
              <TextInput
                value={newHabitName}
                onChangeText={setNewHabitName}
                placeholder="Ex. Méditer 10 minutes"
                placeholderTextColor="#6B6963"
                maxLength={100}
                style={{
                  backgroundColor: '#F7F6F3',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E0DA',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: '#1C1A17',
                  fontSize: 15,
                  marginBottom: 20,
                }}
              />

              <Text
                style={{
                  color: '#6B6963',
                  fontSize: 13,
                  fontWeight: '500',
                  marginBottom: 10,
                }}
              >
                Fréquence
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {(['daily', 'weekdays'] as const).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    onPress={() => setNewHabitFrequency(freq)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor:
                        newHabitFrequency === freq ? '#FF5C1A' : '#F7F6F3',
                      borderWidth: 1,
                      borderColor:
                        newHabitFrequency === freq ? '#FF5C1A' : '#E2E0DA',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: newHabitFrequency === freq ? '#fff' : '#6B6963',
                        fontWeight: '600',
                        fontSize: 14,
                      }}
                    >
                      {freq === 'daily' ? 'Tous les jours' : 'Lun-Ven'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleCreateCustom}
                disabled={createHabitMutation.isPending}
                style={{
                  backgroundColor: '#FF5C1A',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginBottom: 12,
                  opacity: createHabitMutation.isPending ? 0.7 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {createHabitMutation.isPending ? 'Création...' : 'Créer'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setNewHabitName('');
                  setShowCreateModal(false);
                }}
                style={{ paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#6B6963', fontSize: 14 }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (habitsLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FF5C1A" />
    </View>
  );

  if (habitsError) return (
    <ErrorScreen variant="network" onRetry={habitsRefetch} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <PluginHeader title="Habits" onBack={() => router.back()} />
      <SubTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 100,
        }}
      >
        {/* Tab content */}
        {activeTab === "Aujourd'hui" && renderTodayTab()}
        {activeTab === 'Historique' && renderHistoriqueTab()}
        {activeTab === 'Nouvelle' && renderNouvelleTab()}
      </ScrollView>
    </SafeAreaView>
  );
}
