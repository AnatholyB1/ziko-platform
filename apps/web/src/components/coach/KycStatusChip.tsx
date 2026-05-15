const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  pending: {
    label: 'En attente',
    classes: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  submitted: {
    label: 'Documents soumis',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  verified: {
    label: 'Vérifié',
    classes: 'bg-primary/10 text-primary border-primary/20',
  },
  rejected: {
    label: 'Rejeté',
    classes: 'bg-red-50 text-red-600 border-red-200',
  },
};

export function KycStatusChip({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center text-sm font-bold px-3 py-1 rounded-full border ${config.classes}`}
    >
      <span className="sr-only">Statut KYC : </span>
      {config.label}
    </span>
  );
}
