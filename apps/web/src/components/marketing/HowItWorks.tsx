import { getTranslations } from 'next-intl/server'
import { HowItWorksClient } from './HowItWorksClient'

export async function HowItWorks() {
  const t = await getTranslations('Home')
  return (
    <HowItWorksClient
      heading={t('howItWorks.heading')}
      steps={[
        { title: t('howItWorks.step1.title'), desc: t('howItWorks.step1.description') },
        { title: t('howItWorks.step2.title'), desc: t('howItWorks.step2.description') },
        { title: t('howItWorks.step3.title'), desc: t('howItWorks.step3.description') },
      ]}
    />
  )
}
