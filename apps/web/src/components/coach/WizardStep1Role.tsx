'use client';
import { useActionState } from 'react';
import { promoteRole, type CoachIdentityState } from '@/actions/coach-identity';

const initial: CoachIdentityState = { status: 'idle', message: '' };

export function WizardStep1Role({
  currentRole,
  onSuccess,
}: {
  currentRole: string | null;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: CoachIdentityState, fd: FormData) => {
      const result = await promoteRole(prev, fd);
      if (result.status === 'success') onSuccess();
      return result;
    },
    initial,
  );

  const isExistingAthlete = currentRole === 'client';

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm">
      <h2 className="text-xl font-bold text-text mb-2">Activez votre rôle coach</h2>
      <p className="text-sm font-normal text-muted mb-6">
        {isExistingAthlete
          ? 'Votre compte athlète reste actif — vous ajoutez le rôle coach.'
          : 'Votre compte Ziko sera configuré comme coach.'}
      </p>
      <form action={formAction} className="flex gap-3 mt-8 justify-end">
        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-red-600 self-center mr-auto">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-11 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Configuration…' : "Commencer l'inscription"}
        </button>
      </form>
    </div>
  );
}
