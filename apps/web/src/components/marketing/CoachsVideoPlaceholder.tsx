import { getTranslations } from 'next-intl/server'
import { CoachsVideoPlaceholderClient } from './CoachsVideoPlaceholderClient'

export default async function CoachsVideoPlaceholder() {
  const t = await getTranslations('coachs')
  return (
    <CoachsVideoPlaceholderClient
      heading={t('video.heading')}
      caption={t('video.caption')}
    />
  )
}
