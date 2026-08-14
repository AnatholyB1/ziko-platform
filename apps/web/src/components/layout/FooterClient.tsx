'use client'

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

type Props = {
  copyright: string
  legal: string
  privacy: string
  terms: string
  cgv: string
  deleteAccount: string
}

export function FooterClient({ copyright, legal, privacy, terms, cgv, deleteAccount }: Props) {
  return (
    <footer className="bg-white">
      <div className="h-px w-full bg-gradient-to-r from-primary/20 to-transparent" />
      <div className="max-w-screen-xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-primary">ZIKO</span>
          <p className="text-sm text-muted">{copyright}</p>
        </div>
        <nav className="flex flex-wrap gap-6 justify-center">
          <AnimatedLink href="/mentions-legales">{legal}</AnimatedLink>
          <AnimatedLink href="/politique-de-confidentialite">{privacy}</AnimatedLink>
          <AnimatedLink href="/cgu">{terms}</AnimatedLink>
          <AnimatedLink href="/cgv">{cgv}</AnimatedLink>
          <Link href="/supprimer-mon-compte" className="text-sm text-muted hover:text-text transition-colors">
            {deleteAccount}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
