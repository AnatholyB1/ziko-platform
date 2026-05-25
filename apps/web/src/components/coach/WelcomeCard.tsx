import { useTranslations } from 'next-intl';
import { KycStatusChip } from './KycStatusChip';

export function WelcomeCard({
  displayName,
  kycStatus,
}: {
  displayName: string;
  kycStatus: string;
}) {
  const t = useTranslations('Dashboard');
  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-2xl font-bold text-text">
          {t('welcome', { displayName })}
        </h1>
        <KycStatusChip status={kycStatus} />
      </div>
      <p className="text-sm font-normal text-muted mb-6">{t('subtitle')}</p>
      <p className="text-sm font-normal text-muted">{t('inviteTeaser')}</p>
    </div>
  );
}
