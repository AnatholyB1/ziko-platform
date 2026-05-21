import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { useTranslation } from '@ziko/plugin-sdk';

export default function AppLayout() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile?.onboarding_done) return <Redirect href="/(auth)/onboarding/step-1" />;

  return (
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
  );
}
