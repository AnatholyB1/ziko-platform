'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  IoTimerOutline, IoBicycleOutline, IoBarbellOutline, IoCalculatorOutline,
  IoBodyOutline, IoMoonOutline, IoScaleOutline, IoWaterOutline, IoWatchOutline,
  IoNutritionOutline, IoFlaskOutline, IoCheckmarkCircleOutline, IoPersonOutline,
  IoJournalOutline, IoTrophyOutline, IoStatsChartOutline, IoPeopleOutline,
} from 'react-icons/io5'
import type { IconType } from 'react-icons'
import { fadeUp, cardHover } from '@/lib/motion'

type Plugin = { id: string; icon: IconType; category: string; name: string }
type TabKey = 'all' | 'training' | 'health' | 'nutrition' | 'coaching' | 'community'

const PLUGINS: Plugin[] = [
  { id: 'timer', icon: IoTimerOutline, category: 'training', name: 'Timer & Chrono' },
  { id: 'cardio', icon: IoBicycleOutline, category: 'training', name: 'Cardio & Running' },
  { id: 'ai-programs', icon: IoBarbellOutline, category: 'training', name: 'Programmes IA' },
  { id: 'rpe', icon: IoCalculatorOutline, category: 'training', name: 'Calculateur RPE' },
  { id: 'stretching', icon: IoBodyOutline, category: 'training', name: 'Stretching & Mobilité' },
  { id: 'sleep', icon: IoMoonOutline, category: 'health', name: 'Sommeil & Récupération' },
  { id: 'measurements', icon: IoScaleOutline, category: 'health', name: 'Mesures & Progression' },
  { id: 'hydration', icon: IoWaterOutline, category: 'health', name: 'Hydratation' },
  { id: 'wearables', icon: IoWatchOutline, category: 'health', name: 'Wearables & Santé' },
  { id: 'nutrition', icon: IoNutritionOutline, category: 'nutrition', name: 'Nutrition Tracker' },
  { id: 'supplements', icon: IoFlaskOutline, category: 'nutrition', name: 'Compléments' },
  { id: 'habits', icon: IoCheckmarkCircleOutline, category: 'coaching', name: 'Habitudes & Objectifs' },
  { id: 'persona', icon: IoPersonOutline, category: 'coaching', name: 'AI Persona' },
  { id: 'journal', icon: IoJournalOutline, category: 'coaching', name: 'Journal & Mindset' },
  { id: 'gamification', icon: IoTrophyOutline, category: 'coaching', name: 'Récompenses' },
  { id: 'stats', icon: IoStatsChartOutline, category: 'coaching', name: 'Statistiques' },
  { id: 'community', icon: IoPeopleOutline, category: 'community', name: 'Communauté' },
]

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'showcase.categoryAll' },
  { key: 'training', labelKey: 'showcase.categoryTraining' },
  { key: 'health', labelKey: 'showcase.categoryHealth' },
  { key: 'nutrition', labelKey: 'showcase.categoryNutrition' },
  { key: 'coaching', labelKey: 'showcase.categoryCoaching' },
  { key: 'community', labelKey: 'showcase.categoryCommunity' },
]

export function PluginShowcase() {
  const t = useTranslations('Home')
  const tPlugins = useTranslations('Plugins')
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })

  const filtered = activeTab === 'all' ? PLUGINS : PLUGINS.filter(p => p.category === activeTab)

  return (
    <section ref={ref} className="py-24 bg-background">
      <div className="max-w-screen-xl mx-auto px-8">
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="text-3xl md:text-4xl font-black text-text text-center mb-10"
        >
          {t('showcase.heading')}
        </motion.h2>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          {TABS.map(tab => (
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
                {t(tab.labelKey as Parameters<typeof t>[0])}
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                  whileHover={cardHover}
                  className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-2 cursor-pointer"
                >
                  <Icon className="text-primary" size={28} />
                  <span className="text-sm font-bold text-text">{plugin.name}</span>
                  <p className="text-xs text-muted leading-relaxed">
                    {tPlugins(plugin.id as Parameters<typeof tPlugins>[0])}
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
