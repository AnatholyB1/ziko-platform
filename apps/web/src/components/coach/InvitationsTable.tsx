'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CoachInvitationWithStatus } from '@ziko/coach-sdk';
import { FilterChipGroup } from './FilterChipGroup';
import { RevokeConfirmModal } from './RevokeConfirmModal';

type Filter = 'active' | 'all';

const STATUS_CHIP: Record<CoachInvitationWithStatus['status'], string> = {
  active: 'bg-success-subtle text-success border-success/30',
  used: 'bg-blue-50 text-blue-700 border-blue-200',
  expired: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  revoked: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

export function InvitationsTable({
  rows,
  onRevoke,
}: {
  rows: CoachInvitationWithStatus[];
  onRevoke: (id: string) => Promise<void>;
}) {
  const t = useTranslations('CoachInvitations');
  const [filter, setFilter] = useState<Filter>('active');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filtered = filter === 'active' ? rows.filter((r) => r.status === 'active') : rows;
  const visibleRows = filtered;

  return (
    <div className="mt-6">
      <div className="mb-4">
        <FilterChipGroup<Filter>
          options={[
            { key: 'active', label: t('filter.active') },
            { key: 'all', label: t('filter.all') },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {visibleRows.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-base font-semibold text-text">{t('emptyHeading')}</div>
          <div className="text-sm text-muted mt-2 max-w-md mx-auto">{t('emptyBody')}</div>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background text-muted font-semibold uppercase text-xs tracking-wide">
              <th className="py-3 px-4 text-left">{t('table.code')}</th>
              <th className="py-3 px-4 text-left">{t('table.createdAt')}</th>
              <th className="py-3 px-4 text-left">{t('table.expiresAt')}</th>
              <th className="py-3 px-4 text-left">{t('table.status')}</th>
              <th className="py-3 px-4 text-left">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-background/60">
                <td className="py-3 px-4 font-mono tabular-nums">{r.code}</td>
                <td className="py-3 px-4">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="py-3 px-4">
                  {r.expires_at
                    ? new Date(r.expires_at).toLocaleDateString('fr-FR')
                    : t('noExpiry')}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center text-xs font-semibold rounded-full px-3 py-1 border ${STATUS_CHIP[r.status]}`}
                  >
                    {t(`status.${r.status}`)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {r.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(r.id)}
                      className="text-danger text-sm font-normal hover:underline"
                    >
                      {t('revokeCta')}
                    </button>
                  ) : (
                    <span className="text-muted">{t('noRevoke')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RevokeConfirmModal
        open={confirmingId !== null}
        title={t('revokeModal.title')}
        body={t('revokeModal.body')}
        confirmLabel={t('revokeModal.confirmLabel')}
        confirmCta={t('revokeModal.confirmCta')}
        cancelLabel={t('revokeModal.cancel')}
        onCancel={() => setConfirmingId(null)}
        onConfirm={async () => {
          if (confirmingId) {
            await onRevoke(confirmingId);
            setConfirmingId(null);
          }
        }}
      />
    </div>
  );
}
