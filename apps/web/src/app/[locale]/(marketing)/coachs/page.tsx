import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import CoachsHero from '@/components/marketing/CoachsHero'
import CoachsVideoPlaceholder from '@/components/marketing/CoachsVideoPlaceholder'
import CoachsFeatureBlocks from '@/components/marketing/CoachsFeatureBlocks'
import CoachsComparisonTable from '@/components/marketing/CoachsComparisonTable'
import CoachsFounderSection from '@/components/marketing/CoachsFounderSection'
import CoachsFAQ from '@/components/marketing/CoachsFAQ'
import CoachsCtaFooter from '@/components/marketing/CoachsCtaFooter'

type Props = { params: Promise<{ locale: string }> }

export async function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'coachs' })
  return {
    title: { absolute: t('meta.title') },
    description: t('meta.description'),
    alternates: {
      canonical: `/${locale}/coachs`,
      languages: { fr: '/fr/coachs', en: '/en/coachs' },
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: `/${locale}/coachs`,
      siteName: 'Ziko',
      images: [{ url: '/og-coachs.png', width: 1200, height: 630 }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
  }
}

export default async function CoachsPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <main>
      <CoachsHero locale={locale} />
      <CoachsVideoPlaceholder />
      <CoachsFeatureBlocks />
      <CoachsComparisonTable />
      <CoachsFounderSection />
      <CoachsFAQ />
      <CoachsCtaFooter locale={locale} />
    </main>
  )
}
