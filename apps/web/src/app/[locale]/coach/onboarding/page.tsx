// This page is OUTSIDE the (coach) layout — no auth guard fires on load.
// Auth is checked client-side in OnboardingWizard for step 1 (D-06).
// Suspense required: OnboardingWizard uses useSearchParams() (RESEARCH Pitfall 2).
import { Suspense } from 'react';
import { OnboardingWizard } from './OnboardingWizard';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <Suspense fallback={<div className="text-sm font-normal text-muted py-8">Chargement…</div>}>
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
