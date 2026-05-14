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
