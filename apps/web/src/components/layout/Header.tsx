import { getTranslations, getLocale } from 'next-intl/server'
import { HeaderClient } from './HeaderClient'

export async function Header() {
  const t = await getTranslations('Header')
  const locale = await getLocale()
  return (
    <HeaderClient
      locale={locale}
      logo={t('logo')}
      localeFR={t('localeFR')}
      localeEN={t('localeEN')}
      cta={t('cta')}
      founders={t('founders')}
    />
  )
}
