'use client';
import { useActionState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { loginAction, type LoginState } from '@/actions/login';
import { motion } from 'framer-motion';
import { fadeUp, ctaHover, ctaTap } from '@/lib/motion';

const initialState: LoginState = { status: 'idle', message: '' };

export function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Login');
  const next = searchParams.get('next');
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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
      className="max-w-sm w-full bg-white rounded-2xl px-10 py-10 shadow-sm border border-border"
    >
      <p className="text-4xl font-bold text-primary mb-10 text-center tracking-widest">
        ZIKO
      </p>
      <h1 className="text-xl font-bold text-text mb-1">{t('title')}</h1>
      <p className="text-sm font-normal text-muted mb-8">{t('subtitle')}</p>

      <form action={formAction} className="flex flex-col gap-5">
        {next && <input type="hidden" name="next" value={next} />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-bold text-text">
            {t('emailLabel')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@exemple.com"
            className={`bg-white border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted ${state.status === 'error' ? 'border-danger/30' : 'border-border'}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-bold text-text">
            {t('passwordLabel')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={`bg-white border rounded-lg px-3 h-11 w-full text-base font-normal text-text focus:outline-none focus:border-text transition-colors placeholder:text-muted ${state.status === 'error' ? 'border-danger/30' : 'border-border'}`}
          />
        </div>

        {state.status === 'error' && (
          <p role="alert" className="text-sm font-normal text-danger -mt-2">
            {state.message}
          </p>
        )}

        <motion.button
          type="submit"
          disabled={pending}
          whileHover={ctaHover}
          whileTap={ctaTap}
          className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full mt-2"
        >
          {pending ? `${t('submitButton')}…` : t('submitButton')}
        </motion.button>
      </form>
    </motion.div>
  );
}
