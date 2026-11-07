import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import {
  PLUGIN_LEVEL_MAP,
  getPluginIdFromSegments,
  isPluginRouteLocked,
  showAlert,
  useTranslation,
} from '@ziko/plugin-sdk';
import { useAuthStore } from '../../../src/stores/authStore';

// Shared guard for every plugin route (D-05): a deep link / push notification to
// a plugin the athlete has not unlocked yet is redirected home with an alert.
// Level-1 plugins are never blocked, even before the level has been read.
export default function PluginsLayout() {
  const segments = useSegments();
  const { t } = useTranslation();
  const effectiveLevel = useAuthStore((s) => s.effectiveLevel);
  const levelLoaded = useAuthStore((s) => s.levelLoaded);

  const pluginId = getPluginIdFromSegments(segments);
  const info = pluginId ? PLUGIN_LEVEL_MAP[pluginId] : undefined;
  const isLocked = isPluginRouteLocked(segments, effectiveLevel);
  // Gated plugin whose level is not known yet: hold rendering instead of flashing it.
  const isPending = !levelLoaded && !!info && !info.mandatory && info.minLevel > 1;

  useEffect(() => {
    if (!levelLoaded || !isLocked || !info) return;
    router.replace('/(app)/');
    showAlert(
      t('plugins.locked.deepLinkTitle'),
      t('plugins.locked.deepLinkMessage', {
        name: info.name,
        level: info.minLevel,
        current: effectiveLevel,
      }),
    );
  }, [levelLoaded, isLocked, pluginId]);

  if (isPending || (levelLoaded && isLocked)) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="nutrition/dashboard" />
      <Stack.Screen name="nutrition/log" />
      <Stack.Screen name="persona/customize" />
      <Stack.Screen name="habits/dashboard" />
      <Stack.Screen name="habits/log" />
      <Stack.Screen name="stats/dashboard" />
      <Stack.Screen name="stats/exercise" />
      <Stack.Screen name="stats/session" />
      <Stack.Screen name="gamification/dashboard" />
      <Stack.Screen name="gamification/shop" />
      <Stack.Screen name="community/dashboard" />
      <Stack.Screen name="community/friends" />
      <Stack.Screen name="community/chat" />
      <Stack.Screen name="community/conversation" />
      <Stack.Screen name="community/challenges" />
      <Stack.Screen name="community/challenge-detail" />
      <Stack.Screen name="community/create-challenge" />
      <Stack.Screen name="community/compare" />
      <Stack.Screen name="community/invite" />
      <Stack.Screen name="stretching/dashboard" />
      <Stack.Screen name="stretching/session" />
      <Stack.Screen name="sleep/dashboard" />
      <Stack.Screen name="sleep/log" />
      <Stack.Screen name="measurements/dashboard" />
      <Stack.Screen name="measurements/log" />
      <Stack.Screen name="timer/dashboard" />
      <Stack.Screen name="timer/manager" />
      <Stack.Screen name="timer/editor" />
      <Stack.Screen name="ai-programs/dashboard" />
      <Stack.Screen name="ai-programs/generate" />
      <Stack.Screen name="journal/dashboard" />
      <Stack.Screen name="journal/entry" />
      <Stack.Screen name="hydration/dashboard" />
      <Stack.Screen name="cardio/dashboard" />
      <Stack.Screen name="cardio/log" />
      <Stack.Screen name="cardio/tracker" />
      <Stack.Screen name="cardio/[id]" />
      <Stack.Screen name="rpe/index" />
      <Stack.Screen name="wearables/dashboard" />
      <Stack.Screen name="supplements/list" />
      <Stack.Screen name="supplements/detail" />
      <Stack.Screen name="supplements/compare" />
    </Stack>
  );
}
