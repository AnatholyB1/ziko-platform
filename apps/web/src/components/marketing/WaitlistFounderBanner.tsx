import { getTranslations } from 'next-intl/server'
import { CONSENT_CHECKBOX_LABEL, COLLECTION_POINT_NOTICE } from '@/content/legal/founder-offer'
import { WaitlistFounderBannerClient } from './WaitlistFounderBannerClient'

type Props = { locale: string }

export async function WaitlistFounderBanner({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'fondateurs' })
  const localeKey = locale === 'en' ? 'en' : 'fr'

  return (
    <WaitlistFounderBannerClient
      locale={locale}
      heroHeadline={t('hero.headline')}
      heroSubtitle={t('hero.subtitle')}
      pickerHeading={t('picker.heading')}
      pickerAthlete={t('picker.athlete')}
      pickerCoach={t('picker.coach')}
      formEmailLabel={t('form.emailLabel')}
      formEmailPlaceholder={t('form.emailPlaceholder')}
      formSubmit={t('form.submit')}
      formSubmitPending={t('form.submitPending')}
      successFounder={t('success.founder')}
      successGeneric={t('success.generic')}
      errorGeneric={t('error.generic')}
      errorInvalidEmail={t('error.invalidEmail')}
      errorRateLimited={t('error.rateLimited')}
      consentLabel={CONSENT_CHECKBOX_LABEL[localeKey]}
      collectionNotice={COLLECTION_POINT_NOTICE[localeKey]}
    />
  )
}
