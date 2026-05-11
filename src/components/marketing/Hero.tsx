'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { motion, useScroll, useTransform } from 'framer-motion'
import { fadeIn, fadeUp, ctaHover, ctaTap } from '@/lib/motion'
import { IoChevronDownOutline } from 'react-icons/io5'

const wordVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.2 },
  },
}

export function Hero() {
  const t = useTranslations('Home')
  const ref = useRef<HTMLElement>(null)
  const { scrollY } = useScroll()

  const phoneY = useTransform(scrollY, [0, 400], [0, -40])
  const orbY = useTransform(scrollY, [0, 400], [0, 30])
  const indicatorOpacity = useTransform(scrollY, [0, 100], [1, 0])

  const headlines = [
    t('hero.headline1'),
    t('hero.headline2'),
    t('hero.headline3'),
  ]

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      <div className="relative max-w-screen-xl mx-auto px-8 py-20 w-full">
        <div className="flex flex-col md:flex-row md:items-center gap-12">
          {/* Left column */}
          <div className="flex flex-col gap-6 justify-center md:w-3/5 z-10">
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <span className="inline-flex self-start bg-primary/10 text-primary text-xs font-bold px-4 py-2 rounded-full border border-primary/20">
                {t('hero.badge')}
              </span>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-1"
            >
              {headlines.map((line, i) => (
                <motion.h1
                  key={i}
                  variants={wordVariants}
                  className="text-5xl md:text-7xl font-black text-text leading-none tracking-tight"
                >
                  {line}
                </motion.h1>
              ))}
            </motion.div>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.6 }}
              className="text-lg text-muted leading-relaxed max-w-md"
            >
              {t('hero.subline')}
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.75 }}
              className="flex flex-wrap gap-4"
            >
              <motion.a
                href="https://testflight.apple.com/join/ad7pvUxQ"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={ctaHover}
                whileTap={ctaTap}
                className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm inline-block"
                style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.3)' }}
              >
                {t('hero.ctaAppStore')}
              </motion.a>
              <motion.a
                href="https://play.google.com/apps/internaltest/4701476780923858257"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={ctaHover}
                whileTap={ctaTap}
                className="border-2 border-primary text-primary px-6 py-3 rounded-xl font-bold text-sm inline-block"
              >
                {t('hero.ctaPlayStore')}
              </motion.a>
            </motion.div>
          </div>

          {/* Right column — phone + orb */}
          <div className="flex justify-center items-center md:w-2/5 relative">
            <motion.div
              style={{ y: orbY }}
              className="absolute w-72 h-72 rounded-full bg-primary/15 blur-3xl"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, x: 80, rotateY: 8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ y: phoneY }}
            >
              <div
                style={{
                  width: 220,
                  height: 440,
                  borderRadius: 32,
                  border: '3px solid #1C1A17',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '100%', height: '100%', borderRadius: 30, position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/screen.jpg"
                    alt="Ziko app"
                    fill
                    style={{ objectFit: 'cover' }}
                    priority
                    sizes="220px"
                  />
                </div>
                <div
                  style={{
                    position: 'absolute', top: 8, left: '50%',
                    transform: 'translateX(-50%)', width: 80, height: 20,
                    borderRadius: 12, background: '#1C1A17', zIndex: 10,
                  }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        style={{ opacity: indicatorOpacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <IoChevronDownOutline className="text-muted" size={24} />
        </motion.div>
      </motion.div>
    </section>
  )
}
