'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { promoteRole, type CoachIdentityState } from '@/actions/coach-identity';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep1Role({
  currentRole,
  onSuccess,
}: {
  currentRole: string | null;
  onSuccess: () => void;
}) {
  const t = useTranslations('Onboarding');
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      const result = await promoteRole(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  const isExistingAthlete = currentRole === 'client';

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">{t('step1Heading')}</h2>
      <p className="text-sm font-normal text-muted mb-8">
        {isExistingAthlete ? t('step1BodyBoth') : t('step1BodyNew')}
      </p>
      <form action={formAction} className="flex gap-3 mt-8 justify-end items-center">
        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-danger mr-auto">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? `${t('step1Cta')}…` : t('step1Cta')}
        </button>
      </form>
    </div>
  );
}
