'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IoBarbell } from 'react-icons/io5';
import gsap from 'gsap';
import { ExerciseRow } from '@/components/coach/ExerciseRow';
import { ExerciseSlideOver } from '@/components/coach/ExerciseSlideOver';
import type { CoachExercise, CreateExerciseBody, UpdateExerciseBody } from '@/types/coach';

const CATEGORIES = ['Tous', 'Force', 'Cardio', 'Mobilité', 'HIIT', 'Hyrox', 'Autre'] as const;

interface ExercisesClientProps {
  initialExercises: CoachExercise[];
  accessToken: string;
  apiUrl: string;
  locale: string;
  userId: string;
}

export function ExercisesClient({
  initialExercises,
  accessToken,
  apiUrl,
  locale: _locale,
  userId,
}: ExercisesClientProps) {
  const router = useRouter();
  const [exercises, setExercises] = useState<CoachExercise[]>(initialExercises);
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<CoachExercise | null>(null);

  // GSAP stagger animation when exercises load / change
  useEffect(() => {
    if (exercises.length > 0) {
      gsap.from('.exercise-row', {
        y: 8,
        opacity: 0,
        duration: 0.2,
        stagger: 0.04,
        ease: 'power2.out',
      });
    }
  }, [exercises.length]);

  // Filtered list
  const filtered = exercises
    .filter((e) => activeCategory === 'Tous' || e.category === activeCategory)
    .filter((e) =>
      searchQuery.trim()
        ? e.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
        : true
    );

  // Count label
  const countLabel =
    exercises.length === 1 ? '1 exercice' : `${exercises.length} exercices`;

  function openCreate() {
    setEditingExercise(null);
    setSlideOverOpen(true);
  }

  function openEdit(exercise: CoachExercise) {
    setEditingExercise(exercise);
    setSlideOverOpen(true);
  }

  function closeSlideOver() {
    setSlideOverOpen(false);
    setEditingExercise(null);
  }

  async function handleSave(data: CreateExerciseBody | UpdateExerciseBody) {
    if (editingExercise) {
      // PATCH
      const res = await fetch(`${apiUrl}/coach/exercises/${editingExercise.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = (await res.json()) as { exercise: CoachExercise };
        setExercises((prev) =>
          prev.map((e) => (e.id === editingExercise.id ? json.exercise : e))
        );
        router.refresh();
      } else {
        throw new Error(`PATCH failed: ${res.status}`);
      }
    } else {
      // POST
      const res = await fetch(`${apiUrl}/coach/exercises`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = (await res.json()) as { exercise: CoachExercise };
        setExercises((prev) => [json.exercise, ...prev]);
        router.refresh();
      } else {
        throw new Error(`POST failed: ${res.status}`);
      }
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`${apiUrl}/coach/exercises/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      setExercises((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } else {
      console.error('[ExercisesClient] delete failed:', res.status);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text">Exercices</h1>
            {exercises.length > 0 && (
              <span className="ml-2 bg-background text-muted rounded-full px-2 py-0.5 text-xs font-normal">
                {countLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">Votre bibliothèque personnelle</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          + Nouvel exercice
        </button>
      </div>

      {/* Filter bar */}
      <div
        role="group"
        aria-label="Filtrer par catégorie"
        className="flex gap-2 mb-4 flex-wrap"
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={
                isActive
                  ? 'bg-primary text-white rounded-full px-3 py-1 text-xs font-bold border border-primary'
                  : 'bg-white text-muted rounded-full px-3 py-1 text-xs font-normal border border-border hover:border-primary hover:text-primary transition-colors'
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Search input — only visible when >8 exercises */}
      {exercises.length > 8 && (
        <div className="mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un exercice…"
            className="border border-border rounded-lg px-3 py-2 text-sm text-text w-full max-w-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {/* Empty state (no exercises at all) */}
      {exercises.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <IoBarbell className="text-5xl text-muted" />
          <h2 className="text-xl font-bold text-text mt-4">
            Aucun exercice pour l&apos;instant
          </h2>
          <p className="text-sm text-muted mt-2 max-w-xs">
            Créez votre premier exercice custom et attachez-y une vidéo ou photo
            de démonstration.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Créer mon premier exercice
          </button>
        </div>
      )}

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((exercise) => (
            <div key={exercise.id} className="exercise-row">
              <ExerciseRow
                exercise={exercise}
                onEdit={() => openEdit(exercise)}
                onDelete={() => handleDelete(exercise.id)}
              />
            </div>
          ))}

          {/* Filtered empty state (category or search yields nothing) */}
          {filtered.length === 0 && (
            <p className="text-sm text-muted text-center py-8">
              Aucun exercice pour ce filtre.
            </p>
          )}
        </div>
      )}

      {/* SlideOver */}
      <ExerciseSlideOver
        exercise={editingExercise}
        isOpen={slideOverOpen}
        onClose={closeSlideOver}
        onSave={handleSave}
        userId={userId}
        jwt={accessToken}
      />
    </div>
  );
}
