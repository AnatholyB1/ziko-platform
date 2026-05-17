'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ProfileForm } from './ProfileForm';
import { saveProfile, type CoachIdentityState } from '@/actions/coach-identity';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep2Profile({
  userId,
  apiUrl,
  jwt,
  onSuccess,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  onSuccess: () => void;
}) {
  const t = useTranslations('Onboarding');
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      const result = await saveProfile(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">{t('step2Heading')}</h2>
      <p className="text-sm font-normal text-muted mb-6">{t('step2Subtitle')}</p>
      <form action={formAction} className="flex flex-col gap-4">
        <ProfileForm initial={{}} userId={userId} apiUrl={apiUrl} jwt={jwt} />
        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-red-600">
            {state.message}
          </p>
        )}
        <div className="flex gap-3 mt-6 justify-end">
          <button
            type="submit"
            disabled={pending}
            className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? `${t('step2Cta')}…` : t('step2Cta')}
          </button>
        </div>
      </form>
    </div>
  );
}
