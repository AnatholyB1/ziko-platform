'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  IoEllipsisHorizontal,
  IoLockClosedOutline,
} from 'react-icons/io5';
import { AdaptWithAIButton } from './AdaptWithAIButton';

function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const focusableSelectors = [
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const getFocusable = () => Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));

    // Focus first focusable element
    const firstFocusable = getFocusable()[0];
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}

export interface ProgramCardProps {
  id: string;
  name: string;
  goal: string | null;
  weeks_count: number;
  folder_id: string | null;
  folderName: string | null;
  is_template: boolean;
  created_by_coach_id: string | null;
  isSeed: boolean;
  locale?: string;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
  onAdaptWithAI?: (id: string, name: string) => void;
}

const DELETE_TOKEN = 'SUPPRIMER';

export function ProgramCard({
  id,
  name,
  goal,
  weeks_count,
  folderName,
  is_template,
  isSeed,
  locale = 'fr',
  onEdit,
  onDuplicate,
  onAssign,
  onDelete,
}: ProgramCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(deleteOpen, deleteModalRef as React.RefObject<HTMLElement>);

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

  // Reset input when modal opens
  useEffect(() => {
    if (deleteOpen) {
      setDeleteInput('');
    }
  }, [deleteOpen]);

  // Escape key closes delete modal
  useEffect(() => {
    if (!deleteOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDeleteOpen(false);
        setTimeout(() => menuButtonRef.current?.focus(), 0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteOpen]);

  const meta = [
    `${weeks_count} semaine${weeks_count > 1 ? 's' : ''}`,
    goal,
    'template',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* Card */}
      <article className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow group">
        {/* Left: info */}
        <div className="flex flex-col gap-1 min-w-0">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/coach/programs/${id}`)}
            className="text-sm font-bold text-text hover:text-primary text-left truncate focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            aria-label={`Ouvrir le programme ${name}`}
          >
            {name}
          </button>
          <span className="text-xs text-muted">{meta}</span>
          {folderName && (
            <span className="inline-flex self-start mt-1 text-xs font-normal text-muted bg-background border border-border rounded-full px-2 py-0.5">
              {folderName}
            </span>
          )}
        </div>

        {/* Right: own template = context menu ; seed = lock */}
        {isSeed ? (
          <div
            className="relative flex items-center ml-4 shrink-0"
            tabIndex={0}
            aria-label="Utiliser ce template"
          >
            <IoLockClosedOutline className="text-muted text-lg" />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 hidden group-hover:flex group-focus:flex whitespace-nowrap bg-text text-white text-xs font-normal rounded-lg px-3 py-1.5 shadow-md pointer-events-none z-10">
              Utiliser ce template
            </span>
          </div>
        ) : (
          <div className="relative ml-4 shrink-0" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={`Options pour ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-1.5 rounded-lg hover:bg-background text-muted hover:text-text transition-colors"
            >
              <IoEllipsisHorizontal className="text-lg" />
            </button>

            {menuOpen && (
              <div className="bg-white border border-border shadow-lg rounded-xl py-1 absolute right-0 mt-1 z-10 min-w-40">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-normal text-text hover:bg-background cursor-pointer"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDuplicate(id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-normal text-text hover:bg-background cursor-pointer"
                >
                  Dupliquer
                </button>
                {is_template && (
                  <div
                    className="px-4 py-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  >
                    <AdaptWithAIButton
                      programId={id}
                      programName={name}
                      locale={locale}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAssign(id);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-normal text-text hover:bg-background cursor-pointer"
                >
                  Assigner
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-normal text-danger hover:bg-danger/10 cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </article>

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-program-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteOpen(false);
          }}
        >
          <div ref={deleteModalRef} className="bg-white rounded-2xl p-8 max-w-md w-full border border-border shadow-lg">
            <h2 id="delete-program-title" className="text-xl font-bold text-text">
              Supprimer le programme
            </h2>
            <p className="text-sm font-normal text-muted mt-2">
              Cette action est irréversible. Le programme{' '}
              <span className="font-semibold text-text">{name}</span> sera définitivement supprimé.
            </p>
            <label
              className="block text-sm font-semibold text-text mt-6"
              htmlFor="delete-program-input"
            >
              Tapez &ldquo;SUPPRIMER&rdquo; pour confirmer
            </label>
            <input
              id="delete-program-input"
              ref={deleteInputRef}
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={DELETE_TOKEN}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setTimeout(() => menuButtonRef.current?.focus(), 0);
                }}
                className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-normal hover:bg-background transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleteInput !== DELETE_TOKEN || deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    onDelete(id);
                    setDeleteOpen(false);
                    setTimeout(() => menuButtonRef.current?.focus(), 0);
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="bg-danger text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
