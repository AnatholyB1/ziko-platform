import { getTranslations } from 'next-intl/server'
import { CoachsComparisonTableClient } from './CoachsComparisonTableClient'

export default async function CoachsComparisonTable() {
  const t = await getTranslations('coachs')
  return (
    <CoachsComparisonTableClient
      heading={t('comparison.heading')}
      subheading={t('comparison.subheading')}
      footnote={t('comparison.footnote')}
      feature1Label={t('comparison.feature1Label')}
      feature2Label={t('comparison.feature2Label')}
      feature3Label={t('comparison.feature3Label')}
      zikoFeature1={t('comparison.zikoFeature1')}
      zikoFeature2={t('comparison.zikoFeature2')}
      zikoFeature3={t('comparison.zikoFeature3')}
      trainerizeFeature2={t('comparison.trainerizeFeature2')}
      trainerizeFeature3={t('comparison.trainerizeFeature3')}
      truecoachFeature2={t('comparison.truecoachFeature2')}
      truecoachFeature3={t('comparison.truecoachFeature3')}
    />
  )
}
