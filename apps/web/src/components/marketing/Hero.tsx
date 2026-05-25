import { getTranslations } from 'next-intl/server'
import { HeroClient } from './HeroClient'

export async function Hero() {
  const t = await getTranslations('Home')
  return (
    <HeroClient
      badge={t('hero.badge')}
      headline1={t('hero.headline1')}
      headline2={t('hero.headline2')}
      headline3={t('hero.headline3')}
      subline={t('hero.subline')}
      ctaAppStore={t('hero.ctaAppStore')}
      ctaPlayStore={t('hero.ctaPlayStore')}
      ctaCoach={t('hero.ctaCoach')}
    />
  )
}
