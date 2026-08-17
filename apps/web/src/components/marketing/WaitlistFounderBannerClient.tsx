'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { WaitlistRoleForm } from './WaitlistRoleForm'

type Props = {
  locale: string
  heroHeadline: string
  heroSubtitle: string
  pickerHeading: string
  pickerAthlete: string
  pickerCoach: string
  formEmailLabel: string
  formEmailPlaceholder: string
  formSubmit: string
  formSubmitPending: string
  successFounder: string
  successGeneric: string
  errorGeneric: string
  consentLabel: string
  collectionNotice: string
}

function RoleFormFallback() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden="true">
      <div className="rounded-2xl border border-border bg-white p-6 min-h-[140px]" />
      <div className="rounded-2xl border border-border bg-white p-6 min-h-[140px]" />
    </div>
  )
}

export function WaitlistFounderBannerClient({
  locale,
  heroHeadline,
  heroSubtitle,
  pickerHeading,
  pickerAthlete,
  pickerCoach,
  formEmailLabel,
  formEmailPlaceholder,
  formSubmit,
  formSubmitPending,
  successFounder,
  successGeneric,
  errorGeneric,
  consentLabel,
  collectionNotice,
}: Props) {
  return (
    <>
      <section className="py-20 bg-background">
        <div className="max-w-screen-xl mx-auto px-8 text-center">
          {/* Plan 05-03 mounts the live "spots remaining" counter widget here. */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-5xl md:text-7xl font-bold leading-none text-text"
          >
            {heroHeadline}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            className="text-base text-muted leading-relaxed mt-6 max-w-[560px] mx-auto"
          >
            {heroSubtitle}
          </motion.p>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="max-w-screen-xl mx-auto px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-8">{pickerHeading}</h2>
          <div className="max-w-md mx-auto">
            <Suspense fallback={<RoleFormFallback />}>
              <WaitlistRoleForm
                locale={locale}
                pickerAthlete={pickerAthlete}
                pickerCoach={pickerCoach}
                emailLabel={formEmailLabel}
                emailPlaceholder={formEmailPlaceholder}
                submitLabel={formSubmit}
                submitPendingLabel={formSubmitPending}
                successFounder={successFounder}
                successGeneric={successGeneric}
                errorGeneric={errorGeneric}
                consentLabel={consentLabel}
                collectionNotice={collectionNotice}
              />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  )
}
