import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { cgvSections, CGV_LAST_UPDATED } from '@/content/legal/cgv'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('cgvTitle'),
    description: t('cgvDescription'),
    alternates: {
      canonical: `/${locale}/cgv`,
      languages: { fr: '/fr/cgv', en: '/en/cgv' },
    },
    openGraph: {
      title: t('cgvTitle'),
      description: t('cgvDescription'),
      url: `/${locale}/cgv`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('cgvTitle'),
      description: t('cgvDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function CgvPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isEn = locale === 'en';
  const title = isEn ? 'Terms of Sale' : 'Conditions Générales de Vente';
  const sections = cgvSections(locale);
  const lastUpdated = isEn ? CGV_LAST_UPDATED.en : CGV_LAST_UPDATED.fr;
  const cguLinkLabel = isEn ? 'Terms of Use' : 'CGU';
  const privacyLinkLabel = isEn ? 'Privacy Policy' : 'Politique de confidentialité';
  const relatedDocsPrefix = isEn
    ? 'These Terms of Sale should be read alongside the'
    : 'Les présentes CGV doivent être lues conjointement avec les';
  const relatedDocsSeparator = isEn ? 'and the' : 'et la';

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-semibold">{title}</h1>

      {sections.map((section, index) => (
        <section key={index}>
          <h2 className="text-xl font-semibold mt-8 mb-3">{section.heading}</h2>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className="text-text leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="text-text leading-relaxed mb-4">
        {relatedDocsPrefix}{' '}
        <Link href="/cgu" className="text-primary underline">
          {cguLinkLabel}
        </Link>{' '}
        {relatedDocsSeparator}{' '}
        <Link href="/politique-de-confidentialite" className="text-primary underline">
          {privacyLinkLabel}
        </Link>
        .
      </p>

      <p className="text-muted text-sm mt-12">{lastUpdated}</p>
    </main>
  );
}
