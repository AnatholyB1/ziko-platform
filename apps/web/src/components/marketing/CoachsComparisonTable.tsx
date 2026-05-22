'use client'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { IoCheckmarkCircleOutline, IoCloseCircleOutline } from 'react-icons/io5'

export default function CoachsComparisonTable() {
  const t = useTranslations('coachs')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-4">
          {t('comparison.heading')}
        </h2>
        <p className="text-base text-muted text-center mb-12">
          {t('comparison.subheading')}
        </p>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-screen-md mx-auto overflow-x-auto"
        >
          <table className="w-full border-collapse">
            <caption className="sr-only">Comparison of Ziko vs Trainerize vs TrueCoach</caption>
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 border-b-2 border-border" />
                <th
                  scope="col"
                  className="px-4 py-3 border-b-2 border-border text-xs font-bold text-primary bg-primary/5"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  Ziko
                </th>
                <th scope="col" className="px-4 py-3 border-b-2 border-border text-xs font-bold text-text">
                  Trainerize
                </th>
                <th scope="col" className="px-4 py-3 border-b-2 border-border text-xs font-bold text-text">
                  TrueCoach
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1 — AI-native tools */}
              <tr>
                <td className="px-4 py-3 border-b border-border text-xs font-bold text-text sticky left-0 bg-white">
                  {t('comparison.feature1Label')}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-[#22C55E] flex-shrink-0" aria-label="Oui" />
                    {t('comparison.zikoFeature1')}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <IoCloseCircleOutline size={18} className="text-[#EF4444]" aria-label="Non" />
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <IoCloseCircleOutline size={18} className="text-[#EF4444]" aria-label="Non" />
                </td>
              </tr>
              {/* Row 2 — Client data depth */}
              <tr>
                <td className="px-4 py-3 border-b border-border text-xs font-bold text-text sticky left-0 bg-[#F0EFE9]">
                  {t('comparison.feature2Label')}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-[#22C55E] flex-shrink-0" aria-label="Oui" />
                    {t('comparison.zikoFeature2')}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border bg-[#F0EFE9] text-xs text-text">
                  {t('comparison.trainerizeFeature2')}
                </td>
                <td className="px-4 py-3 border-b border-border bg-[#F0EFE9] text-xs text-text">
                  {t('comparison.truecoachFeature2')}
                </td>
              </tr>
              {/* Row 3 — Integrated athlete mobile app */}
              <tr>
                <td className="px-4 py-3 border-b border-border text-xs font-bold text-text sticky left-0 bg-white">
                  {t('comparison.feature3Label')}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-[#22C55E] flex-shrink-0" aria-label="Oui" />
                    {t('comparison.zikoFeature3')}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-[#22C55E] flex-shrink-0" aria-label="Oui" />
                    {t('comparison.trainerizeFeature3')}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  {t('comparison.truecoachFeature3')}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-4 text-center">{t('comparison.footnote')}</p>
        </motion.div>
      </div>
    </section>
  )
}
