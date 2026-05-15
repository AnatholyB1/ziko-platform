export function WizardProgress({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const pct = Math.round((currentStep / totalSteps) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Étape ${currentStep} sur ${totalSteps}`}
      className="w-full h-1 bg-border rounded-full mb-8"
    >
      <div
        className="h-1 bg-primary rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
