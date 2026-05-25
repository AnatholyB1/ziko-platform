'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { IoCheckmarkCircleOutline, IoCloseCircleOutline } from 'react-icons/io5'

type Props = {
  heading: string
  subheading: string
  footnote: string
  feature1Label: string
  feature2Label: string
  feature3Label: string
  zikoFeature1: string
  zikoFeature2: string
  zikoFeature3: string
  trainerizeFeature2: string
  trainerizeFeature3: string
  truecoachFeature2: string
  truecoachFeature3: string
}

export function CoachsComparisonTableClient({
  heading,
  subheading,
  footnote,
  feature1Label,
  feature2Label,
  feature3Label,
  zikoFeature1,
  zikoFeature2,
  zikoFeature3,
  trainerizeFeature2,
  trainerizeFeature3,
  truecoachFeature2,
  truecoachFeature3,
}: Props) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <section className="py-24 bg-white">
      <div className="max-w-screen-xl mx-auto px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-4">
          {heading}
        </h2>
        <p className="text-base text-muted text-center mb-12">
          {subheading}
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
                  {feature1Label}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-success flex-shrink-0" aria-label="Oui" />
                    {zikoFeature1}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <IoCloseCircleOutline size={18} className="text-danger" aria-label="Non" />
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <IoCloseCircleOutline size={18} className="text-danger" aria-label="Non" />
                </td>
              </tr>
              {/* Row 2 — Client data depth */}
              <tr>
                <td className="px-4 py-3 border-b border-border text-xs font-bold text-text sticky left-0 bg-[#F0EFE9]">
                  {feature2Label}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-success flex-shrink-0" aria-label="Oui" />
                    {zikoFeature2}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border bg-[#F0EFE9] text-xs text-text">
                  {trainerizeFeature2}
                </td>
                <td className="px-4 py-3 border-b border-border bg-[#F0EFE9] text-xs text-text">
                  {truecoachFeature2}
                </td>
              </tr>
              {/* Row 3 — Integrated athlete mobile app */}
              <tr>
                <td className="px-4 py-3 border-b border-border text-xs font-bold text-text sticky left-0 bg-white">
                  {feature3Label}
                </td>
                <td
                  className="px-4 py-3 border-b border-border bg-primary/5 text-xs text-text"
                  style={{ borderLeft: '4px solid #FF5C1A' }}
                >
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-success flex-shrink-0" aria-label="Oui" />
                    {zikoFeature3}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  <div className="flex items-center gap-1.5">
                    <IoCheckmarkCircleOutline size={18} className="text-success flex-shrink-0" aria-label="Oui" />
                    {trainerizeFeature3}
                  </div>
                </td>
                <td className="px-4 py-3 border-b border-border text-xs text-text">
                  {truecoachFeature3}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-4 text-center">{footnote}</p>
        </motion.div>
      </div>
    </section>
  )
}
