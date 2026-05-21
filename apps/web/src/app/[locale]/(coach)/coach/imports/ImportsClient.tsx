'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import {
  IoCloudUploadOutline,
  IoInformationCircleOutline,
  IoDocumentOutline,
  IoGridOutline,
  IoDocumentTextOutline,
  IoImageOutline,
  IoAlbumsOutline,
  IoChevronForwardOutline,
} from 'react-icons/io5';
import type { ImportRow } from './page';

interface ImportsClientProps {
  imports: ImportRow[];
  locale: string;
  accessToken: string;
  apiUrl: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getMimeCategory(mime: string): 'pdf' | 'excel' | 'word' | 'image' {
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  )
    return 'excel';
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'word';
  return 'image';
}

function computeCredits(row: ImportRow): string {
  if (!row.credit_transaction_id) return '—';
  if (row.mime_type === 'application/pdf') {
    const pages = row.page_count ?? 1;
    return String(Math.min(pages, 10));
  }
  return '1';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(d)
    .replace(',', ',')
    .replace(':', 'h');
}

function getOverallConfidence(row: ImportRow): number | null {
  if (!row.confidence_scores) return null;
  const scores = row.confidence_scores as Record<string, unknown>;
  if (typeof scores.overall === 'number') return scores.overall;
  return null;
}

// ── sub-components ────────────────────────────────────────────────────────────

const FORMAT_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  pdf: { bg: '#FEF9C3', color: '#92400E', label: 'PDF' },
  excel: { bg: '#DCFCE7', color: '#166534', label: 'Excel' },
  word: { bg: '#DBEAFE', color: '#1E40AF', label: 'Word' },
  image: { bg: '#F3E8FF', color: '#6B21A8', label: 'Image' },
};

function FormatChip({ mime }: { mime: string }) {
  const cat = getMimeCategory(mime);
  const cfg = FORMAT_CHIP[cat];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

const STATUS_CHIP: Record<
  string,
  { bg: string; color: string; border: string; label: string; pulse?: boolean }
> = {
  pending: { bg: '#F0EFE9', color: '#6B6963', border: '#E2E0DA', label: 'En attente' },
  uploaded: { bg: '#F0EFE9', color: '#6B6963', border: '#E2E0DA', label: 'Uploadé' },
  parsing: { bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD', label: 'Analyse…', pulse: true },
  ready: { bg: '#DCFCE7', color: '#166534', border: '#86EFAC', label: 'Prêt' },
  failed: { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5', label: 'Échec' },
  committed: { bg: '#EDE9FE', color: '#5B21B6', border: '#C4B5FD', label: 'Validé' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CHIP[status] ?? STATUS_CHIP.pending;
  return (
    <span
      className={cfg.pulse ? 'animate-pulse parsing-chip' : undefined}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 6,
        padding: '2px 8px',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {cfg.pulse && (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: '#3B82F6',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}
      {cfg.label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: '#6B6963', fontSize: 12, fontWeight: 600 }}>—</span>;
  const pct = Math.round(value * 100);
  let color = '#22C55E';
  if (value < 0.5) color = '#EF4444';
  else if (value < 0.8) color = '#F59E0B';
  return (
    <span style={{ color, fontSize: 12, fontWeight: 600 }}>{pct}%</span>
  );
}

function FileIcon({ mime }: { mime: string }) {
  const cat = getMimeCategory(mime);
  const iconProps = { size: 16, color: '#6B6963', style: { flexShrink: 0, marginRight: 8 } };
  if (cat === 'pdf') return <IoDocumentOutline {...iconProps} />;
  if (cat === 'excel') return <IoGridOutline {...iconProps} />;
  if (cat === 'word') return <IoDocumentTextOutline {...iconProps} />;
  return <IoImageOutline {...iconProps} />;
}

// ── main component ────────────────────────────────────────────────────────────

export function ImportsClient({ imports, locale, accessToken, apiUrl }: ImportsClientProps) {
  const router = useRouter();
  const [localImports, setLocalImports] = useState<ImportRow[]>(imports);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(imports.length);

  // Page entrance animation
  useEffect(() => {
    if (pageRef.current) {
      gsap.from(pageRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  // Row stagger when table appears from empty
  useEffect(() => {
    if (prevLengthRef.current === 0 && localImports.length > 0) {
      gsap.from('.import-row', { y: 8, opacity: 0, duration: 0.18, stagger: 0.04, ease: 'power2.out' });
    }
    prevLengthRef.current = localImports.length;
  }, [localImports.length]);

  // Polling for parsing/uploading rows (T-28-05-02: uses Bearer token, RLS enforced)
  useEffect(() => {
    const parsingIds = localImports
      .filter((r) => r.status === 'parsing' || r.status === 'uploaded')
      .map((r) => r.id);

    if (parsingIds.length === 0) return;

    const interval = setInterval(async () => {
      const updates = await Promise.all(
        parsingIds.map(async (id) => {
          try {
            const res = await fetch(`${apiUrl}/coach/imports/${id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              cache: 'no-store',
            });
            if (res.ok) {
              const json = await res.json();
              return (json.import ?? json) as ImportRow;
            }
          } catch {
            // ignore polling errors
          }
          return null;
        })
      );

      setLocalImports((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        updates.forEach((u) => {
          if (u) map.set(u.id, u);
        });
        return Array.from(map.values());
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [localImports, apiUrl, accessToken]);

  // ── upload handler ──────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (file: File) => {
      // Client-side size guard (T-28-05-01: UX only, server validates too)
      if (file.size > 25 * 1024 * 1024) {
        alert('Le fichier dépasse la limite de 25 Mo.');
        return;
      }

      setUploading(true);

      try {
        // Step 1: Create import record + get signed URL
        const createRes = await fetch(`${apiUrl}/coach/imports`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            original_filename: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            mode: 'coach_template',
          }),
        });

        if (!createRes.ok) {
          const errJson = await createRes.json().catch(() => ({}));
          alert(`Erreur lors de la création de l'import : ${errJson.error ?? createRes.statusText}`);
          return;
        }

        const createJson = await createRes.json();
        const importId: string = createJson.import?.id ?? createJson.id;
        const signedUploadUrl: string =
          createJson.import?.signed_upload_url ?? createJson.signed_upload_url;

        // Step 2: PUT file blob to signed URL (bypasses Vercel 4.5 MB limit)
        const putRes = await fetch(signedUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!putRes.ok) {
          alert('Échec du téléversement vers le stockage.');
          return;
        }

        // Step 3: Notify backend upload is complete
        await fetch(`${apiUrl}/coach/imports/${importId}/status`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'uploaded' }),
        });

        // Step 4: Trigger parse
        await fetch(`${apiUrl}/coach/imports/${importId}/parse`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        // Step 5: Add new row to local state with parsing status
        const newRow: ImportRow = {
          id: importId,
          original_filename: file.name,
          mime_type: file.type,
          status: 'parsing',
          page_count: null,
          mode: 'coach_template',
          parsed_data: null,
          confidence_scores: null,
          credit_transaction_id: null,
          committed_program_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setLocalImports((prev) => [newRow, ...prev]);
      } catch (err) {
        console.error('[ImportsClient] upload error:', err);
        alert('Une erreur inattendue est survenue.');
      } finally {
        setUploading(false);
      }
    },
    [apiUrl, accessToken]
  );

  // ── drag handlers ───────────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global styles for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div ref={pageRef} className="imports-page">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1C1A17', lineHeight: 1.2 }}>
              Imports de fichiers
            </h1>
            <p style={{ fontSize: 12, color: '#6B6963', marginTop: 6 }}>
              Importez vos programmes d&apos;entraînement depuis PDF, Excel, Word ou image.
            </p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: '#FF5C1A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            Importer un fichier
          </button>
        </div>

        {/* Drop zone */}
        <div
          className="drop-zone"
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            width: '100%',
            maxWidth: 480,
            height: 200,
            background: dragOver ? '#FFF7F4' : '#F0EFE9',
            border: `2px dashed ${dragOver ? '#FF5C1A' : '#E2E0DA'}`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            boxShadow: dragOver ? '0 8px 30px rgba(255,92,26,0.15)' : 'none',
            margin: '0 auto',
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!uploading) fileInputRef.current?.click();
            }
          }}
          aria-label="Zone de dépôt de fichier"
        >
          <IoCloudUploadOutline size={40} color="#6B6963" />
          <span style={{ fontSize: 14, color: '#6B6963', fontWeight: 400 }}>
            {uploading ? 'Upload en cours…' : 'Glissez un fichier ici'}
          </span>
          <span style={{ fontSize: 12, color: '#6B6963' }}>
            PDF · Excel · Word · Image — max 25 Mo
          </span>
          <div style={{ width: '100%', textAlign: 'center', margin: '0', color: '#6B6963', fontSize: 12 }}>
            — ou —
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              if (!uploading) fileInputRef.current?.click();
            }}
            style={{
              border: '1px solid #E2E0DA',
              background: '#FFFFFF',
              color: '#1C1A17',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 14,
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            Parcourir les fichiers
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Credit cost info block */}
        <div
          style={{
            maxWidth: 480,
            margin: '16px auto 0',
            background: '#FFFFFF',
            border: '1px solid #E2E0DA',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IoInformationCircleOutline size={16} color="#6B6963" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#6B6963' }}>
            PDF : 1 crédit/page (max 10 crédits) · Autres formats : 1 crédit
          </span>
        </div>

        {/* Imports table or empty state */}
        {localImports.length > 0 ? (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              overflow: 'hidden',
              marginTop: 32,
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 120px 120px 80px 120px 80px',
                background: '#F0EFE9',
                borderBottom: '1px solid #E2E0DA',
                padding: '8px 16px',
                gap: 8,
              }}
            >
              {['Fichier', 'Format', 'Statut', 'Confiance', 'Crédits', 'Date', 'Actions'].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6B6963',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Table rows */}
            {localImports.map((row, idx) => (
              <div
                key={row.id}
                className="import-row"
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 120px 120px 80px 120px 80px',
                  alignItems: 'center',
                  padding: '0 16px',
                  gap: 8,
                  minHeight: 52,
                  borderBottom: idx < localImports.length - 1 ? '1px solid #E2E0DA' : 'none',
                  background: hoveredRow === row.id ? '#F0EFE9' : '#FFFFFF',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                onClick={() => router.push(`/${locale}/coach/imports/${row.id}`)}
              >
                {/* Fichier */}
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <FileIcon mime={row.mime_type} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1C1A17',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={row.original_filename}
                  >
                    {row.original_filename}
                  </span>
                </div>

                {/* Format */}
                <div>
                  <FormatChip mime={row.mime_type} />
                </div>

                {/* Statut */}
                <div>
                  <StatusChip status={row.status} />
                </div>

                {/* Confiance */}
                <div>
                  <ConfidenceBadge value={getOverallConfidence(row)} />
                </div>

                {/* Crédits */}
                <span style={{ fontSize: 14, color: '#1C1A17' }}>
                  {computeCredits(row)}
                </span>

                {/* Date */}
                <span style={{ fontSize: 12, color: '#6B6963' }}>
                  {formatDate(row.created_at)}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {hoveredRow === row.id && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 14,
                        color: '#FF5C1A',
                        fontWeight: 400,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${locale}/coach/imports/${row.id}`);
                      }}
                    >
                      Voir
                      <IoChevronForwardOutline size={14} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 48,
              gap: 12,
            }}
          >
            <IoAlbumsOutline size={64} color="#E2E0DA" />
            <span style={{ fontSize: 14, color: '#6B6963', fontWeight: 400 }}>
              Aucun import pour le moment
            </span>
            <span style={{ fontSize: 12, color: '#6B6963' }}>
              Vos fichiers importés apparaîtront ici.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
