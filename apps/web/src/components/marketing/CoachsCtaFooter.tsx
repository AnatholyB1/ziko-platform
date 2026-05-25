import { getTranslations } from 'next-intl/server'
import { CoachsCtaFooterClient } from './CoachsCtaFooterClient'

interface CoachsCtaFooterProps {
  locale: string
}

export default async function CoachsCtaFooter({ locale }: CoachsCtaFooterProps) {
  const t = await getTranslations('coachs')
  return (
    <CoachsCtaFooterClient
      locale={locale}
      heading={t('cta.heading')}
      subheading={t('cta.subheading')}
      button={t('cta.button')}
      note={t('cta.note')}
    />
  )
}
