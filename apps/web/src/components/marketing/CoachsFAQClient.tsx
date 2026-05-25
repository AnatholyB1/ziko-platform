'use client'

import { motion, AnimatePresence, useInView } from 'framer-motion'
import { useState, useRef } from 'react'
import { IoChevronDownOutline } from 'react-icons/io5'

type FaqItem = { q: string; a: string }

type Props = {
  heading: string
  items: FaqItem[]
}

export function CoachsFAQClient({ heading, items }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-white">
      <div className="max-w-screen-md mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-12">
          {heading}
        </h2>
        <div ref={ref} className="divide-y divide-border">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="border-b border-border last:border-b-0">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex justify-between items-center py-5 text-left cursor-pointer"
                  aria-expanded={openIndex === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span className="text-xs font-bold text-text">{item.q}</span>
                  <motion.span
                    animate={{ rotate: openIndex === i ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <IoChevronDownOutline
                      size={18}
                      className={openIndex === i ? 'text-primary' : 'text-muted'}
                    />
                  </motion.span>
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      key="answer"
                      id={`faq-answer-${i}`}
                      role="region"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p className="text-base text-muted leading-relaxed py-4">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
