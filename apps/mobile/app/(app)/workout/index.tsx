import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useWorkoutStore } from '../../../src/stores/workoutStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useTranslation } from '@ziko/plugin-sdk';
import { useCommunityStore, loadCommunity, shareProgram } from '@ziko/plugin-community';
import type { WorkoutSession, WorkoutProgram, ProgramWorkout } from '@ziko/plugin-sdk';

// ── Day helpers ───────────────────────────────────────────────────────────────
// DB: 1=Mon … 7=Sun
function todayDbDay(): number {
  return (new Date().getDay() + 6) % 7 + 1;
}

// ── ResumeBar ─────────────────────────────────────────────────────────────────
function ResumeBar({ session, theme }: { session: WorkoutSession; theme: any }) {
  const elapsed = session.started_at
    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
    : 0;
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/workout/session')}
      style={{
        marginHorizontal: 20, marginBottom: 12,
        backgroundColor: theme.cardDark, borderRadius: 16, padding: 16,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary + '33', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="pulse" size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.cardDarkText, fontWeight: '700', fontSize: 15 }}>Séance en cours</Text>
        <Text style={{ color: theme.cardDarkText + 'aa', fontSize: 13, marginTop: 2 }}>
          {session.name ?? 'Workout'} · {elapsed}min
        </Text>
      </View>
      <View style={{ backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reprendre</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── ProgramCard ───────────────────────────────────────────────────────────────
const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function ProgramCard({
  program, recentSessions, onManage, theme,
}: {
  program: WorkoutProgram;
  recentSessions: WorkoutSession[];
  onManage: () => void;
  theme: any;
}) {
  const today = todayDbDay();
  const workouts: ProgramWorkout[] = (program.program_workouts ?? []) as ProgramWorkout[];
  const scheduledDays = new Set(workouts.map((w) => w.day_of_week));

  // Sessions this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const doneDays = new Set(
    recentSessions
      .filter((s) => s.started_at && new Date(s.started_at) >= weekStart)
      .map((s) => {
        const d = new Date(s.started_at!).getDay();
        return (d + 6) % 7 + 1;
      })
  );

  const todayWorkout = workouts.find((w) => w.day_of_week === today);

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 16, shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{program.name}</Text>
          {todayWorkout ? (
            <Text style={{ color: theme.primary, fontSize: 13, marginTop: 2 }}>{todayWorkout.name}</Text>
          ) : (
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Repos aujourd'hui</Text>
          )}
        </View>
        <TouchableOpacity onPress={onManage} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
        </TouchableOpacity>
      </View>

      {/* Weekly grid */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAY_SHORT.map((label, i) => {
          const dbDay = i + 1;
          const isToday = dbDay === today;
          const isDone = doneDays.has(dbDay);
          const isScheduled = scheduledDays.has(dbDay);

          let bg = theme.background;
          let textColor = theme.muted;
          let borderColor = theme.border;

          if (isDone) { bg = theme.success + '22'; textColor = theme.success; borderColor = theme.success + '44'; }
          else if (isToday && isScheduled) { bg = theme.primary; textColor = '#fff'; borderColor = theme.primary; }
          else if (isToday) { bg = theme.primary + '22'; textColor = theme.primary; borderColor = theme.primary + '66'; }
          else if (isScheduled) { bg = theme.surface; textColor = theme.text; borderColor = theme.border; }

          return (
            <TouchableOpacity
              key={label + i}
              onPress={() => {
                const w = workouts.find((pw) => pw.day_of_week === dbDay);
                if (w) router.push(`/(app)/workout/${program.id}` as any);
              }}
              style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: 1, borderColor }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: textColor }}>{label}</Text>
              {isDone && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.success, marginTop: 2 }} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── StartModes ────────────────────────────────────────────────────────────────
function StartModes({ activeProgram, theme }: { activeProgram: WorkoutProgram | null; theme: any }) {
  const today = todayDbDay();
  const workouts: ProgramWorkout[] = (activeProgram?.program_workouts ?? []) as ProgramWorkout[];
  const todayWorkout = workouts.find((w) => w.day_of_week === today);

  const modes = [
    {
      icon: 'barbell' as const,
      label: 'Mission du jour',
      sub: todayWorkout?.name ?? (activeProgram ? 'Repos' : 'Aucun programme'),
      color: theme.primary,
      onPress: () => {
        if (todayWorkout) {
          router.push(`/(app)/workout/${activeProgram!.id}` as any);
        } else {
          router.push('/(app)/workout/session');
        }
      },
    },
    {
      icon: 'flash' as const,
      label: 'Libre',
      sub: 'Séance sans programme',
      color: theme.info,
      onPress: () => router.push('/(app)/workout/session'),
    },
    {
      icon: 'sparkles' as const,
      label: 'Coach IA',
      sub: 'Génère ton plan',
      color: theme.violet,
      onPress: () => router.push('/(app)/(plugins)/ai-programs/dashboard' as any),
    },
  ];

  return (
    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, gap: 10 }}>
      {modes.map((m) => (
        <TouchableOpacity
          key={m.label}
          onPress={m.onPress}
          style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, shadowColor: theme.cardDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: m.color + '22', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={m.icon} size={20} color={m.color} />
          </View>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12, textAlign: 'center' }}>{m.label}</Text>
          <Text style={{ color: theme.muted, fontSize: 10, textAlign: 'center' }} numberOfLines={1}>{m.sub}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── WorkoutHistory ────────────────────────────────────────────────────────────
function WorkoutHistory({ sessions, theme }: { sessions: WorkoutSession[]; theme: any }) {
  const shown = sessions.slice(0, 5);
  if (shown.length === 0) return null;

  function fmt(s: WorkoutSession) {
    const d = s.started_at ? new Date(s.started_at) : null;
    if (!d) return '';
    const today = new Date();
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function duration(s: WorkoutSession) {
    if (!s.started_at || !s.ended_at) return null;
    const min = Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000);
    return `${min}min`;
  }

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Récentes</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/workout/history')}>
          <Text style={{ color: theme.primary, fontSize: 14 }}>Tout voir →</Text>
        </TouchableOpacity>
      </View>
      {shown.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => router.push(`/(app)/workout/history` as any)}
          style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.border }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barbell-outline" size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{s.name ?? 'Séance'}</Text>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{fmt(s)}{duration(s) ? ` · ${duration(s)}` : ''}</Text>
          </View>
          {s.total_volume_kg != null && s.total_volume_kg > 0 && (
            <View style={{ backgroundColor: theme.primary + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>{Math.round(s.total_volume_kg)}kg</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Program {
  id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  is_active: boolean;
  created_at: string;
}

export default function WorkoutProgramsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const communityEnabled = enabledPlugins.includes('community');
  const friends = useCommunityStore((s) => s.friends);
  const theme = useThemeStore((s) => s.theme);

  const currentSession = useWorkoutStore((s) => s.currentSession);
  const activeProgram = useWorkoutStore((s) => s.activeProgram);
  const recentSessions = useWorkoutStore((s) => s.recentSessions);
  const loadPrograms = useWorkoutStore((s) => s.loadPrograms);
  const loadRecentSessions = useWorkoutStore((s) => s.loadRecentSessions);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [shareModalProgram, setShareModalProgram] = useState<Program | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showPrograms, setShowPrograms] = useState(false);

  const DAY_LABELS = [t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'), t('day.fri'), t('day.sat'), t('day.sun')];
  const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const toggleDay = (dayIndex: number) => {
    const dbDay = dayIndex + 1;
    setSelectedDays((prev) =>
      prev.includes(dbDay) ? prev.filter((d) => d !== dbDay) : [...prev, dbDay].sort((a, b) => a - b)
    );
  };

  const fetchPrograms = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_programs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPrograms((data ?? []) as Program[]);
  };

  useEffect(() => {
    loadPrograms();
    loadRecentSessions(14);
    fetchPrograms();
  }, [user]);

  useEffect(() => {
    if (communityEnabled) loadCommunity(supabase);
  }, [communityEnabled]);

  const setActiveProgramStore = useWorkoutStore((s) => s.setActiveProgram);

  const createProgram = async () => {
    if (!newName.trim() || !user || selectedDays.length === 0) return;
    const { data, error } = await supabase
      .from('workout_programs')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() || null, days_per_week: selectedDays.length })
      .select()
      .single();
    if (!error && data) {
      const workoutDays = selectedDays.map((dbDay) => ({
        program_id: data.id,
        name: DAY_FULL[dbDay - 1],
        day_of_week: dbDay,
        order_index: dbDay,
      }));
      await supabase.from('program_workouts').insert(workoutDays);
      await setActiveProgramStore(data.id);
      await fetchPrograms();
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setSelectedDays([]);
    }
  };

  const deleteProgram = (id: string) => {
    showAlert('Supprimer le programme', 'Cette action supprimera le programme et toutes ses séances.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('workout_programs').delete().eq('id', id);
          setPrograms(programs.filter((p) => p.id !== id));
          await loadPrograms();
        },
      },
    ]);
  };

  const duplicateProgram = async (prog: Program) => {
    if (!user) return;
    const { data: newProg, error } = await supabase
      .from('workout_programs')
      .insert({ user_id: user.id, name: `${prog.name} (copie)`, description: prog.description, days_per_week: prog.days_per_week })
      .select()
      .single();
    if (error || !newProg) return;

    const { data: srcWorkouts } = await supabase
      .from('program_workouts')
      .select('*, program_exercises(*)')
      .eq('program_id', prog.id)
      .order('day_of_week');

    if (srcWorkouts && srcWorkouts.length > 0) {
      for (const srcW of srcWorkouts) {
        const { data: newW } = await supabase
          .from('program_workouts')
          .insert({ program_id: newProg.id, name: srcW.name, day_of_week: srcW.day_of_week, order_index: srcW.order_index })
          .select()
          .single();
        if (newW && srcW.program_exercises?.length > 0) {
          const exercises = srcW.program_exercises.map((pe: any) => ({
            workout_id: newW.id,
            exercise_id: pe.exercise_id,
            sets: pe.sets, reps: pe.reps, reps_min: pe.reps_min, reps_max: pe.reps_max,
            duration_seconds: pe.duration_seconds, duration_min: pe.duration_min, duration_max: pe.duration_max,
            rest_seconds: pe.rest_seconds, weight_kg: pe.weight_kg, notes: pe.notes, order_index: pe.order_index,
          }));
          await supabase.from('program_exercises').insert(exercises);
        }
      }
    }
    await fetchPrograms();
    await loadPrograms();
  };

  const showProgramActions = (prog: Program) => {
    const buttons: any[] = [
      { text: 'Activer', onPress: () => setActiveProgramStore(prog.id) },
      { text: 'Dupliquer', onPress: () => duplicateProgram(prog) },
    ];
    if (communityEnabled) {
      buttons.push({ text: 'Partager avec un ami', onPress: () => setShareModalProgram(prog) });
    }
    buttons.push(
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteProgram(prog.id) },
      { text: 'Annuler', style: 'cancel' },
    );
    showAlert(prog.name, undefined, buttons);
  };

  const handleShareToFriend = async (friendId: string) => {
    if (!shareModalProgram) return;
    setSharing(true);
    try {
      await shareProgram(supabase, friendId, shareModalProgram.id);
      showAlert('Partagé !', 'Le programme a été envoyé à ton ami.');
      setShareModalProgram(null);
    } catch {
      showAlert('Erreur', 'Impossible de partager le programme.');
    }
    setSharing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', color: theme.text }}>Au boulot.</Text>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
        >
          <Ionicons name="add" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* ResumeBar */}
        {currentSession && <ResumeBar session={currentSession} theme={theme} />}

        {/* ProgramCard */}
        {activeProgram ? (
          <ProgramCard
            program={activeProgram as unknown as WorkoutProgram}
            recentSessions={recentSessions}
            onManage={() => setShowPrograms(true)}
            theme={theme}
          />
        ) : (
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderStyle: 'dashed' }}
          >
            <Ionicons name="barbell-outline" size={32} color={theme.muted} />
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15, marginTop: 10 }}>Créer un programme</Text>
            <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Structure tes entraînements pour progresser</Text>
          </TouchableOpacity>
        )}

        {/* StartModes */}
        <StartModes activeProgram={activeProgram as unknown as WorkoutProgram | null} theme={theme} />

        {/* WorkoutHistory */}
        <WorkoutHistory sessions={recentSessions} theme={theme} />
      </ScrollView>

      {/* Programs management modal */}
      <Modal visible={showPrograms} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: theme.text }}>Mes programmes</Text>
            <TouchableOpacity onPress={() => setShowPrograms(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 40 }}>
            {programs.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 48 }}>
                <Image
                  source={require('../../../assets/image/no_training.png')}
                  style={{ width: 160, height: 160, marginBottom: 8 }}
                  contentFit="contain"
                  transition={300}
                />
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>{t('workout.noPrograms')}</Text>
                <Text style={{ color: theme.muted, marginTop: 8, textAlign: 'center' }}>{t('workout.noProgramsDesc')}</Text>
              </View>
            ) : (
              programs.map((program) => (
                <TouchableOpacity
                  key={program.id}
                  onPress={() => { setShowPrograms(false); router.push(`/(app)/workout/${program.id}` as any); }}
                  onLongPress={() => showProgramActions(program)}
                  style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: program.is_active ? theme.primary : theme.border, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="barbell" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{program.name}</Text>
                      {program.is_active && (
                        <View style={{ backgroundColor: theme.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Actif</Text>
                        </View>
                      )}
                    </View>
                    {program.description && <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>{program.description}</Text>}
                    {program.days_per_week != null && (
                      <Text style={{ color: theme.primary, fontSize: 12, marginTop: 4 }}>{program.days_per_week}{t('workout.daysPerWeekShort')}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => showProgramActions(program)} style={{ padding: 4 }}>
                    <Ionicons name="ellipsis-vertical" size={16} color={theme.muted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              onPress={() => { setShowPrograms(false); setShowCreate(true); }}
              style={{ backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Nouveau programme</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Create Program Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{t('workout.newProgram')}</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>{t('workout.programName')} *</Text>
          <TextInput value={newName} onChangeText={setNewName} placeholder="ex: PPL, Upper/Lower" placeholderTextColor={theme.muted}
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16 }} />

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 6 }}>Description (optionnel)</Text>
          <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="Brève description" placeholderTextColor={theme.muted} multiline numberOfLines={3}
            style={{ backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, color: theme.text, marginBottom: 16, height: 80, textAlignVertical: 'top' }} />

          <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 8 }}>{t('workout.trainingDays')} *</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {DAY_LABELS.map((label, i) => {
              const dbDay = i + 1;
              const isSelected = selectedDays.includes(dbDay);
              return (
                <TouchableOpacity key={label} onPress={() => toggleDay(i)}
                  style={{
                    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderWidth: 1, borderColor: isSelected ? theme.primary : theme.border,
                  }}>
                  <Text style={{ color: isSelected ? '#fff' : theme.muted, fontWeight: '600', fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedDays.length > 0 ? (
            <Text style={{ color: theme.primary, fontSize: 12, marginBottom: 20 }}>
              {selectedDays.length} jour{selectedDays.length > 1 ? 's' : ''} sélectionné{selectedDays.length > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 20 }}>
              Appuie sur les jours où tu t'entraînes
            </Text>
          )}

          <TouchableOpacity onPress={createProgram} disabled={!newName.trim() || selectedDays.length === 0}
            style={{ backgroundColor: newName.trim() && selectedDays.length > 0 ? theme.primary : theme.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('workout.createProgram')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Share with friend Modal */}
      <Modal visible={!!shareModalProgram} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: theme.background, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>Partager avec un ami</Text>
            <TouchableOpacity onPress={() => setShareModalProgram(null)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>
          {shareModalProgram && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="barbell" size={18} color={theme.primary} />
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 15 }}>{shareModalProgram.name}</Text>
            </View>
          )}
          {friends.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 48 }}>
              <Ionicons name="people-outline" size={40} color={theme.border} />
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 12 }}>Aucun ami pour le moment</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              renderItem={({ item: friend }) => (
                <TouchableOpacity
                  onPress={() => handleShareToFriend(friend.id)}
                  disabled={sharing}
                  style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary }}>
                      {(friend.name ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: theme.text, fontWeight: '600', fontSize: 15 }}>
                    {friend.name ?? 'Unknown'}
                  </Text>
                  <Ionicons name="send" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
          {sharing && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
