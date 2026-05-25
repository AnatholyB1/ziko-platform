'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IoChevronForward } from 'react-icons/io5';
import { createClientSupabase } from '@/lib/supabase/client';

const GOAL_CHIPS = [
  'Prise de masse',
  'Perte de poids',
  'Force',
  'Hyrox',
  'Endurance',
  'Mobilité',
  'Reconditionnement',
] as const;

interface FolderRow {
  id: string;
  name: string;
}

export default function NewProgramPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params?.locale ?? 'fr';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState<string>('');
  const [weeksCount, setWeeksCount] = useState<number>(4);
  const [folderId, setFolderId] = useState<string>('');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<FolderRow[]>([]);

  useEffect(() => {
    async function loadFolders() {
      try {
        const supabase = createClientSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
        const res = await fetch(`${apiUrl}/coach/programs/folders`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          setFolders(json.folders ?? json ?? []);
        }
      } catch (err) {
        console.error('[programs/new] load folders error:', err);
      }
    }
    loadFolders();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setNameError('Nom requis');
      return;
    }
    setNameError('');
    setLoading(true);

    try {
      const supabase = createClientSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        router.push(`/${locale}/login`);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiUrl}/coach/programs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          goal: goal || null,
          weeks_count: weeksCount,
          folder_id: folderId || null,
          weeks_data: [],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const newId: string = json.id ?? json.program?.id;
        if (newId) {
          router.push(`/${locale}/coach/programs/${newId}`);
        } else {
          router.push(`/${locale}/coach/programs`);
        }
      } else {
        console.error('[programs/new] POST failed:', res.status);
      }
    } catch (err) {
      console.error('[programs/new] submit error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-8" aria-label="Fil d'Ariane">
        <a
          href={`/${locale}/coach/programs`}
          className="text-muted hover:text-text transition-colors"
        >
          Programmes
        </a>
        <IoChevronForward className="text-muted text-base" />
        <span className="text-text font-bold">Nouveau programme</span>
      </nav>

      {/* Form card */}
      <div className="max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-2xl p-8 shadow-sm"
        >
          <div className="flex flex-col gap-6">
            {/* Nom */}
            <div>
              <label htmlFor="prog-name" className="block text-sm font-bold text-text mb-1.5">
                Nom
              </label>
              <input
                id="prog-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                placeholder="ex : PPL 12 semaines Hyrox"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              {nameError && (
                <p className="text-xs text-danger mt-1">{nameError}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="prog-desc" className="block text-sm font-bold text-text mb-1.5">
                Description{' '}
                <span className="text-muted font-normal">(optionnel)</span>
              </label>
              <textarea
                id="prog-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'objectif et le contexte du programme…"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Objectif */}
            <div>
              <p className="text-sm font-bold text-text mb-2">
                Objectif{' '}
                <span className="text-muted font-normal">(optionnel)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {GOAL_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setGoal(goal === chip ? '' : chip)}
                    className={`border rounded-full px-4 py-2 text-sm cursor-pointer transition-colors ${
                      goal === chip
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border text-text font-normal hover:bg-background'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre de semaines */}
            <div>
              <label htmlFor="prog-weeks" className="block text-sm font-bold text-text mb-1.5">
                Nombre de semaines
              </label>
              <input
                id="prog-weeks"
                type="number"
                min={1}
                max={52}
                value={weeksCount}
                onChange={(e) => setWeeksCount(Math.max(1, Math.min(52, Number(e.target.value))))}
                className="w-24 rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Dossier */}
            <div>
              <label htmlFor="prog-folder" className="block text-sm font-bold text-text mb-1.5">
                Dossier{' '}
                <span className="text-muted font-normal">(optionnel)</span>
              </label>
              <select
                id="prog-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 text-sm font-normal text-text focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="">Aucun dossier</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action row */}
          <div className="flex justify-end gap-3 mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/coach/programs`)}
              className="border border-border bg-white text-text rounded-xl px-6 py-3 text-sm font-normal hover:bg-background transition-colors"
            >
              Abandonner le programme
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Création…' : 'Créer le programme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
