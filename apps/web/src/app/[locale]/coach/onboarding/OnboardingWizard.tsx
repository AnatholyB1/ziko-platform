'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClientSupabase } from '@/lib/supabase/client';
import { WizardProgress } from '@/components/coach/WizardProgress';
import { WizardStep1Role } from '@/components/coach/WizardStep1Role';
import { WizardStep2Profile } from '@/components/coach/WizardStep2Profile';
import { WizardStep3Kyc } from '@/components/coach/WizardStep3Kyc';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function OnboardingWizard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = Math.min(3, Math.max(1, parseInt(searchParams.get('step') ?? '1', 10)));

  const [userId, setUserId] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClientSupabase();
    supabase.auth.getSession().then((result) => {
      const session = result.data.session;
      if (!session) {
        // D-06: step 1 requires auth — redirect to login with ?next= for resume
        router.push('/fr/login?next=/coach/onboarding');
        setAuthChecked(true);
        return;
      }
      setUserId(session.user.id);
      setJwt(session.access_token);
      setAuthChecked(true);

      // Check if already a coach — redirect to dashboard (idempotent re-visit)
      supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then((profileResult) => {
          const p = profileResult.data as { role: string } | null;
          if (p?.role === 'coach' || p?.role === 'both') {
            if (step === 1) router.push('/coach/dashboard');
          }
          setCurrentRole(p?.role ?? 'client');
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authChecked) return <div className="text-sm font-normal text-muted text-center py-8">Chargement…</div>;
  if (!userId || !jwt) return null; // redirect in progress

  const goToStep = (n: number) => router.push(`/coach/onboarding?step=${n}`);

  return (
    <div className="max-w-lg w-full mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-primary text-center mb-8">ZIKO</h1>
      <p className="text-xl font-bold text-text text-center mb-6">Devenir coach Ziko</p>
      <WizardProgress currentStep={step} totalSteps={3} />
      {step === 1 && (
        <WizardStep1Role
          currentRole={currentRole}
          onSuccess={() => goToStep(2)}
        />
      )}
      {step === 2 && (
        <WizardStep2Profile
          userId={userId}
          apiUrl={API_URL}
          jwt={jwt}
          onSuccess={() => goToStep(3)}
        />
      )}
      {step === 3 && (
        <WizardStep3Kyc
          userId={userId}
          apiUrl={API_URL}
          jwt={jwt}
          onSuccess={() => router.push('/coach/dashboard')}
          onSkip={() => router.push('/coach/dashboard')}
        />
      )}
    </div>
  );
}
