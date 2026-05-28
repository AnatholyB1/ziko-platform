'use client';

// ─── TypeScript interfaces for Coach Forms (exported for downstream use) ──────

export type QuestionType = 'text' | 'scale' | 'yesno' | 'choice';

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  choices?: string[];
}

export type TriggerType = 'first_contact' | 'after_n_sessions' | 'fixed_date' | 'manual';

export interface TriggerConfig {
  type: TriggerType;
  n_sessions?: number;
  fixed_date?: string;
}

export interface CoachForm {
  id: string;
  title: string;
  questions: FormQuestion[];
  trigger_config: TriggerConfig;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
}

// ─── FormStatusBadge component ────────────────────────────────────────────────

interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived' | 'submitted' | 'pending';
}

const STATUS_CONFIG: Record<
  FormStatusBadgeProps['status'],
  { bg: string; text: string; label: string }
> = {
  draft: {
    bg: 'bg-[#F0EFE9]',
    text: 'text-[#6B6963]',
    label: 'Brouillon',
  },
  active: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#16A34A]',
    label: 'Actif',
  },
  archived: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#DC2626]',
    label: 'Archivé',
  },
  submitted: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#16A34A]',
    label: 'Soumis',
  },
  pending: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#D97706]',
    label: 'En attente',
  },
};

export function FormStatusBadge({ status }: FormStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold inline-flex items-center ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
