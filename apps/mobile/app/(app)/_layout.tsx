import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useAIStore } from '../../src/stores/aiStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';

function AIChatFAB() {
  const toggleChat = useAIStore((s) => s.toggleChat);
  const { bottom } = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={toggleChat}
      style={{
        position: 'absolute',
        bottom: 70 + bottom + 16,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FF5C1A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF5C1A',
        shadowOpacity: 0.5,
        shadowRadius: 12,
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
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const enabledPlugins = usePluginRegistry((s) => s.enabledPlugins);
  const manifests = usePluginRegistry((s) => s.manifests);
  const insets = useSafeAreaInsets();

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
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E2E0DA',
            borderTopWidth: 1,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
            height: 70 + insets.bottom,
          },
          tabBarActiveTintColor: '#FF5C1A',
          tabBarInactiveTintColor: '#7A7670',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{
            title: 'Workout',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="barbell" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="store"
          options={{
            title: 'Plugins',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden screens — not shown in tab bar */}
        <Tabs.Screen name="ai" options={{ href: null }} />
        <Tabs.Screen name="(plugins)" options={{ href: null }} />
      </Tabs>
      <AIChatFAB />
    </>
  );
}
