import '../../src/tasks/notificationTask';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Tabs, Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { useUserPrefsStore } from '../../src/stores/userPrefsStore';
import { useTranslation } from '@ziko/plugin-sdk';
import { supabase } from '../../src/lib/supabase';
import { useNotificationSetup } from '../../src/hooks/useNotificationSetup';
import { NotificationPermissionModal } from '../../src/components/NotificationPermissionModal';

// Set foreground notification display behavior at module scope (required by Expo SDK 54)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const url = response.notification.request.content.data?.url as string | undefined;
  if (url) {
    router.push(url as any);
  }
}

export default function AppLayout() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const userId = useAuthStore((s) => s.user?.id);

  const { showModal, onActivate, onSkip } = useNotificationSetup(userId, session);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('user_profiles')
      .select('units, language, region')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          useUserPrefsStore.getState().setPrefs({
            units: (data as any).units ?? 'metric',
            language: (data as any).language ?? 'fr',
            region: (data as any).region ?? 'FR',
          });
        }
      });
  }, [userId]);

  // Notification response listener (handles background/killed → opened by tap)
  useEffect(() => {
    if (!session || !userId) return;

    // Handle last response for the killed → opened case
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleNotificationResponse(lastResponse);
    }

    // Subscribe to notification taps while app is running
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => sub.remove();
  }, [session, userId]);

  // AppState listener for badge sync (Phase 3 will wire notificationStore.syncUnreadCount)
  useEffect(() => {
    const stateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // badge sync placeholder — Phase 3 will add notificationStore.getState().syncUnreadCount()
      }
    });
    return () => stateSub.remove();
  }, []);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile?.onboarding_done) return <Redirect href="/(auth)/onboarding/step-1" />;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.tabBarBg,
            borderTopWidth: 0,
            borderTopColor: 'transparent',
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
            height: 70 + insets.bottom,
            elevation: 0,
            shadowOpacity: 0,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 0,
          },
          tabBarActiveTintColor: theme.tabBarActive,
          tabBarInactiveTintColor: theme.tabBarInactive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab.home'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            title: t('tab.workout'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t('tab.profile'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden screens — not shown in tab bar */}
        <Tabs.Screen name="store" options={{ href: null }} />
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="(plugins)" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="help" options={{ href: null }} />
        <Tabs.Screen name="legal" options={{ href: null }} />
        <Tabs.Screen name="referral" options={{ href: null }} />
        <Tabs.Screen name="modules" options={{ href: null }} />
      </Tabs>
      <NotificationPermissionModal
        visible={showModal}
        onActivate={onActivate}
        onSkip={onSkip}
      />
    </>
  );
}
