// CGV (Conditions Générales de Vente) — locale-branched section data for the
// `/[locale]/cgv` route. Phase 03-legal-cgv-cgu — 03-01 Task 1 seeded the two
// load-bearing sections (lifetime scope, AI-credit-cap parity); Task 2 grows this to
// the full ten-section contract. French is authoritative (D-08); English is a
// faithful translation of the French draft, never an independent draft.
//
// Deliberately plain strings, no JSX — `cgvSections()` is importable and assertable
// in a plain node test environment without rendering a React Server Component.

import {
  AI_CREDIT_CAP_SENTENCE,
  LANGUAGE_PRECEDENCE_CLAUSE,
  LIFETIME_SCOPE_SENTENCE,
  RETENTION_STATEMENT,
  SHUTDOWN_MODIFICATION_CLAUSE,
  type LocalizedText,
} from './founder-offer';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

// Section order is identical, index-for-index, between the FR and EN arrays —
// `cgv-locale.test.ts` and `cgv-content.test.ts` both assert this correspondence.
export const CGV_SECTIONS_FR: LegalSection[] = [
  {
    heading: "1. Objet et champ d'application",
    paragraphs: [
      "Les présentes Conditions Générales de Vente (CGV) régissent les modalités de l'offre fondateurs Ziko, à savoir l'attribution d'un accès Premium à vie aux 200 premiers inscrits sur la liste d'attente. Elles complètent, sans s'y substituer, les Conditions Générales d'Utilisation (CGU), qui régissent l'usage général du Service. En cas de contradiction entre les deux documents sur un point relatif à l'offre fondateurs, les présentes CGV prévalent.",
    ],
  },
  {
    heading: "2. Identité de l'éditeur",
    paragraphs: [
      "Le Service est édité par Ziko. L'identité complète de l'éditeur (dénomination sociale, forme juridique, numéro SIRET, siège social) figure sur la page Mentions légales du site, à laquelle les présentes CGV renvoient plutôt que de la reproduire.",
    ],
  },
  {
    heading: "3. L'offre fondateurs",
    paragraphs: [
      "Les 200 premières personnes inscrites sur la liste d'attente Ziko et ayant confirmé leur inscription reçoivent, gratuitement et sans obligation d'achat ni d'abonnement, un accès Premium à vie à l'application Ziko.",
      "Une place dans l'offre fondateurs est attribuée dans l'ordre chronologique d'inscription confirmée, dans la limite de 200 places. L'attribution d'une place n'implique aucun paiement, aucune souscription et aucune carte bancaire.",
    ],
  },
  {
    heading: "4. Portée de l'engagement « à vie »",
    paragraphs: [LIFETIME_SCOPE_SENTENCE.fr],
  },
  {
    heading: '5. Fonctionnalités Premium et crédits IA',
    paragraphs: [AI_CREDIT_CAP_SENTENCE.fr],
  },
  {
    heading: '6. Évolution et cessation du Service',
    paragraphs: [
      "Hors le cas prévu ci-dessous, Ziko ne modifie ni ne retire l'avantage Premium à vie accordé aux membres fondateurs tant que le Service continue d'être exploité.",
      SHUTDOWN_MODIFICATION_CLAUSE.fr,
    ],
  },
  {
    heading: '7. Données personnelles',
    paragraphs: [
      RETENTION_STATEMENT.fr,
      'Le traitement de vos données personnelles dans le cadre de l’offre fondateurs est décrit en détail dans notre Politique de confidentialité, à laquelle les présentes CGV renvoient sans en reproduire le contenu.',
    ],
  },
  {
    heading: '8. Absence de paiement et droit de rétractation',
    paragraphs: [
      "L'offre fondateurs ne comporte aucun paiement de la part de l'inscrit. Le droit de rétractation de quatorze jours applicable aux contrats à distance portant sur un objet monétaire n'a donc pas d'objet dans le cadre de la présente offre.",
      "L'inscrit peut se désinscrire de la liste d'attente ou demander l'effacement de ses données à tout moment en écrivant à support@ziko-app.com, sans qu'aucune justification ne soit requise.",
    ],
  },
  {
    heading: '9. Langue du contrat',
    paragraphs: [LANGUAGE_PRECEDENCE_CLAUSE.fr],
  },
  {
    heading: '10. Droit applicable et litiges',
    paragraphs: [
      "Les présentes CGV sont soumises au droit français. En cas de litige relatif à leur interprétation ou à leur exécution, les parties s'efforcent de trouver une solution amiable avant tout recours contentieux.",
      "Le consommateur peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige, conformément aux articles L.616-1 et suivants du Code de la consommation.",
      'À défaut de résolution amiable, les tribunaux compétents désignés par le droit commun sont seuls compétents pour connaître du litige.',
    ],
  },
];

export const CGV_SECTIONS_EN: LegalSection[] = [
  {
    heading: '1. Purpose and scope',
    paragraphs: [
      "These Terms of Sale (CGV) govern the terms of the Ziko founder offer — namely the granting of lifetime Premium access to the first 200 confirmed waitlist registrants. They complement, without replacing, the Terms of Use (CGU), which govern general use of the Service. In the event of a contradiction between the two documents on a matter relating to the founder offer, these Terms of Sale prevail.",
    ],
  },
  {
    heading: '2. Publisher identity',
    paragraphs: [
      "The Service is published by Ziko. The publisher's full identity (company name, legal form, SIRET number, registered office) is listed on the site's Legal Notice page, which these Terms of Sale reference rather than duplicate.",
    ],
  },
  {
    heading: '3. The founder offer',
    paragraphs: [
      'The first 200 people who join the Ziko waitlist and confirm their registration receive, free of charge and with no obligation to purchase or subscribe, lifetime Premium access to the Ziko application.',
      'A place in the founder offer is granted in the chronological order of confirmed registration, within the limit of 200 places. Being granted a place involves no payment, no subscription, and no credit card.',
    ],
  },
  {
    heading: '4. Scope of the lifetime commitment',
    paragraphs: [LIFETIME_SCOPE_SENTENCE.en],
  },
  {
    heading: '5. Premium features and AI credits',
    paragraphs: [AI_CREDIT_CAP_SENTENCE.en],
  },
  {
    heading: '6. Changes to and discontinuation of the Service',
    paragraphs: [
      'Except as provided below, Ziko does not modify or withdraw the lifetime Premium benefit granted to founding members for as long as the Service continues to operate.',
      SHUTDOWN_MODIFICATION_CLAUSE.en,
    ],
  },
  {
    heading: '7. Personal data',
    paragraphs: [
      RETENTION_STATEMENT.en,
      'The processing of your personal data as part of the founder offer is described in full in our Privacy Policy, which these Terms of Sale reference without restating its content.',
    ],
  },
  {
    heading: '8. No payment and right of withdrawal',
    paragraphs: [
      'The founder offer involves no payment from the registrant. The fourteen-day withdrawal right applicable to distance contracts with a monetary object therefore has no object under this offer.',
      'The registrant may unsubscribe from the waitlist or request erasure of their data at any time by writing to support@ziko-app.com, with no justification required.',
    ],
  },
  {
    heading: '9. Language of the contract',
    paragraphs: [LANGUAGE_PRECEDENCE_CLAUSE.en],
  },
  {
    heading: '10. Governing law and disputes',
    paragraphs: [
      'These Terms of Sale are governed by French law. In the event of a dispute relating to their interpretation or performance, the parties shall first seek an amicable resolution before pursuing any legal action.',
      'The consumer may use a consumer mediator free of charge to seek an amicable resolution of the dispute, in accordance with Articles L.616-1 et seq. of the French Consumer Code.',
      'Failing an amicable resolution, only the courts designated as competent under ordinary French law shall have jurisdiction over the dispute.',
    ],
  },
];

export const CGV_LAST_UPDATED: LocalizedText = {
  fr: 'Dernière mise à jour : août 2026',
  en: 'Last updated: August 2026',
};

export function cgvSections(locale: string): LegalSection[] {
  return locale === 'en' ? CGV_SECTIONS_EN : CGV_SECTIONS_FR;
}
