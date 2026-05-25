import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useThemeStore, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../../apps/mobile/src/stores/authStore';

// ── Types ──────────────────────────────────────────────────────────────────

interface CoachPreviewPayload {
  coach_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  photo_signed_url: string | null;
  kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected' | null;
}

interface LinkRow {
  id: string;
  coach_id: string;
  client_id: string;
  created_at: string;
}

interface LinkStatusResponse {
  link: LinkRow | null;
  preview: CoachPreviewPayload | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CoachScreen({ supabase }: { supabase: any }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── Local state ──
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<CoachPreviewPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeInput, setRevokeInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ── Link status query ──
  const {
    data,
    isLoading,
    refetch,
  } = useQuery<LinkStatusResponse>({
    queryKey: ['coach-link', user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Failed to fetch link status');
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!user?.id,
  });

  const link = data?.link ?? null;

  // ── Stats queries (only enabled when linked) ──
  const { data: sessionsCount } = useQuery<number | null>({
    queryKey: ['coach-sessions', user?.id, link?.created_at],
    queryFn: async () => {
      if (!user?.id || !link?.created_at) return null;
      const { count, error } = await supabase
        .from('workout_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('started_at', link.created_at);
      if (error) return null;
      return count ?? null;
    },
    staleTime: 30_000,
    enabled: !!link && !!user?.id,
  });

  const { data: habitsPct } = useQuery<number | null>({
    queryKey: ['coach-habits-pct', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (habitsError || !habitsData || habitsData.length === 0) return null;

      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', today);
      if (logsError) return null;

      const total = habitsData.length;
      const completed = logsData?.length ?? 0;
      return Math.round((completed / total) * 100);
    },
    staleTime: 30_000,
    enabled: !!link && !!user?.id,
  });

  // ── Handlers ──
  const handleCodeChange = useCallback((v: string) => {
    const filtered = v.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
    setCode(filtered);
    setShowError(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (code.length !== 6 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/preview`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        },
      );
      const responseData = await res.json();
      if (responseData.ok) {
        setPreview(responseData.preview);
        setShowError(false);
      } else {
        setShowError(true);
      }
    } catch {
      setShowError(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, isSubmitting, supabase]);

  const handleConfirmLink = useCallback(async () => {
    if (isLinking) return;
    setIsLinking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/redeem`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        },
      );
      const responseData = await res.json();
      if (responseData.ok) {
        queryClient.invalidateQueries({ queryKey: ['coach-link', user?.id] });
        setPreview(null);
        setCode('');
      } else {
        showAlert(t('coach.error.link_failed'), t('coach.error.try_again'));
      }
    } catch {
      showAlert(t('coach.error.link_failed'), t('coach.error.try_again'));
    } finally {
      setIsLinking(false);
    }
  }, [isLinking, code, supabase, queryClient, user?.id, t]);

  const handleRevoke = useCallback(async () => {
    if (!link || isRevoking) return;
    setIsRevoking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/coach/clients/links/${link.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setShowRevokeModal(false);
        setRevokeInput('');
        queryClient.invalidateQueries({ queryKey: ['coach-link', user?.id] });
        setCode('');
        setPreview(null);
      } else {
        showAlert(t('coach.error.revoke_failed'), t('coach.error.try_again'));
      }
    } catch {
      showAlert(t('coach.error.revoke_failed'), t('coach.error.try_again'));
    } finally {
      setIsRevoking(false);
    }
  }, [link, isRevoking, supabase, queryClient, user?.id, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF5C1A" />
      </SafeAreaView>
    );
  }

  // ── Determine current state ──
  const isStateB = preview !== null;
  const isStateC = !isStateB && link !== null;

  // ── Shared screen title ──
  const ScreenTitle = () => (
    <Text style={{ fontSize: 28, fontWeight: '700', color: '#1C1A17', marginBottom: 8 }}>
      {t('coach.screen_title')}
    </Text>
  );

  // ── Avatar component (shared between State B and C) ──
  const CoachAvatar = ({ photoUrl, displayName }: { photoUrl: string | null; displayName: string }) => (
    photoUrl ? (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: 72, height: 72, borderRadius: 36 }}
      />
    ) : (
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F7F6F3', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-circle-outline" size={72} color="#6B6963" />
      </View>
    )
  );

  // ── Specialties chips (shared) ──
  const SpecialtyChips = ({ specialties }: { specialties: string[] | null }) => {
    if (!specialties || specialties.length === 0) return null;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {specialties.map((specialty) => (
          <View
            key={specialty}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 20,
              backgroundColor: '#F7F6F3',
              borderWidth: 1,
              borderColor: '#E2E0DA',
            }}
          >
            <Text style={{ fontSize: 14, color: '#6B6963' }}>{specialty}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Card shadow style ──
  const cardStyle = {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E0DA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    padding: 16,
    marginTop: 24,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />
        }
      >

        {/* ── STATE A: Code Entry ── */}
        {!isStateB && !isStateC && (
          <>
            <ScreenTitle />
            <Text style={{ fontSize: 14, color: '#6B6963', marginBottom: 16 }}>
              {t('coach.state_a.subtitle')}
            </Text>

            <TextInput
              value={code}
              onChangeText={handleCodeChange}
              placeholder={t('coach.state_a.placeholder')}
              placeholderTextColor="#6B6963"
              autoCapitalize="characters"
              maxLength={6}
              accessibilityLabel={t('coach.state_a.placeholder')}
              accessibilityHint={t('coach.state_a.subtitle')}
              style={{
                height: 56,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E2E0DA',
                paddingHorizontal: 16,
                fontSize: 28,
                fontWeight: '700',
                letterSpacing: 6,
                textAlign: 'center',
                color: '#1C1A17',
              }}
            />

            {showError && (
              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FCA5A5',
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={{ fontSize: 14, color: '#DC2626' }}>
                  {t('coach.state_a.error')}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={code.length !== 6 || isSubmitting}
              accessibilityRole="button"
              accessibilityState={{ disabled: code.length < 6 }}
              style={{
                height: 52,
                borderRadius: 14,
                marginTop: 24,
                backgroundColor: code.length === 6 && !isSubmitting ? '#FF5C1A' : '#E2E0DA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: code.length === 6 ? '#FFFFFF' : '#6B6963',
                  }}
                >
                  {t('coach.state_a.submit')}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── STATE B: Coach Preview ── */}
        {isStateB && preview && (
          <>
            <ScreenTitle />
            <Text style={{ fontSize: 14, color: '#6B6963', marginBottom: 8 }}>
              {t('coach.state_b.subtitle')}
            </Text>

            <View style={cardStyle}>
              {/* Avatar row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CoachAvatar photoUrl={preview.photo_signed_url} displayName={preview.display_name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17' }}>
                    {preview.display_name}
                  </Text>
                  {preview.kyc_status === 'verified' && (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}
                      accessibilityLabel={t('coach.state_b.kyc_badge')}
                    >
                      <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                      <Text style={{ fontSize: 14, color: '#16A34A' }}>
                        {t('coach.state_b.kyc_badge')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Specialty chips */}
              <SpecialtyChips specialties={preview.specialties} />

              {/* Bio */}
              {preview.bio && (
                <Text style={{ fontSize: 14, color: '#6B6963', lineHeight: 20, marginTop: 12 }}>
                  {preview.bio}
                </Text>
              )}

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#E2E0DA', marginTop: 16 }} />

              {/* CTAs */}
              <TouchableOpacity
                onPress={handleConfirmLink}
                disabled={isLinking}
                style={{
                  height: 52,
                  borderRadius: 14,
                  marginTop: 16,
                  backgroundColor: '#FF5C1A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isLinking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                    {t('coach.state_b.confirm')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setPreview(null); setCode(''); }}
                style={{ marginTop: 12, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: '#FF5C1A' }}>
                  {t('coach.state_b.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STATE C: Linked Coach ── */}
        {isStateC && link && data?.preview && (
          <>
            <ScreenTitle />

            <View style={cardStyle}>
              {/* Avatar row */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CoachAvatar photoUrl={data.preview.photo_signed_url} displayName={data.preview.display_name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17' }}>
                    {data.preview.display_name}
                  </Text>
                  {data.preview.kyc_status === 'verified' && (
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}
                      accessibilityLabel={t('coach.state_b.kyc_badge')}
                    >
                      <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                      <Text style={{ fontSize: 14, color: '#16A34A' }}>
                        {t('coach.state_b.kyc_badge')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Specialty chips */}
              <SpecialtyChips specialties={data.preview.specialties} />

              {/* Stats row */}
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17' }}>
                    {sessionsCount !== null && sessionsCount !== undefined ? sessionsCount : '--'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B6963' }}>
                    {t('coach.state_c.sessions_label')}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17' }}>
                    {habitsPct !== null && habitsPct !== undefined ? `${habitsPct}%` : '--'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B6963' }}>
                    {t('coach.state_c.progress_label')}
                  </Text>
                </View>
              </View>

              {/* Linked since */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Ionicons name="calendar-outline" size={16} color="#6B6963" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, color: '#6B6963' }}>
                  {t('coach.state_c.linked_since').replace(
                    '{{date}}',
                    format(new Date(link.created_at), 'dd/MM/yyyy', { locale: fr }),
                  )}
                </Text>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#E2E0DA', marginTop: 16 }} />

              {/* Revoke button */}
              <TouchableOpacity
                onPress={() => setShowRevokeModal(true)}
                accessibilityRole="button"
                accessibilityLabel={t('coach.state_c.revoke')}
                style={{
                  marginTop: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 14, color: '#DC2626' }}>
                  {t('coach.state_c.revoke')}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Confirm Revocation Modal ── */}
      <Modal
        visible={showRevokeModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowRevokeModal(false); setRevokeInput(''); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#1C1A17' }}>
              {t('coach.revoke_modal.title')}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 8 }}>
              {t('coach.revoke_modal.body')}
            </Text>

            <TextInput
              value={revokeInput}
              onChangeText={setRevokeInput}
              placeholder={t('coach.revoke_modal.placeholder')}
              placeholderTextColor="#6B6963"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                height: 48,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E2E0DA',
                paddingHorizontal: 12,
                fontSize: 16,
                color: '#1C1A17',
                marginTop: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => { setShowRevokeModal(false); setRevokeInput(''); }}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#E2E0DA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16, color: '#1C1A17' }}>
                  {t('coach.revoke_modal.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRevoke}
                disabled={revokeInput.trim() !== 'COACH' || isRevoking}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: revokeInput.trim() === 'COACH' ? '#DC2626' : '#E2E0DA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isRevoking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: revokeInput.trim() === 'COACH' ? '#FFFFFF' : '#6B6963',
                    }}
                  >
                    {t('coach.revoke_modal.confirm')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
