'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { IoCloudUploadOutline, IoCloseOutline, IoDocumentOutline, IoGridOutline, IoReaderOutline } from 'react-icons/io5';

type FileStatus = 'uploading' | 'parsing' | 'ready' | 'failed';
type FileState = {
  id: string;
  file: File;
  importId?: string;
  status: FileStatus;
  errorMessage?: string;
};

const ALLOWED_EXTENSIONS = new Set(['pdf', 'xlsx', 'xls', 'docx']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function StatusPill({ status, t }: { status: FileStatus; t: (key: string) => string }) {
  const config: Record<FileStatus, { colorClasses: string; labelKey: string; hasSpinner: boolean }> = {
    uploading: { colorClasses: 'bg-blue-50 text-blue-600', labelKey: 'step4FileUploading', hasSpinner: true },
    parsing: { colorClasses: 'bg-orange-50 text-orange-600', labelKey: 'step4FileParsing', hasSpinner: true },
    ready: { colorClasses: 'bg-green-50 text-green-700', labelKey: 'step4FileReady', hasSpinner: false },
    failed: { colorClasses: 'bg-red-50 text-red-600', labelKey: 'step4FileFailed', hasSpinner: false },
  };
  const { colorClasses, labelKey, hasSpinner } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${colorClasses}`}>
      {hasSpinner && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {t(labelKey)}
    </span>
  );
}

export function WizardStep4Import({
  userId,
  apiUrl,
  jwt,
  onSuccess,
  onSkip,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  onSuccess: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations('Onboarding');
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const pipelineStartedRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const isCapHit = fileStates.length >= 4;

  // Cleanup all polling intervals and abort controllers on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current.clear();
      abortControllersRef.current.forEach((ctrl) => ctrl.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  // Pipeline trigger: fire for any new file with status 'uploading' and no importId yet
  useEffect(() => {
    fileStates.forEach((fs) => {
      if (fs.status === 'uploading' && !fs.importId && !pipelineStartedRef.current.has(fs.id)) {
        pipelineStartedRef.current.add(fs.id);
        runPipeline(fs);
      }
    });
  }, [fileStates, runPipeline]);

  function startPolling(importId: string, fileId: string): void {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 3 min at 3s interval
    const handle = setInterval(async () => {
      attempts = attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(handle);
        intervalsRef.current.delete(fileId);
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: 'Timeout' } : f,
          ),
        );
        return;
      }
      try {
        const res = await fetch(`${apiUrl}/coach/imports/${importId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) return; // transient error — keep polling
        const data = await res.json() as { import: { status: string; error_message: string | null } };
        const importRow = data.import;
        if (importRow.status === 'ready' || importRow.status === 'failed') {
          clearInterval(handle);
          intervalsRef.current.delete(fileId);
          setFileStates((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    status: importRow.status as FileStatus,
                    errorMessage: importRow.error_message ?? undefined,
                  }
                : f,
            ),
          );
        }
      } catch {
        // network error — keep polling
      }
    }, 3000);
    intervalsRef.current.set(fileId, handle);
  }

  const runPipeline = useCallback(async (fileState: FileState): Promise<void> => {
    const fileId = fileState.id;
    const controller = new AbortController();
    abortControllersRef.current.set(fileId, controller);

    // Step 1 — Create import record
    let importId: string;
    let signedUploadUrl: string;
    try {
      const res = await fetch(`${apiUrl}/coach/imports`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          filename: fileState.file.name,
          mime_type: fileState.file.type,
          size_bytes: fileState.file.size,
          mode: 'coach_template',
        }),
      });
      if (!res.ok) {
        const errText = res.status >= 500 ? t('step4ErrorServer') : await res.text();
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
      const data = await res.json() as { import_id: string; signed_upload_url: string };
      importId = data.import_id;
      signedUploadUrl = data.signed_upload_url;
      setFileStates((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, importId } : f)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
        ),
      );
      return;
    }

    // Step 2 — Upload file to signed URL (no Authorization header — self-authenticating)
    try {
      const uploadRes = await fetch(signedUploadUrl, {
        method: 'PUT',
        signal: controller.signal,
        body: fileState.file,
        headers: { 'Content-Type': fileState.file.type },
      });
      if (!uploadRes.ok) {
        const errText = uploadRes.status >= 500 ? t('step4ErrorServer') : await uploadRes.text();
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Storage upload failed';
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
        ),
      );
      return;
    }

    // Step 3 — Mark as uploaded
    try {
      const statusRes = await fetch(`${apiUrl}/coach/imports/${importId}/status`, {
        method: 'PUT',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ status: 'uploaded' }),
      });
      if (!statusRes.ok) {
        const errText = statusRes.status >= 500 ? t('step4ErrorServer') : await statusRes.text();
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
        ),
      );
      return;
    }

    // Step 4 — Trigger parse
    try {
      const parseRes = await fetch(`${apiUrl}/coach/imports/${importId}/parse`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!parseRes.ok) {
        const errText = parseRes.status >= 500 ? t('step4ErrorServer') : await parseRes.text();
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
      // 202 accepted — immediately update local status to 'parsing' (don't wait for polling)
      setFileStates((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'parsing' } : f)),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Parse trigger failed';
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
        ),
      );
      return;
    }

    // Step 5 — Start polling
    startPolling(importId, fileId);
  }, [jwt, apiUrl, userId]);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function getFileIcon(filename: string): React.ReactElement {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return <IoDocumentOutline className="w-5 h-5" />;
    if (ext === 'xlsx' || ext === 'xls') return <IoGridOutline className="w-5 h-5" />;
    if (ext === 'docx') return <IoReaderOutline className="w-5 h-5" />;
    return <IoDocumentOutline className="w-5 h-5" />;
  }

  function handleFiles(fileList: FileList | null): void {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      return ALLOWED_EXTENSIONS.has(ext) && file.size <= MAX_FILE_BYTES;
    });
    const remaining = 4 - fileStates.length;
    if (remaining <= 0) return;
    const toAdd = incoming.slice(0, remaining);
    const newStates: FileState[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading',
    }));
    setFileStates((prev) => [...prev, ...newStates]);
  }

  function removeFile(id: string): void {
    const interval = intervalsRef.current.get(id);
    if (interval !== undefined) {
      clearInterval(interval);
      intervalsRef.current.delete(id);
    }
    const controller = abortControllersRef.current.get(id);
    controller?.abort();
    abortControllersRef.current.delete(id);
    pipelineStartedRef.current.delete(id);
    setFileStates((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">{t('step4Heading')}</h2>
      <p className="text-sm font-normal text-muted mb-6">{t('step4Subtitle')}</p>

      {/* Section 1 — AI Chat Bubble */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-start gap-2">
          <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
            IA
          </div>
          <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
            {t('step4AiGreeting')}
          </div>
        </div>
      </div>

      {/* Section 2 — Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl min-h-[120px] flex flex-col items-center justify-center gap-3 p-6 transition-colors ${isDragOver ? 'border-primary bg-primary/5' : 'border-border'} ${isCapHit ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <IoCloudUploadOutline className="w-8 h-8 text-muted" />
        <p className="text-sm text-muted text-center">
          {isCapHit ? t('step4CapReached') : t('step4DropZoneLabel')}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isCapHit}
          className="h-9 px-4 rounded-lg border border-border text-sm text-text hover:bg-surface-alt transition-colors disabled:opacity-50"
        >
          {t('step4BrowseFiles')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.docx"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Section 3 — File List */}
      {fileStates.length > 0 && (
        <div className="flex flex-col gap-2 mt-4">
          {fileStates.map((fileState) => (
            <div key={fileState.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
              <div className="shrink-0 text-muted">{getFileIcon(fileState.file.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-normal text-text truncate">{fileState.file.name}</p>
                <p className="text-xs text-muted">{formatBytes(fileState.file.size)}</p>
                {fileState.status === 'failed' && fileState.errorMessage && (
                  <p className="text-xs text-red-500 mt-0.5 truncate" title={fileState.errorMessage}>
                    {fileState.errorMessage.length > 80 ? fileState.errorMessage.slice(0, 80) + '\u2026' : fileState.errorMessage}
                  </p>
                )}
              </div>
              <StatusPill status={fileState.status} t={t} />
              <button
                type="button"
                onClick={() => removeFile(fileState.id)}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-alt transition-colors"
                aria-label={t('step4RemoveFile')}
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-8 justify-end items-center">
        <button
          type="button"
          onClick={onSkip}
          className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
        >
          {t('step4Skip')}
        </button>
      </div>
    </div>
  );
}
