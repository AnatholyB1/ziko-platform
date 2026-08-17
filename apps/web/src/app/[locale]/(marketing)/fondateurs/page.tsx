import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { WaitlistFounderBanner } from '@/components/marketing/WaitlistFounderBanner'

type Props = { params: Promise<{ locale: string }> }

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'fondateurs' })
  return {
    title: { absolute: t('meta.title') },
    description: t('meta.description'),
    alternates: {
      canonical: `/${locale}/fondateurs`,
      languages: { fr: '/fr/fondateurs', en: '/en/fondateurs' },
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: `/${locale}/fondateurs`,
      siteName: 'Ziko',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
    },
  }
}

export default async function FondateursPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <WaitlistFounderBanner locale={locale} />
    </main>
  )
}
