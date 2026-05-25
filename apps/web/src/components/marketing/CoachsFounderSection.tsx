'use client'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'

export default function CoachsFounderSection() {
  const t = useTranslations('coachs')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-background">
      <div className="max-w-screen-xl mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-12">
          {t('founder.heading')}
        </h2>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, x: -20 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto rounded-2xl p-8"
          style={{
            border: '1px solid #E2E0DA',
            borderLeft: '4px solid #FF5C1A',
            boxShadow: '0 4px 8px rgba(28,26,23,0.08)',
          }}
        >
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* LEFT — mission content */}
            <div className="flex-1">
              <span className="text-5xl text-primary/20 font-bold leading-none select-none" aria-hidden="true">&ldquo;</span>
              <p className="text-xl font-bold text-text leading-snug mb-4">{t('founder.quote')}</p>
              {/* TODO: replace with real founder story before go-live */}
              <p className="text-base text-muted leading-relaxed">{t('founder.story')}</p>
            </div>
            {/* RIGHT — founder avatar */}
            <div className="flex-shrink-0 w-48 flex flex-col items-center gap-2 text-center">
              {/* TODO: replace with real founder photo before go-live */}
              <div
                className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center"
                style={{ backgroundColor: '#F0EFE9' }}
              >
                <span className="text-muted font-bold text-xs">FD</span>
              </div>
              {/* TODO: replace with real name before go-live */}
              <p className="text-xs font-bold text-text">{t('founder.name')}</p>
              <p className="text-xs text-muted">{t('founder.title')}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
