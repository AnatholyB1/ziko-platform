import { getTranslations } from 'next-intl/server'
import { FooterClient } from './FooterClient'

export async function Footer() {
  const t = await getTranslations('Footer')
  return (
    <FooterClient
      copyright={t('copyright')}
      legal={t('legal')}
      privacy={t('privacy')}
      terms={t('terms')}
      deleteAccount={t('deleteAccount')}
    />
  )
}
