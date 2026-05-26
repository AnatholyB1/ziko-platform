'use client';

import { useState, useEffect } from 'react';
import {
  IoBarbell,
  IoVideocam,
  IoImage,
  IoPencilOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { createClientSupabase } from '@/lib/supabase/client';
import type { CoachExercise } from '@/types/coach';

const MAX_VISIBLE_MUSCLES = 3;

interface ExerciseRowProps {
  exercise: CoachExercise;
  onEdit: () => void;
  onDelete: () => void;
}

export function ExerciseRow({ exercise, onEdit, onDelete }: ExerciseRowProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);

  // Fetch signed URL for photo thumbnail (1h TTL)
  useEffect(() => {
    if (!exercise.photo_path) return;
    let cancelled = false;
    (async () => {
      const supabase = createClientSupabase();
      const { data } = await supabase.storage
        .from('coach-exercises')
        .createSignedUrl(exercise.photo_path!, 3600);
      if (!cancelled && data?.signedUrl) {
        setPhotoSignedUrl(data.signedUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [exercise.photo_path]);

  const visibleMuscles = exercise.muscle_groups.slice(0, MAX_VISIBLE_MUSCLES);
  const overflowCount = exercise.muscle_groups.length - MAX_VISIBLE_MUSCLES;

  // Left icon slot
  function LeftSlot() {
    if (exercise.photo_path && photoSignedUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSignedUrl}
          alt={exercise.name}
          className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
        />
      );
    }
    if (exercise.video_path && !exercise.photo_path) {
      return (
        <div className="w-9 h-9 rounded-lg bg-[#1C1A17]/8 flex items-center justify-center shrink-0">
          <IoVideocam className="text-text text-base" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0">
        <IoBarbell className="text-muted text-lg" />
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-border rounded-2xl flex flex-col min-h-[56px] group hover:shadow-sm transition-all${showDeleteConfirm ? ' border-red-100' : ''}`}
    >
      {/* Main row content */}
      <div className="px-5 flex items-center gap-4 min-h-[56px]">
        <LeftSlot />

        {/* Name */}
        <span className="text-sm font-bold text-text flex-1 truncate">{exercise.name}</span>

        {/* Badges: category + media */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="bg-background text-muted rounded-full px-2 py-0.5 text-xs">
            {exercise.category}
          </span>

          {exercise.video_path && (
            <span className="inline-flex items-center gap-1 bg-[#1C1A17]/8 text-text rounded-full px-2 py-0.5 text-xs">
              <IoVideocam className="text-xs" />
              Vidéo
            </span>
          )}

          {exercise.photo_path && (
            <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 rounded-full px-2 py-0.5 text-xs">
              <IoImage className="text-xs" />
              Photo
            </span>
          )}

          {/* Muscle chips — max 3 + overflow */}
          {visibleMuscles.map((muscle) => (
            <span key={muscle} className="text-xs text-muted">
              {muscle}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-xs text-muted">+{overflowCount}</span>
          )}
        </div>

        {/* Action buttons (visible on group-hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Modifier ${exercise.name}`}
            className="p-2 rounded-lg text-muted hover:text-text hover:bg-background transition-colors"
          >
            <IoPencilOutline className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label={`Supprimer ${exercise.name}`}
            className="p-2 rounded-lg text-muted hover:text-danger hover:bg-red-50 transition-colors"
          >
            <IoTrashOutline className="text-base" />
          </button>
        </div>
      </div>

      {/* Inline delete confirmation */}
      {showDeleteConfirm && (
        <div
          role="alert"
          className="border-t border-red-100 pt-3 pb-3 px-5 bg-red-50/50 rounded-b-2xl"
        >
          <p className="text-sm text-text">
            Supprimer &laquo;&nbsp;{exercise.name}&nbsp;&raquo;&nbsp;?
          </p>
          <p className="text-xs text-muted mt-0.5">
            Cette action est irréversible. Les fichiers associés seront supprimés du stockage.
          </p>
          <div className="flex items-center mt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm text-muted hover:text-text mr-3"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="bg-danger text-white rounded-lg px-4 py-1.5 text-sm font-bold hover:bg-red-600 transition-colors"
            >
              Supprimer définitivement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
