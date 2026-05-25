'use client';
import { useState, useRef } from 'react';
import { createClientSupabase } from '@/lib/supabase/client';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadedDoc {
  type: 'certification' | 'id_recto' | 'id_verso' | 'other';
  url: string;
  uploaded_at: string;
  filename?: string;
}

export function FileUploadRow({
  docType,
  label,
  userId,
  apiUrl,
  jwt,
  onUploaded,
  uploaded,
  onRemove,
}: {
  docType: 'certification' | 'id_recto' | 'id_verso' | 'other';
  label: string;
  userId: string;
  apiUrl: string;
  jwt: string;
  onUploaded: (doc: UploadedDoc) => void;
  uploaded?: UploadedDoc;
  onRemove: () => void;
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format non accepté. PDF, JPEG, PNG ou WebP uniquement.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Fichier trop volumineux (max 5 Mo).');
      return;
    }
    setUploading(true);
    try {
      const filename = `${docType}-${Date.now()}-${file.name}`;
      const urlRes = await fetch(
        `/api/storage/upload-url?bucket=coach-kyc&path=${userId}/${filename}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!urlRes.ok) throw new Error('Upload URL failed');
      const { path, token } = await urlRes.json() as { upload_url: string; path: string; token: string };
      const supabase = createClientSupabase();
      const { error: uploadError } = await supabase.storage
        .from('coach-kyc')
        .uploadToSignedUrl(path, token, file);
      if (uploadError) throw uploadError;
      // Store path (not signed URL) — Pitfall 7: signed URLs expire
      onUploaded({
        type: docType,
        url: path,
        uploaded_at: new Date().toISOString(),
        filename: file.name,
      });
    } catch (err) {
      console.error('[FileUploadRow] upload failed:', err);
      setError('Échec du transfert. Réessayez.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected after remove
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (uploaded) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 min-h-12">
        <span className="inline-flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1 text-sm font-normal text-text">
          {uploaded.filename ?? uploaded.url}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Supprimer le document"
          className="text-muted hover:text-danger transition-colors"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="py-2 border-b border-border last:border-0 min-h-12">
      <label className="inline-flex items-center gap-2 h-11 px-4 bg-white border border-border rounded-lg text-sm font-normal text-text hover:bg-background transition-colors cursor-pointer">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={uploading}
        />
        {uploading ? 'Transfert…' : label}
      </label>
      {error && <p className="text-sm font-normal text-danger mt-1">{error}</p>}
    </div>
  );
}
