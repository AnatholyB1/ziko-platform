// Phase 03-legal-cgv-cgu — 03-02 Task 1: proves LEGAL-04 structurally. The CGU
// obtains the AI-credit-cap sentence by importing the same `AI_CREDIT_CAP_SENTENCE`
// constant the CGV renders, rather than restating it — so a word-diff between the
// two documents' credit-cap paragraphs is empty by construction, not merely by
// careful drafting. All value comparisons run over imported constants; only the
// "obtained by import, not by literal" checks below read the CGU route's raw
// source text, since that structural property cannot be expressed any other way.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CGV_SECTIONS_FR, CGV_SECTIONS_EN } from '../../src/content/legal/cgv';
import { AI_CREDIT_CAP_SENTENCE } from '../../src/content/legal/founder-offer';

function joinSection(section: { heading: string; paragraphs: string[] }): string {
  return `${section.heading} ${section.paragraphs.join(' ')}`;
}

function joinAll(sections: Array<{ heading: string; paragraphs: string[] }>): string {
  return sections.map(joinSection).join(' ');
}

const cguSource = readFileSync(
  join(__dirname, '../../src/app/[locale]/(marketing)/cgu/page.tsx'),
  'utf-8'
);

describe('LEGAL-04 — CGV side of the identity', () => {
  it('the FR CGV body contains the AI-credit-cap sentence verbatim', () => {
    expect(joinAll(CGV_SECTIONS_FR)).toContain(AI_CREDIT_CAP_SENTENCE.fr);
  });

  it('the EN CGV body contains the AI-credit-cap sentence verbatim', () => {
    expect(joinAll(CGV_SECTIONS_EN)).toContain(AI_CREDIT_CAP_SENTENCE.en);
  });
});

describe('LEGAL-04 — CGU obtains the sentence by import, not by paraphrase', () => {
  it('the CGU route imports AI_CREDIT_CAP_SENTENCE from the shared clause module', () => {
    expect(cguSource).toContain('AI_CREDIT_CAP_SENTENCE');
    expect(cguSource).toContain('@/content/legal/founder-offer');
  });

  it('the CGU route does not additionally re-type the sentence as a literal', () => {
    const frOpening = AI_CREDIT_CAP_SENTENCE.fr.slice(0, 40);
    expect(cguSource).not.toContain(frOpening);
  });

  it('the CGU route carries the draft-pending-review banner', () => {
    expect(cguSource).toContain('DRAFT_REVIEW_BANNER');
    expect(cguSource).toContain('border-warning');
  });

  it('the CGU route leaves the existing section-9 modification clause untouched', () => {
    expect(cguSource).toContain('Ziko se r&eacute;serve le droit de modifier');
  });

  it('the CGU route genuinely branches the new section on locale', () => {
    expect(cguSource).toContain("locale === 'en'");
  });
});
