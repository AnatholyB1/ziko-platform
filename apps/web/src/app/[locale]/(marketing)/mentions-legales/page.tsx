import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('legalTitle'),
    description: t('legalDescription'),
    alternates: {
      canonical: `/${locale}/mentions-legales`,
      languages: { fr: '/fr/mentions-legales', en: '/en/mentions-legales' },
    },
    openGraph: {
      title: t('legalTitle'),
      description: t('legalDescription'),
      url: `/${locale}/mentions-legales`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('legalTitle'),
      description: t('legalDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function MentionsLegalesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Mentions l&eacute;gales</h1>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">&Eacute;diteur du site</h2>
        <p className="text-text leading-relaxed mb-4">
          Le pr&eacute;sent site internet est &eacute;dit&eacute; par&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-text leading-relaxed">
          <li><strong>Nom&nbsp;:</strong> Ziko</li>
          <li><strong>Forme juridique&nbsp;:</strong> [A COMPL&Eacute;TER]</li>
          <li><strong>SIRET&nbsp;:</strong> [A COMPL&Eacute;TER]</li>
          <li><strong>Si&egrave;ge social&nbsp;:</strong> [A COMPL&Eacute;TER]</li>
          <li><strong>Directeur de la publication&nbsp;:</strong> BRICON Anatholy</li>
          <li><strong>Email de contact&nbsp;:</strong> contact@ziko-app.com</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">H&eacute;bergement</h2>
        <p className="text-text leading-relaxed mb-4">
          Ce site est h&eacute;berg&eacute; par&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-text leading-relaxed">
          <li><strong>H&eacute;bergeur&nbsp;:</strong> Vercel Inc.</li>
          <li><strong>Adresse&nbsp;:</strong> 440 N Barranca Ave #4133, Covina, CA 91723, &Eacute;tats-Unis</li>
          <li>
            <strong>Site web&nbsp;:</strong>{' '}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              https://vercel.com
            </a>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">Propri&eacute;t&eacute; intellectuelle</h2>
        <p className="text-text leading-relaxed mb-4">
          L&apos;ensemble des contenus pr&eacute;sents sur ce site (textes, images, graphismes, logos, ic&ocirc;nes, sons, logiciels) est la propri&eacute;t&eacute; exclusive de Ziko ou de ses partenaires, et est prot&eacute;g&eacute; par les lois fran&ccedil;aises et internationales relatives &agrave; la propri&eacute;t&eacute; intellectuelle.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Toute reproduction, distribution, modification, adaptation, retransmission ou publication, m&ecirc;me partielle, de ces diff&eacute;rents &eacute;l&eacute;ments est strictement interdite sans l&apos;accord &eacute;crit pr&eacute;alable de Ziko. Cette repr&eacute;sentation ou reproduction, par quelque proc&eacute;d&eacute; que ce soit, constitue une contrefa&ccedil;on sanctionn&eacute;e par les articles L.335-2 et suivants du Code de la propri&eacute;t&eacute; intellectuelle.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">Donn&eacute;es personnelles</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko s&apos;engage &agrave; prot&eacute;ger la vie priv&eacute;e de ses utilisateurs et &agrave; traiter leurs donn&eacute;es personnelles en conformit&eacute; avec le R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD) du 27 avril 2016.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Conform&eacute;ment au RGPD, vous disposez d&apos;un droit d&apos;acc&egrave;s, de rectification, d&apos;effacement et de portabilit&eacute; de vos donn&eacute;es personnelles. Pour exercer ces droits ou pour toute question relative au traitement de vos donn&eacute;es, vous pouvez nous contacter &agrave; l&apos;adresse&nbsp;: <strong>contact@ziko-app.com</strong>
        </p>
        <p className="text-text leading-relaxed mb-4">
          Pour plus d&apos;informations sur notre politique de traitement des donn&eacute;es personnelles, veuillez consulter notre{' '}
          <Link href="/politique-de-confidentialite" className="text-primary underline">
            Politique de confidentialit&eacute;
          </Link>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">Cookies</h2>
        <p className="text-text leading-relaxed mb-4">
          Le site ziko-app.com n&apos;utilise pas de cookies de tra&ccedil;age publicitaire ni de cookies analytiques tiers. Aucun cookie de suivi comportemental ou de partage de donn&eacute;es avec des r&eacute;gies publicitaires n&apos;est d&eacute;pos&eacute; sur votre terminal.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Seuls des cookies fonctionnels essentiels peuvent &ecirc;tre utilis&eacute;s afin d&apos;assurer le bon fonctionnement du site (gestion de session, pr&eacute;f&eacute;rences de langue). Ces cookies sont strictement n&eacute;cessaires &agrave; la fourniture du service et ne n&eacute;cessitent pas votre consentement pr&eacute;alable conform&eacute;ment &agrave; la directive ePrivacy.
        </p>
      </section>

      <p className="text-muted text-sm mt-12">
        Derni&egrave;re mise &agrave; jour&nbsp;: mars 2026
      </p>
    </main>
  );
}
