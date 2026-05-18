'use client';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  useReactTable,
} from '@tanstack/react-table';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientSignalChip } from './ClientSignalChip';
import { CompareButton } from './CompareButton';
import { RevokeConfirmModal } from './RevokeConfirmModal';

type ClientRow = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  last_active: string | null;
  signal_missed: boolean;
  signal_stale: boolean;
  signal_mood: boolean;
  sessions_this_week: number;
  habits_pct: number | null;
};

type SignalFilter = 'all' | 'missed' | 'stale' | 'declining';
const MAX_SELECTED = 5;

function IndeterminateCheckbox({
  indeterminate,
  className = '',
  ...rest
}: { indeterminate: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);
  useEffect(() => {
    if (typeof indeterminate === 'boolean') {
      ref.current.indeterminate = !rest.checked && indeterminate;
    }
  }, [ref, indeterminate, rest.checked]);
  return (
    <input
      type="checkbox"
      ref={ref}
      {...rest}
      className={`h-4 w-4 rounded border-border text-primary focus:ring-primary ${className}`}
    />
  );
}

function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return '–';
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Il y a 1 jour';
  return `Il y a ${days} jours`;
}

function RevokeClientModal({
  client,
  locale,
  onClose,
}: {
  client: ClientRow;
  locale: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const handleRevoke = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    const res = await fetch(`${apiUrl}/coach/clients/links/${client.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      onClose();
      router.refresh();
    }
  };

  return (
    <RevokeConfirmModal
      open={true}
      title="Retirer ce client ?"
      body={`${client.name ?? 'Ce client'} perdra l'accès à vos programmes assignés. Vous perdrez l'accès à leurs données.`}
      confirmLabel='Tapez "COACH" pour confirmer'
      confirmCta="Retirer"
      cancelLabel="Garder ce client"
      onConfirm={handleRevoke}
      onCancel={onClose}
    />
  );
}

export function ClientsTable({ rows, locale }: { rows: ClientRow[]; locale: string }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [revokeTarget, setRevokeTarget] = useState<ClientRow | null>(null);

  // Signal pre-filter — applied BEFORE TanStack receives data
  const filteredRows = rows.filter((row) => {
    if (signalFilter === 'missed') return row.signal_missed;
    if (signalFilter === 'stale') return row.signal_stale;
    if (signalFilter === 'declining') return row.signal_mood;
    return true;
  });

  const columns: ColumnDef<ClientRow>[] = [
    {
      id: 'select',
      header: ({ table }) => {
        const selectedCount = Object.keys(table.getState().rowSelection).length;
        return (
          <IndeterminateCheckbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            disabled={!table.getIsAllRowsSelected() && selectedCount >= MAX_SELECTED}
            aria-label="Tout sélectionner"
          />
        );
      },
      cell: ({ row, table }) => {
        const selectedCount = Object.keys(table.getState().rowSelection).length;
        const disabled = !row.getIsSelected() && selectedCount >= MAX_SELECTED;
        return (
          <IndeterminateCheckbox
            checked={row.getIsSelected()}
            disabled={disabled}
            indeterminate={false}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Sélectionner ${row.original.name ?? row.original.id}`}
            className={disabled ? 'cursor-not-allowed opacity-40' : ''}
          />
        );
      },
      size: 40,
    },
    {
      accessorKey: 'name',
      header: 'Client',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center overflow-hidden shrink-0">
            {row.original.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.original.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-muted">
                {(row.original.name ?? '?')[0].toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push(`/${locale}/coach/clients/${row.original.id}`)}
            className="text-sm font-normal text-text hover:text-primary hover:underline text-left"
          >
            {row.original.name ?? 'Client sans nom'}
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'last_active',
      header: 'Dernière activité',
      cell: ({ row }) => (
        <span className="text-sm text-muted">{formatRelativeDate(row.original.last_active)}</span>
      ),
    },
    {
      id: 'signals',
      header: 'Signaux',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.signal_missed && <ClientSignalChip type="missed" />}
          {row.original.signal_stale && <ClientSignalChip type="stale" />}
          {row.original.signal_mood && <ClientSignalChip type="declining" />}
        </div>
      ),
    },
    {
      id: 'compliance',
      header: 'Compliance',
      cell: ({ row }) => (
        <div className="text-sm text-text">
          <div>{row.original.sessions_this_week}/3 séances</div>
          <div className="text-muted">
            {row.original.habits_pct !== null ? `${row.original.habits_pct}% habitudes` : '–'}
          </div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${locale}/coach/clients/${row.original.id}`)}
            className="text-sm text-primary hover:underline"
          >
            Voir
          </button>
          <button
            onClick={() => setRevokeTarget(row.original)}
            className="text-sm text-red-600 hover:underline"
            aria-label={`Retirer ${row.original.name ?? row.original.id}`}
          >
            Retirer
          </button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { rowSelection, globalFilter },
    enableRowSelection: (row) => {
      const selectedCount = Object.keys(rowSelection).length;
      return row.getIsSelected() || selectedCount < MAX_SELECTED;
    },
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection);

  const SIGNAL_CHIPS: { key: SignalFilter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'missed', label: 'Séances manquées' },
    { key: 'stale', label: 'Mesures non mises à jour' },
    { key: 'declining', label: 'Humeur en baisse' },
  ];

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-xl font-bold text-text mb-2">Aucun client lié</h3>
        <p className="text-sm text-muted mb-6">
          Invitez votre premier client pour voir ses données ici.
        </p>
        <a
          href={`/${locale}/coach/invitations`}
          className="inline-flex items-center bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90"
        >
          Gérer les invitations →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Rechercher un client…"
          className="border border-border rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filtres signal">
          {SIGNAL_CHIPS.map((chip) => (
            <button
              key={chip.key}
              role="tab"
              aria-selected={signalFilter === chip.key}
              onClick={() => setSignalFilter(chip.key)}
              className={`px-4 py-1.5 rounded-full border text-sm font-normal transition-colors ${
                signalFilter === chip.key
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-border bg-white text-muted hover:border-primary/50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-sm text-muted">
                  Aucun client ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-background/60">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky compare button — visible when >= 2 selected */}
      <CompareButton ids={selectedIds} />

      {/* Revoke modal */}
      {revokeTarget && (
        <RevokeClientModal
          client={revokeTarget}
          locale={locale}
          onClose={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
