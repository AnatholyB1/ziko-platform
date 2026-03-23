import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { router } from 'expo-router';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../src/stores/themeStore';
import { useTranslation } from '@ziko/plugin-sdk';
import { showBugReport } from '../../src/components/BugReportModal';

function BugReportFAB() {
  const theme = useThemeStore((s) => s.theme);
  const { bottom } = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={() => showBugReport()}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: 80 + bottom,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
        zIndex: 1000,
      }}
    >
      <Ionicons name="bug" size={20} color="#EF4444" />
    </TouchableOpacity>
  );
}

function ChatFAB() {
  const theme = useThemeStore((s) => s.theme);
  const { bottom } = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(app)/(plugins)/community/chat' as any)}
      activeOpacity={0.8}
      style={{
        position: 'absolute',
        bottom: 80 + bottom,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
        zIndex: 1000,
      }}
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const manifests = usePluginRegistry((s) => s.manifests);
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile?.onboarding_done) return <Redirect href="/(auth)/onboarding/step-1" />;

  // Build tab-bar plugin tabs
  const pluginTabs = enabledPlugins.flatMap((pid) => {
    const manifest = manifests[pid];
    if (!manifest) return [];
    return manifest.routes.filter((r) => r.showInTabBar);
  });

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
          name="store"
          options={{
            title: t('tab.store'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size} color={color} />
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
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="(plugins)" options={{ href: null }} />
      </Tabs>
      <ChatFAB />
      <BugReportFAB />
    </>
  );
}
