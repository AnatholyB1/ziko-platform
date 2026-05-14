'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useInView } from 'framer-motion'
import { IoDownloadOutline, IoSettingsOutline, IoTrendingUpOutline } from 'react-icons/io5'
import { fadeUp } from '@/lib/motion'
import type { IconType } from 'react-icons'

function CountUp({ target, isVisible }: { target: number; isVisible: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible) return
    const steps = 30
    const duration = 800
    const increment = target / steps
    const interval = duration / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, interval)
    return () => clearInterval(timer)
  }, [isVisible, target])

  return <>{String(count).padStart(2, '0')}</>
}

const STEPS: { number: number; icon: IconType; titleKey: string; descKey: string }[] = [
  { number: 1, icon: IoDownloadOutline, titleKey: 'howItWorks.step1.title', descKey: 'howItWorks.step1.description' },
  { number: 2, icon: IoSettingsOutline, titleKey: 'howItWorks.step2.title', descKey: 'howItWorks.step2.description' },
  { number: 3, icon: IoTrendingUpOutline, titleKey: 'howItWorks.step3.title', descKey: 'howItWorks.step3.description' },
]

export function HowItWorks() {
  const t = useTranslations('Home')
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="text-3xl md:text-4xl font-black text-text text-center mb-16"
        >
          {t('howItWorks.heading')}
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ delay: index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center md:items-start text-center md:text-left px-4"
              >
                <div className="text-8xl md:text-9xl font-black leading-none select-none mb-2 text-primary/15">
                  <CountUp target={step.number} isVisible={isVisible} />
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 -mt-4">
                  <Icon className="text-primary" size={24} />
                </div>
                <h3 className="text-xl font-black text-text mb-2">
                  {t(step.titleKey as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {t(step.descKey as Parameters<typeof t>[0])}
                </p>
              </motion.div>
            )
          })}

          <svg
            className="absolute hidden md:block pointer-events-none"
            style={{ top: '4.5rem', left: 0, width: '100%', height: '4px' }}
            fill="none"
            overflow="visible"
          >
            <motion.line
              x1="17%"
              y1="2"
              x2="83%"
              y2="2"
              stroke="#E2E0DA"
              strokeWidth="2"
              strokeDasharray="6 4"
              initial={{ pathLength: 0 }}
              animate={isVisible ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: 'easeInOut' }}
            />
          </svg>
        </div>
      </div>
    </section>
  )
}
