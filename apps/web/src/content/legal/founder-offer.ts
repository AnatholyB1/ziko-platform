// Single source of truth for every legal clause that must appear, byte-identical
// per locale, in more than one legal document (CGV, CGU, Politique de confidentialité).
// Phase 03-legal-cgv-cgu — 03-01 (Task 1) creates this module; 03-02 appends the
// consent/collection-notice constants consumed by Phase 5.
//
// French is the authoritative language (D-08); English is a courtesy translation.
// Every constant below is drafted from 03-UI-SPEC.md's Copywriting Contract table —
// verbatim where the table provides text, drafted within the D-03/D-04 guardrails
// where it does not (LANGUAGE_PRECEDENCE_CLAUSE).

export type LocalizedText = {
  fr: string;
  en: string;
};

// D-05 — CNIL NS-048 retention guidance for the founder waitlist. Plan 03-03's
// migration seeds `app_config.waitlist_retention_years` with this exact value.
export const WAITLIST_RETENTION_YEARS = 3;

// D-01 — rendered on both the CGV and CGU pages, immediately after <h1>, before the
// first <section>. Stays live until the phase's terminal counsel checkpoint clears.
export const DRAFT_REVIEW_BANNER: { headline: LocalizedText; body: LocalizedText } = {
  headline: {
    fr: 'Document en cours de relecture juridique',
    en: 'Document under legal review',
  },
  body: {
    fr: "Ce texte a été rédigé avec le plus grand soin mais n'a pas encore été validé par un avocat. Il est susceptible d'être modifié avant sa version définitive. Pour toute question, contactez-nous à support@ziko-app.com.",
    en: 'This text has been drafted with care but has not yet been reviewed and approved by a lawyer. It may be revised before its final version. Please contact us at support@ziko-app.com with any questions.',
  },
};

// LEGAL-02, D-03 — the AI-credit-cap parity sentence. Pasted byte-identical
// (translated) into both the CGV and the CGU per 03-RESEARCH.md's pitfall guard
// against describing the cap in subtly different terms across documents.
export const AI_CREDIT_CAP_SENTENCE: LocalizedText = {
  fr: "L'abonnement Premium à vie donne accès à l'ensemble des fonctionnalités de Ziko. L'usage de l'intelligence artificielle (coach IA, analyse de repas, génération de programmes) reste soumis à un quota mensuel de crédits IA, identique à celui de tout autre utilisateur Premium. Ce quota peut évoluer dans le temps en tant que politique tarifaire applicable à l'ensemble des utilisateurs Premium, sans jamais cibler spécifiquement les membres fondateurs.",
  en: "Lifetime Premium membership unlocks all of Ziko's features. Use of artificial intelligence (AI coach, meal analysis, program generation) remains subject to a monthly AI-credit allowance, identical to that of any other Premium user. This allowance may change over time as a platform-wide policy that applies to all Premium users, and will never single out founding members specifically.",
};

// LEGAL-03, D-03 — scoped to the Service's operating lifetime, frozen feature set,
// discretionary-only future additions (Pitfall 7).
export const LIFETIME_SCOPE_SENTENCE: LocalizedText = {
  fr: "L'avantage Premium à vie est valable pour toute la durée d'exploitation du Service par Ziko. Il correspond à l'ensemble des fonctionnalités Premium disponibles à la date de l'offre fondateurs. Les fonctionnalités Premium ajoutées ultérieurement pourront être étendues aux membres fondateurs, à la discrétion de Ziko, sans que cela ne constitue un engagement contractuel additionnel.",
  en: "The lifetime Premium benefit is valid for the entire operating lifetime of the Service by Ziko. It corresponds to the set of Premium features available as of the founder offer date. Premium features added later may be extended to founding members at Ziko's discretion, without this constituting an additional contractual commitment.",
};

// LEGAL-03/04, D-04 — the grey-list-pattern modification clause (Pitfall 8). The only
// circumstance in which the founder benefit ends is a service-wide shutdown, with
// notice and a data-export commitment. The notice period was counsel's Q6 answer in
// 03-COUNSEL-BRIEFING.md — see 03-COUNSEL-APPROVAL.md — 90 days, approved 2026-08-15.
export const SHUTDOWN_MODIFICATION_CLAUSE: LocalizedText = {
  fr: "Ziko ne peut mettre fin à l'avantage Premium à vie des membres fondateurs que dans le cadre d'une cessation générale du Service. Dans ce cas, Ziko s'engage à notifier les utilisateurs concernés avec un préavis raisonnable d'au moins 90 jours et à leur permettre d'exporter leurs données personnelles avant la fermeture.",
  en: "Ziko may only end founding members' lifetime Premium benefit as part of a general shutdown of the Service. In that case, Ziko commits to notifying affected users with reasonable advance notice of at least 90 days and to allowing them to export their personal data before closure.",
};

// LEGAL-08, D-05 — "3 years from last contact" (CNIL NS-048). Stated in the CGV/CGU
// text and, per Phase 5, in the point-of-collection notice — same number, both places.
export const RETENTION_STATEMENT: LocalizedText = {
  fr: "Les adresses e-mail collectées via la liste d'attente fondateurs sont conservées pendant 3 ans à compter du dernier contact avec l'inscrit, conformément aux recommandations de la CNIL (norme NS-048), puis supprimées ou anonymisées.",
  en: "Email addresses collected through the founder waitlist are retained for 3 years from the registrant's last contact with us, in line with CNIL's NS-048 guidance, and are then deleted or anonymized.",
};

// D-08 — French governs legally, English is a courtesy translation, French controls
// on any discrepancy. Not present verbatim in 03-UI-SPEC.md's Copywriting Contract
// table; drafted here within D-08's guardrail as the plan directs.
export const LANGUAGE_PRECEDENCE_CLAUSE: LocalizedText = {
  fr: "Les présentes CGV sont rédigées en langue française, qui fait seule foi. La version anglaise est fournie à titre de traduction de courtoisie destinée à faciliter la compréhension des utilisateurs non francophones. En cas de divergence ou de contradiction entre la version française et la version anglaise, la version française prévaut.",
  en: 'These Terms of Sale are drafted in French, which is the sole authoritative version. The English version is provided as a courtesy translation to help non-French-speaking users. In the event of any discrepancy or contradiction between the French and English versions, the French version shall prevail.',
};

// LEGAL-09, D-06 — the erasure-request channel and Article 12 GDPR's settled
// one-month response ceiling. Verbatim from 03-UI-SPEC.md's Copywriting Contract;
// the deadline is a statutory maximum, never softened or shortened here.
export const ERASURE_REQUEST_STATEMENT: LocalizedText = {
  fr: "Vous pouvez demander la suppression de votre adresse e-mail de notre liste d'attente à tout moment en écrivant à support@ziko-app.com. Votre demande sera traitée dans un délai d'un mois maximum, conformément à l'article 12 du RGPD.",
  en: 'You may request the removal of your email address from our waitlist at any time by writing to support@ziko-app.com. Your request will be processed within one month at most, as required by Article 12 GDPR.',
};

// LEGAL-06, D-07 — copy only, Phase 5 renders the actual (unchecked, standalone)
// checkbox. Worded as a freely-given, revocable marketing opt-in per Planet49
// (CJEU C-673/17) / GDPR Recital 32 — never phrased as acceptance of the CGV/CGU,
// never bundled with the submit action.
export const CONSENT_CHECKBOX_LABEL: LocalizedText = {
  fr: "J'accepte de recevoir des informations sur le lancement de Ziko et l'offre fondateurs par e-mail. Je peux me désinscrire à tout moment.",
  en: 'I agree to receive information about the Ziko launch and the founder offer by email. I can unsubscribe at any time.',
};

// LEGAL-07, D-07 — copy only, Phase 5 renders it at the point of collection (not
// footer-only). Carries all six CNIL Article 13 minimum fields in one block:
// controller, purposes, legal basis, recipients, retention duration, and
// data-subject rights with a contact channel. The retention duration is
// interpolated from WAITLIST_RETENTION_YEARS so the notice can never drift from
// the number the database and RETENTION_STATEMENT state.
export const COLLECTION_POINT_NOTICE: LocalizedText = {
  fr: `Ziko (responsable du traitement) collecte votre adresse e-mail pour vous informer du lancement de l'application et gérer votre place dans l'offre fondateurs (base légale : consentement). Vos données ne sont partagées avec aucun tiers à des fins commerciales et sont conservées ${WAITLIST_RETENTION_YEARS} ans à compter de votre dernier contact avec nous. Vous disposez d'un droit d'accès, de rectification et d'effacement : contactez-nous à support@ziko-app.com.`,
  en: `Ziko (data controller) collects your email address to notify you of the app launch and manage your place in the founder offer (legal basis: consent). Your data is never shared with third parties for commercial purposes and is kept for ${WAITLIST_RETENTION_YEARS} years from your last contact with us. You have the right to access, correct, and erase your data: contact us at support@ziko-app.com.`,
};

// Pattern 4, 03-RESEARCH.md — the literal Phase 5 writes into
// `waitlist_signups.consent_version` alongside `consent_given_at` (columns Phase 1
// shipped empty for exactly this purpose, D-15/D-16). Increment the `-vN` suffix
// any future time CONSENT_CHECKBOX_LABEL or COLLECTION_POINT_NOTICE changes, so a
// stored signup stays traceable to the exact copy it agreed to.
export const CONSENT_VERSION = 'waitlist-consent-v1';
