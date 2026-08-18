'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { fadeIn, fadeUp, ctaHover, ctaTap } from '@/lib/motion'
import { WAITLIST_ROLE_PARAM, WAITLIST_ROLE_COACH } from './WaitlistRoleForm'

const wordVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14 },
  },
}

type Props = {
  locale: string
  badge: string
  headline: string
  subtitle: string
  cta: string
  ctaNote: string
}

export function CoachsHeroClient({ locale, badge, headline, subtitle, cta, ctaNote }: Props) {
  const { scrollY } = useScroll()
  const cardY = useTransform(scrollY, [0, 400], [0, -40])

  return (
    <section className="min-h-screen flex items-center bg-background py-20">
      <div className="max-w-screen-xl mx-auto px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-16 items-center">
          {/* LEFT COLUMN */}
          <div>
            {/* 1. Beta badge */}
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <span className="inline-block bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                {badge}
              </span>
            </motion.div>

            {/* 2. Word-stagger headline */}
            <motion.h1
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-5xl md:text-7xl font-bold leading-none tracking-tight text-text mt-6"
            >
              {headline.split(' ').map((word, i) => (
                <motion.span key={i} variants={wordVariants} className="inline-block mr-[0.25em]">
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* 3. Subtitle */}
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.6 }}
              className="text-base text-muted leading-relaxed mt-6 max-w-[480px]"
            >
              {subtitle}
            </motion.p>

            {/* 4. CTA group */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.75 }}
              className="flex flex-col items-start gap-3 mt-8"
            >
              <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block">
                <Link
                  href={`/${locale}/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`}
                  className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm inline-block"
                  style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
                >
                  {cta}
                </Link>
              </motion.div>
              <p className="text-xs text-muted">{ctaNote}</p>
            </motion.div>
          </div>

          {/* RIGHT COLUMN — CRM mock card */}
          <div className="hidden md:block">
            <motion.div
              style={{ y: cardY }}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden"
                style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}
              >
                {/* Browser chrome */}
                <div className="bg-gray-800 h-9 flex items-center px-3 gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
                </div>
                {/* Orange accent bar */}
                <div className="h-1 bg-primary w-full" />
                {/* Skeleton client rows */}
                <div className="p-6 space-y-3">
                  <div className="bg-gray-800 h-10 rounded-lg flex items-center px-3">
                    <div className="bg-gray-700 h-4 rounded" style={{ width: '60%' }} />
                  </div>
                  <div className="bg-gray-800 h-10 rounded-lg flex items-center px-3">
                    <div className="bg-gray-700 h-4 rounded" style={{ width: '45%' }} />
                    <span className="text-primary font-bold text-xs ml-auto">92% →</span>
                  </div>
                  <div className="bg-gray-800 h-10 rounded-lg flex items-center px-3">
                    <div className="bg-gray-700 h-4 rounded" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
