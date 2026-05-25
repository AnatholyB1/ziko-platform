'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion'
import {
  IoTimerOutline, IoBicycleOutline, IoBarbellOutline, IoCalculatorOutline,
  IoBodyOutline, IoMoonOutline, IoScaleOutline, IoWaterOutline, IoWatchOutline,
  IoNutritionOutline, IoFlaskOutline, IoCheckmarkCircleOutline, IoPersonOutline,
  IoJournalOutline, IoTrophyOutline, IoStatsChartOutline, IoPeopleOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { fadeUp, cardHover } from '@/lib/motion'

type TabKey = 'all' | 'training' | 'health' | 'nutrition' | 'coaching' | 'community'

type Plugin = { id: string; icon: IconType; category: string; name: string; description: string }

const PLUGIN_ICONS: Record<string, IconType> = {
  timer: IoTimerOutline,
  cardio: IoBicycleOutline,
  'ai-programs': IoBarbellOutline,
  rpe: IoCalculatorOutline,
  stretching: IoBodyOutline,
  sleep: IoMoonOutline,
  measurements: IoScaleOutline,
  hydration: IoWaterOutline,
  wearables: IoWatchOutline,
  nutrition: IoNutritionOutline,
  supplements: IoFlaskOutline,
  habits: IoCheckmarkCircleOutline,
  persona: IoPersonOutline,
  journal: IoJournalOutline,
  gamification: IoTrophyOutline,
  stats: IoStatsChartOutline,
  community: IoPeopleOutline,
}

const PLUGIN_CATEGORIES: Record<string, string> = {
  timer: 'training',
  cardio: 'training',
  'ai-programs': 'training',
  rpe: 'training',
  stretching: 'training',
  sleep: 'health',
  measurements: 'health',
  hydration: 'health',
  wearables: 'health',
  nutrition: 'nutrition',
  supplements: 'nutrition',
  habits: 'coaching',
  persona: 'coaching',
  journal: 'coaching',
  gamification: 'coaching',
  stats: 'coaching',
  community: 'community',
}

const PLUGIN_NAMES: Record<string, string> = {
  timer: 'Timer & Chrono',
  cardio: 'Cardio & Running',
  'ai-programs': 'Programmes IA',
  rpe: 'Calculateur RPE',
  stretching: 'Stretching & Mobilité',
  sleep: 'Sommeil & Récupération',
  measurements: 'Mesures & Progression',
  hydration: 'Hydratation',
  wearables: 'Wearables & Santé',
  nutrition: 'Nutrition Tracker',
  supplements: 'Compléments',
  habits: 'Habitudes & Objectifs',
  persona: 'AI Persona',
  journal: 'Journal & Mindset',
  gamification: 'Récompenses',
  stats: 'Statistiques',
  community: 'Communauté',
}

const PLUGIN_IDS = [
  'timer', 'cardio', 'ai-programs', 'rpe', 'stretching',
  'sleep', 'measurements', 'hydration', 'wearables',
  'nutrition', 'supplements',
  'habits', 'persona', 'journal', 'gamification', 'stats',
  'community',
]

type Props = {
  heading: string
  tabs: { key: TabKey; label: string }[]
  pluginDescriptions: Record<string, string>
}

export function PluginShowcaseClient({ heading, tabs, pluginDescriptions }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })
  const prefersReducedMotion = useReducedMotion()

  const cardVariants = prefersReducedMotion
    ? { hidden: {}, visible: {} }
    : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

  const plugins: Plugin[] = PLUGIN_IDS.map(id => ({
    id,
    icon: PLUGIN_ICONS[id],
    category: PLUGIN_CATEGORIES[id],
    name: PLUGIN_NAMES[id],
    description: pluginDescriptions[id] ?? '',
  }))

  const filtered = activeTab === 'all' ? plugins : plugins.filter(p => p.category === activeTab)

  return (
    <section ref={ref} className="py-24 bg-background">
      <div className="max-w-screen-xl mx-auto px-8">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="text-3xl md:text-4xl font-black text-text text-center mb-10"
        >
          {heading}
        </motion.h2>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-2 rounded-full text-sm font-bold transition-colors"
              style={{ color: activeTab === tab.key ? '#fff' : '#6B6963' }}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10">
                {tab.label}
              </span>
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {filtered.map((plugin, i) => {
              const Icon = plugin.icon
              return (
                <motion.div
                  key={plugin.id}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  transition={prefersReducedMotion ? undefined : { delay: i * 0.05, duration: 0.35 }}
                  whileHover={prefersReducedMotion ? undefined : cardHover}
                  className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-2 cursor-pointer"
                >
                  <Icon className="text-primary" size={28} />
                  <span className="text-sm font-bold text-text">{plugin.name}</span>
                  <p className="text-xs text-muted leading-relaxed">
                    {plugin.description}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
