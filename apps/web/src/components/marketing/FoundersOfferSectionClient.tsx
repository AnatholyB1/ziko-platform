'use client'

// Phase 5 plan 05-04 (T-05-08, D-05) — the homepage's flagship growth push. Mounts
// Plan 05-03's WaitlistCounterClient verbatim rather than a local badge, so the
// homepage is structurally incapable of showing a number the database did not
// produce (FOND-03/06). The link carries no role hint — the homepage speaks to both
// audiences at once (D-07) and pre-answering the picker here would be a guess.
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { ctaHover, ctaTap } from '@/lib/motion'
import { WaitlistCounterClient } from './WaitlistCounterClient'

type Props = {
  locale: string
  heading: string
  subheading: string
  button: string
  note: string
  counterStaticOffer: string
  counterRemainingTemplate: string
  counterCompleteHeading: string
  counterCompleteBody: string
}

export function FoundersOfferSectionClient({
  locale,
  heading,
  subheading,
  button,
  note,
  counterStaticOffer,
  counterRemainingTemplate,
  counterCompleteHeading,
  counterCompleteBody,
}: Props) {
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
          <div className="mb-4 flex justify-center">
            <WaitlistCounterClient
              staticOfferSentence={counterStaticOffer}
              remainingTemplate={counterRemainingTemplate}
              completeHeading={counterCompleteHeading}
              completeBody={counterCompleteBody}
            />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">{heading}</h2>
          <p className="text-base text-muted mb-8">{subheading}</p>
          <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block">
            <Link
              href={`/${locale}/fondateurs`}
              className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-sm inline-block"
              style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
            >
              {button}
            </Link>
          </motion.div>
          <p className="text-sm text-muted mt-3">{note}</p>
        </motion.div>
      </div>
    </section>
  )
}
