'use client';

import { useActionState, useState } from 'react';
import { deleteAccount, DeleteAccountState } from '@/actions/account';

const initialState: DeleteAccountState = { status: 'idle', message: '' };

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);

  const canSubmit = typed === 'SUPPRIMER' && checked && !pending;

  if (state.status === 'success') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-6">
        <p className="text-green-800 font-medium">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6 max-w-md">
      <div>
        <label className="block text-sm font-medium text-text mb-1" htmlFor="email">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          placeholder="votre@email.com"
          className="w-full rounded-lg border border-border px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">
          Je comprends que cette action est irr&eacute;versible
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium text-text mb-1" htmlFor="confirmation-input">
          Tapez SUPPRIMER pour confirmer
        </label>
        <input
          id="confirmation-input"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="SUPPRIMER"
          className="w-full rounded-lg border border-border px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input type="hidden" name="confirmation" value={typed} />
      </div>

      {state.status === 'error' && (
        <p className="text-red-600 text-sm">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-red-600 px-6 py-3 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
      >
        {pending ? 'Suppression en cours...' : 'Supprimer mon compte'}
      </button>
    </form>
  );
}
