import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/stores/authStore';
import { PluginLoader } from '../src/lib/PluginLoader';
import { useThemeStore } from '../src/stores/themeStore';
import { supabase } from '../src/lib/supabase';
import CustomAlert from '../src/components/CustomAlert';
import BugReportModal from '../src/components/BugReportModal';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setBanner = useThemeStore((s) => s.setBanner);

  useEffect(() => {
    initialize();
  }, []);

  // Sync theme/banner from DB when user is authenticated
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('user_gamification')
      .select('equipped_theme, equipped_banner_name')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.equipped_theme) setTheme(data.equipped_theme);
        if (data?.equipped_banner_name) setBanner(data.equipped_banner_name);
      });
  }, [session?.user?.id]);

  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  if (!isInitialized) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PluginLoader>
            <StatusBar style={theme.statusBarStyle} backgroundColor={theme.statusBarBg} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
            <CustomAlert />
            <BugReportModal />
          </PluginLoader>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
