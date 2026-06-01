'use client';
import { useState } from 'react';
import { IoPersonOutline, IoCloudUploadOutline } from 'react-icons/io5';
import gsap from 'gsap';
import { createClientSupabase } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['image/png', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024;

export interface LogoUploadProps {
  userId: string;
  currentPath: string | null;
  onUploaded: (bucketPath: string) => void;
  onRemoved: () => void;
}

export function LogoUpload({ userId, currentPath, onUploaded, onRemoved }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Derive display URL — never stored in state
  const displayUrl: string | null =
    localPreviewUrl ??
    (currentPath
      ? createClientSupabase().storage.from('coach-logos').getPublicUrl(currentPath).data.publicUrl
      : null);

  function shakeError() {
    gsap.fromTo(
      '.logo-upload-error',
      { x: -4 },
      { x: 0, duration: 0.3, ease: 'none', keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 3 }, { x: 0 }] },
    );
  }

  async function handleFile(file: File) {
    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non accepté. PNG ou SVG uniquement.');
      shakeError();
      return;
    }

    if (file.size > MAX_BYTES) {
      setError('Fichier trop volumineux (max 2 Mo).');
      shakeError();
      return;
    }

    setLocalPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const ext = file.type === 'image/svg+xml' ? 'svg' : 'png';
      const path = `${userId}/logo.${ext}`;
      const supabase = createClientSupabase();
      const { error: uploadError } = await supabase.storage
        .from('coach-logos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      onUploaded(path);
      gsap.from('.logo-avatar-img', {
        scale: 0.85,
        opacity: 0,
        duration: 0.25,
        ease: 'back.out(1.4)',
      });
    } catch (err) {
      console.error('[LogoUpload] upload failed:', err);
      setError('Échec du transfert. Réessayez.');
      setLocalPreviewUrl(null);
      shakeError();
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setLocalPreviewUrl(null);
    setError('');
    onRemoved();
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm branding-section">
      <h2 className="text-base font-bold text-text mb-5">Logo</h2>
      <p className="text-xs text-muted mb-5">
        Format PNG ou SVG, max 2 Mo. Le logo s&apos;affiche dans la card athlète.
      </p>

      <div className="flex items-center gap-4">
        {/* Avatar circle */}
        {uploading ? (
          <div className="w-24 h-24 rounded-full border-2 border-border relative flex items-center justify-center bg-background">
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : displayUrl ? (
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              className="logo-avatar-img w-full h-full object-contain bg-white"
              alt="Logo coach"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-[#F0EFE9] border-2 border-dashed border-border flex items-center justify-center">
            <IoPersonOutline size={32} className="text-muted" />
          </div>
        )}

        {/* Button column */}
        <div className="flex flex-col gap-2">
          <label
            className={
              'inline-flex items-center gap-2 h-11 px-4 bg-white border border-border rounded-xl text-sm font-normal text-text hover:bg-background transition-colors cursor-pointer' +
              (uploading ? ' opacity-50 cursor-not-allowed' : '')
            }
          >
            <input
              type="file"
              accept="image/png,image/svg+xml"
              className="sr-only"
              disabled={uploading}
              aria-label="Choisir un logo (PNG ou SVG, max 2 Mo)"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <IoCloudUploadOutline size={16} />
            {uploading ? 'Transfert en cours…' : displayUrl ? 'Remplacer le logo' : 'Choisir un logo'}
          </label>

          {displayUrl && !uploading && (
            <button
              type="button"
              className="text-sm text-muted hover:text-red-500 transition-colors cursor-pointer"
              onClick={handleRemove}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="logo-upload-error text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
