'use client';
import { useState } from 'react';
import Image from 'next/image';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function PhotoUpload({
  userId,
  apiUrl,
  jwt,
  currentPath,
  onUploaded,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  currentPath?: string | null;
  onUploaded: (path: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non accepté. JPEG, PNG ou WebP uniquement.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/photo.${ext}`;
      const urlRes = await fetch(
        `${apiUrl}/storage/upload-url?bucket=coach-kyc&path=${path}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!urlRes.ok) throw new Error();
      const { upload_url } = await urlRes.json() as { upload_url: string };
      const putRes = await fetch(upload_url, { method: 'PUT', body: file });
      if (!putRes.ok) throw new Error();
      // Store PATH (not signed URL) — see RESEARCH Pitfall 7
      onUploaded(path);
    } catch {
      setError('Échec du transfert. Réessayez.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  // For display: use local preview if available; for persisted paths, use a proxy route
  const displaySrc =
    preview ??
    (currentPath ? `/api/photo?path=${encodeURIComponent(currentPath)}` : null);

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-full bg-background border-2 border-border overflow-hidden flex items-center justify-center">
        {displaySrc ? (
          <Image
            src={displaySrc}
            alt="Photo de profil"
            width={96}
            height={96}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-3xl text-muted" aria-hidden="true">
            👤
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="inline-flex items-center gap-2 h-11 px-4 bg-white border border-border rounded-lg text-sm font-normal text-text hover:bg-background transition-colors cursor-pointer">
          <input
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            disabled={uploading}
            aria-label="Choisir une photo de profil"
          />
          {uploading ? 'Transfert…' : 'Choisir une photo'}
        </label>
        <p className="text-sm font-normal text-muted">Photo de profil (optionnel)</p>
        {error && <p className="text-sm font-normal text-red-600">{error}</p>}
      </div>
    </div>
  );
}
