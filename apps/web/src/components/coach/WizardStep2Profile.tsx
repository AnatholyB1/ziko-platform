'use client';
import { useActionState } from 'react';
import { ProfileForm } from './ProfileForm';
import { saveProfile, type CoachIdentityState } from '@/actions/coach-identity';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep2Profile({
  userId,
  apiUrl,
  jwt,
  onSuccess,
}: {
  userId: string;
  apiUrl: string;
  jwt: string;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      const result = await saveProfile(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">Votre profil coach</h2>
      <p className="text-sm font-normal text-muted mb-6">
        Ces informations seront visibles par vos futurs clients.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <ProfileForm initial={{}} userId={userId} apiUrl={apiUrl} jwt={jwt} />
        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-red-600">
            {state.message}
          </p>
        )}
        <div className="flex gap-3 mt-4 justify-end">
          <button
            type="submit"
            disabled={pending}
            className="h-11 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Enregistrement…' : 'Continuer la configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
