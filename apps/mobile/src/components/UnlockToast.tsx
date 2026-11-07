import React, { useEffect, useState } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useThemeStore,
  useTranslation,
  unlockToastAction,
  unlockToastBottom,
  unlockToastDetailKey,
  unlockToastMotion,
  UNLOCK_TOAST_DURATION_MS,
} from '@ziko/plugin-sdk';
import { useAuthStore } from '../stores/authStore';
import { useOverlayGateStore } from '../stores/overlayGateStore';

type LevelUp = NonNullable<ReturnType<typeof useAuthStore.getState>['levelUp']>;

// Phase 46 unlock toast. Driven by authStore.levelUp, queued behind the weekly
// review overlay, 4000 ms, one at a time, cleared after display. Mounted in
// app/(app)/_layout.tsx so it sits above the tab bar (70 + inset + gap).
export function UnlockToast() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const levelUp = useAuthStore((s) => s.levelUp);
  const overlayOpen = useOverlayGateStore((s) => s.weeklyReviewOpen);
  const [shown, setShown] = useState<LevelUp | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Reactive gate: pick a pending level-up once no blocking overlay is open,
  // and drop the on-screen toast (without clearing the store entry) if the
  // overlay opens meanwhile, so it restarts after the overlay closes.
  const action = unlockToastAction({ shown, levelUp, blockingOverlayOpen: overlayOpen });
  useEffect(() => {
    if (action === 'pick' && levelUp) setShown(levelUp);
    else if (action === 'suspend') setShown(null);
  }, [action, levelUp]);

  // Announcement: once per displayed toast.
  useEffect(() => {
    if (!shown) return;
    const count = shown.plugins.length;
    const title = t('plugins.unlocked.toastTitle', { n: shown.to });
    const detail = t(unlockToastDetailKey(count), { k: count });
    AccessibilityInfo.announceForAccessibility(`${title}. ${detail}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // Display timer: runs only while the toast is shown and no overlay is open;
  // cleared after display. Cancelled by the cleanup when the overlay opens.
  useEffect(() => {
    if (!shown || action !== 'run') return;
    const timer = setTimeout(() => {
      if (useAuthStore.getState().levelUp === shown) useAuthStore.getState().clearLevelUp();
      setShown(null);
    }, UNLOCK_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, action]);

  if (!shown || overlayOpen) return null;

  const count = shown.plugins.length;
  const motion = unlockToastMotion(reduceMotion);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: unlockToastBottom(insets.bottom),
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      <MotiView
        accessibilityLiveRegion="polite"
        from={motion.from}
        animate={motion.animate}
        transition={{ type: 'timing', duration: motion.duration }}
        style={{
          maxWidth: 358,
          backgroundColor: theme.surface,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Ionicons name="lock-open" size={18} color={theme.primary} />
        <View>
          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, lineHeight: 20 }}>
            {t('plugins.unlocked.toastTitle', { n: shown.to })}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 20 }}>
            {t(unlockToastDetailKey(count), { k: count })}
          </Text>
        </View>
      </MotiView>
    </View>
  );
}
