'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { IoCheckmarkCircleOutline } from 'react-icons/io5'
import { ctaHover, ctaTap } from '@/lib/motion'
import { Link } from '@/i18n/navigation'

type Props = {
  heading: string
  popularBadge: string
  price: string
  priceUnit: string
  valueProp1: string
  valueProp2: string
  valueProp3: string
  cta: string
  priceNote: string
}

export function PricingClient({ heading, popularBadge, price, priceUnit, valueProp1, valueProp2, valueProp3, cta, priceNote }: Props) {
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-black text-text text-center mb-4"
        >
          {heading}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-4"
        >
          <span className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full">
            {popularBadge}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="border-2 border-primary rounded-3xl p-8 max-w-sm mx-auto"
          style={{ boxShadow: '0 8px 48px rgba(255,92,26,0.12)' }}
        >
          <div className="text-center mb-8">
            <span className="text-6xl font-black text-primary">{price}</span>
            <span className="text-muted text-base"> {priceUnit}</span>
          </div>

          <ul className="flex flex-col gap-4 mb-8">
            {[valueProp1, valueProp2, valueProp3].map((prop, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-text leading-relaxed">
                <IoCheckmarkCircleOutline className="text-primary flex-shrink-0 mt-0.5" size={20} />
                <span>{prop}</span>
              </li>
            ))}
          </ul>

          <motion.div
            whileHover={{ ...ctaHover, boxShadow: '0 8px 32px rgba(255,92,26,0.45)' }}
            whileTap={ctaTap}
          >
            <Link
              href="/coach/dashboard"
              className="block w-full bg-primary text-white py-4 rounded-2xl font-black text-base text-center"
            >
              {cta}
            </Link>
          </motion.div>

          <p className="text-center text-xs text-muted mt-4">
            {priceNote}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
