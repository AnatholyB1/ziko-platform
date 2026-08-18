import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { BotIdClient } from 'botid/client'
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

// BotID's server-side checkBotId() only reports meaningfully when this client
// instrumentation is present on the page whose submission is being judged. Protects
// both locale paths — a visitor can submit from either — for the POST method Server
// Action submissions use. Reads nothing at request time (a script mount only), so the
// route stays statically prerendered.
const BOTID_PROTECTED_ROUTES = [
  { path: '/fr/fondateurs', method: 'POST' },
  { path: '/en/fondateurs', method: 'POST' },
]

export default async function FondateursPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <BotIdClient protect={BOTID_PROTECTED_ROUTES} />
      <WaitlistFounderBanner locale={locale} />
    </main>
  )
}
