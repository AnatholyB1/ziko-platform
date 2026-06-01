import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubTabs, AISuggestion, PluginHeader } from '@ziko/ui';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIProgram {
  id: string;
  user_id: string;
  goal: string;
  program_data: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
}

interface UserProfile {
  goal?: string;
  weight_kg?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProgramName(p: AIProgram): string {
  return p.program_data?.name ?? `Programme ${new Date(p.created_at).toLocaleDateString('fr-FR')}`;
}

function getProgramWeeks(p: AIProgram): number {
  return p.program_data?.weeks ?? 8;
}

function getProgramSessions(p: AIProgram): number {
  return p.program_data?.sessions?.length ?? p.program_data?.sessions_per_week ?? 3;
}

function getProgramProgress(p: AIProgram): number {
  // Derive a display progress (0–100) from JSONB; default 0
  const sessions = p.program_data?.sessions;
  if (Array.isArray(sessions) && sessions.length > 0) {
    const done = sessions.filter((s: any) => s.completed).length;
    return Math.round((done / sessions.length) * 100);
  }
  return p.is_active ? 20 : 100;
}

function getGenerateAISuggestion(goal?: string, sessionsPerWeek?: number): string {
  if (goal === 'hypertrophie' || goal === 'muscle_gain') {
    if ((sessionsPerWeek ?? 0) >= 4) {
      return 'Push/Pull/Legs sur 8 semaines est idéal pour ton objectif. 4-5 séances/semaine avec surcharge progressive.';
    }
    return 'Un programme Push/Pull/Legs 8 semaines te permettrait d\'optimiser chaque groupe musculaire avec suffisamment de récupération.';
  }
  if (goal === 'force' || goal === 'strength') {
    return '5×5 sur 12 semaines est la référence pour développer la force brute. Squat, deadlift, bench press — charges lourdes à chaque séance.';
  }
  return 'Endurance progressive sur 6 semaines : alternance cardio/force pour une condition physique globale équilibrée.';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIProgramsPlugin({ supabase }: { supabase: SupabaseClient }) {
  const theme = useThemeStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState('Programme');
  const queryClient = useQueryClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: authData } = useQuery({
    queryKey: ['auth_user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: Infinity,
  });
  const userId = authData?.id ?? '';

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: activeProgram, isLoading: loadingActive } = useQuery({
    queryKey: ['ai_program_active', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      return data as AIProgram | null;
    },
    enabled: !!userId,
  });

  const { data: allPrograms = [], isLoading: loadingAll } = useQuery({
    queryKey: ['ai_programs', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_generated_programs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return (data ?? []) as AIProgram[];
    },
    enabled: !!userId,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user_profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('goal, weight_kg')
        .eq('user_id', userId)
        .maybeSingle();
      return data as UserProfile | null;
    },
    enabled: !!userId,
  });

  // ── Réactiver Mutation ────────────────────────────────────────────────────
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const reactivateMutation = useMutation({
    mutationFn: async (programId: string) => {
      // Step 1: clear all active for this user
      const { error: e1 } = await supabase
        .from('ai_generated_programs')
        .update({ is_active: false })
        .eq('user_id', userId);
      if (e1) throw new Error(e1.message);

      // Step 2: activate selected program
      const { error: e2 } = await supabase
        .from('ai_generated_programs')
        .update({ is_active: true })
        .eq('id', programId);
      if (e2) throw new Error(e2.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_programs', userId] });
      queryClient.invalidateQueries({ queryKey: ['ai_program_active', userId] });
      setReactivatingId(null);
      setActiveTab('Programme');
    },
    onError: (err: any) => {
      setReactivatingId(null);
      showAlert('Erreur', err.message ?? 'Impossible de réactiver le programme');
    },
  });

  const handleReactiver = (programId: string) => {
    showAlert(
      'Réactiver ce programme',
      'Cela désactivera ton programme actuel et activera celui-ci.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réactiver',
          onPress: () => {
            setReactivatingId(programId);
            reactivateMutation.mutate(programId);
          },
        },
      ],
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderProgrammeTab = () => {
    if (loadingActive) {
      return (
        <View>
          {/* Shimmer dark card */}
          <View
            style={{
              height: 200,
              backgroundColor: '#1C1A17',
              borderRadius: 16,
              opacity: 0.4,
              marginBottom: 16,
            }}
          />
          {/* Shimmer AISuggestion */}
          <View
            style={{
              height: 80,
              backgroundColor: theme.border,
              borderRadius: 16,
              opacity: 0.4,
            }}
          />
        </View>
      );
    }

    if (activeProgram) {
      const name = getProgramName(activeProgram);
      const weeks = getProgramWeeks(activeProgram);
      const sessions = getProgramSessions(activeProgram);
      const progress = getProgramProgress(activeProgram);
      const currentWeek = Math.max(1, Math.round((progress / 100) * weeks));
      const totalSessions = weeks * sessions;
      const doneSessions = Math.round((progress / 100) * totalSessions);

      return (
        <View>
          {/* Dark hero card */}
          <View
            style={{
              backgroundColor: '#1C1A17',
              borderRadius: 16,
              padding: 16,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            {/* Glow circle */}
            <View
              style={{
                position: 'absolute',
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: 'rgba(46,123,246,0.30)',
                top: -32,
                right: -32,
                zIndex: 0,
              }}
            />

            {/* Content layer */}
            <View style={{ zIndex: 1 }}>
              {/* Status chip */}
              <View
                style={{
                  backgroundColor: 'rgba(46,123,246,0.25)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  flexDirection: 'row',
                  gap: 4,
                  alignSelf: 'flex-start',
                  marginBottom: 8,
                  alignItems: 'center',
                }}
              >
                <Ionicons name="sparkles" size={12} color="#9DC4FF" />
                <Text style={{ color: '#9DC4FF', fontSize: 12, fontWeight: '600' }}>Programme actif</Text>
              </View>

              {/* Program name */}
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#FFFAF6',
                  marginBottom: 6,
                }}
              >
                {name}
              </Text>

              {/* Progress sub */}
              <Text
                style={{
                  fontSize: 13,
                  color: 'rgba(255,250,246,0.6)',
                  marginBottom: 12,
                }}
              >
                Semaine {currentWeek}/{weeks} · {doneSessions}/{totalSessions} séances
              </Text>

              {/* Progress bar */}
              <View
                style={{
                  backgroundColor: 'rgba(255,250,246,0.12)',
                  height: 4,
                  borderRadius: 2,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    backgroundColor: '#FF5C1A',
                    height: 4,
                    borderRadius: 2,
                    width: `${Math.min(progress, 100)}%`,
                  }}
                />
              </View>

              {/* CTA row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => router.push('/workout/session')}
                  style={{
                    flex: 1,
                    backgroundColor: '#FF5C1A',
                    borderRadius: 10,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFAF6', fontSize: 14, fontWeight: '700' }}>
                    Prochaine séance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(255,250,246,0.10)',
                    borderRadius: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFAF6', fontSize: 14, fontWeight: '600' }}>Détails</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* AISuggestion */}
          <AISuggestion
            text={`Tu avances bien sur "${name}" ! Continue sur ta lancée pour progresser chaque semaine.`}
            tintColor="#2E7BF6"
          />
        </View>
      );
    }

    // Empty state
    return (
      <View>
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 48,
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 16,
          }}
        >
          <Ionicons name="barbell-outline" size={48} color={theme.muted} />
          <Text
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: theme.text,
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            Aucun programme actif
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.muted,
              marginTop: 6,
              textAlign: 'center',
              paddingHorizontal: 32,
            }}
          >
            Génère un programme personnalisé avec ton coach IA pour structurer ton entraînement.
          </Text>
          <TouchableOpacity
            onPress={() => setActiveTab('Générer')}
            style={{
              marginTop: 20,
              backgroundColor: theme.primary,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Créer un programme</Text>
          </TouchableOpacity>
        </View>

        <AISuggestion
          text="Un programme structuré peut doubler tes résultats. Génère ton premier programme IA en moins de 2 minutes !"
          tintColor="#2E7BF6"
        />
      </View>
    );
  };

  const renderGenererTab = () => {
    const goal = userProfile?.goal;
    const suggestionText = getGenerateAISuggestion(goal);

    return (
      <View>
        {/* Launch card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 16,
            shadowColor: '#1C1A17',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {/* Génération IA chip */}
          <View
            style={{
              backgroundColor: 'rgba(46,123,246,0.08)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              alignSelf: 'flex-start',
              marginBottom: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Ionicons name="sparkles" size={12} color="#2E7BF6" />
            <Text style={{ color: '#2E7BF6', fontSize: 12, fontWeight: '700' }}>Génération IA</Text>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: theme.text,
              marginBottom: 8,
            }}
          >
            Crée ton programme sur mesure
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: theme.muted,
              lineHeight: 20,
              marginBottom: 20,
            }}
          >
            Réponds à quelques questions sur tes objectifs, ton niveau et ta disponibilité — ton coach IA génère un programme adapté uniquement pour toi.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/workout/ai-generate')}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Générer un programme</Text>
          </TouchableOpacity>
        </View>

        <AISuggestion text={suggestionText} tintColor="#2E7BF6" />
      </View>
    );
  };

  const renderBibliothequeTab = () => {
    const count = allPrograms.length;

    const libraryAISuggestion =
      count === 0
        ? "Génère ton premier programme IA pour démarrer ta progression structurée !"
        : count === 1
        ? `Tu as ${count} programme dans ta bibliothèque. Complète-le ou génère-en un nouveau pour varier les stimuli.`
        : `Tu as ${count} programmes dans ta bibliothèque. Réactive un ancien programme ou génère un nouveau cycle pour progresser.`;

    if (loadingAll) {
      return (
        <View>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                height: 90,
                backgroundColor: theme.border,
                borderRadius: 14,
                opacity: 0.4,
                marginBottom: 10,
              }}
            />
          ))}
        </View>
      );
    }

    return (
      <View>
        <AISuggestion text={libraryAISuggestion} tintColor="#2E7BF6" />

        <View style={{ marginTop: 16 }}>
          {count === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="library-outline" size={40} color={theme.muted} />
              <Text style={{ color: theme.muted, marginTop: 12, textAlign: 'center', fontSize: 14 }}>
                Aucun programme dans ta bibliothèque.
              </Text>
            </View>
          ) : (
            allPrograms.map((program) => {
              const name = getProgramName(program);
              const weeks = getProgramWeeks(program);
              const progress = getProgramProgress(program);
              const isActive = program.id === activeProgram?.id || program.is_active;
              const isReactivating = reactivatingId === program.id;

              return (
                <View
                  key={program.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    shadowColor: '#1C1A17',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  {/* Program name + status chip */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: '700',
                        color: theme.text,
                        flex: 1,
                        marginRight: 10,
                      }}
                    >
                      {name}
                    </Text>
                    <View
                      style={{
                        backgroundColor: isActive ? 'rgba(46,123,246,0.12)' : 'rgba(46,158,91,0.12)',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: isActive ? '#2E7BF6' : '#2E9E5B',
                        }}
                      >
                        {isActive ? 'En cours' : 'Terminé'}
                      </Text>
                    </View>
                  </View>

                  {/* Sub info */}
                  <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 8 }}>
                    {isActive
                      ? `En cours · ${progress}% · ${weeks} sem`
                      : `Terminé · 100% · ${weeks} sem`}
                  </Text>

                  {/* Progress bar */}
                  <View
                    style={{
                      backgroundColor: theme.border,
                      height: 4,
                      borderRadius: 2,
                      marginBottom: isActive ? 0 : 12,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: isActive ? '#FF5C1A' : '#2E9E5B',
                        height: 4,
                        borderRadius: 2,
                        width: `${isActive ? Math.min(progress, 100) : 100}%`,
                      }}
                    />
                  </View>

                  {/* Réactiver button (only on non-active programs) */}
                  {!isActive && (
                    <TouchableOpacity
                      onPress={() => handleReactiver(program.id)}
                      disabled={isReactivating}
                      style={{
                        marginTop: 12,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: theme.border,
                        paddingVertical: 9,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(28,26,23,0.03)',
                      }}
                    >
                      {isReactivating ? (
                        <ActivityIndicator size="small" color={theme.text} />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={15} color={theme.text} />
                          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                            Réactiver
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Programmes IA" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        <SubTabs
          tabs={['Programme', 'Générer', 'Bibliothèque']}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'Programme' && renderProgrammeTab()}
        {activeTab === 'Générer' && renderGenererTab()}
        {activeTab === 'Bibliothèque' && renderBibliothequeTab()}
      </ScrollView>
    </SafeAreaView>
  );
}
