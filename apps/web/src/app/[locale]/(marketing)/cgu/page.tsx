import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('cguTitle'),
    description: t('cguDescription'),
    alternates: {
      canonical: `/${locale}/cgu`,
      languages: { fr: '/fr/cgu', en: '/en/cgu' },
    },
    openGraph: {
      title: t('cguTitle'),
      description: t('cguDescription'),
      url: `/${locale}/cgu`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('cguTitle'),
      description: t('cguDescription'),
      images: ['/og-image.png'],
    },
  }
}

export default async function CguPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Conditions G&eacute;n&eacute;rales d&apos;Utilisation</h1>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">1. Objet</h2>
        <p className="text-text leading-relaxed mb-4">
          Les pr&eacute;sentes Conditions G&eacute;n&eacute;rales d&apos;Utilisation (CGU) ont pour objet de d&eacute;finir les modalit&eacute;s et conditions d&apos;utilisation de l&apos;application mobile Ziko et du site web ziko-app.com (ci-apr&egrave;s &laquo;&nbsp;le Service&nbsp;&raquo;), ainsi que les droits et obligations des parties.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">2. Acceptation des CGU</h2>
        <p className="text-text leading-relaxed mb-4">
          L&apos;utilisation du Service implique l&apos;acceptation pleine et enti&egrave;re des pr&eacute;sentes CGU. Si vous n&apos;&ecirc;tes pas d&apos;accord avec ces conditions, veuillez ne pas utiliser le Service.
        </p>
        <p className="text-text leading-relaxed mb-4">
          En cr&eacute;ant un compte ou en utilisant l&apos;application, vous d&eacute;clarez avoir pris connaissance des pr&eacute;sentes CGU et les accepter sans r&eacute;serve.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">3. Description du service</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko est une application de suivi fitness et de coaching par intelligence artificielle. Le Service propose notamment&nbsp;:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-text leading-relaxed">
          <li>Suivi des s&eacute;ances d&apos;entra&icirc;nement et programmes personnalis&eacute;s</li>
          <li>Suivi de la nutrition (calories, macronutriments, hydratation)</li>
          <li>Gestion des habitudes quotidiennes et objectifs fitness</li>
          <li>Suivi du sommeil et de la r&eacute;cup&eacute;ration</li>
          <li>Coach IA personnalis&eacute; propuls&eacute; par Claude (Anthropic)</li>
          <li>Suivi cardio avec GPS (course, cyclisme)</li>
          <li>Journal d&apos;humeur, d&apos;&eacute;nergie et de stress</li>
          <li>Fonctionnalit&eacute;s communautaires (d&eacute;fis, classements)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">4. Compte utilisateur</h2>
        <p className="text-text leading-relaxed mb-4">
          Pour acc&eacute;der au Service, vous devez cr&eacute;er un compte en fournissant une adresse e-mail valide et des informations de profil (nom, &acirc;ge, objectifs). Vous &ecirc;tes responsable de la confidentialit&eacute; de vos identifiants de connexion.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Vous vous engagez &agrave; fournir des informations exactes et &agrave; les maintenir &agrave; jour. Tout acc&egrave;s non autoris&eacute; &agrave; votre compte doit &ecirc;tre signal&eacute; imm&eacute;diatement &agrave; contact@ziko-app.com.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Vous pouvez supprimer votre compte &agrave; tout moment depuis la page{' '}
          <Link href="/supprimer-mon-compte" className="text-primary underline">
            Supprimer mon compte
          </Link>. La suppression entra&icirc;ne l&apos;effacement d&eacute;finitif de toutes vos donn&eacute;es personnelles conform&eacute;ment &agrave; notre{' '}
          <Link href="/politique-de-confidentialite" className="text-primary underline">
            Politique de confidentialit&eacute;
          </Link>.
        </p>
      </section>

      {/* AI coaching is not medical advice — this section constitutes the required medical disclaimer */}
      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">5. Coaching IA &mdash; Avertissement important</h2>
        <div className="rounded-lg border-2 border-primary bg-orange-50 p-6 space-y-3">
          <p className="font-bold text-text text-lg">
            &#9888; Le coaching IA n&apos;est pas un avis médical
          </p>
          <p className="text-text leading-relaxed">
            Le coaching IA de Ziko est un <strong>outil d&apos;assistance et de motivation</strong>. Il ne constitue en aucun cas un avis m&eacute;dical, un diagnostic, ou un traitement.
          </p>
          <p className="text-text leading-relaxed">
            L&apos;IA <strong>n&apos;est pas un professionnel de sant&eacute;</strong> et ne remplace pas la consultation d&apos;un m&eacute;decin, d&apos;un nutritionniste, ou d&apos;un professionnel du sport qualifi&eacute;.
          </p>
          <p className="text-text leading-relaxed">
            Les recommandations g&eacute;n&eacute;r&eacute;es par l&apos;IA sont bas&eacute;es sur les donn&eacute;es fournies par l&apos;utilisateur et des mod&egrave;les statistiques. <strong>Elles peuvent &ecirc;tre inexactes ou inappropri&eacute;es</strong> pour certaines conditions m&eacute;dicales, blessures ou situations de sant&eacute; particuli&egrave;res.
          </p>
          <p className="text-text leading-relaxed">
            L&apos;utilisateur est <strong>seul responsable</strong> de l&apos;utilisation des recommandations de l&apos;IA et doit <strong>consulter un professionnel de sant&eacute;</strong> avant de commencer tout programme d&apos;exercice ou r&eacute;gime alimentaire, en particulier en cas de probl&egrave;me de sant&eacute; pr&eacute;existant.
          </p>
          <p className="text-text leading-relaxed">
            Ziko d&eacute;cline toute responsabilit&eacute; en cas de dommage corporel, mat&eacute;riel ou immat&eacute;riel r&eacute;sultant de l&apos;utilisation des recommandations g&eacute;n&eacute;r&eacute;es par l&apos;IA.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">6. Donn&eacute;es personnelles</h2>
        <p className="text-text leading-relaxed mb-4">
          Le traitement de vos donn&eacute;es personnelles est r&eacute;gi par notre{' '}
          <Link href="/politique-de-confidentialite" className="text-primary underline">
            Politique de confidentialit&eacute;
          </Link>{' '}
          int&eacute;gr&eacute;e aux pr&eacute;sentes CGU par r&eacute;f&eacute;rence. En acceptant les pr&eacute;sentes CGU, vous reconnaissez avoir pris connaissance de cette politique.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">7. Propri&eacute;t&eacute; intellectuelle</h2>
        <p className="text-text leading-relaxed mb-4">
          L&apos;ensemble des &eacute;l&eacute;ments constituant le Service (code source, design, textes, graphismes, logos, marques) est la propri&eacute;t&eacute; exclusive de Ziko et est prot&eacute;g&eacute; par le droit de la propri&eacute;t&eacute; intellectuelle fran&ccedil;ais et international.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Les donn&eacute;es g&eacute;n&eacute;r&eacute;es par l&apos;utilisateur (s&eacute;ances, mesures, journaux personnels) restent la propri&eacute;t&eacute; de l&apos;utilisateur. Ziko b&eacute;n&eacute;ficie d&apos;une licence d&apos;utilisation de ces donn&eacute;es aux seules fins du fonctionnement et de l&apos;am&eacute;lioration du Service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">8. Limitation de responsabilit&eacute;</h2>
        <p className="text-text leading-relaxed mb-4">
          Le Service est fourni &laquo;&nbsp;en l&apos;&eacute;tat&nbsp;&raquo;, sans garantie d&apos;aucune sorte. Ziko ne garantit pas la disponibilit&eacute; continue du Service ni l&apos;absence d&apos;interruptions ou d&apos;erreurs.
        </p>
        <p className="text-text leading-relaxed mb-4">
          Ziko ne saurait &ecirc;tre tenu responsable des dommages directs ou indirects r&eacute;sultant d&apos;une perte de donn&eacute;es, d&apos;une interruption de service, ou d&apos;une utilisation du Service non conforme aux pr&eacute;sentes CGU.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">9. Modification des CGU</h2>
        <p className="text-text leading-relaxed mb-4">
          Ziko se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU &agrave; tout moment. Les modifications seront notifi&eacute;es aux utilisateurs par e-mail ou via l&apos;application avec un pr&eacute;avis raisonnable. La poursuite de l&apos;utilisation du Service apr&egrave;s notification vaut acceptation des nouvelles CGU.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">10. Droit applicable et juridiction</h2>
        <p className="text-text leading-relaxed mb-4">
          Les pr&eacute;sentes CGU sont soumises au droit fran&ccedil;ais. En cas de litige relatif &agrave; l&apos;interpr&eacute;tation ou &agrave; l&apos;ex&eacute;cution des pr&eacute;sentes, les parties s&apos;engagent &agrave; tenter de r&eacute;soudre le diff&eacute;rend &agrave; l&apos;amiable avant tout recours judiciaire. &Agrave; d&eacute;faut, les tribunaux comp&eacute;tents [A COMPL&Eacute;TER] seront seuls comp&eacute;tents pour conna&icirc;tre du litige.
        </p>
      </section>

      <p className="text-muted text-sm mt-12">
        Derni&egrave;re mise &agrave; jour&nbsp;: mars 2026
      </p>
    </main>
  );
}
