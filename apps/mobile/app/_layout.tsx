import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '../src/stores/authStore';
import { PluginLoader } from '../src/lib/PluginLoader';
import { useThemeStore } from '../src/stores/themeStore';
import { supabase } from '../src/lib/supabase';
import CustomAlert from '../src/components/CustomAlert';
import BugReportModal from '../src/components/BugReportModal';
import CreditEarnToast from '../src/components/CreditEarnToast';
import CreditExhaustionSheet from '../src/components/CreditExhaustionSheet';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { initSentry, setUserContext, clearUserContext } from '../src/lib/sentry';
import {
  useFonts,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';

// Init Sentry before anything renders
initSentry();

// Catch unhandled JS exceptions outside React tree
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  Sentry.captureException(error, { extra: { isFatal } });
  defaultHandler(error, isFatal);
});

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setBanner = useThemeStore((s) => s.setBanner);

  const [fontsLoaded] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
  });

  useEffect(() => {
    initialize();
  }, []);

  // Sync Sentry user context with auth state
  useEffect(() => {
    if (session?.user) {
      setUserContext(session.user.id, session.user.email);
    } else {
      clearUserContext();
    }
  }, [session?.user?.id]);

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

  if (!isInitialized || !fontsLoaded) return null;

  return (
    <ErrorBoundary>
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
              <CreditEarnToast />
              <CreditExhaustionSheet />
            </PluginLoader>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
