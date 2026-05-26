'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { MuscleChipSelector } from './MuscleChipSelector';
import { ExerciseMediaUpload } from './ExerciseMediaUpload';
import type { CoachExercise, CreateExerciseBody, UpdateExerciseBody } from '@/types/coach';

export interface ExerciseSlideOverProps {
  exercise: CoachExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateExerciseBody | UpdateExerciseBody) => Promise<void>;
  userId: string;
  jwt: string;
}

export function ExerciseSlideOver({
  exercise,
  isOpen,
  onClose,
  onSave,
  userId,
  jwt,
}: ExerciseSlideOverProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  // Validation errors
  const [nameError, setNameError] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Refs for focus management and GSAP shake
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameFieldRef = useRef<HTMLDivElement>(null);
  const categoryFieldRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Populate form when editing or reset when creating
  useEffect(() => {
    if (isOpen) {
      if (exercise) {
        setName(exercise.name);
        setDescription(exercise.description ?? '');
        setCategory(exercise.category);
        setMuscleGroups(exercise.muscle_groups ?? []);
        setVideoPath(exercise.video_path);
        setPhotoPath(exercise.photo_path);
      } else {
        setName('');
        setDescription('');
        setCategory('');
        setMuscleGroups([]);
        setVideoPath(null);
        setPhotoPath(null);
      }
      setNameError('');
      setCategoryError('');
      setIsSaving(false);

      // Save current focus to restore on close
      previousFocusRef.current = document.activeElement;

      // Focus name input on open
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 210); // slight delay after animation starts
      return () => clearTimeout(timer);
    } else {
      // Restore focus on close
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen, exercise]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  function shakeField(ref: React.RefObject<HTMLDivElement | null>) {
    if (ref.current) {
      gsap.to(ref.current, { x: [-6, 6, -4, 4, 0], duration: 0.3, ease: 'none' });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let hasError = false;

    if (!name.trim()) {
      setNameError("Le nom de l'exercice est obligatoire.");
      shakeField(nameFieldRef);
      hasError = true;
    } else {
      setNameError('');
    }

    if (!category) {
      setCategoryError('Veuillez choisir une catégorie.');
      shakeField(categoryFieldRef);
      hasError = true;
    } else {
      setCategoryError('');
    }

    if (hasError) return;

    setIsSaving(true);
    try {
      const data: CreateExerciseBody | UpdateExerciseBody = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        muscle_groups: muscleGroups,
        video_path: videoPath,
        photo_path: photoPath,
      };
      await onSave(data);
      onClose();
    } catch (err) {
      console.error('[ExerciseSlideOver] save error:', err);
    } finally {
      setIsSaving(false);
    }
  }

  const isEditMode = Boolean(exercise);

  return (
    <>
      {/* Transparent backdrop — click closes, aria-hidden */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-slideover-title"
        className={`fixed inset-y-0 right-0 w-[480px] bg-white shadow-xl flex flex-col z-50 transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2
              id="exercise-slideover-title"
              className="text-base font-bold text-text"
            >
              {isEditMode ? "Modifier l'exercice" : 'Nouvel exercice'}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              {isEditMode
                ? exercise?.name
                : 'Renseignez les informations de base.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-background transition-colors shrink-0 ml-3"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Form body — scrollable */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

            {/* Name field */}
            <div ref={nameFieldRef}>
              <label
                htmlFor="exercise-name"
                className="block text-xs font-bold text-muted uppercase tracking-wide mb-1"
              >
                Nom de l'exercice *
              </label>
              <input
                ref={nameInputRef}
                id="exercise-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError('');
                }}
                maxLength={100}
                placeholder="Ex. : Squat bulgare, Hip thrust, RDL…"
                disabled={isSaving}
                className={`border rounded-lg px-3 py-2 text-sm text-text w-full outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                  nameError ? 'border-danger focus:ring-danger/20' : 'border-border'
                }`}
              />
              {nameError && (
                <p className="text-xs text-danger mt-1">{nameError}</p>
              )}
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="exercise-description"
                className="block text-xs font-bold text-muted uppercase tracking-wide mb-1"
              >
                Description
              </label>
              <textarea
                id="exercise-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Consignes d'exécution, points de vigilance…"
                disabled={isSaving}
                className="border border-border rounded-lg px-3 py-2 text-sm text-text w-full resize-none outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* Category field */}
            <div ref={categoryFieldRef}>
              <label
                htmlFor="exercise-category"
                className="block text-xs font-bold text-muted uppercase tracking-wide mb-1"
              >
                Catégorie *
              </label>
              <select
                id="exercise-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (categoryError) setCategoryError('');
                }}
                disabled={isSaving}
                className={`border rounded-lg px-3 py-2 text-sm text-text w-full bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${
                  categoryError ? 'border-danger' : 'border-border'
                }`}
              >
                <option value="">Choisir une catégorie</option>
                <option value="Force">Force</option>
                <option value="Cardio">Cardio</option>
                <option value="Mobilité">Mobilité</option>
                <option value="HIIT">HIIT</option>
                <option value="Hyrox">Hyrox</option>
                <option value="Autre">Autre</option>
              </select>
              {categoryError && (
                <p className="text-xs text-danger mt-1">{categoryError}</p>
              )}
            </div>

            {/* Muscle groups */}
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wide mb-1">
                Muscles ciblés
              </label>
              <MuscleChipSelector
                value={muscleGroups}
                onChange={setMuscleGroups}
                disabled={isSaving}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2" />

            {/* Media upload */}
            <ExerciseMediaUpload
              userId={userId}
              jwt={jwt}
              videoPath={videoPath}
              photoPath={photoPath}
              onVideoUploaded={(path) => setVideoPath(path)}
              onPhotoUploaded={(path) => setPhotoPath(path)}
              onVideoRemoved={() => setVideoPath(null)}
              onPhotoRemoved={() => setPhotoPath(null)}
              disabled={isSaving}
            />
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-normal text-muted hover:text-text transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`bg-primary text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-primary/90 transition-colors ${
                isSaving ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isSaving
                ? 'Enregistrement…'
                : isEditMode
                ? 'Enregistrer les modifications'
                : "Créer l'exercice"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
