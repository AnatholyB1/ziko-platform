'use client';
import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { IoPersonAddOutline } from 'react-icons/io5';
import type { CoachPreviewPayload } from '@ziko/coach-sdk';
import { CodeInput } from './CodeInput';
import { CoachPreviewCard } from './CoachPreviewCard';
import { RevokeConfirmModal } from './RevokeConfirmModal';
import { previewCodeAction, redeemCodeAction, revokeLinkAction } from '@/lib/redeem/actions';

type State =
  | { kind: 'A'; code: string; error: 'invalidOrExpired' | 'rateLimited' | null }
  | { kind: 'B'; code: string; preview: CoachPreviewPayload; error: 'invalidOrExpired' | 'rateLimited' | null }
  | { kind: 'C'; linkId: string; preview: CoachPreviewPayload; createdAt: string };

export function RedeemStateMachine({
  initialKind,
  initialPreview,
  initialLinkId,
  initialCreatedAt,
  initialCode,
}: {
  initialKind: 'A' | 'B' | 'C';
  initialPreview: CoachPreviewPayload | null;
  initialLinkId: string | null;
  initialCreatedAt: string | null;
  initialCode: string | null;
}) {
  const t = useTranslations('CoachRedeem');
  const [state, setState] = useState<State>(() => {
    if (initialKind === 'C' && initialPreview && initialLinkId && initialCreatedAt) {
      return { kind: 'C', linkId: initialLinkId, preview: initialPreview, createdAt: initialCreatedAt };
    }
    return { kind: 'A', code: initialCode ?? '', error: null };
  });
  const [pending, startTransition] = useTransition();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Deep-link: auto-run preview when component mounts with prefilled code in State A
  useEffect(() => {
    if (state.kind === 'A' && state.code.length === 6 && /^[A-Z2-9]{6}$/.test(state.code) && initialCode) {
      runPreview(state.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runPreview(code: string) {
    startTransition(async () => {
      const res = await previewCodeAction(code);
      if (res.ok) {
        setState({ kind: 'B', code, preview: res.preview, error: null });
      } else {
        setState({ kind: 'A', code, error: res.error_code === 'RATE_LIMITED' ? 'rateLimited' : 'invalidOrExpired' });
      }
    });
  }

  function runRedeem() {
    if (state.kind !== 'B') return;
    const code = state.code;
    startTransition(async () => {
      const res = await redeemCodeAction(code);
      if (res.ok) {
        setToast(t('successToast', { displayName: res.preview.display_name }));
        setTimeout(() => setToast(null), 4000);
        setState({ kind: 'C', linkId: res.link.id, preview: res.preview, createdAt: res.link.created_at });
      } else {
        setState({ kind: 'A', code: '', error: res.error_code === 'RATE_LIMITED' ? 'rateLimited' : 'invalidOrExpired' });
      }
    });
  }

  function runRevoke() {
    if (state.kind !== 'C') return;
    const id = state.linkId;
    startTransition(async () => {
      const res = await revokeLinkAction(id);
      setConfirmingRevoke(false);
      if (res.ok) setState({ kind: 'A', code: '', error: null });
    });
  }

  // ---------- State A ----------
  if (state.kind === 'A') {
    const errorId = state.error ? 'redeem-error' : undefined;
    return (
      <div className="max-w-sm mx-auto pt-16 text-center">
        <IoPersonAddOutline aria-hidden className="mx-auto text-muted" size={48} />
        <h1 className="text-2xl font-bold text-text mt-4">{t('stateA.heading')}</h1>
        <p className="text-sm font-normal text-muted mt-2">{t('stateA.body')}</p>
        <div className="mt-8 flex justify-center">
          <CodeInput
            value={state.code}
            onChange={(v) => setState({ ...state, code: v, error: null })}
            disabled={pending}
            ariaErrorId={errorId}
          />
        </div>
        <button
          type="button"
          disabled={state.code.length !== 6 || pending}
          onClick={() => runPreview(state.code)}
          className="mt-4 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('stateA.submit')}
        </button>
        {state.error && (
          <p id={errorId} className="text-sm text-red-600 mt-3 text-center" role="alert">
            {state.error === 'rateLimited' ? t('errors.rateLimited') : t('errors.invalidOrExpired')}
          </p>
        )}
      </div>
    );
  }

  // ---------- State B ----------
  if (state.kind === 'B') {
    return (
      <div className="max-w-md mx-auto pt-8">
        <button
          type="button"
          onClick={() => setState({ kind: 'A', code: '', error: null })}
          className="text-sm text-muted hover:text-text"
        >
          {t('stateB.back')}
        </button>
        <div className="mt-4">
          <CoachPreviewCard preview={state.preview} />
        </div>
        <div className="flex items-center gap-4 mt-6 justify-center">
          <button
            type="button"
            disabled={pending}
            onClick={runRedeem}
            className="bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('stateB.link')}
          </button>
          <button
            type="button"
            onClick={() => setState({ kind: 'A', code: '', error: null })}
            className="text-muted text-sm hover:text-text"
          >
            {t('stateB.cancel')}
          </button>
        </div>
      </div>
    );
  }

  // ---------- State C ----------
  return (
    <div className="max-w-md mx-auto pt-8">
      <p className="text-sm font-normal text-muted text-center mb-6">
        {t('stateC.banner', {
          displayName: state.preview.display_name,
          date: new Date(state.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        })}
      </p>
      <CoachPreviewCard preview={state.preview} />
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setConfirmingRevoke(true)}
          className="text-red-600 text-sm font-normal underline"
        >
          {t('stateC.revoke')}
        </button>
      </div>
      <RevokeConfirmModal
        open={confirmingRevoke}
        title={t('revokeModal.title')}
        body={t('revokeModal.body', { displayName: state.preview.display_name })}
        confirmLabel={t('revokeModal.confirmLabel')}
        confirmCta={t('revokeModal.confirmCta')}
        cancelLabel={t('revokeModal.cancel')}
        onCancel={() => setConfirmingRevoke(false)}
        onConfirm={runRevoke}
      />
      {toast && (
        <div role="status" className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-text text-white rounded-xl px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
