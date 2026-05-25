import { getTranslations } from 'next-intl/server'
import { CoachsHeroClient } from './CoachsHeroClient'

interface CoachsHeroProps {
  locale: string
}

export default async function CoachsHero({ locale }: CoachsHeroProps) {
  const t = await getTranslations('coachs')
  return (
    <CoachsHeroClient
      locale={locale}
      badge={t('hero.badge')}
      headline={t('hero.headline')}
      subtitle={t('hero.subtitle')}
      cta={t('hero.cta')}
      ctaNote={t('hero.ctaNote')}
    />
  )
}
