import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('deleteTitle'),
    description: t('deleteDescription'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: `/${locale}/supprimer-mon-compte`,
      languages: { fr: '/fr/supprimer-mon-compte', en: '/en/supprimer-mon-compte' },
    },
    openGraph: {
      title: t('deleteTitle'),
      description: t('deleteDescription'),
      url: `/${locale}/supprimer-mon-compte`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('deleteTitle'),
      description: t('deleteDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function SupprimerMonComptePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16">
      <h1 className="text-2xl font-semibold mb-2">Supprimer mon compte</h1>
      <p className="text-muted mb-8">
        Conform&eacute;ment au RGPD (Art.&nbsp;17), vous pouvez demander la suppression de votre
        compte et de toutes vos donn&eacute;es personnelles.
      </p>
      <DeleteAccountForm />
    </main>
  )
}
