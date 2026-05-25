type SignalType = 'missed' | 'stale' | 'declining';

const SIGNAL_LABELS: Record<SignalType, string> = {
  missed: 'Séances manquées',
  stale: 'Mesures non mises à jour',
  declining: 'Humeur en baisse',
};
const SIGNAL_CLASSES: Record<SignalType, string> = {
  missed: 'bg-danger-subtle text-danger border border-danger/30',
  stale: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  declining: 'bg-danger-subtle text-danger border border-danger/30',
};

export function ClientSignalChip({ type }: { type: SignalType }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-normal px-2 py-0.5 rounded-full ${SIGNAL_CLASSES[type]}`}
      aria-label={`Signal : ${SIGNAL_LABELS[type]}`}
    >
      {SIGNAL_LABELS[type]}
    </span>
  );
}
