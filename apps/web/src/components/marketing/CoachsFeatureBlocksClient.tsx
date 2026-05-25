'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { IoPeopleOutline, IoSparklesOutline, IoCalendarOutline, IoRocketOutline } from 'react-icons/io5'
import type { ComponentType } from 'react'

const FEATURE_ICONS: Array<ComponentType<{ size?: number; className?: string }>> = [
  IoPeopleOutline,
  IoSparklesOutline,
  IoCalendarOutline,
  IoRocketOutline,
]

type FeatureItem = {
  title: string
  body: string
  bullets: string[]
  hasRoadmapTag: boolean
  roadmapTag?: string
}

type Props = {
  heading: string
  subheading: string
  features: FeatureItem[]
}

export function CoachsFeatureBlocksClient({ heading, subheading, features }: Props) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="py-24 bg-background">
      <div className="max-w-screen-xl mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-4">
          {heading}
        </h2>
        <p className="text-base text-muted text-center mb-16 max-w-lg mx-auto">
          {subheading}
        </p>
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((f, index) => {
            const Icon = FEATURE_ICONS[index]
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(28,26,23,0.10)' }}
                className="bg-white border border-border rounded-2xl p-8 relative"
                style={{ boxShadow: '0 4px 8px rgba(28,26,23,0.08)' }}
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={24} className="text-primary" />
                  </div>
                  {f.hasRoadmapTag && f.roadmapTag && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ color: '#FF5C1A', border: '1px solid #FF5C1A', backgroundColor: 'rgba(255,92,26,0.08)' }}
                    >
                      {f.roadmapTag}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-text mt-4">{f.title}</h3>
                <p className="text-base text-muted leading-relaxed mt-2">{f.body}</p>
                <ul className="mt-4">
                  {f.bullets.map((bullet, bi) => (
                    <li
                      key={bi}
                      className={`flex items-start gap-2 mt-2 ${f.hasRoadmapTag ? 'text-sm text-muted/60 leading-relaxed' : 'text-sm text-muted leading-relaxed'}`}
                    >
                      <span className="text-primary mt-0.5">·</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
