'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  IoEllipsisHorizontal,
  IoLockClosedOutline,
} from 'react-icons/io5';

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
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
}

const DELETE_TOKEN = 'SUPPRIMER';

export function ProgramCard({
  id,
  name,
  goal,
  weeks_count,
  folderName,
  isSeed,
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
  const deleteInputRef = useRef<HTMLInputElement>(null);

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

  // Focus delete input when modal opens
  useEffect(() => {
    if (deleteOpen) {
      setDeleteInput('');
      setTimeout(() => deleteInputRef.current?.focus(), 50);
    }
  }, [deleteOpen]);

  // Escape key closes delete modal
  useEffect(() => {
    if (!deleteOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDeleteOpen(false);
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
      <div
        role="button"
        aria-label={`Ouvrir le programme ${name}`}
        tabIndex={0}
        onClick={() => router.push(`/fr/coach/programs/${id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') router.push(`/fr/coach/programs/${id}`);
        }}
        className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group"
      >
        {/* Left: info */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-bold text-text truncate">{name}</span>
          <span className="text-xs text-muted">{meta}</span>
          {folderName && (
            <span className="inline-flex self-start mt-1 text-xs font-normal text-muted bg-background border border-border rounded-full px-2 py-0.5">
              {folderName}
            </span>
          )}
        </div>

        {/* Right: own template = context menu ; seed = lock */}
        {isSeed ? (
          <div className="relative flex items-center ml-4 shrink-0">
            <IoLockClosedOutline className="text-muted text-lg" />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 hidden group-hover:flex whitespace-nowrap bg-text text-white text-xs font-normal rounded-lg px-3 py-1.5 shadow-md pointer-events-none z-10">
              Utiliser ce template
            </span>
          </div>
        ) : (
          <div className="relative ml-4 shrink-0" ref={menuRef}>
            <button
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
                  className="w-full text-left px-4 py-2 text-sm font-normal text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
          <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-border shadow-lg">
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
                onClick={() => setDeleteOpen(false)}
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
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="bg-red-600 text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
