'use client';
import { useTranslations } from 'next-intl';

export function WizardStep4Import({
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

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">{t('step4Heading')}</h2>
      <p className="text-sm font-normal text-muted mb-6">{t('step4Subtitle')}</p>
      {/* Phase 2: upload UI goes here */}
      <div className="flex gap-3 mt-8 justify-end items-center">
        <button
          type="button"
          onClick={onSkip}
          className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
        >
          {t('step4Skip')}
        </button>
      </div>
    </div>
  );
}
