'use client';

import type { TriggerConfig as TriggerConfigType, TriggerType } from './FormStatusBadge';

// ─── Trigger labels ────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  first_contact: 'Premier contact',
  after_n_sessions: 'Après N séances',
  fixed_date: 'Date fixe',
  manual: 'Envoi manuel',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TriggerConfigProps {
  value: TriggerConfigType;
  onChange: (config: TriggerConfigType) => void;
  readOnly?: boolean;
}

// ─── TriggerConfig ─────────────────────────────────────────────────────────────

export default function TriggerConfig({ value, onChange, readOnly }: TriggerConfigProps) {
  // ─── Read-only mode ──────────────────────────────────────────────────────────

  if (readOnly) {
    let paramLabel: string | null = null;
    if (value.type === 'after_n_sessions' && value.n_sessions != null) {
      paramLabel = `${value.n_sessions} séance${value.n_sessions > 1 ? 's' : ''}`;
    } else if (value.type === 'fixed_date' && value.fixed_date) {
      paramLabel = value.fixed_date;
    }

    return (
      <div className="bg-[#F0EFE9] rounded-xl p-4">
        <p className="text-sm font-bold text-text">{TRIGGER_LABELS[value.type]}</p>
        {paramLabel && <p className="text-sm text-muted mt-1">{paramLabel}</p>}
      </div>
    );
  }

  // ─── Editable mode ───────────────────────────────────────────────────────────

  const showConditional = true; // always render for CSS transition

  return (
    <div>
      {/* Trigger type dropdown */}
      <select
        value={value.type}
        onChange={(e) => {
          const newType = e.target.value as TriggerType;
          onChange({ type: newType });
        }}
        className="rounded-xl border border-border px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary bg-white"
      >
        <option value="first_contact">Premier contact</option>
        <option value="after_n_sessions">Après N séances</option>
        <option value="fixed_date">Date fixe</option>
        <option value="manual">Envoi manuel</option>
      </select>

      {/* Conditional fields — always rendered, CSS transition on opacity */}
      <div
        className={`mt-3 ${showConditional ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: 'opacity 200ms, max-height 200ms' }}
      >
        {value.type === 'after_n_sessions' && (
          <div>
            <label className="text-xs font-bold text-muted mb-1 block">Nombre de séances</label>
            <input
              type="number"
              min="1"
              value={value.n_sessions ?? 1}
              onChange={(e) => onChange({ ...value, n_sessions: parseInt(e.target.value, 10) })}
              className="w-32 rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {value.type === 'fixed_date' && (
          <div>
            <label className="text-xs font-bold text-muted mb-1 block">Date d&apos;envoi</label>
            <input
              type="date"
              value={value.fixed_date ?? ''}
              onChange={(e) => onChange({ ...value, fixed_date: e.target.value })}
              className="w-48 rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {value.type === 'first_contact' && (
          <p className="text-xs text-muted italic">
            Le formulaire sera envoyé automatiquement lors du premier contact avec l&apos;athlète.
          </p>
        )}

        {value.type === 'manual' && (
          <p className="text-xs text-muted italic">
            Le formulaire est envoyé manuellement depuis la liste des formulaires.
          </p>
        )}
      </div>
    </div>
  );
}
