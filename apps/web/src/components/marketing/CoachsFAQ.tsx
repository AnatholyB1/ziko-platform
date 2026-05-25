import { getTranslations } from 'next-intl/server'
import { CoachsFAQClient } from './CoachsFAQClient'

const FAQ_KEYS = ['1', '2', '3', '4', '5', '6'] as const

export default async function CoachsFAQ() {
  const t = await getTranslations('coachs')
  const items = FAQ_KEYS.map((k) => ({
    q: t(`faq.q${k}`),
    a: t(`faq.a${k}`),
  }))
  return (
    <CoachsFAQClient
      heading={t('faq.heading')}
      items={items}
    />
  )
}
