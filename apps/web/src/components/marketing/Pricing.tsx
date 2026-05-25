import { getTranslations } from 'next-intl/server'
import { PricingClient } from './PricingClient'

export async function Pricing() {
  const t = await getTranslations('Home')
  return (
    <PricingClient
      heading={t('pricing.heading')}
      popularBadge={t('pricing.popularBadge')}
      price={t('pricing.price')}
      priceUnit={t('pricing.priceUnit')}
      valueProp1={t('pricing.valueProp1')}
      valueProp2={t('pricing.valueProp2')}
      valueProp3={t('pricing.valueProp3')}
      cta={t('pricing.cta')}
      priceNote={t('pricing.priceNote')}
    />
  )
}
