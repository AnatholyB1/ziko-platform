import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const athleteOnboardingComplete = useAuthStore((s) => s.athleteOnboardingComplete);

  // Both flags are required (D-02): onboarding_done is set by step-7.tsx
  // before the Ziko chat runs, so it alone cannot express "the mandatory
  // flow finished". athlete_state.status === 'active' is written only by
  // the assess_profile tool and is therefore the authoritative completion
  // signal.
  if (session && profile?.onboarding_done && athleteOnboardingComplete) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
