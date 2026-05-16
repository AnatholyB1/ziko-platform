'use client';
import { useActionState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { loginAction, type LoginState } from '@/actions/login';
import { motion } from 'framer-motion';
import { fadeUp, ctaHover, ctaTap } from '@/lib/motion';

const initialState: LoginState = { status: 'idle', message: '' };

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const next = searchParams.get('next');
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  // Handle success redirect client-side — redirect() in Server Actions used with useActionState
  // throws internally and gets caught, preventing navigation (RESEARCH Pitfall 6).
  // Prepend locale prefix because loginAction returns locale-less paths (e.g. /coach/dashboard).
  useEffect(() => {
    if (state.status === 'success' && state.redirectTo) {
      router.push(`/${locale}${state.redirectTo}`);
    }
  }, [state, router, locale]);

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="max-w-sm w-full bg-white rounded-2xl p-8 shadow-sm border border-border"
    >
      <p className="text-3xl font-bold text-primary mb-8 text-center">ZIKO</p>
      <h1 className="text-xl font-bold text-text mb-1">Bienvenue</h1>
      <p className="text-sm font-normal text-muted mb-6">Connectez-vous à votre espace coach.</p>

      <form action={formAction} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-bold text-text">Adresse email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@exemple.com"
            className={`bg-white border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted ${state.status === 'error' ? 'border-red-400' : 'border-border'}`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-bold text-text">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={`bg-white border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted ${state.status === 'error' ? 'border-red-400' : 'border-border'}`}
          />
        </div>

        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-red-600 mt-1">
            {state.message}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={pending}
          whileHover={ctaHover}
          whileTap={ctaTap}
          className="h-11 px-6 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full mt-2"
        >
          {pending ? 'Connexion…' : 'Se connecter'}
        </motion.button>
      </form>
    </motion.div>
  );
}
