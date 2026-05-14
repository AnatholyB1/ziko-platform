'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ctaHover, ctaTap } from '@/lib/motion'

export function Header() {
  const t = useTranslations('Header')
  const locale = useLocale()
  const { scrollY } = useScroll()
  const blurOpacity = useTransform(scrollY, [0, 50], [0, 1])

  return (
    <motion.header className="sticky top-0 z-50">
      <motion.div
        className="absolute inset-0 backdrop-blur-md bg-white/90 border-b border-border"
        style={{ opacity: blurOpacity }}
      />
      <div className="relative max-w-screen-xl mx-auto px-8 h-14 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-primary">
          {t('logo')}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              locale="fr"
              className={locale === 'fr' ? 'font-bold text-text text-sm' : 'text-sm text-muted hover:text-text transition-colors'}
            >
              {t('localeFR')}
            </Link>
            <span className="text-muted text-sm">|</span>
            <Link
              href="/"
              locale="en"
              className={locale === 'en' ? 'font-bold text-text text-sm' : 'text-sm text-muted hover:text-text transition-colors'}
            >
              {t('localeEN')}
            </Link>
          </div>
          <motion.div whileHover={ctaHover} whileTap={ctaTap}>
            <Link href="#" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold block">
              {t('cta')}
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.header>
  )
}
