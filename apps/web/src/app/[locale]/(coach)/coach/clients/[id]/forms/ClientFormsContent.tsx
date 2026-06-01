'use client';

import { useState } from 'react';
import {
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoDocumentTextOutline,
} from 'react-icons/io5';
import { FormStatusBadge } from '@/components/coach/FormStatusBadge';

// RF-03: local QuestionType uses 'yes_no' (not 'yesno' from FormStatusBadge exports)
type QuestionType = 'text' | 'scale' | 'yes_no' | 'choice';

interface FormAnswer {
  question_id: string;
  question_label: string;
  question_type: QuestionType;
  answer_value: string | number;
}

interface FormInstance {
  instance_id: string;
  form_id: string;
  form_title: string;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
  question_count: number;
  answers: FormAnswer[] | null;
}

interface ClientFormsContentProps {
  forms: FormInstance[];
  locale: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatAnswerValue(type: QuestionType, value: string | number): string {
  if (type === 'scale') return `${value} / 10`;
  if (type === 'yes_no') return value === 'yes' ? 'Oui' : 'Non';
  return String(value);
}

const TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Texte libre',
  scale: 'Échelle 1–10',
  yes_no: 'Oui / Non',
  choice: 'Choix unique',
};

export function ClientFormsContent({ forms, locale: _locale }: ClientFormsContentProps) {
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);

  const sorted = [
    ...forms
      .filter((f) => f.status === 'submitted')
      .sort(
        (a, b) =>
          new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime()
      ),
    ...forms.filter((f) => f.status === 'pending'),
  ];

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <IoDocumentTextOutline size={48} color="#E2E0DA" aria-hidden="true" />
        <h2 className="text-[22px] font-bold text-text mt-4">
          Aucun formulaire pour ce client
        </h2>
        <p className="text-sm text-muted mt-2">
          Les formulaires assignés et les réponses apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-background">
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                FORMULAIRE
              </th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                STATUT
              </th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                DATE
              </th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                RÉPONSES
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((form) => {
              const isExpanded = expandedInstanceId === form.instance_id;

              if (form.status === 'submitted') {
                return (
                  <tr key={form.instance_id + '-wrapper'}>
                    <td colSpan={4} className="p-0">
                      {/* Submitted row header */}
                      <div
                        className="grid grid-cols-[1fr_auto_auto_auto] border-t border-border hover:bg-background/60 cursor-pointer transition-colors duration-150 min-h-[56px]"
                        onClick={() =>
                          setExpandedInstanceId(
                            expandedInstanceId === form.instance_id
                              ? null
                              : form.instance_id
                          )
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setExpandedInstanceId(
                              expandedInstanceId === form.instance_id
                                ? null
                                : form.instance_id
                            );
                          }
                        }}
                        aria-expanded={isExpanded}
                      >
                        <div className="py-3 px-4 text-sm font-bold text-text truncate max-w-[280px]">
                          {form.form_title}
                        </div>
                        <div className="py-3 px-4">
                          <FormStatusBadge status={form.status} />
                        </div>
                        <div className="py-3 px-4 text-xs text-muted whitespace-nowrap">
                          {formatDate(form.submitted_at)}
                        </div>
                        <div className="py-3 px-4 text-xs text-muted text-right whitespace-nowrap">
                          <span className="inline-flex items-center">
                            {form.question_count} réponses
                            {isExpanded ? (
                              <IoChevronUpOutline
                                size={16}
                                className="text-muted ml-2 inline transition-transform duration-200"
                                aria-label="Masquer les réponses"
                              />
                            ) : (
                              <IoChevronDownOutline
                                size={16}
                                className="text-muted ml-2 inline transition-transform duration-200"
                                aria-label="Voir les réponses"
                              />
                            )}
                          </span>
                        </div>
                      </div>
                      {/* Expand panel */}
                      <div
                        style={{
                          maxHeight: isExpanded ? '600px' : '0',
                          opacity: isExpanded ? 1 : 0,
                          overflow: 'hidden',
                          transition: isExpanded
                            ? 'max-height 200ms ease-out, opacity 200ms ease-out'
                            : 'max-height 150ms ease-in, opacity 150ms ease-in',
                        }}
                      >
                        <div className="bg-[#F7F6F3] px-4 py-4 border-t border-border">
                          {form.answers?.map((answer, idx) => (
                            <div
                              key={answer.question_id}
                              className={
                                idx < (form.answers?.length ?? 0) - 1
                                  ? 'border-b border-[#E2E0DA] pb-4 mb-4'
                                  : ''
                              }
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-muted uppercase tracking-wide">
                                  {answer.question_label}
                                </span>
                                <span className="bg-[#F0EFE9] text-[#6B6963] rounded px-1.5 py-0.5 text-xs">
                                  {TYPE_LABELS[answer.question_type]}
                                </span>
                              </div>
                              <p className="text-sm text-text">
                                {formatAnswerValue(answer.question_type, answer.answer_value)}
                              </p>
                            </div>
                          ))}
                          <p className="text-xs text-muted italic mt-2">
                            Soumis le {formatDate(form.submitted_at)}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }

              // Pending row
              return (
                <tr
                  key={form.instance_id}
                  className="border-t border-border cursor-default min-h-[56px]"
                >
                  <td className="py-3 px-4 text-sm font-bold text-text max-w-[280px] truncate">
                    {form.form_title}
                  </td>
                  <td className="py-3 px-4">
                    <FormStatusBadge status="pending" />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted italic">—</td>
                  <td className="py-3 px-4 text-xs text-muted italic">—</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sorted.every((f) => f.status === 'pending') && (
          <p className="text-sm text-muted italic text-center py-4">
            L&apos;athlète n&apos;a pas encore soumis de réponses.
          </p>
        )}
      </div>
    </div>
  );
}
