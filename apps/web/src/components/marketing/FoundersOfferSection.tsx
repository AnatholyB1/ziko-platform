import { getTranslations } from 'next-intl/server'
import { FoundersOfferSectionClient } from './FoundersOfferSectionClient'

type Props = { locale: string }

export async function FoundersOfferSection({ locale }: Props) {
  const tHome = await getTranslations({ locale, namespace: 'Home' })
  const tFondateurs = await getTranslations({ locale, namespace: 'fondateurs' })

  return (
    <FoundersOfferSectionClient
      locale={locale}
      heading={tHome('founders.heading')}
      subheading={tHome('founders.subheading')}
      button={tHome('founders.button')}
      note={tHome('founders.note')}
      counterStaticOffer={tFondateurs('counter.preThreshold')}
      counterRemainingTemplate={tFondateurs('counter.remaining')}
      counterCompleteHeading={tFondateurs('counter.completeHeading')}
      counterCompleteBody={tFondateurs('counter.completeBody')}
    />
  )
}
