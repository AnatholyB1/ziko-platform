import { getTranslations } from 'next-intl/server'
import { AICoachClient } from './AICoachClient'

export async function AICoach() {
  const t = await getTranslations('Home')
  return (
    <AICoachClient
      badge={t('aiCoach.badge')}
      heading={t('aiCoach.heading')}
      description={t('aiCoach.description')}
      cta={t('aiCoach.cta')}
      userMessage={t('aiCoach.userMessage')}
      aiMessage={t('aiCoach.aiMessage')}
    />
  )
}
