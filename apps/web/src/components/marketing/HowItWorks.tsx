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

        <div className="flex flex-col md:flex-row items-start gap-0">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isLast = index === STEPS.length - 1

            const numberSize =
              index === 0 ? 'text-[9rem] md:text-[10rem]' :
              index === 1 ? 'text-8xl md:text-9xl' :
              'text-7xl md:text-8xl'

            const headingSize =
              index === 0 ? 'text-2xl font-black' :
              index === 1 ? 'text-xl font-bold' :
              'text-lg font-bold'

            return (
              <div key={step.number} className="flex flex-col md:flex-row items-start flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ delay: index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-start text-left px-4 flex-1"
                >
                  <div className={`${numberSize} font-black leading-none select-none mb-3 text-primary/15`}>
                    <CountUp target={step.number} isVisible={isVisible} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="text-primary shrink-0" size={index === 0 ? 22 : 18} />
                    <h3 className={`${headingSize} text-text`}>
                      {t(step.titleKey as Parameters<typeof t>[0])}
                    </h3>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">
                    {t(step.descKey as Parameters<typeof t>[0])}
                  </p>
                </motion.div>

                {!isLast && (
                  <div className="hidden md:flex items-start pt-16 px-2 text-border" aria-hidden>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ delay: index * 0.15 + 0.3, duration: 0.4 }}
                      className="text-2xl font-light select-none text-muted"
                    >
                      →
                    </motion.span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
