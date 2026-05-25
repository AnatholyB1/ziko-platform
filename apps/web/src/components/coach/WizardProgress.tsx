import { useTranslations } from 'next-intl';

export function WizardProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const t = useTranslations('Onboarding');
  const pct = Math.round((currentStep / totalSteps) * 100);
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-muted uppercase tracking-wide">
          {t('progressLabel', { current: currentStep, total: totalSteps })}
        </p>
        <p className="text-xs font-bold text-text">{pct}%</p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={t('progressLabel', { current: currentStep, total: totalSteps })}
        className="w-full h-1.5 bg-border rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
