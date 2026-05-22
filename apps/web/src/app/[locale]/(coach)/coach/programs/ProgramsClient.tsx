'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IoDocumentTextOutline,
  IoFolderOutline,
} from 'react-icons/io5';
import { ProgramCard } from '@/components/coach/ProgramCard';
// AdaptWithAIButton is rendered inside ProgramCard for is_template programs (imported by ProgramCard)
import { AdaptWithAIButton as _AdaptWithAIButton } from '@/components/coach/AdaptWithAIButton';
import type { ProgramRow, FolderRow } from './page';

interface ProgramsClientProps {
  programs: ProgramRow[];
  folders: FolderRow[];
  locale: string;
  accessToken: string;
  apiUrl: string;
}

export function ProgramsClient({ programs, folders, locale, accessToken, apiUrl }: ProgramsClientProps) {
  const router = useRouter();
  const [activeFolderId, setActiveFolderId] = useState<string | null | 'all' | 'none'>('all');

  const ownPrograms = programs.filter((p) => p.created_by_coach_id !== null);
  const seedPrograms = programs.filter((p) => p.created_by_coach_id === null);

  function filterOwn(list: ProgramRow[]) {
    if (activeFolderId === 'all') return list;
    if (activeFolderId === 'none') return list.filter((p) => p.folder_id === null);
    return list.filter((p) => p.folder_id === activeFolderId);
  }

  const filteredOwn = filterOwn(ownPrograms);

  function folderName(folderId: string | null): string | null {
    if (!folderId) return null;
    return folders.find((f) => f.id === folderId)?.name ?? null;
  }

  function handleEdit(id: string) {
    router.push(`/${locale}/coach/programs/${id}/edit`);
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`${apiUrl}/coach/programs/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error('[ProgramsClient] duplicate error:', err);
    }
  }

  function handleAssign(id: string) {
    router.push(`/${locale}/coach/programs/${id}/assign`);
  }

  function handleAdaptWithAI(id: string, _name: string) {
    router.push(`/${locale}/coach/ai?template=${id}`);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce programme ? Cette action est irréversible.')) return;
    try {
      const res = await fetch(`${apiUrl}/coach/programs/${id}?confirmed=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) router.refresh();
    } catch (err) {
      console.error('[ProgramsClient] delete error:', err);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Programmes</h1>
          <p className="text-sm text-muted mt-1">Vos templates d&apos;entraînement</p>
        </div>
        <a
          href={`/${locale}/coach/programs/new`}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          Nouveau programme
        </a>
      </div>

      {/* Body: folder rail + program grid */}
      <div className="flex gap-8">
        {/* Folder rail */}
        <aside className="w-48 shrink-0 border-r border-border pr-4">
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                onClick={() => setActiveFolderId('all')}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activeFolderId === 'all'
                    ? 'font-bold text-primary bg-primary/10'
                    : 'font-normal text-text hover:bg-background'
                }`}
              >
                Tous les programmes
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActiveFolderId('none')}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  activeFolderId === 'none'
                    ? 'font-bold text-primary bg-primary/10'
                    : 'font-normal text-text hover:bg-background'
                }`}
              >
                Sans dossier
              </button>
            </li>
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className={`w-full text-left flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
                    activeFolderId === folder.id
                      ? 'font-bold text-primary bg-primary/10'
                      : 'font-normal text-text hover:bg-background'
                  }`}
                >
                  <IoFolderOutline className="text-base shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 text-sm text-muted hover:text-text transition-colors px-3"
          >
            + Nouveau dossier
          </button>
        </aside>

        {/* Program grid */}
        <div className="flex-1 min-w-0">
          {/* MES TEMPLATES */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-muted uppercase tracking-wide mb-3">
              Mes templates
            </h2>

            {filteredOwn.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <IoDocumentTextOutline className="text-5xl text-muted" />
                <h3 className="text-xl font-bold text-text mt-4">Aucun programme</h3>
                <p className="text-sm text-muted mt-2 max-w-xs">
                  Créez votre premier template pour commencer à prescrire des programmes à vos clients.
                </p>
                <a
                  href={`/${locale}/coach/programs/new`}
                  className="mt-6 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  Créer mon premier programme
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredOwn.map((p) => (
                  <ProgramCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    goal={p.goal}
                    weeks_count={p.weeks_count}
                    folder_id={p.folder_id}
                    folderName={folderName(p.folder_id)}
                    is_template={p.is_template}
                    created_by_coach_id={p.created_by_coach_id}
                    isSeed={false}
                    locale={locale}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onAssign={handleAssign}
                    onDelete={handleDelete}
                    onAdaptWithAI={handleAdaptWithAI}
                  />
                ))}
              </div>
            )}
          </div>

          {/* BIBLIOTHÈQUE ZIKO */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-muted uppercase tracking-wide">
                Bibliothèque Ziko
              </h2>
              <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                Officiel
              </span>
            </div>

            {seedPrograms.length === 0 ? (
              <p className="text-sm text-muted">Aucun template disponible.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {seedPrograms.map((p) => (
                  <ProgramCard
                    key={p.id}
                    id={p.id}
                    name={p.name}
                    goal={p.goal}
                    weeks_count={p.weeks_count}
                    folder_id={p.folder_id}
                    folderName={null}
                    is_template={p.is_template}
                    created_by_coach_id={p.created_by_coach_id}
                    isSeed={true}
                    locale={locale}
                    onEdit={() => {}}
                    onDuplicate={() => {}}
                    onAssign={handleAssign}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
