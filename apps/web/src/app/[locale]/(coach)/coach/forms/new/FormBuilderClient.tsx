'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { IoAddOutline, IoCheckmarkCircleOutline, IoLockClosedOutline } from 'react-icons/io5';
import type {
  CoachForm,
  FormQuestion,
  TriggerConfig,
} from '@/components/coach/FormStatusBadge';
import QuestionCard from '@/components/coach/QuestionCard';
import TriggerConfigComponent from '@/components/coach/TriggerConfig';
import PublishModal from '@/components/coach/PublishModal';
import ArchiveModal from '@/components/coach/ArchiveModal';

// ─── Question type labels ───────────────────────────────────────────────────────

const Q_TYPE_LABELS: Record<string, string> = {
  text: 'Texte libre',
  scale: 'Échelle 1-10',
  yesno: 'Oui / Non',
  choice: 'Choix unique',
};

// ─── genId ─────────────────────────────────────────────────────────────────────

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ─── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">{children}</p>
      <div className="border-b border-border" />
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface FormBuilderClientProps {
  locale: string;
  accessToken: string;
  apiUrl: string;
  form: CoachForm | null;
}

// ─── FormBuilderClient ─────────────────────────────────────────────────────────

export default function FormBuilderClient({
  locale,
  accessToken,
  apiUrl,
  form,
}: FormBuilderClientProps) {
  const router = useRouter();

  // ─── State ───────────────────────────────────────────────────────────────────

  const [title, setTitle] = useState(form?.title ?? '');
  const [questions, setQuestions] = useState<FormQuestion[]>(form?.questions ?? []);
  const [trigger, setTrigger] = useState<TriggerConfig>(
    form?.trigger_config ?? { type: 'manual' }
  );
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const isActive = form?.status === 'active';
  const isDraft = !form || form.status === 'draft';

  // ─── GSAP entrance ───────────────────────────────────────────────────────────

  useEffect(() => {
    gsap.from('.builder-section', {
      y: 20,
      opacity: 0,
      duration: 0.25,
      stagger: 0.08,
      ease: 'power2.out',
    });
  }, []);

  // ─── Toast system ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!toast) return;
    gsap.from('.toast', { y: -16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ─── Add question ────────────────────────────────────────────────────────────

  function handleAddQuestion() {
    const newQuestion: FormQuestion = { id: genId(), type: 'text', label: '' };
    const nextQuestions = [...questions, newQuestion];
    setQuestions(nextQuestions);
    setExpandedIdx(nextQuestions.length - 1);
    setTimeout(() => {
      const cards = document.querySelectorAll('.question-card:last-child');
      if (cards.length > 0) {
        gsap.from(cards, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
      }
    }, 10);
  }

  // ─── handleSave ──────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!title.trim()) {
      setToast({ message: 'Le titre est requis.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const isNew = !form?.id;
      const url = isNew
        ? `${apiUrl}/forms/coach/forms`
        : `${apiUrl}/forms/coach/forms/${form!.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          questions,
          trigger_config: trigger,
          status: 'draft',
        }),
      });
      if (res.ok) {
        setToast({ message: 'Formulaire sauvegardé', type: 'success' });
        if (isNew) {
          const json = await res.json();
          const newId = json.id ?? json.form?.id;
          if (newId) router.push(`/${locale}/coach/forms/${newId}`);
        }
      } else {
        setToast({ message: 'Une erreur est survenue. Réessayez.', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── handlePublishSuccess / handleArchiveSuccess ─────────────────────────────

  function handlePublishSuccess() {
    setPublishModalOpen(false);
    setToast({ message: 'Formulaire publié avec succès', type: 'success' });
    setTimeout(() => router.push(`/${locale}/coach/forms`), 1500);
  }

  function handleArchiveSuccess() {
    setArchiveModalOpen(false);
    setToast({ message: 'Formulaire archivé', type: 'success' });
    setTimeout(() => router.push(`/${locale}/coach/forms`), 1500);
  }

  // ─── handlePublishClick — guard: save first if form has no id ────────────────

  async function handlePublishClick() {
    if (!form?.id) {
      setToast({ message: 'Sauvegardez d\'abord le formulaire.', type: 'info' });
      await handleSave();
      return; // user clicks Publish again after save has created an ID
    }
    setPublishModalOpen(true);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Toast */}
      {toast && (
        <div
          className={`toast fixed top-4 right-4 z-50 bg-white border border-border rounded-xl px-5 py-3 text-sm font-bold shadow-lg ${toast.type === 'error' ? 'text-destructive' : 'text-text'}`}
        >
          {toast.message}
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-border h-14 px-8 flex items-center justify-between">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted flex items-center gap-1">
          <a href={`/${locale}/coach/forms`} className="hover:text-text">
            Formulaires
          </a>
          <span className="mx-1">/</span>
          <span className="text-text font-bold truncate max-w-[200px]">
            {title || 'Nouveau formulaire'}
          </span>
        </nav>

        {/* Actions */}
        {isDraft && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-bold hover:bg-background disabled:opacity-40"
            >
              Sauvegarder le brouillon
            </button>
            <button
              type="button"
              onClick={handlePublishClick}
              disabled={saving}
              className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Publier le formulaire
            </button>
          </div>
        )}
        {isActive && (
          <button
            type="button"
            onClick={() => setArchiveModalOpen(true)}
            className="border border-destructive text-destructive bg-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-[#FEE2E2]"
          >
            Archiver
          </button>
        )}
      </div>

      {/* Title input */}
      <div className="px-8 pt-6 pb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du formulaire…"
          readOnly={isActive}
          className={`text-xl font-bold text-text bg-transparent border-none focus:outline-none w-full ${isDraft ? 'focus:border-b focus:border-primary' : ''}`}
        />
      </div>

      {/* Questions section */}
      <div className="builder-section px-8 py-6">
        <SectionLabel>Questions</SectionLabel>

        {/* Active mode: read-only question cards */}
        {isActive && questions.map((q) => (
          <div
            key={q.id}
            className="bg-[#F0EFE9] border border-border rounded-xl p-4 mb-3 flex items-center gap-3"
          >
            <span className="bg-white text-[#6B6963] text-xs font-bold rounded px-2 py-0.5 shrink-0">
              {Q_TYPE_LABELS[q.type] ?? q.type}
            </span>
            <span className="text-sm text-text font-bold flex-1 truncate">{q.label}</span>
            <IoLockClosedOutline
              size={12}
              className="text-muted ml-auto shrink-0"
              title="Ce formulaire est actif — modification impossible"
            />
          </div>
        ))}

        {/* Draft mode: interactive question cards */}
        {isDraft && questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            isExpanded={expandedIdx === i}
            onExpand={() => setExpandedIdx(i)}
            onCollapse={() => setExpandedIdx(null)}
            onSave={(updated) => {
              const next = [...questions];
              next[i] = updated;
              setQuestions(next);
            }}
            onDelete={() => setQuestions(questions.filter((_, idx) => idx !== i))}
            onMoveUp={() => {
              if (i === 0) return;
              const next = [...questions];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              setQuestions(next);
            }}
            onMoveDown={() => {
              if (i === questions.length - 1) return;
              const next = [...questions];
              [next[i], next[i + 1]] = [next[i + 1], next[i]];
              setQuestions(next);
            }}
          />
        ))}

        {isDraft && (
          <button
            type="button"
            onClick={handleAddQuestion}
            className="border-2 border-dashed border-border rounded-xl py-3 text-sm font-bold text-muted text-center hover:border-primary hover:text-primary transition-colors cursor-pointer w-full mt-2 flex items-center justify-center gap-1"
          >
            <IoAddOutline size={16} /> + Ajouter une question
          </button>
        )}
      </div>

      {/* Trigger section */}
      <div className="builder-section px-8 py-6">
        <SectionLabel>Déclencheur</SectionLabel>
        <TriggerConfigComponent
          value={trigger}
          onChange={setTrigger}
          readOnly={isActive}
        />
      </div>

      {/* Publication section */}
      <div className="builder-section px-8 py-6 pb-24">
        <SectionLabel>Publication</SectionLabel>

        {isDraft && (
          <>
            <div className="bg-[#F0EFE9] border border-border rounded-xl p-4 text-sm text-muted mb-4">
              Le formulaire sera envoyé automatiquement selon le déclencheur configuré ci-dessus.
              Publiez pour l&apos;activer.
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-bold hover:bg-background disabled:opacity-40"
              >
                Sauvegarder le brouillon
              </button>
              <button
                type="button"
                onClick={handlePublishClick}
                disabled={saving}
                className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
              >
                Publier le formulaire
              </button>
            </div>
          </>
        )}

        {isActive && (
          <>
            <div className="bg-[#DCFCE7] border border-[#BBF7D0] rounded-xl p-4 flex items-center gap-3 mb-4">
              <IoCheckmarkCircleOutline size={18} className="text-[#16A34A]" />
              <span className="text-sm text-muted">
                Formulaire actif — en cours d&apos;envoi selon le déclencheur.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setArchiveModalOpen(true)}
              className="border border-destructive text-destructive bg-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-[#FEE2E2]"
            >
              Archiver
            </button>
          </>
        )}
      </div>

      {/* Publish modal */}
      {publishModalOpen && form?.id && (
        <PublishModal
          open={publishModalOpen}
          formId={form.id}
          accessToken={accessToken}
          apiUrl={apiUrl}
          locale={locale}
          onClose={() => setPublishModalOpen(false)}
          onSuccess={handlePublishSuccess}
        />
      )}

      {/* Archive modal */}
      {archiveModalOpen && form?.id && (
        <ArchiveModal
          open={archiveModalOpen}
          formId={form.id}
          accessToken={accessToken}
          apiUrl={apiUrl}
          locale={locale}
          onClose={() => setArchiveModalOpen(false)}
          onSuccess={handleArchiveSuccess}
        />
      )}
    </div>
  );
}
