import { KycStatusChip } from './KycStatusChip';

export function WelcomeCard({
  displayName,
  kycStatus,
}: {
  displayName: string;
  kycStatus: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-xl font-bold text-text">Bonjour, {displayName} 👋</h1>
        <KycStatusChip status={kycStatus} />
      </div>
      <p className="text-sm font-normal text-muted mb-4">Votre espace coach est prêt.</p>
      <p className="text-sm font-normal text-muted">
        Inviter un client → (bientôt disponible)
      </p>
    </div>
  );
}
