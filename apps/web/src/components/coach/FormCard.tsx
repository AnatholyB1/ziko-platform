'use client';

import { useState, useEffect, useRef } from 'react';
import { IoEllipsisHorizontal } from 'react-icons/io5';
import { FormStatusBadge, CoachForm } from '@/components/coach/FormStatusBadge';

// ─── Trigger label map ─────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<CoachForm['trigger_config']['type'], string> = {
  first_contact: 'Premier contact',
  after_n_sessions: 'Après N séances',
  fixed_date: 'Date fixe',
  manual: 'Envoi manuel',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface FormCardProps {
  form: CoachForm;
  locale: string;
  onEdit: (id: string) => void;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
  onView: (id: string) => void;
}

// ─── FormCard ─────────────────────────────────────────────────────────────────

export function FormCard({ form, locale, onEdit, onPublish, onArchive, onView }: FormCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const formattedDate = new Date(form.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <tr className="form-row border-b border-border hover:bg-[#F7F6F3] transition-colors min-h-[56px]">
      {/* Title */}
      <td className="px-4 py-3 text-sm font-bold text-text max-w-[280px] truncate">
        {form.title}
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <FormStatusBadge status={form.status} />
      </td>

      {/* Trigger type */}
      <td className="px-4 py-3 text-sm text-muted">
        {TRIGGER_LABELS[form.trigger_config.type]}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-xs text-muted">
        {formattedDate}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 relative">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Options"
            onClick={() => setMenuOpen((v) => !v)}
            className="text-muted hover:text-text transition-colors"
          >
            <IoEllipsisHorizontal size={24} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-xl shadow-md z-10 py-1">
              {form.status === 'draft' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onEdit(form.id); }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-[#F7F6F3]"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onPublish(form.id); }}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-[#F7F6F3]"
                  >
                    Publier
                  </button>
                </>
              )}

              {form.status === 'active' && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onView(form.id); }}
                  className="w-full text-left px-4 py-2 text-sm text-text hover:bg-[#F7F6F3]"
                >
                  Voir / Archiver
                </button>
              )}

              {form.status === 'archived' && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onView(form.id); }}
                  className="w-full text-left px-4 py-2 text-sm text-text hover:bg-[#F7F6F3]"
                >
                  Voir
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
