'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ctaHover, ctaTap } from '@/lib/motion'
import { WAITLIST_ROLE_PARAM, WAITLIST_ROLE_COACH } from './WaitlistRoleForm'

type Props = {
  locale: string
  heading: string
  subheading: string
  button: string
  note: string
}

export function CoachsCtaFooterClient({ locale, heading, subheading, button, note }: Props) {
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
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">{heading}</h2>
          <p className="text-base text-muted mb-8">{subheading}</p>
          <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block">
            <Link
              href={`/${locale}/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`}
              className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-xs inline-block"
              style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
            >
              {button}
            </Link>
          </motion.div>
          <p className="text-xs text-muted mt-3">{note}</p>
        </motion.div>
      </div>
    </section>
  )
}
