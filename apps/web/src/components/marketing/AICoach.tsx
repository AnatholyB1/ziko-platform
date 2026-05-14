'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useInView } from 'framer-motion'
import { IoFlashOutline } from 'react-icons/io5'
import { ctaHover, ctaTap } from '@/lib/motion'

function TypewriterText({ text, isVisible }: { text: string; isVisible: boolean }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!isVisible) return
    let i = 0
    const timer = setInterval(() => {
      if (i >= text.length) { clearInterval(timer); return }
      setDisplayed(text.slice(0, i + 1))
      i++
    }, 28)
    return () => clearInterval(timer)
  }, [isVisible, text])

  return <>{displayed}</>
}

export function AICoach() {
  const t = useTranslations('Home')
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-24 bg-[#1C1A17]">
      <div className="max-w-screen-xl mx-auto px-8">
        <div className="flex flex-col md:flex-row md:items-center gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6 md:w-1/2"
          >
            <span className="inline-flex self-start items-center gap-2 bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20">
              <IoFlashOutline className="text-primary" size={14} />
              {t('aiCoach.badge')}
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
              {t('aiCoach.heading')}
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              {t('aiCoach.description')}
            </p>
            <motion.a
              href="#"
              whileHover={{ ...ctaHover, boxShadow: '0 4px 24px rgba(255,92,26,0.4)' }}
              whileTap={ctaTap}
              className="inline-flex self-start bg-white text-primary px-6 py-3 rounded-xl font-bold text-sm"
            >
              {t('aiCoach.cta')}
            </motion.a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:w-1/2"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex justify-end">
                <div className="bg-white/10 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
                  {t('aiCoach.userMessage')}
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-3"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 0px rgba(255,92,26,0)',
                      '0 0 16px rgba(255,92,26,0.6)',
                      '0 0 0px rgba(255,92,26,0)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1"
                >
                  <IoFlashOutline className="text-white" size={16} />
                </motion.div>
                <div className="bg-primary text-white text-sm rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs min-h-[44px]">
                  {isVisible && <TypewriterText text={t('aiCoach.aiMessage')} isVisible={isVisible} />}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
