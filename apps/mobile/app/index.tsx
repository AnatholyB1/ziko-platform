import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { decideAppGate } from '../src/lib/profileGate';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const profileStatus = useAuthStore((s) => s.profileStatus);

  const gate = decideAppGate({ hasSession: !!session, profile, profileStatus });
  if (gate === 'login') return <Redirect href="/(auth)/login" />;
  if (gate === 'onboarding') return <Redirect href="/(auth)/onboarding/step-1" />;
  if (gate === 'wait') return null;
  return <Redirect href="/(app)" />;
}
