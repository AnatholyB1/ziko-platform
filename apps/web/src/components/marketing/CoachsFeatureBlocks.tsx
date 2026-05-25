import { getTranslations } from 'next-intl/server'
import { CoachsFeatureBlocksClient } from './CoachsFeatureBlocksClient'

const FEATURE_KEYS = ['crm', 'ai', 'programs', 'erp'] as const
type FeatureKey = typeof FEATURE_KEYS[number]

export default async function CoachsFeatureBlocks() {
  const t = await getTranslations('coachs')

  const features = FEATURE_KEYS.map((key) => ({
    title: t(`features.${key}.title`),
    body: t(`features.${key}.body`),
    bullets: [
      t(`features.${key}.bullet1`),
      t(`features.${key}.bullet2`),
      t(`features.${key}.bullet3`),
    ],
    hasRoadmapTag: key === 'erp',
    roadmapTag: key === 'erp' ? t('features.erp.tag') : undefined,
  }))

  return (
    <CoachsFeatureBlocksClient
      heading={t('features.heading')}
      subheading={t('features.subheading')}
      features={features}
    />
  )
}
