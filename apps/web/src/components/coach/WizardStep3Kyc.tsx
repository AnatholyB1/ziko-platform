'use client';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { KycDocList } from './KycDocList';
import { saveKyc, type CoachIdentityState } from '@/actions/coach-identity';
import type { UploadedDoc } from './FileUploadRow';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep3Kyc({
  userId,
  apiUrl,
  jwt,
  onSuccess,
  onSkip,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  onSuccess: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations('Onboarding');
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      fd.set('kyc_docs', JSON.stringify(docs));
      const result = await saveKyc(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">{t('step3Heading')}</h2>
      <p className="text-sm font-normal text-muted mb-6">{t('step3Subtitle')}</p>
      <KycDocList userId={userId} apiUrl={apiUrl} jwt={jwt} onChange={setDocs} />
      {state.status === 'error' && (
        <p role="alert" className="text-sm font-normal text-danger mt-3">
          {state.message}
        </p>
      )}
      <form action={formAction}>
        <div className="flex gap-3 mt-8 justify-end items-center">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
          >
            {t('step3Skip')}
          </button>
          <button
            type="submit"
            disabled={pending || docs.length === 0}
            className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? `${t('step3Cta')}…` : t('step3Cta')}
          </button>
        </div>
      </form>
    </div>
  );
}
