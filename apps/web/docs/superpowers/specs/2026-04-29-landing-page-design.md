# Landing Page Redesign — Ziko Web

**Date:** 2026-04-29  
**Project:** `ziko-web` (Next.js 15 + Tailwind v4 + next-intl)  
**Scope:** Full redesign of `src/app/[locale]/page.tsx` and all marketing components

---

## 1. Visual Direction

**Register:** Athletic / Energetic (Nike, Strava)  
- Typographies XXL, weight 900 (font-black)  
- Primary orange `#FF5C1A` used boldly as the main accent  
- Fast, impactful motion — never decorative for its own sake  
- Light sport theme maintained (no dark mode except AI Coach section)

**Design tokens (unchanged):**

| Token | Value |
|---|---|
| Background | `#F7F6F3` |
| Surface | `#FFFFFF` |
| Border | `#E2E0DA` |
| Primary | `#FF5C1A` |
| Text | `#1C1A17` |
| Muted | `#6B6963` |

---

## 2. Animation Library

**Choice:** Framer Motion (Option A)  
**Rationale:** Native React integration, works cleanly with Next.js 15 App Router, covers all animation needs (scroll-triggered, entrance, parallax, hover, stagger), compatible with React 19, no commercial license required.

**Architecture rule:** All animated components are Client Components (`"use client"`) with a thin wrapper pattern. Server Components (translations, metadata) pass text as props to client wrappers — SSR is preserved for content, motion runs client-side only.

---

## 3. Page Structure

```
Header         (sticky, blur-on-scroll)
Hero           (full-screen, XXL type, phone mockup, parallax orb)
HowItWorks     (3-step, NEW)
AICoach        (dark section, NEW)
PluginShowcase (tabs + animated grid, revamped)
Pricing        (premium card, revamped)
Footer         (minimal, adjusted)
```

---

## 4. Motion System

| Element | Animation | Trigger |
|---|---|---|
| Hero headline | Stagger word-by-word `y: 40→0, opacity: 0→1` | Page load |
| Hero phone | Slide from right `x: 80→0` + `rotateY: 8deg→0` | Page load |
| Hero background orb | Parallax (inverse, slow) via `useScroll/useTransform` | Scroll |
| Hero scroll indicator | Bounce loop, `opacity: 0` at `scrollY > 100` | Always |
| Header | `backdrop-blur-md + bg-white/80 + border-b` at `scrollY > 50` | Scroll |
| All sections | `useInView` → fade-up stagger on children | Scroll |
| HowItWorks numbers | Count-up `0 → N` over 0.8s | useInView |
| HowItWorks connector line | `pathLength: 0 → 1` SVG draw | useInView |
| AICoach icon | Glow pulse (box-shadow orange), 2s loop | Always |
| AICoach chat bubble | Typewriter reveal, 0.5s delay | useInView |
| Plugin tabs | `layoutId` pill slides between active tabs | Click |
| Plugin cards | `AnimatePresence` fade+scale on category change | Click |
| Plugin cards | `whileHover: scale(1.03)` + orange shadow | Hover |
| All CTAs | `whileHover: scale(1.05)` + `whileTap: scale(0.97)` | Interaction |
| Footer links | Underline `scaleX: 0→1` from left | Hover |

---

## 5. Sections Detail

### 5.1 Header

- Logo `ZIKO` bold orange, `text-2xl`
- Lang switcher (FR | EN) + CTA button
- **Sticky** with `motion.header`: at `scrollY > 50`, transition to `backdrop-blur-md bg-white/80 border-b border-border` via spring animation
- CTA: `whileHover scale(1.05)` + `whileTap scale(0.97)`

### 5.2 Hero

**Layout:** `min-h-screen`, vertically centered, background `#F7F6F3`

**Left column (60%):**
- Animated badge: `"🔥 Coach IA · 17 plugins · iOS & Android"` — orange pill, fade-in first (delay 0)
- H1 XXL (`~5rem` desktop / `~3rem` mobile, `font-black`): stagger word-by-word using `motion.span`, 3 lines:
  ```
  Entraîne-toi.
  Progresse.
  Recommence.
  ```
- Subline: `text-lg text-muted`, fade-in after title (delay 0.6s)
- CTAs row:
  - App Store: `bg-primary text-white`, hover glow
  - Play Store: `border-2 border-primary text-primary`, hover fill
  - Both: `whileHover + whileTap`

**Right column (40%):**
- Phone mockup: enters from right (`x: 80→0`), subtle 3D tilt (`rotateY: 8→0`), parallax vertical on scroll
- Background orb: `#FF5C1A` at 15% opacity, blurred (`blur-3xl`), parallax inverse (moves opposite to phone)

**Scroll indicator:** small chevron-down, `animate={{ y: [0, 6, 0] }}` loop, disappears at `scrollY > 100`

### 5.3 How It Works (NEW)

**Layout:** `bg-white`, 3-column desktop / stacked mobile

**Each step:**
- Giant number `"01"` `"02"` `"03"` — `font-black ~8rem`, `text-primary/15` (decorative), count-up on enter
- Icon: 48px circle `bg-primary/10`, Ionicons icon in orange
- Title: `font-bold text-xl`
- Description: `text-muted text-sm`

**Steps content:**
1. `download-outline` — **Télécharge** — "Installe Ziko en 30 secondes, disponible sur iOS et Android"
2. `settings-outline` — **Personnalise** — "Choisis tes plugins, configure ton coach IA selon ton style"
3. `trending-up-outline` — **Progresse** — "Suis tes données, reçois des recommandations et bats tes records"

**Connector:** dashed SVG line between steps, `pathLength: 0→1` animation, desktop only

**Motion:** stagger the 3 columns at `useInView`, `y: 30→0`, 0.15s delay between each

### 5.4 AI Coach Feature Highlight (NEW)

**Layout:** `bg-[#1C1A17]` (dark), high visual contrast — breaks the white rhythm

**Left (text):**
- Badge: `"Propulsé par Claude Sonnet"` — white/orange pill
- H2 `font-black ~3rem text-white`: "Ton coach IA qui te comprend vraiment"
- Description `text-white/70`: explains conversational AI, tools (habits, nutrition, programs, etc.)
- CTA: `bg-white text-primary`, `whileHover scale + glow`

**Right (chat card):**
- Stylized conversation card (`bg-white/5 rounded-2xl border border-white/10`)
- User bubble: `bg-white/10 text-white rounded-2xl`
- AI bubble: `bg-primary text-white`, with ⚡ icon — **typewriter reveal** (chars appear one by one), 0.5s delay
- AI icon: continuous glow pulse animation (`box-shadow` orange, 2s loop)

**Motion:** section enters `opacity: 0→1, y: 20→0`; AI bubble types in after 0.5s delay

### 5.5 Plugin Showcase (revamped)

**Layout:** `bg-[#F7F6F3]`, centered heading

**Category tabs:**
- Pills: "Tous" | "Training" | "Santé" | "Nutrition" | "Coaching" | "Communauté"
- Active tab: `bg-primary text-white`
- `layoutId="activeTab"` on a `motion.div` background — pill slides smoothly between tabs on click
- Inactive tabs: `text-muted hover:text-text`

**Grid:**
- `AnimatePresence mode="wait"` wraps the grid — cards fade+scale in/out on category change
- Stagger on enter: each card `+0.05s` delay
- Each card: `bg-white border border-border rounded-2xl p-5`
  - Icon 28px orange
  - Name `font-bold`
  - Description `text-muted text-sm`
  - `whileHover: scale(1.03)` + subtle orange `box-shadow`

### 5.6 Pricing (revamped)

**Layout:** `bg-white`, centered, `max-w-lg`

- Badge above card: `"Le plus populaire"` orange pill
- Card: `border-2 border-primary rounded-3xl shadow-xl`
- Entry animation: `scale: 0.95→1` at `useInView`
- Price: XXL `font-black text-primary`
- Sub-price: `"/ mois, sans engagement"` text-muted
- Features list: orange checkmarks, clear text
- CTA: `bg-primary full-width rounded-2xl font-bold`, `whileHover scale(1.03) + glow`, `whileTap scale(0.97)`
- Note: `"Essai gratuit 7 jours · Annulation à tout moment"` centered muted text below button

### 5.7 Footer (adjusted)

- Logo `ZIKO` more prominent: bold, orange
- Legal links with hover underline (`scaleX: 0→1` from left)
- Top border: gradient `#FF5C1A → transparent` instead of solid

---

## 6. File Changes

| File | Action |
|---|---|
| `package.json` | Add `framer-motion` |
| `src/components/layout/Header.tsx` | Rewrite as client component with scroll-based blur |
| `src/components/marketing/Hero.tsx` | Rewrite with all entrance animations |
| `src/components/marketing/HowItWorks.tsx` | Create (NEW) |
| `src/components/marketing/AICoach.tsx` | Create (NEW) |
| `src/components/marketing/PluginShowcase.tsx` | Rewrite with tabs + AnimatePresence |
| `src/components/marketing/Pricing.tsx` | Rewrite with scroll entrance + CTA glow |
| `src/components/layout/Footer.tsx` | Minor adjustments |
| `src/app/[locale]/page.tsx` | Add HowItWorks + AICoach imports |

---

## 7. i18n Keys Needed (new)

All new strings go into the `Home` namespace in `messages/fr.json` and `messages/en.json`:

```
Home.howItWorks.heading
Home.howItWorks.step1.title / .description
Home.howItWorks.step2.title / .description
Home.howItWorks.step3.title / .description
Home.aiCoach.badge
Home.aiCoach.heading
Home.aiCoach.description
Home.aiCoach.cta
Home.aiCoach.userMessage      ← example user message in chat card
Home.aiCoach.aiMessage        ← example AI response in chat card
Home.pricing.popularBadge
Home.pricing.priceNote
Home.hero.badge
```

---

## 8. Out of Scope

- Dark mode
- New pages (only landing page `/[locale]/`)
- Backend changes
- New screenshots or app assets
- Social proof / testimonials section (not requested)
