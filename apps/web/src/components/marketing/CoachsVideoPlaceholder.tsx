'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { IoPlayOutline } from 'react-icons/io5'

export default function CoachsVideoPlaceholder() {
  const t = useTranslations('coachs')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-10">
          {t('video.heading')}
        </h2>
        {/* TODO: replace with real video when available: <video autoPlay muted loop playsInline className="w-full aspect-video rounded-2xl"><source src="/demo-coachs.mp4" type="video/mp4" /></video> */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="aspect-video max-w-3xl mx-auto rounded-2xl overflow-hidden relative"
          style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.18)', border: '1px solid rgba(255,92,26,0.30)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-orange-950 flex flex-col items-center justify-center gap-6">
            <span className="text-white text-5xl font-bold tracking-tight">ZIKO</span>
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <IoPlayOutline size={28} className="text-white ml-1" />
            </div>
            <p className="text-xs text-gray-400">{t('video.caption')}</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
