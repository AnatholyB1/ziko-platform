'use client'

import { useEffect, useRef, useState } from 'react'
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

const STEP_ICONS: IconType[] = [IoDownloadOutline, IoSettingsOutline, IoTrendingUpOutline]

type Step = { title: string; desc: string }

type Props = {
  heading: string
  steps: Step[]
}

export function HowItWorksClient({ heading, steps }: Props) {
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
          {heading}
        </motion.h2>

        <div className="flex flex-col md:flex-row items-start gap-0">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index]
            const isLast = index === steps.length - 1
            const number = index + 1

            const numberSize =
              index === 0 ? 'text-[9rem] md:text-[10rem]' :
              index === 1 ? 'text-8xl md:text-9xl' :
              'text-7xl md:text-8xl'

            const headingSize =
              index === 0 ? 'text-2xl font-black' :
              index === 1 ? 'text-xl font-bold' :
              'text-lg font-bold'

            return (
              <div key={number} className="flex flex-col md:flex-row items-start flex-1">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ delay: index * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-start text-left px-4 flex-1"
                >
                  <div className={`${numberSize} font-black leading-none select-none mb-3 text-primary/15`}>
                    <CountUp target={number} isVisible={isVisible} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="text-primary shrink-0" size={index === 0 ? 22 : 18} />
                    <h3 className={`${headingSize} text-text`}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">
                    {step.desc}
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
