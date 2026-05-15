'use client';
import { useActionState, useState } from 'react';
import { KycDocList } from './KycDocList';
import { saveKyc, type CoachIdentityState } from '@/actions/coach-identity';
import type { UploadedDoc } from './FileUploadRow';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep3Kyc({
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
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      fd.set('kyc_docs', JSON.stringify(docs));
      const result = await saveKyc(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">Vérification (optionnel)</h2>
      <p className="text-sm font-normal text-muted mb-6">
        Ajoutez vos certifications pour renforcer la confiance de vos clients. Vous pouvez
        passer cette étape.
      </p>
      <KycDocList userId={userId} apiUrl={apiUrl} jwt={jwt} onChange={setDocs} />
      {state.status === 'error' && (
        <p role="alert" className="text-sm font-normal text-red-600 mt-2">
          {state.message}
        </p>
      )}
      <form action={formAction}>
        <div className="flex gap-3 mt-8 justify-end">
          <button
            type="button"
            onClick={onSkip}
            className="h-11 px-4 text-sm font-normal text-muted hover:text-text transition-colors"
          >
            Passer cette étape
          </button>
          <button
            type="submit"
            disabled={pending || docs.length === 0}
            className="h-11 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Enregistrement…' : 'Terminer la configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
