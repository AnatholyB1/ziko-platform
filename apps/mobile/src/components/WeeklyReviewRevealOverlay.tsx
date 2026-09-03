import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@ziko/plugin-sdk';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { appStorage } from '../lib/storage';

const SEEN_MARKER_KEY = 'weekly_review_seen';

interface AthleteStateReviewShape {
  last_review_at: string | null;
  current_focus_summary: string | null;
}

// Reveal moment shown once per completed weekly review (D-03). Mounted as a
// Tabs sibling in apps/mobile/app/(app)/_layout.tsx so it can fire from any
// tab. Reuses Phase 43's CelebrationOverlay dark-exception tokens verbatim
// (see ziko-chat.tsx's CelebrationOverlay / 44-UI-SPEC.md) — only the badge
// glyph (sparkles vs checkmark) and dismiss behavior differ.
export function WeeklyReviewRevealOverlay() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [seenMarker, setSeenMarker] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    appStorage.getString(SEEN_MARKER_KEY).then((v) => setSeenMarker(v));
  }, []);

  const { data } = useQuery<AthleteStateReviewShape | null>({
    queryKey: ['weekly-review-reveal', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_state')
        .select('last_review_at, current_focus_summary')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Grounding rule (44-UI-SPEC.md): never render from incomplete, pending or
  // failed review data — only a non-null last_review_at AND a non-empty
  // current_focus_summary AND a marker mismatch make the overlay visible.
  const isNewReview =
    !!data?.last_review_at &&
    !!data?.current_focus_summary &&
    seenMarker !== undefined &&
    data.last_review_at !== seenMarker;

  const isVisible = isNewReview && !dismissed;

  const dismiss = () => {
    if (data?.last_review_at) {
      appStorage.set(SEEN_MARKER_KEY, data.last_review_at);
      setSeenMarker(data.last_review_at);
    }
    setDismissed(true);
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={{ flex: 1, backgroundColor: '#1C1A17' }}>
        <View
          style={{
            position: 'absolute',
            top: -40,
            left: '50%',
            marginLeft: -180,
            width: 360,
            height: 360,
            borderRadius: 180,
            backgroundColor: 'rgba(255,92,26,0.25)',
          }}
          pointerEvents="none"
        />
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 32 }}>
            <Animated.View
              entering={FadeInUp.springify().damping(12)}
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                backgroundColor: '#FF5C1A',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: 'rgba(255,92,26,0.70)',
                shadowOffset: { width: 0, height: 12 },
                shadowRadius: 40,
                shadowOpacity: 1,
                elevation: 16,
              }}
            >
              <Ionicons name="sparkles" size={38} color="#fff" />
            </Animated.View>

            <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFAF6' }}>
              {t('coach.weeklyReview.headline')}
            </Text>

            <Text style={{ fontSize: 15, fontWeight: '400', color: 'rgba(255,250,246,0.70)', lineHeight: 22 }}>
              {t('coach.weeklyReview.body', { focus: data?.current_focus_summary ?? '' })}
            </Text>

            <TouchableOpacity
              onPress={dismiss}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: '#FF5C1A',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                {t('coach.weeklyReview.cta')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
