# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ziko-web landing page with athletic/energetic visual direction, Framer Motion animations (scroll-triggered, entrance, parallax, micro-interactions), two new sections (HowItWorks, AICoach), and revamped PluginShowcase + Pricing.

**Architecture:** All animated components are Client Components (`"use client"`) using `useTranslations` (next-intl client hook). Server Components only handle metadata. Framer Motion handles all animation. Shared variants live in `src/lib/motion.ts`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Framer Motion, next-intl, react-icons

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | Add framer-motion dependency |
| `messages/fr.json` | Modify | New i18n keys: hero badge, howItWorks, aiCoach, pricing additions, showcase tab |
| `messages/en.json` | Modify | Same in English |
| `src/lib/motion.ts` | Create | Shared Framer Motion variants and transition presets |
| `src/components/layout/Header.tsx` | Rewrite | Sticky header with scroll-triggered blur |
| `src/components/marketing/Hero.tsx` | Rewrite | Full-screen hero with entrance animations + parallax |
| `src/components/marketing/HowItWorks.tsx` | Create | 3-step section with count-up numbers + SVG connector |
| `src/components/marketing/AICoach.tsx` | Create | Dark section with typewriter chat + glow pulse |
| `src/components/marketing/PluginShowcase.tsx` | Rewrite | Animated tabs (layoutId) + AnimatePresence grid |
| `src/components/marketing/Pricing.tsx` | Rewrite | Scroll entrance + popular badge + glow CTA |
| `src/components/layout/Footer.tsx` | Rewrite | Gradient border + animated underline hover links |
| `src/app/[locale]/page.tsx` | Modify | Add HowItWorks + AICoach imports |

---

## Task 1: Install Framer Motion + add i18n keys

**Files:**
- Modify: `package.json`
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Install framer-motion**

Run from `C:/ziko-web`:
```bash
npm install framer-motion
```
Expected: `framer-motion` appears in `package.json` dependencies, `package-lock.json` updated.

- [ ] **Step 2: Update messages/fr.json — replace the entire "Home" key**

In `messages/fr.json`, replace the entire `"Home"` section with:
```json
"Home": {
  "hero": {
    "badge": "🔥 Coach IA · 17 plugins · iOS & Android",
    "headline1": "Entraîne-toi.",
    "headline2": "Progresse.",
    "headline3": "Recommence.",
    "subline": "17 plugins, un seul abonnement. Coaching IA, suivi nutrition, GPS running et bien plus.",
    "ctaAppStore": "Télécharger sur l'App Store",
    "ctaPlayStore": "Disponible sur Google Play"
  },
  "howItWorks": {
    "heading": "Comment ça marche",
    "step1": {
      "title": "Télécharge",
      "description": "Installe Ziko en 30 secondes, disponible sur iOS et Android."
    },
    "step2": {
      "title": "Personnalise",
      "description": "Choisis tes plugins, configure ton coach IA selon ton style d'entraînement."
    },
    "step3": {
      "title": "Progresse",
      "description": "Suis tes données, reçois des recommandations et bats tes records."
    }
  },
  "aiCoach": {
    "badge": "Propulsé par Claude Sonnet",
    "heading": "Ton coach IA qui te comprend vraiment",
    "description": "Pose tes questions, fixe tes objectifs, demande un programme. Le coach IA analyse tes habitudes, ta nutrition et tes performances pour te donner des conseils personnalisés en temps réel.",
    "cta": "Découvrir le coach IA",
    "userMessage": "J'ai du mal à rester régulier, comment m'aider ?",
    "aiMessage": "Commençons par 3 habitudes simples cette semaine. Je vais t'envoyer un rappel chaque jour et ajuster selon tes résultats. 💪"
  },
  "showcase": {
    "heading": "17 plugins, une seule app",
    "categoryAll": "Tous",
    "categoryTraining": "Entraînement",
    "categoryHealth": "Santé",
    "categoryNutrition": "Nutrition",
    "categoryCoaching": "Coaching & IA",
    "categoryCommunity": "Communauté"
  },
  "pricing": {
    "popularBadge": "Le plus populaire",
    "heading": "Gratuit pour toujours",
    "price": "0€",
    "priceUnit": "/mois",
    "valueProp1": "Pas d'abonnement, pas de surprise",
    "valueProp2": "Coaching IA inclus dans l'app",
    "valueProp3": "17 plugins disponibles dès le téléchargement",
    "cta": "Télécharger gratuitement",
    "priceNote": "Essai gratuit 7 jours · Annulation à tout moment"
  }
}
```

- [ ] **Step 3: Update messages/en.json — replace the entire "Home" key**

In `messages/en.json`, replace the entire `"Home"` section with:
```json
"Home": {
  "hero": {
    "badge": "🔥 AI Coach · 17 plugins · iOS & Android",
    "headline1": "Train.",
    "headline2": "Progress.",
    "headline3": "Repeat.",
    "subline": "17 plugins, one app. AI coaching, nutrition tracking, GPS running and much more.",
    "ctaAppStore": "Download on the App Store",
    "ctaPlayStore": "Get it on Google Play"
  },
  "howItWorks": {
    "heading": "How it works",
    "step1": {
      "title": "Download",
      "description": "Install Ziko in 30 seconds, available on iOS and Android."
    },
    "step2": {
      "title": "Customize",
      "description": "Choose your plugins, configure your AI coach to match your training style."
    },
    "step3": {
      "title": "Progress",
      "description": "Track your data, get personalized recommendations and beat your records."
    }
  },
  "aiCoach": {
    "badge": "Powered by Claude Sonnet",
    "heading": "An AI coach that truly gets you",
    "description": "Ask questions, set goals, request a program. Your AI coach analyzes your habits, nutrition and performance to give you real-time personalized advice.",
    "cta": "Discover the AI coach",
    "userMessage": "I struggle to stay consistent — how can you help?",
    "aiMessage": "Let's start with 3 simple habits this week. I'll send you a daily reminder and adjust based on your results. 💪"
  },
  "showcase": {
    "heading": "17 plugins, one app",
    "categoryAll": "All",
    "categoryTraining": "Training",
    "categoryHealth": "Health",
    "categoryNutrition": "Nutrition",
    "categoryCoaching": "Coaching & AI",
    "categoryCommunity": "Community"
  },
  "pricing": {
    "popularBadge": "Most popular",
    "heading": "Free forever",
    "price": "$0",
    "priceUnit": "/month",
    "valueProp1": "No subscription, no hidden fees",
    "valueProp2": "AI coaching included in the app",
    "valueProp3": "17 plugins available from day one",
    "cta": "Download for free",
    "priceNote": "7-day free trial · Cancel anytime"
  }
}
```

- [ ] **Step 4: Commit**
```bash
cd C:/ziko-web
git add package.json package-lock.json messages/fr.json messages/en.json
git commit -m "feat(landing): install framer-motion, add i18n keys for redesign"
```

---

## Task 2: Create shared animation variants

**Files:**
- Create: `src/lib/motion.ts`

- [ ] **Step 1: Create src/lib/motion.ts**

Create `src/lib/motion.ts` with this exact content:
```ts
import type { Variants, Transition } from 'framer-motion'

export const easeOut: Transition = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1],
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: easeOut },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: easeOut },
}

export const ctaHover = { scale: 1.05 }
export const ctaTap = { scale: 0.97 }

export const cardHover = {
  scale: 1.03,
  boxShadow: '0 8px 32px rgba(255, 92, 26, 0.18)',
}
```

- [ ] **Step 2: Commit**
```bash
cd C:/ziko-web
git add src/lib/motion.ts
git commit -m "feat(landing): shared Framer Motion variants"
```

---

## Task 3: Rewrite Header with scroll-triggered blur

**Files:**
- Rewrite: `src/components/layout/Header.tsx`

- [ ] **Step 1: Rewrite Header.tsx**

Replace the entire contents of `src/components/layout/Header.tsx`:
```tsx
'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ctaHover, ctaTap } from '@/lib/motion'

export function Header() {
  const t = useTranslations('Header')
  const locale = useLocale()
  const { scrollY } = useScroll()
  const blurOpacity = useTransform(scrollY, [0, 50], [0, 1])

  return (
    <motion.header className="sticky top-0 z-50">
      <motion.div
        className="absolute inset-0 backdrop-blur-md bg-white/90 border-b border-border"
        style={{ opacity: blurOpacity }}
      />
      <div className="relative max-w-screen-xl mx-auto px-8 h-14 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-primary">
          {t('logo')}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              locale="fr"
              className={locale === 'fr' ? 'font-bold text-text text-sm' : 'text-sm text-muted hover:text-text transition-colors'}
            >
              {t('localeFR')}
            </Link>
            <span className="text-muted text-sm">|</span>
            <Link
              href="/"
              locale="en"
              className={locale === 'en' ? 'font-bold text-text text-sm' : 'text-sm text-muted hover:text-text transition-colors'}
            >
              {t('localeEN')}
            </Link>
          </div>
          <motion.div whileHover={ctaHover} whileTap={ctaTap}>
            <Link href="#" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold block">
              {t('cta')}
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.header>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev` in `C:/ziko-web`, open `http://localhost:3000/fr`.
- At top: header background is invisible
- After 50px scroll: `backdrop-blur-md` + white/90 + border-b appear smoothly

- [ ] **Step 3: Commit**
```bash
cd C:/ziko-web
git add src/components/layout/Header.tsx
git commit -m "feat(landing): header scroll-triggered blur"
```

---

## Task 4: Rewrite Hero with entrance animations + parallax

**Files:**
- Rewrite: `src/components/marketing/Hero.tsx`

- [ ] **Step 1: Rewrite Hero.tsx**

Replace the entire contents of `src/components/marketing/Hero.tsx`:
```tsx
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
            {/* Badge */}
            <motion.div variants={fadeIn} initial="hidden" animate="visible">
              <span className="inline-flex self-start bg-primary/10 text-primary text-xs font-bold px-4 py-2 rounded-full border border-primary/20">
                {t('hero.badge')}
              </span>
            </motion.div>

            {/* H1 — 3 lines, staggered */}
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

            {/* Subline */}
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.6 }}
              className="text-lg text-muted leading-relaxed max-w-md"
            >
              {t('hero.subline')}
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.75 }}
              className="flex flex-wrap gap-4"
            >
              <motion.a
                href="#"
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
            {/* Orb */}
            <motion.div
              style={{ y: orbY }}
              className="absolute w-72 h-72 rounded-full bg-primary/15 blur-3xl"
              aria-hidden
            />
            {/* Phone */}
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

      {/* Scroll indicator */}
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/fr`. Check:
- Badge fades in immediately
- 3 headline lines ("Entraîne-toi." / "Progresse." / "Recommence.") stagger in from below
- Subline fades up at ~0.6s
- Two CTAs appear at ~0.75s
- Phone slides in from the right with slight Y rotation
- Orange orb glows behind phone
- Chevron bounces at the bottom, disappears on scroll

- [ ] **Step 3: Commit**
```bash
cd C:/ziko-web
git add src/components/marketing/Hero.tsx
git commit -m "feat(landing): hero entrance animations, word stagger, parallax phone + orb"
```

---

## Task 5: Create HowItWorks section

**Files:**
- Create: `src/components/marketing/HowItWorks.tsx`

- [ ] **Step 1: Create src/components/marketing/HowItWorks.tsx**

Create this file with the following content:
```tsx
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
                {/* Giant number */}
                <div className="text-8xl md:text-9xl font-black leading-none select-none mb-2 text-primary/15">
                  <CountUp target={step.number} isVisible={isVisible} />
                </div>

                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 -mt-4">
                  <Icon className="text-primary" size={24} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-black text-text mb-2">
                  {t(step.titleKey as Parameters<typeof t>[0])}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted leading-relaxed">
                  {t(step.descKey as Parameters<typeof t>[0])}
                </p>
              </motion.div>
            )
          })}

          {/* SVG dashed connector — desktop only */}
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
```

- [ ] **Step 2: Commit**
```bash
cd C:/ziko-web
git add src/components/marketing/HowItWorks.tsx
git commit -m "feat(landing): HowItWorks section with count-up numbers and SVG connector"
```

---

## Task 6: Create AICoach section

**Files:**
- Create: `src/components/marketing/AICoach.tsx`

- [ ] **Step 1: Create src/components/marketing/AICoach.tsx**

Create this file with the following content:
```tsx
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
      if (i >= text.length) {
        clearInterval(timer)
        return
      }
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
          {/* Left — text */}
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

          {/* Right — chat card */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="md:w-1/2"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="bg-white/10 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs">
                  {t('aiCoach.userMessage')}
                </div>
              </div>

              {/* AI bubble */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-3"
              >
                {/* Glowing icon */}
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
                  {isVisible && (
                    <TypewriterText text={t('aiCoach.aiMessage')} isVisible={isVisible} />
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**
```bash
cd C:/ziko-web
git add src/components/marketing/AICoach.tsx
git commit -m "feat(landing): AICoach section with typewriter and glow pulse"
```

---

## Task 7: Rewrite PluginShowcase with animated tabs + AnimatePresence

**Files:**
- Rewrite: `src/components/marketing/PluginShowcase.tsx`

- [ ] **Step 1: Rewrite PluginShowcase.tsx**

Replace the entire contents of `src/components/marketing/PluginShowcase.tsx`:
```tsx
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
        {/* Heading */}
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="text-3xl md:text-4xl font-black text-text text-center mb-10"
        >
          {t('showcase.heading')}
        </motion.h2>

        {/* Tabs */}
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

        {/* Grid with AnimatePresence */}
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/fr`, scroll to PluginShowcase:
- Tabs row is visible. Click "Entraînement" → orange pill slides to that tab, grid fades out and new cards fade in with stagger
- Click "Tous" → pill slides back, all 17 cards appear
- Hover a card → scale up + orange glow

- [ ] **Step 3: Commit**
```bash
cd C:/ziko-web
git add src/components/marketing/PluginShowcase.tsx
git commit -m "feat(landing): PluginShowcase animated tabs (layoutId) + AnimatePresence grid"
```

---

## Task 8: Rewrite Pricing with scroll entrance + glow CTA

**Files:**
- Rewrite: `src/components/marketing/Pricing.tsx`

- [ ] **Step 1: Rewrite Pricing.tsx**

Replace the entire contents of `src/components/marketing/Pricing.tsx`:
```tsx
'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useInView } from 'framer-motion'
import { IoCheckmarkCircleOutline } from 'react-icons/io5'
import { ctaHover, ctaTap } from '@/lib/motion'

export function Pricing() {
  const t = useTranslations('Home')
  const ref = useRef<HTMLElement>(null)
  const isVisible = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-black text-text text-center mb-4"
        >
          {t('pricing.heading')}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex justify-center mb-4"
        >
          <span className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full">
            {t('pricing.popularBadge')}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="border-2 border-primary rounded-3xl p-8 max-w-sm mx-auto"
          style={{ boxShadow: '0 8px 48px rgba(255,92,26,0.12)' }}
        >
          <div className="text-center mb-8">
            <span className="text-6xl font-black text-primary">{t('pricing.price')}</span>
            <span className="text-muted text-base"> {t('pricing.priceUnit')}</span>
          </div>

          <ul className="flex flex-col gap-4 mb-8">
            {(['valueProp1', 'valueProp2', 'valueProp3'] as const).map(key => (
              <li key={key} className="flex items-start gap-3 text-sm text-text leading-relaxed">
                <IoCheckmarkCircleOutline className="text-primary flex-shrink-0 mt-0.5" size={20} />
                <span>{t(`pricing.${key}`)}</span>
              </li>
            ))}
          </ul>

          <motion.a
            href="#"
            whileHover={{ ...ctaHover, boxShadow: '0 8px 32px rgba(255,92,26,0.45)' }}
            whileTap={ctaTap}
            className="block w-full bg-primary text-white py-4 rounded-2xl font-black text-base text-center"
          >
            {t('pricing.cta')}
          </motion.a>

          <p className="text-center text-xs text-muted mt-4">
            {t('pricing.priceNote')}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**
```bash
cd C:/ziko-web
git add src/components/marketing/Pricing.tsx
git commit -m "feat(landing): Pricing scale entrance, popular badge, glow CTA"
```

---

## Task 9: Adjust Footer with animated underline links

**Files:**
- Rewrite: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Rewrite Footer.tsx**

Replace the entire contents of `src/components/layout/Footer.tsx`:
```tsx
'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion } from 'framer-motion'

function AnimatedLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative text-sm text-text inline-block overflow-hidden">
      {children}
      <motion.span
        className="absolute bottom-0 left-0 h-px bg-primary w-full origin-left"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </Link>
  )
}

export function Footer() {
  const t = useTranslations('Footer')

  return (
    <footer className="bg-white">
      <div
        className="h-px w-full"
        style={{ background: 'linear-gradient(90deg, #FF5C1A 0%, transparent 100%)' }}
      />
      <div className="max-w-screen-xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-primary">ZIKO</span>
          <p className="text-sm text-muted">{t('copyright')}</p>
        </div>
        <nav className="flex flex-wrap gap-6 justify-center">
          <AnimatedLink href="/mentions-legales">{t('legal')}</AnimatedLink>
          <AnimatedLink href="/politique-de-confidentialite">{t('privacy')}</AnimatedLink>
          <AnimatedLink href="/cgu">{t('terms')}</AnimatedLink>
          <Link href="/supprimer-mon-compte" className="text-sm text-muted hover:text-text transition-colors">
            {t('deleteAccount')}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**
```bash
cd C:/ziko-web
git add src/components/layout/Footer.tsx
git commit -m "feat(landing): footer gradient border + animated underline links"
```

---

## Task 10: Update page.tsx + full verification

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Update page.tsx**

Replace the entire contents of `src/app/[locale]/page.tsx`:
```tsx
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Hero } from '@/components/marketing/Hero'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { AICoach } from '@/components/marketing/AICoach'
import { PluginShowcase } from '@/components/marketing/PluginShowcase'
import { Pricing } from '@/components/marketing/Pricing'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: '/fr', en: '/en' },
    },
    openGraph: {
      title: t('homeTitle'),
      description: t('homeDescription'),
      url: `/${locale}`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('homeTitle'),
      description: t('homeDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main>
      <Hero />
      <HowItWorks />
      <AICoach />
      <PluginShowcase />
      <Pricing />
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:/ziko-web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Full visual verification**

Start dev server: `npm run dev` in `C:/ziko-web`

Open `http://localhost:3000/fr` and check each section top-to-bottom:

| Section | What to check |
|---|---|
| Header | Transparent at top. Scroll 50px → blur + border appear smoothly |
| Hero | Badge → 3 headline lines stagger → subline → CTAs → phone slides from right with orb glow behind it → chevron bounces at bottom, disappears on scroll |
| HowItWorks | Scroll into view → 01/02/03 count up, dashed line draws left-to-right, icons animate in with stagger |
| AICoach | Dark section appears. Text slides up. Chat card slides from right. AI bubble icon pulses orange. AI message types out character by character |
| PluginShowcase | Heading + tabs fade in. Click category tabs → pill slides smoothly to new tab → grid transitions with AnimatePresence. Hover card → scale + orange shadow |
| Pricing | Card scales in from slightly smaller. Hover CTA → intense orange glow |
| Footer | Gradient border top-left. Hover legal links → orange underline slides in from left |

Also open `http://localhost:3000/en` and verify English translations load correctly.

- [ ] **Step 4: Final commit**

```bash
cd C:/ziko-web
git add src/app/\[locale\]/page.tsx
git commit -m "feat(landing): complete landing page redesign

Sections: Hero, HowItWorks, AICoach, PluginShowcase, Pricing
Motion: word stagger, parallax, scroll-triggered fade-up, animated tabs,
AnimatePresence, typewriter, count-up, glow pulse, hover micro-interactions"
```
