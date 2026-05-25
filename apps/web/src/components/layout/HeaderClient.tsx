'use client'

import { Link } from '@/i18n/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ctaHover, ctaTap } from '@/lib/motion'

type Props = {
  locale: string
  logo: string
  localeFR: string
  localeEN: string
  cta: string
}

export function HeaderClient({ locale, logo, localeFR, localeEN, cta }: Props) {
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
          {logo}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              locale="fr"
              className={locale === 'fr' ? 'font-bold text-text text-sm px-2 py-2 min-h-[44px] inline-flex items-center rounded' : 'text-sm text-muted hover:text-text transition-colors px-2 py-2 min-h-[44px] inline-flex items-center rounded'}
            >
              {localeFR}
            </Link>
            <span className="text-muted text-sm">|</span>
            <Link
              href="/"
              locale="en"
              className={locale === 'en' ? 'font-bold text-text text-sm px-2 py-2 min-h-[44px] inline-flex items-center rounded' : 'text-sm text-muted hover:text-text transition-colors px-2 py-2 min-h-[44px] inline-flex items-center rounded'}
            >
              {localeEN}
            </Link>
          </div>
          <motion.div whileHover={ctaHover} whileTap={ctaTap}>
            <Link href="/coach/dashboard" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold block">
              {cta}
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.header>
  )
}
