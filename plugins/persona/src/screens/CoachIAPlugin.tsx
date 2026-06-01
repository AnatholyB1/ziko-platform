import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useThemeStore, showAlert, useCreditStore } from '@ziko/plugin-sdk';
import { SubTabs, AISuggestion, PluginHeader, ErrorScreen } from '@ziko/ui';

// ─── Persona definitions (UI-SPEC §5.4) ───────────────────────────────────────
const PERSONAS = [
  {
    id: 'max',
    name: 'Max',
    style: 'Sergent motivant',
    desc: "Te pousse, sans pitié, dans l'effort.",
    color: '#FF5C1A',
    emoji: '💪',
  },
  {
    id: 'zoe',
    name: 'Zoé',
    style: 'Bienveillante',
    desc: 'Encourage, rassure, valorise tes progrès.',
    color: '#7B5BD0',
    emoji: '🌿',
  },
  {
    id: 'leo',
    name: 'Léo',
    style: 'Tactique pragmatique',
    desc: 'Données, optimisation, performance.',
    color: '#2E7BF6',
    emoji: '📊',
  },
  {
    id: 'rio',
    name: 'Rio',
    style: 'Cool & relax',
    desc: 'Le pote qui dédramatise et rend ça fun.',
    color: '#2E9E5B',
    emoji: '🏖️',
  },
];

// ─── Coaching settings options ─────────────────────────────────────────────────
const COACHING_STYLE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'encouraging', label: 'Encourageant' },
  { value: 'technical', label: 'Technique' },
];

const RESPONSE_LENGTH_OPTIONS = [
  { value: 'short', label: 'Court' },
  { value: 'medium', label: 'Moyen' },
  { value: 'detailed', label: 'Détaillé' },
];

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
}

// ─── CoachIAPlugin ─────────────────────────────────────────────────────────────
export default function CoachIAPlugin({ supabase }: { supabase: any }) {
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Discussion');

  // Credit balance
  const balance = useCreditStore((s) => s.balance);
  const fetchBalance = useCreditStore((s) => s.fetchBalance);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      const token = data?.session?.access_token;
      if (token) fetchBalance(token);
    });
  }, []);

  // Get current user id
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // ─── Queries ────────────────────────────────────────────────────────────────

  // Conversations
  const { data: conversations = [], isLoading: convsLoading, isError: convsError, refetch: convsRefetch } = useQuery({
    queryKey: ['ai_conversations', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      // Fetch last message preview for each conversation
      if (!data || data.length === 0) return [];
      const convoIds = data.map((c: any) => c.id);
      const { data: msgs } = await supabase
        .from('ai_messages')
        .select('conversation_id, content, role, created_at')
        .in('conversation_id', convoIds)
        .order('created_at', { ascending: false });
      const previewMap: Record<string, string> = {};
      if (msgs) {
        for (const msg of msgs) {
          if (!previewMap[msg.conversation_id]) {
            previewMap[msg.conversation_id] = msg.content;
          }
        }
      }
      return data.map((c: any) => ({
        ...c,
        preview: previewMap[c.id] ?? '',
      }));
    },
  });

  // User settings (persona + coaching prefs)
  const { data: settings } = useQuery({
    queryKey: ['user_settings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return (data?.settings as any) ?? {};
    },
  });

  const activePersonaId: string = settings?.ai_persona ?? 'max';
  const activePersona = PERSONAS.find((p) => p.id === activePersonaId) ?? PERSONAS[0];

  // ─── Mutations ───────────────────────────────────────────────────────────────

  // Update a settings key
  const settingsMutation = useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const { data: current } = await supabase
        .from('user_profiles')
        .select('settings')
        .eq('id', userId)
        .single();
      const existing = (current?.settings as any) ?? {};
      const { error } = await supabase
        .from('user_profiles')
        .update({ settings: { ...existing, ...patch } })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings', userId] });
    },
  });

  // Create new conversation
  const newConvoMutation = useMutation<{ id: string; prefilledMessage?: string }, Error, string | undefined>({
    mutationFn: async (prefilledMessage?: string) => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({ user_id: userId, title: 'Nouvelle conversation' })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data.id, prefilledMessage };
    },
    onSuccess: ({ id, prefilledMessage }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_conversations', userId] });
      if (prefilledMessage) {
        router.push({ pathname: '/ai/chat', params: { conversation_id: id, prefill: prefilledMessage } } as any);
      } else {
        router.push({ pathname: '/ai/chat', params: { conversation_id: id } } as any);
      }
    },
    onError: () => {
      showAlert('Erreur', 'Impossible de créer la conversation.');
    },
  });

  // ─── Persona selection handler ───────────────────────────────────────────────
  const selectPersona = (id: string) => {
    // Validate against allowed values (T-37-05-01)
    if (!['max', 'zoe', 'leo', 'rio'].includes(id)) return;
    settingsMutation.mutate({ ai_persona: id });
  };

  // ─── Coaching settings handlers ──────────────────────────────────────────────
  const pickCoachingStyle = () => {
    const current = settings?.ai_coaching_style ?? 'direct';
    showAlert(
      'Ton du coach',
      `Choix actuel : ${COACHING_STYLE_OPTIONS.find((o) => o.value === current)?.label ?? 'Direct'}`,
      [
        ...COACHING_STYLE_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => settingsMutation.mutate({ ai_coaching_style: opt.value }),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  const pickResponseLength = () => {
    const current = settings?.ai_response_length ?? 'medium';
    showAlert(
      'Longueur des réponses',
      `Choix actuel : ${RESPONSE_LENGTH_OPTIONS.find((o) => o.value === current)?.label ?? 'Moyen'}`,
      [
        ...RESPONSE_LENGTH_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => settingsMutation.mutate({ ai_response_length: opt.value }),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  const pickLanguage = () => {
    const current = settings?.ai_language ?? 'fr';
    showAlert(
      'Langue du coach',
      `Choix actuel : ${LANGUAGE_OPTIONS.find((o) => o.value === current)?.label ?? 'Français'}`,
      [
        ...LANGUAGE_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => settingsMutation.mutate({ ai_language: opt.value }),
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ],
    );
  };

  // ─── Header right: credit chip ───────────────────────────────────────────────
  const creditChip = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255,92,26,0.10)',
      }}
    >
      <Ionicons name="flash-outline" size={12} color="#FF5C1A" />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FF5C1A' }}>
        {balance}
      </Text>
    </View>
  );

  // ─── Discussion Tab ───────────────────────────────────────────────────────────
  const renderDiscussion = () => (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Active Persona Banner */}
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: activePersona.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{activePersona.emoji}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
            {activePersona.name}
            <Text style={{ fontWeight: '500', color: theme.muted }}>
              {' '}· {activePersona.style}
            </Text>
          </Text>
          <Text style={{ fontSize: 11, color: '#2E9E5B', marginTop: 4 }}>
            ● En ligne · répond en moins de 2s
          </Text>
        </View>

        {/* Settings button */}
        <TouchableOpacity
          onPress={() => setActiveTab('Personas')}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityLabel="Ouvrir les réglages du coach"
        >
          <Ionicons name="settings-outline" size={16} color={theme.muted} />
        </TouchableOpacity>
      </View>

      {/* Quick Prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginBottom: 16 }}
      >
        {['Plan ma séance', 'Ai-je récupéré ?', 'Mes macros du soir ?', 'Motivation'].map((prompt) => (
          <TouchableOpacity
            key={prompt}
            onPress={() => newConvoMutation.mutate(prompt)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ fontSize: 12, color: theme.text, fontWeight: '500' }}>
              {prompt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* AISuggestion */}
      <AISuggestion
        text="Pose une question précise à ton coach — il a accès à tes séances, ta nutrition et tes habitudes pour te donner des conseils personnalisés."
        actionLabel="Nouvelle discussion"
        onAction={() => newConvoMutation.mutate(undefined)}
        tintColor="#FF5C1A"
      />

      {/* Conversations section */}
      <View style={{ marginTop: 16 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.muted,
            textTransform: 'uppercase',
            letterSpacing: 0.06 * 11,
            marginBottom: 8,
          }}
        >
          Conversations
        </Text>

        {conversations.length === 0 ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
              Aucune conversation
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, textAlign: 'center', lineHeight: 19 }}>
              Lance une discussion avec ton coach !
            </Text>
          </View>
        ) : (
          conversations.map((convo: any) => (
            <TouchableOpacity
              key={convo.id}
              onPress={() =>
                router.push({ pathname: '/ai/chat', params: { conversation_id: convo.id } } as any)
              }
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.border,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
                shadowColor: '#1C1A17',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              {/* Small persona avatar */}
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: activePersona.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16 }}>{activePersona.emoji}</Text>
              </View>

              {/* Content */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Text
                    style={{ flex: 1, fontSize: 13, fontWeight: '700', color: theme.text }}
                    numberOfLines={1}
                  >
                    {convo.title || 'Nouvelle conversation'}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.muted }}>
                    {timeAgo(convo.updated_at)}
                  </Text>
                </View>
                {convo.preview ? (
                  <Text
                    style={{ fontSize: 11, color: theme.muted, lineHeight: 16 }}
                    numberOfLines={1}
                  >
                    {convo.preview}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* New conversation CTA */}
      <TouchableOpacity
        onPress={() => newConvoMutation.mutate(undefined)}
        style={{
          backgroundColor: theme.primary,
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 8,
        }}
      >
        <Ionicons name="chatbubble-outline" size={16} color="#fff" />
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
          Nouvelle conversation
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Personas Tab ─────────────────────────────────────────────────────────────
  const renderPersonas = () => (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Intro text */}
      <Text
        style={{
          fontSize: 13,
          color: theme.muted,
          lineHeight: 13 * 1.5,
          marginBottom: 12,
        }}
      >
        Choisis le coach qui te parle le mieux. Tu peux changer à tout moment.
      </Text>

      {/* Persona cards */}
      {PERSONAS.map((persona) => {
        const isSelected = activePersonaId === persona.id;
        return (
          <TouchableOpacity
            key={persona.id}
            onPress={() => selectPersona(persona.id)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? persona.color : theme.border,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              marginBottom: 12,
              shadowColor: '#1C1A17',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            {/* Avatar */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: persona.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>{persona.emoji}</Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>
                  {persona.name}
                </Text>
                {isSelected && (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: 'rgba(46,158,91,0.12)',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2E9E5B' }}>
                      Actif
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: persona.color,
                  fontWeight: '700',
                  marginBottom: 4,
                }}
              >
                {persona.style}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.muted,
                  lineHeight: 13 * 1.5,
                }}
              >
                {persona.desc}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Coaching settings section */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: theme.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.06 * 11,
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        Préférences du coach
      </Text>

      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        {/* Row: Ton du coach */}
        <TouchableOpacity
          onPress={pickCoachingStyle}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ flex: 1, fontSize: 13, color: theme.text, fontWeight: '500' }}>
            Ton du coach
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginRight: 8 }}>
            {COACHING_STYLE_OPTIONS.find((o) => o.value === (settings?.ai_coaching_style ?? 'direct'))?.label ?? 'Direct'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>

        {/* Row: Longueur des réponses */}
        <TouchableOpacity
          onPress={pickResponseLength}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Text style={{ flex: 1, fontSize: 13, color: theme.text, fontWeight: '500' }}>
            Longueur des réponses
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginRight: 8 }}>
            {RESPONSE_LENGTH_OPTIONS.find((o) => o.value === (settings?.ai_response_length ?? 'medium'))?.label ?? 'Moyen'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>

        {/* Row: Langue du coach */}
        <TouchableOpacity
          onPress={pickLanguage}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <Text style={{ flex: 1, fontSize: 13, color: theme.text, fontWeight: '500' }}>
            Langue du coach
          </Text>
          <Text style={{ fontSize: 13, color: theme.muted, marginRight: 8 }}>
            {LANGUAGE_OPTIONS.find((o) => o.value === (settings?.ai_language ?? 'fr'))?.label ?? 'Français'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.muted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (convsLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FF5C1A" />
    </View>
  );

  if (convsError) return (
    <ErrorScreen variant="network" onRetry={convsRefetch} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader
        title="Coach IA"
        onBack={() => router.back()}
        right={creditChip}
      />

      <SubTabs
        tabs={['Discussion', 'Personas']}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'Discussion' ? renderDiscussion() : renderPersonas()}
    </View>
  );
}
