'use client'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ctaHover, ctaTap } from '@/lib/motion'

interface CoachsCtaFooterProps {
  locale: string
}

export default function CoachsCtaFooter({ locale }: CoachsCtaFooterProps) {
  const t = useTranslations('coachs')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-background">
      <div ref={ref} className="max-w-screen-xl mx-auto px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">{t('cta.heading')}</h2>
          <p className="text-base text-muted mb-8">{t('cta.subheading')}</p>
          <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block">
            <Link
              href={`/${locale}/coach/onboarding`}
              className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-xs inline-block"
              style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
            >
              {t('cta.button')}
            </Link>
          </motion.div>
          <p className="text-xs text-muted mt-3">{t('cta.note')}</p>
        </motion.div>
      </div>
    </section>
  )
}
