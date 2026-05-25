import { getTranslations } from 'next-intl/server'
import { CoachsFounderSectionClient } from './CoachsFounderSectionClient'

export default async function CoachsFounderSection() {
  const t = await getTranslations('coachs')
  return (
    <CoachsFounderSectionClient
      heading={t('founder.heading')}
      quote={t('founder.quote')}
      story={t('founder.story')}
      name={t('founder.name')}
      title={t('founder.title')}
    />
  )
}
