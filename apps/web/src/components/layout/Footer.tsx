'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion } from 'framer-motion'

function AnimatedLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative text-sm text-text inline-block overflow-hidden">
      {children}
      <motion.span
        className="absolute bottom-0 left-0 h-px bg-primary w-full origin-left"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </Link>
  )
}

export function Footer() {
  const t = useTranslations('Footer')

  return (
    <footer className="bg-white">
      <div
        className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, #FF5C1A 0%, transparent 100%)' }}
      />
      <div className="max-w-screen-xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-primary">ZIKO</span>
          <p className="text-sm text-muted">{t('copyright')}</p>
        </div>
        <nav className="flex flex-wrap gap-6 justify-center">
          <AnimatedLink href="/mentions-legales">{t('legal')}</AnimatedLink>
          <AnimatedLink href="/politique-de-confidentialite">{t('privacy')}</AnimatedLink>
          <AnimatedLink href="/cgu">{t('terms')}</AnimatedLink>
          <Link href="/supprimer-mon-compte" className="text-sm text-muted hover:text-text transition-colors">
            {t('deleteAccount')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
