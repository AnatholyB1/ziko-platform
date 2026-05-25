import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('privacyTitle'),
    description: t('privacyDescription'),
    alternates: {
      canonical: `/${locale}/politique-de-confidentialite`,
      languages: { fr: '/fr/politique-de-confidentialite', en: '/en/politique-de-confidentialite' },
    },
    openGraph: {
      title: t('privacyTitle'),
      description: t('privacyDescription'),
      url: `/${locale}/politique-de-confidentialite`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('privacyTitle'),
      description: t('privacyDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function PolitiqueConfidentialitePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Politique de confidentialit&eacute;</h1>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
        <p className="text-text leading-relaxed mb-4">
          La pr&eacute;sente politique de confidentialit&eacute; d&eacute;crit la mani&egrave;re dont Ziko (&laquo;&nbsp;nous&nbsp;&raquo;, &laquo;&nbsp;notre&nbsp;&raquo;) collecte, utilise et prot&egrave;ge les donn&eacute;es personnelles des utilisateurs de l&apos;application mobile Ziko et du site web ziko-app.com.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Ziko est le responsable du traitement de vos donn&eacute;es personnelles. Nous nous engageons &agrave; respecter le R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD) du 27 avril 2016 ainsi que la loi Informatique et Libert&eacute;s modifi&eacute;e.
        </p>
        <p className="text-text leading-relaxed mb-4">
          <strong>Derni&egrave;re mise &agrave; jour&nbsp;:</strong> mars 2026
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">2. Donn&eacute;es collect&eacute;es</h2>
        <p className="text-text leading-relaxed mb-4">
          Dans le cadre de l&apos;utilisation de l&apos;application Ziko, nous collectons les cat&eacute;gories de donn&eacute;es personnelles suivantes&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-text leading-relaxed">
          <li>
            <strong>Donn&eacute;es d&apos;identification&nbsp;:</strong> adresse e-mail, nom, pr&eacute;nom, &acirc;ge
          </li>
          <li>
            <strong>Donn&eacute;es de sant&eacute;&nbsp;:</strong> poids, taille, mesures corporelles (tour de taille, poitrine, bras, hanches), qualit&eacute; du sommeil, journal d&apos;humeur, niveau d&apos;&eacute;nergie et de stress
          </li>
          <li>
            <strong>Donn&eacute;es d&apos;activit&eacute; physique&nbsp;:</strong> s&eacute;ances d&apos;entra&icirc;nement, habitudes quotidiennes, objectifs fitness, programmes personnalis&eacute;s
          </li>
          <li>
            <strong>Donn&eacute;es de g&eacute;olocalisation&nbsp;:</strong> traces GPS des sessions cardio (course &agrave; pied, cyclisme) incluant les coordonn&eacute;es g&eacute;ographiques, l&apos;altitude et la vitesse. Ces donn&eacute;es ne sont collect&eacute;es qu&apos;avec votre consentement explicite, lors de l&apos;activation du suivi GPS.
          </li>
          <li>
            <strong>Donn&eacute;es nutritionnelles&nbsp;:</strong> repas enregistr&eacute;s, apports caloriques, macronutriments (prot&eacute;ines, glucides, lipides), hydratation quotidienne
          </li>
          <li>
            <strong>Donn&eacute;es d&apos;interaction IA&nbsp;:</strong> conversations avec le coach IA, contexte fourni pour personnaliser les r&eacute;ponses (profil utilisateur, historique de s&eacute;ances, objectifs), outils IA utilis&eacute;s
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">3. Finalit&eacute;s du traitement</h2>
        <p className="text-text leading-relaxed mb-4">
          Vos donn&eacute;es personnelles sont trait&eacute;es aux fins suivantes&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-text leading-relaxed">
          <li>
            <strong>Fonctionnement de l&apos;application&nbsp;:</strong> suivi de vos activit&eacute;s physiques, nutrition, sommeil, habitudes et objectifs fitness
          </li>
          <li>
            <strong>Personnalisation du coaching IA&nbsp;:</strong> g&eacute;n&eacute;ration de recommandations personnalis&eacute;es, programmes d&apos;entra&icirc;nement adapt&eacute;s &agrave; votre profil
          </li>
          <li>
            <strong>Am&eacute;lioration du service&nbsp;:</strong> analyse de l&apos;usage (donn&eacute;es agr&eacute;g&eacute;es et anonymis&eacute;es) pour am&eacute;liorer les fonctionnalit&eacute;s de l&apos;application
          </li>
          <li>
            <strong>Gestion du compte&nbsp;:</strong> cr&eacute;ation et gestion de votre compte utilisateur, authentification, communication de service
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">4. Base l&eacute;gale du traitement</h2>
        <ul className="list-disc pl-6 space-y-2 text-text leading-relaxed">
          <li>
            <strong>Consentement (Art. 6.1.a RGPD)&nbsp;:</strong> pour le traitement des donn&eacute;es de sant&eacute; (poids, mesures corporelles, sommeil, humeur) et des donn&eacute;es de g&eacute;olocalisation GPS, qui sont des donn&eacute;es sensibles au sens de l&apos;article 9 du RGPD. Vous pouvez retirer votre consentement &agrave; tout moment.
          </li>
          <li>
            <strong>Ex&eacute;cution du contrat (Art. 6.1.b)&nbsp;:</strong> pour la gestion de votre compte, l&apos;authentification et la fourniture des fonctionnalit&eacute;s principales de l&apos;application
          </li>
          <li>
            <strong>Int&eacute;r&ecirc;t l&eacute;gitime (Art. 6.1.f)&nbsp;:</strong> pour l&apos;am&eacute;lioration de nos services &agrave; partir de donn&eacute;es agr&eacute;g&eacute;es et anonymis&eacute;es, sous r&eacute;serve que cet int&eacute;r&ecirc;t ne pr&eacute;vale pas sur vos droits et libert&eacute;s fondamentaux
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">5. Sous-traitants et destinataires</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko fait appel aux sous-traitants et prestataires suivants dans le cadre du traitement de vos donn&eacute;es&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-3 text-text leading-relaxed">
          <li>
            <strong>Anthropic</strong> (San Francisco, CA, &Eacute;tats-Unis) &mdash; sous-traitant pour le coaching IA via l&apos;API Claude. Vos conversations avec le coach IA ainsi que votre contexte utilisateur (profil, historique r&eacute;cent de s&eacute;ances, r&eacute;sum&eacute;s nutritionnels et d&apos;habitudes) sont transmis &agrave; Anthropic pour g&eacute;n&eacute;rer des r&eacute;ponses personnalis&eacute;es.
          </li>
          <li>
            <strong>Supabase</strong> (Supabase Pte Ltd, Singapour) &mdash; h&eacute;bergement de la base de donn&eacute;es et service d&apos;authentification. Vos donn&eacute;es sont stock&eacute;es dans des centres de donn&eacute;es s&eacute;curis&eacute;s.
          </li>
          <li>
            <strong>Vercel</strong> (Vercel Inc., &Eacute;tats-Unis) &mdash; h&eacute;bergement du site web ziko-app.com
          </li>
          <li>
            <strong>Expo / EAS (Expo Application Services)</strong> &mdash; compilation et distribution de l&apos;application mobile sur l&apos;App Store et le Google Play Store
          </li>
        </ul>
        <p className="text-text leading-relaxed mt-4">
          Ces transferts de donn&eacute;es vers des pays tiers (notamment les &Eacute;tats-Unis) sont encadr&eacute;s par des garanties appropri&eacute;es, notamment les clauses contractuelles types (CCT) de la Commission europ&eacute;enne et/ou le Data Privacy Framework (DPF) UE-&Eacute;tats-Unis.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">6. Dur&eacute;e de conservation</h2>
        <ul className="list-disc pl-6 space-y-2 text-text leading-relaxed">
          <li>
            <strong>Donn&eacute;es de compte&nbsp;:</strong> conserv&eacute;es tant que le compte est actif. En cas de suppression du compte, vos donn&eacute;es sont supprim&eacute;es dans un d&eacute;lai de 30 jours.
          </li>
          <li>
            <strong>Donn&eacute;es de sant&eacute; et d&apos;activit&eacute;&nbsp;:</strong> conserv&eacute;es tant que le compte est actif, supprim&eacute;es sur demande ou lors de la suppression du compte.
          </li>
          <li>
            <strong>Conversations IA&nbsp;:</strong> conserv&eacute;es pendant 12 mois, puis anonymis&eacute;es ou supprim&eacute;es.
          </li>
          <li>
            <strong>Donn&eacute;es de g&eacute;olocalisation GPS&nbsp;:</strong> associ&eacute;es &agrave; vos sessions cardio, supprim&eacute;es avec la session concern&eacute;e ou lors de la suppression du compte.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">7. Vos droits</h2>
        <p className="text-text leading-relaxed mb-4">
          Conform&eacute;ment au RGPD, vous disposez des droits suivants concernant vos donn&eacute;es personnelles&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-text leading-relaxed">
          <li><strong>Droit d&apos;acc&egrave;s (Art. 15)&nbsp;:</strong> obtenir une copie de vos donn&eacute;es personnelles</li>
          <li><strong>Droit de rectification (Art. 16)&nbsp;:</strong> corriger des donn&eacute;es inexactes ou incompl&egrave;tes</li>
          <li>
            <strong>Droit &agrave; l&apos;effacement (Art. 17)&nbsp;:</strong> demander la suppression de vos donn&eacute;es. Vous pouvez &eacute;galement supprimer votre compte directement depuis la page{' '}
            <Link href="/supprimer-mon-compte" className="text-primary underline">
              Supprimer mon compte
            </Link>
          </li>
          <li><strong>Droit &agrave; la limitation du traitement (Art. 18)&nbsp;:</strong> demander la suspension temporaire du traitement de vos donn&eacute;es</li>
          <li><strong>Droit &agrave; la portabilit&eacute; (Art. 20)&nbsp;:</strong> recevoir vos donn&eacute;es dans un format structur&eacute; et lisible par machine</li>
          <li><strong>Droit d&apos;opposition (Art. 21)&nbsp;:</strong> vous opposer au traitement de vos donn&eacute;es pour des motifs l&eacute;gitimes</li>
        </ul>
        <p className="text-text leading-relaxed mt-4">
          Pour exercer ces droits, contactez-nous &agrave;&nbsp;: <strong>contact@ziko-app.com</strong>
        </p>
        <p className="text-text leading-relaxed mt-2">
          Vous disposez &eacute;galement du droit d&apos;introduire une r&eacute;clamation aupr&egrave;s de la Commission Nationale de l&apos;Informatique et des Libert&eacute;s (CNIL)&nbsp;:{' '}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            www.cnil.fr
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">8. S&eacute;curit&eacute;</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko met en &oelig;uvre des mesures techniques et organisationnelles appropri&eacute;es pour prot&eacute;ger vos donn&eacute;es personnelles contre tout acc&egrave;s non autoris&eacute;, perte, destruction ou alt&eacute;ration. Ces mesures comprennent notamment&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-text leading-relaxed">
          <li>Chiffrement des donn&eacute;es en transit (HTTPS/TLS)</li>
          <li>Contr&ocirc;les d&apos;acc&egrave;s stricts bas&eacute;s sur les r&ocirc;les (Row Level Security sur la base de donn&eacute;es)</li>
          <li>Authentification s&eacute;curis&eacute;e via Supabase Auth avec tokens JWT</li>
          <li>Acc&egrave;s limit&eacute; aux donn&eacute;es au strict n&eacute;cessaire (&laquo;&nbsp;privacy by design&nbsp;&raquo;)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">9. Cookies</h2>
        <p className="text-text leading-relaxed mb-4">
          Le site ziko-app.com n&apos;utilise pas de cookies de tra&ccedil;age publicitaire ni de cookies analytiques tiers. Seuls des cookies fonctionnels essentiels peuvent &ecirc;tre utilis&eacute;s pour assurer le bon fonctionnement du site (gestion de session, pr&eacute;f&eacute;rences de langue).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">10. Modifications de la politique</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko se r&eacute;serve le droit de modifier la pr&eacute;sente politique de confidentialit&eacute; &agrave; tout moment. En cas de modification substantielle, vous serez notifi&eacute;(e) par e-mail ou via une notification dans l&apos;application. La date de derni&egrave;re mise &agrave; jour figurant en haut de ce document sera &eacute;galement actualis&eacute;e. Nous vous encourageons &agrave; consulter r&eacute;guli&egrave;rement cette page.
        </p>
      </section>

      <p className="text-muted text-sm mt-12">
        Derni&egrave;re mise &agrave; jour&nbsp;: mars 2026
      </p>
    </main>
  );
}
