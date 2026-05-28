'use client';

import { useState, useRef } from 'react';
import { IoVideocam, IoImage, IoCheckmarkCircle, IoAlertCircle, IoFilm } from 'react-icons/io5';

const VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm';
const PHOTO_TYPES = 'image/jpeg,image/png,image/webp';
const GIF_TYPES = 'image/gif';
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB
const GIF_MAX_BYTES = 20 * 1024 * 1024;    // 20 MB

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

// Upload via signed URL using XMLHttpRequest for progress events
function xhrUpload(uploadUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('XHR upload error')));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

interface UploadRowProps {
  label: string;
  icon: React.ReactNode;
  accept: string;
  maxBytes: number;
  maxLabel: string;
  existingPath: string | null;
  onUploaded: (path: string) => void;
  onRemoved: () => void;
  userId: string;
  jwt: string;
  disabled?: boolean;
}

function UploadRow({
  label,
  icon,
  accept,
  maxBytes,
  maxLabel,
  existingPath,
  onUploaded,
  onRemoved,
  userId,
  jwt,
  disabled = false,
}: UploadRowProps) {
  const [state, setState] = useState<UploadState>(existingPath ? 'done' : 'idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [filename, setFilename] = useState<string>(existingPath?.split('/').pop() ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    setProgress(0);

    // Validate MIME type
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    if (!acceptedTypes.includes(file.type)) {
      setError('Format non accepté.');
      setState('error');
      return;
    }

    // Validate size
    if (file.size > maxBytes) {
      setError(`Fichier trop volumineux (max ${maxLabel}).`);
      setState('error');
      return;
    }

    setState('uploading');
    setFilename(file.name);

    try {
      const safeName = `${Date.now()}-${file.name}`;
      const urlRes = await fetch(
        `/api/storage/upload-url?bucket=coach-exercises&path=${userId}/${safeName}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!urlRes.ok) throw new Error('Upload URL failed');
      const { path, upload_url } = (await urlRes.json()) as { path: string; token: string; upload_url: string };

      // Use XHR for progress tracking (upload_url is the signed PUT URL from Supabase)
      await xhrUpload(upload_url, file, setProgress);

      // Store path (not signed URL) — signed URLs expire (Pitfall 7)
      setState('done');
      onUploaded(path);
    } catch (err) {
      console.error('[ExerciseMediaUpload] upload failed:', err);
      setError('Échec du transfert. Réessayez.');
      setState('error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRetry() {
    setState('idle');
    setError('');
    setProgress(0);
    setFilename('');
  }

  function handleRemove() {
    setState('idle');
    setProgress(0);
    setFilename('');
    setError('');
    onRemoved();
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 py-2">
        <IoCheckmarkCircle className="text-success text-lg shrink-0" />
        <span className="text-sm text-text truncate max-w-[200px]">
          {filename || label}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          aria-label="Supprimer le fichier"
          className="ml-auto text-muted hover:text-danger transition-colors text-sm"
        >
          ×
        </button>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-text truncate max-w-[180px]">{filename}</span>
          <span className="text-xs text-muted ml-2">{progress}%</span>
        </div>
        <div className="h-1 bg-border rounded-full">
          <div
            className="bg-primary rounded-full transition-all h-1"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2">
          <IoAlertCircle className="text-danger text-lg shrink-0" />
          <span className="text-sm text-danger mt-1">{error}</span>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="text-sm text-primary underline cursor-pointer mt-1"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // idle state
  return (
    <div className="py-2">
      <label className="inline-flex items-center gap-2 h-11 px-4 bg-white border border-border rounded-lg text-sm font-normal text-text hover:bg-background cursor-pointer">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {icon}
        {label}
      </label>
    </div>
  );
}

interface ExerciseMediaUploadProps {
  userId: string;
  jwt: string;
  videoPath: string | null;
  photoPath: string | null;
  gifPath: string | null;
  onVideoUploaded: (path: string) => void;
  onPhotoUploaded: (path: string) => void;
  onGifUploaded: (path: string) => void;
  onVideoRemoved: () => void;
  onPhotoRemoved: () => void;
  onGifRemoved: () => void;
  disabled?: boolean;
}

export function ExerciseMediaUpload({
  userId,
  jwt,
  videoPath,
  photoPath,
  gifPath,
  onVideoUploaded,
  onPhotoUploaded,
  onGifUploaded,
  onVideoRemoved,
  onPhotoRemoved,
  onGifRemoved,
  disabled = false,
}: ExerciseMediaUploadProps) {
  return (
    <div>
      <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">MÉDIAS DE DÉMO</p>

      <UploadRow
        label="Ajouter une vidéo"
        icon={<IoVideocam className="text-base" />}
        accept={VIDEO_TYPES}
        maxBytes={VIDEO_MAX_BYTES}
        maxLabel="100 Mo"
        existingPath={videoPath}
        onUploaded={onVideoUploaded}
        onRemoved={onVideoRemoved}
        userId={userId}
        jwt={jwt}
        disabled={disabled}
      />

      <UploadRow
        label="Ajouter un GIF"
        icon={<IoFilm className="text-base" />}
        accept={GIF_TYPES}
        maxBytes={GIF_MAX_BYTES}
        maxLabel="20 Mo"
        existingPath={gifPath}
        onUploaded={onGifUploaded}
        onRemoved={onGifRemoved}
        userId={userId}
        jwt={jwt}
        disabled={disabled}
      />

      <UploadRow
        label="Ajouter une photo"
        icon={<IoImage className="text-base" />}
        accept={PHOTO_TYPES}
        maxBytes={PHOTO_MAX_BYTES}
        maxLabel="10 Mo"
        existingPath={photoPath}
        onUploaded={onPhotoUploaded}
        onRemoved={onPhotoRemoved}
        userId={userId}
        jwt={jwt}
        disabled={disabled}
      />
    </div>
  );
}
