'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { IoCloudUploadOutline, IoCloseOutline, IoDocumentOutline, IoGridOutline, IoReaderOutline } from 'react-icons/io5';

type FileStatus = 'uploading' | 'parsing' | 'ready' | 'failed';
type DocType = 'da_coach' | 'template_programme';
type CommitStatus = 'pending' | 'committed' | 'failed';
type FileState = {
  id: string;
  file: File;
  importId?: string;
  status: FileStatus;
  errorMessage?: string;
  docType?: DocType;
  clarificationPending?: boolean;
  parsedData?: Record<string, unknown>;
  commitStatus?: CommitStatus;
  commitError?: string;
};
type ChatMessage =
  | { id: string; kind: 'ia-template-summary'; fileId: string; name: string; weeks: number; sessions: number | null }
  | { id: string; kind: 'ia-da-coach-summary'; fileId: string; filename: string }
  | { id: string; kind: 'ia-ambiguous'; fileId: string; filename: string }
  | { id: string; kind: 'coach-reply'; fileId: string; docType: DocType }
  | { id: string; kind: 'ia-confirmation'; fileId: string };

const ALLOWED_EXTENSIONS = new Set(['pdf', 'xlsx', 'xls', 'docx']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const VALID_FILE_STATUSES = new Set<string>(['uploading', 'parsing', 'ready', 'failed']);

function getMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [view, setView] = useState<'import' | 'review'>('import');
  const [reviewPhase, setReviewPhase] = useState<'editing' | 'committing' | 'done'>('editing');
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const pipelineStartedRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const isCapHit = fileStates.length >= 4;

  const canAdvance =
    fileStates.length > 0 &&
    fileStates.every(
      (f) =>
        f.status === 'failed' ||
        (f.status === 'ready' && Boolean(f.docType) && !f.clarificationPending),
    ) &&
    fileStates.some((f) => f.status === 'ready');

  const reviewDocs = fileStates.filter((f) => f.status === 'ready');
  const committableCount = reviewDocs.filter((f) => f.docType === 'template_programme').length;
  const committedCount = reviewDocs.filter(
    (f) => f.docType === 'template_programme' && f.commitStatus === 'committed',
  ).length;

  // Cleanup all polling intervals and abort controllers on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current.clear();
      abortControllersRef.current.forEach((ctrl) => ctrl.abort());
      abortControllersRef.current.clear();
    };
  }, []);

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
          mime_type: getMimeType(fileState.file),
          size_bytes: fileState.file.size,
          mode: 'coach_template',
        }),
      });
      if (!res.ok) {
        const errText = t('step4ErrorServer');
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = t('step4ErrorServer');
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
        headers: { 'Content-Type': getMimeType(fileState.file) },
      });
      if (!uploadRes.ok) {
        const errText = t('step4ErrorServer');
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = t('step4ErrorServer');
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
        const errText = t('step4ErrorServer');
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: errText } : f,
          ),
        );
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = t('step4ErrorServer');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (!parseRes.ok) {
        const errText = t('step4ErrorServer');
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const msg = t('step4ErrorServer');
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: 'failed', errorMessage: msg } : f,
        ),
      );
      return;
    }

    // Step 5 — Start polling (inline so closure captures same jwt/apiUrl as above steps)
    const filename = fileState.file.name;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 3 min at 3s interval
    const handle = setInterval(async () => {
      attempts = attempts + 1;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(handle);
        intervalsRef.current.delete(fileId);
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: 'failed', errorMessage: t('step4ErrorServer') } : f,
          ),
        );
        return;
      }
      try {
        const res = await fetch(`${apiUrl}/coach/imports/${importId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) return; // transient error — keep polling
        type ParsedData = { overall_confidence?: number | null; name?: string; weeks?: Array<{ sessions?: unknown[] }> } | null;
        const data = await res.json() as { import: { status: string; error_message: string | null; parsed_data: ParsedData } };
        const importRow = data.import;
        if (importRow.status === 'ready' || importRow.status === 'failed') {
          clearInterval(handle);
          intervalsRef.current.delete(fileId);
          if (importRow.status === 'ready') {
            const rawParsedData = importRow.parsed_data as unknown as Record<string, unknown> | undefined;
            const confidence = importRow.parsed_data?.overall_confidence;
            if (confidence == null) {
              // Unknown confidence — treat as ambiguous, require user clarification
              setFileStates((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, status: 'ready', clarificationPending: true, parsedData: rawParsedData } : f,
                ),
              );
              setChatMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: 'ia-ambiguous', fileId, filename },
              ]);
            } else if (confidence < 0.4) {
              // Low confidence for template → classify as da_coach
              setFileStates((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, status: 'ready', docType: 'da_coach', parsedData: rawParsedData } : f,
                ),
              );
              setChatMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: 'ia-da-coach-summary', fileId, filename },
              ]);
            } else if (confidence >= 0.6) {
              // Confident: template_programme
              const name = importRow.parsed_data?.name ?? fileId;
              const weeks = importRow.parsed_data?.weeks?.length ?? 0;
              const sessions = importRow.parsed_data?.weeks?.[0]?.sessions?.length ?? null;
              setFileStates((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, status: 'ready', docType: 'template_programme', parsedData: rawParsedData } : f,
                ),
              );
              setChatMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: 'ia-template-summary', fileId, name, weeks, sessions: sessions === 0 ? null : sessions },
              ]);
            } else {
              // Ambiguous: 0.4 <= confidence < 0.6
              setFileStates((prev) =>
                prev.map((f) =>
                  f.id === fileId ? { ...f, status: 'ready', clarificationPending: true, parsedData: rawParsedData } : f,
                ),
              );
              setChatMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), kind: 'ia-ambiguous', fileId, filename },
              ]);
            }
          } else {
            // failed or unexpected status — validate before cast to prevent StatusPill crash
            const rawStatus = importRow.status;
            const safeStatus: FileStatus = VALID_FILE_STATUSES.has(rawStatus)
              ? (rawStatus as FileStatus)
              : 'failed';
            setFileStates((prev) =>
              prev.map((f) =>
                f.id === fileId ? { ...f, status: safeStatus, errorMessage: importRow.error_message ?? undefined } : f,
              ),
            );
          }
        }
      } catch {
        // network error — keep polling
      }
    }, 3000);
    intervalsRef.current.set(fileId, handle);
  }, [jwt, apiUrl, t]);

  // Pipeline trigger: fire for any new file with status 'uploading' and no importId yet
  useEffect(() => {
    fileStates.forEach((fs) => {
      if (fs.status === 'uploading' && !fs.importId && !pipelineStartedRef.current.has(fs.id)) {
        pipelineStartedRef.current.add(fs.id);
        runPipeline(fs);
      }
    });
  }, [fileStates, runPipeline]);

  // Completion effect (D-10): once every committable doc reaches commitStatus 'committed',
  // move to 'done' and auto-redirect via onSuccess exactly 1500ms later.
  useEffect(() => {
    if (reviewPhase !== 'committing') return;
    const committable = fileStates.filter((f) => f.status === 'ready' && f.docType === 'template_programme');
    if (committable.length === 0) return;
    const allDone = committable.every((f) => f.commitStatus === 'committed');
    if (!allDone) return;
    setReviewPhase('done');
    const timer = setTimeout(onSuccess, 1500);
    return () => clearTimeout(timer);
  }, [fileStates, reviewPhase, onSuccess]);

  function handleClarification(fileId: string, chosenType: DocType): void {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, docType: chosenType, clarificationPending: false } : f,
      ),
    );
    setChatMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), kind: 'coach-reply', fileId, docType: chosenType },
      { id: crypto.randomUUID(), kind: 'ia-confirmation', fileId },
    ]);
  }

  function setDocType(fileId: string, next: DocType): void {
    setFileStates((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, docType: next, clarificationPending: false, commitError: undefined, commitStatus: undefined }
          : f,
      ),
    );
  }

  async function commitDoc(fileId: string, fileState: FileState): Promise<boolean> {
    if (!fileState.importId || !fileState.parsedData) {
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f,
        ),
      );
      return false;
    }
    try {
      const res = await fetch(`${apiUrl}/coach/imports/${fileState.importId}/commit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ parsed_data: fileState.parsedData }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({} as { program_id?: string }));
        if (body.program_id) {
          setFileStates((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'committed' } : f)),
          );
          return true;
        }
      }
      if (!res.ok) {
        setFileStates((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f,
          ),
        );
        return false;
      }
      setFileStates((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'committed', commitError: undefined } : f)),
      );
      return true;
    } catch {
      setFileStates((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, commitStatus: 'failed', commitError: t('step4CommitError') } : f,
        ),
      );
      return false;
    }
  }

  async function handleConfirm(): Promise<void> {
    setReviewPhase('committing');
    const toCommit = fileStates.filter((f) => f.status === 'ready' && f.docType === 'template_programme');
    setFileStates((prev) =>
      prev.map((f) =>
        f.status === 'ready' && f.docType === 'template_programme'
          ? { ...f, commitStatus: 'pending', commitError: undefined }
          : f,
      ),
    );
    await Promise.all(toCommit.map((f) => commitDoc(f.id, f)));
  }

  function retryCommit(fileId: string): void {
    const fileState = fileStates.find((f) => f.id === fileId);
    if (!fileState) return;
    setFileStates((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, commitStatus: 'pending', commitError: undefined } : f)),
    );
    void commitDoc(fileId, fileState);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} ${t('unitBytes')}`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t('unitKB')}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('unitMB')}`;
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
    setFileStates((prev) => {
      const remaining = 4 - prev.length;
      if (remaining <= 0) return prev;
      const toAdd = incoming.slice(0, remaining);
      const newStates: FileState[] = toAdd.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'uploading',
      }));
      return [...prev, ...newStates];
    });
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

  if (view === 'review') {
    return (
      <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
        <h2 className="text-xl font-bold text-text mb-2">{t('step4ReviewHeading')}</h2>
        <p className="text-sm font-normal text-muted mb-6">{t('step4ReviewSubtitle')}</p>

        <div className="flex flex-col gap-2">
          {reviewDocs.map((fileState) => (
            <div key={fileState.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
                <div className="shrink-0 text-muted">{getFileIcon(fileState.file.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-normal text-text truncate">{fileState.file.name}</p>
                  <p className="text-xs text-muted">{formatBytes(fileState.file.size)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDocType(fileState.id, 'template_programme')}
                    disabled={reviewPhase !== 'editing'}
                    className={`px-3 py-2 rounded-full border text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                      fileState.docType === 'template_programme'
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-text hover:border-primary hover:text-primary'
                    }`}
                  >
                    {t('step4PillTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocType(fileState.id, 'da_coach')}
                    disabled={reviewPhase !== 'editing'}
                    className={`px-3 py-2 rounded-full border text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                      fileState.docType === 'da_coach'
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-border text-text hover:border-primary hover:text-primary'
                    }`}
                  >
                    {t('step4PillDaCoach')}
                  </button>
                </div>
                {fileState.docType === 'da_coach' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-surface-alt text-muted border border-border">
                    {t('step4ReviewNoAction')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm font-bold text-primary text-right mt-6">
          {t('step4ReviewCount', { count: committableCount })}
        </p>

        <div className="flex gap-3 mt-8 justify-end items-center">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
          >
            {t('step4Skip')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={reviewPhase === 'committing'}
            className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
          >
            {t('step4ReviewConfirm')}
          </button>
        </div>
      </div>
    );
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
        {chatMessages.map((msg) => {
          if (msg.kind === 'ia-template-summary') {
            const summaryText =
              msg.sessions != null && msg.sessions > 0
                ? t('step4AiTemplateSummary', { name: msg.name, weeks: msg.weeks, sessions: msg.sessions })
                : t('step4AiTemplateSummaryShort', { name: msg.name, weeks: msg.weeks });
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">IA</div>
                <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">{summaryText}</div>
              </div>
            );
          }
          if (msg.kind === 'ia-da-coach-summary') {
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">IA</div>
                <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
                  {t('step4AiDaCoachSummary', { filename: msg.filename })}
                </div>
              </div>
            );
          }
          if (msg.kind === 'ia-ambiguous') {
            const fileState = fileStates.find((f) => f.id === msg.fileId);
            const isPending = fileState?.clarificationPending ?? false;
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">IA</div>
                <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
                  {t('step4AiAmbiguous', { filename: msg.filename })}
                  {isPending && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleClarification(msg.fileId, 'template_programme')}
                        className="px-3 py-2 rounded-full border border-border text-sm font-bold text-text hover:border-primary hover:text-primary transition-colors"
                      >
                        {t('step4PillTemplate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClarification(msg.fileId, 'da_coach')}
                        className="px-3 py-2 rounded-full border border-border text-sm font-bold text-text hover:border-primary hover:text-primary transition-colors"
                      >
                        {t('step4PillDaCoach')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          if (msg.kind === 'coach-reply') {
            const label = msg.docType === 'template_programme' ? t('step4PillTemplate') : t('step4PillDaCoach');
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="bg-primary/10 rounded-xl rounded-tr-none px-4 py-3 text-sm text-text max-w-xs">{label}</div>
              </div>
            );
          }
          if (msg.kind === 'ia-confirmation') {
            return (
              <div key={msg.id} className="flex items-start gap-2">
                <div className="bg-primary text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">IA</div>
                <div className="bg-surface-alt rounded-xl rounded-tl-none px-4 py-3 text-sm text-text max-w-xs">
                  {t('step4AiConfirmation')}
                </div>
              </div>
            );
          }
          return null;
        })}
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
              {fileState.docType && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-surface-alt text-text border border-border">
                  {fileState.docType === 'template_programme' ? t('step4DocTypeTemplate') : t('step4DocTypeDaCoach')}
                </span>
              )}
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
        {canAdvance && (
          <button
            type="button"
            onClick={() => setView('review')}
            className="h-11 px-6 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {t('step4Continue')}
          </button>
        )}
      </div>
    </div>
  );
}
