// CGV (Conditions Générales de Vente) — locale-branched section data for the
// `/[locale]/cgv` route. Phase 03-legal-cgv-cgu — 03-01 Task 1 seeds the two
// load-bearing sections (lifetime scope, AI-credit-cap parity); 03-01 Task 2 grows
// this to the full ten-section contract. French is authoritative (D-08); English is
// a courtesy translation of the same French draft, never an independent draft.
//
// Deliberately plain strings, no JSX — `cgvSections()` is importable and assertable
// in a plain node test environment without rendering a React Server Component.

import {
  AI_CREDIT_CAP_SENTENCE,
  LIFETIME_SCOPE_SENTENCE,
  type LocalizedText,
} from './founder-offer';

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

// Section order is identical, index-for-index, between the FR and EN arrays —
// `cgv-locale.test.ts` asserts this correspondence directly.
export const CGV_SECTIONS_FR: LegalSection[] = [
  {
    heading: "Portée de l'engagement « à vie »",
    paragraphs: [LIFETIME_SCOPE_SENTENCE.fr],
  },
  {
    heading: 'Fonctionnalités Premium et crédits IA',
    paragraphs: [AI_CREDIT_CAP_SENTENCE.fr],
  },
];

export const CGV_SECTIONS_EN: LegalSection[] = [
  {
    heading: 'Scope of the lifetime commitment',
    paragraphs: [LIFETIME_SCOPE_SENTENCE.en],
  },
  {
    heading: 'Premium features and AI credits',
    paragraphs: [AI_CREDIT_CAP_SENTENCE.en],
  },
];

export const CGV_LAST_UPDATED: LocalizedText = {
  fr: 'Dernière mise à jour : août 2026',
  en: 'Last updated: August 2026',
};

export function cgvSections(locale: string): LegalSection[] {
  return locale === 'en' ? CGV_SECTIONS_EN : CGV_SECTIONS_FR;
}
