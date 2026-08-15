// Phase 03-legal-cgv-cgu — 03-01 Task 2: content assertions over the completed
// ten-section CGV body, covering LEGAL-02 (AI-credit-cap parity), LEGAL-03
// (lifetime scope + narrow shutdown-only modification clause), D-04 (placeholder
// integrity) and D-08 (language precedence). All assertions run against the
// imported constant values and the joined section text — never against raw file
// text — so comments and prose in this plan can never invalidate the negative
// checks.
import { describe, expect, it } from 'vitest';

import { CGV_SECTIONS_FR, CGV_SECTIONS_EN } from '../../src/content/legal/cgv';
import {
  AI_CREDIT_CAP_SENTENCE,
  LANGUAGE_PRECEDENCE_CLAUSE,
  LIFETIME_SCOPE_SENTENCE,
  SHUTDOWN_MODIFICATION_CLAUSE,
} from '../../src/content/legal/founder-offer';

function joinSection(section: { heading: string; paragraphs: string[] }): string {
  return `${section.heading} ${section.paragraphs.join(' ')}`;
}

function joinAll(sections: Array<{ heading: string; paragraphs: string[] }>): string {
  return sections.map(joinSection).join(' ');
}

describe('CGV body completeness', () => {
  it('has all ten sections in both locales', () => {
    expect(CGV_SECTIONS_FR.length).toBe(10);
    expect(CGV_SECTIONS_EN.length).toBe(10);
  });
});

describe('LEGAL-02 — AI-credit-cap parity, no uncapped-AI claim', () => {
  it('the FR body contains the AI-credit-cap sentence verbatim', () => {
    expect(joinAll(CGV_SECTIONS_FR)).toContain(AI_CREDIT_CAP_SENTENCE.fr);
  });

  it('the EN body contains the AI-credit-cap sentence verbatim', () => {
    expect(joinAll(CGV_SECTIONS_EN)).toContain(AI_CREDIT_CAP_SENTENCE.en);
  });

  it('neither locale ever claims unlimited/uncapped AI usage', () => {
    const pattern = /illimit|unlimited|sans limite|uncapped/i;
    expect(joinAll(CGV_SECTIONS_FR)).not.toMatch(pattern);
    expect(joinAll(CGV_SECTIONS_EN)).not.toMatch(pattern);
  });
});

describe('LEGAL-03 — lifetime scope + narrow shutdown-only modification clause', () => {
  it('the FR body contains the lifetime-scope and shutdown-modification clauses verbatim', () => {
    const joinedFr = joinAll(CGV_SECTIONS_FR);
    expect(joinedFr).toContain(LIFETIME_SCOPE_SENTENCE.fr);
    expect(joinedFr).toContain(SHUTDOWN_MODIFICATION_CLAUSE.fr);
  });

  it('the EN body contains the lifetime-scope and shutdown-modification clauses verbatim', () => {
    const joinedEn = joinAll(CGV_SECTIONS_EN);
    expect(joinedEn).toContain(LIFETIME_SCOPE_SENTENCE.en);
    expect(joinedEn).toContain(SHUTDOWN_MODIFICATION_CLAUSE.en);
  });

  it('no section combines "à tout moment" with "sans préavis" — the black-list unilateral-modification pattern', () => {
    for (const section of [...CGV_SECTIONS_FR, ...CGV_SECTIONS_EN]) {
      const joined = joinSection(section);
      const hasBoth = joined.includes('à tout moment') && joined.includes('sans préavis');
      expect(hasBoth).toBe(false);
    }
  });

  it('never reserves a purely discretionary right to withdraw the benefit', () => {
    const pattern = /à sa seule discrétion|at its sole discretion/i;
    expect(joinAll(CGV_SECTIONS_FR)).not.toMatch(pattern);
    expect(joinAll(CGV_SECTIONS_EN)).not.toMatch(pattern);
  });
});

describe('D-04 — notice-period placeholder resolved to counsel-approved figure', () => {
  it('the shutdown clause carries no unresolved [TBD] placeholder in either locale', () => {
    expect(SHUTDOWN_MODIFICATION_CLAUSE.fr).not.toContain('[TBD');
    expect(SHUTDOWN_MODIFICATION_CLAUSE.en).not.toContain('[TBD');
  });

  it('the shutdown clause states the counsel-approved 90-day notice period in both locales', () => {
    expect(SHUTDOWN_MODIFICATION_CLAUSE.fr).toContain('90 jours');
    expect(SHUTDOWN_MODIFICATION_CLAUSE.en).toContain('90 days');
  });
});

describe('D-08 — French-authoritative language precedence clause', () => {
  it('the FR body contains the language-precedence clause verbatim', () => {
    expect(joinAll(CGV_SECTIONS_FR)).toContain(LANGUAGE_PRECEDENCE_CLAUSE.fr);
  });

  it('the EN body contains the language-precedence clause verbatim', () => {
    expect(joinAll(CGV_SECTIONS_EN)).toContain(LANGUAGE_PRECEDENCE_CLAUSE.en);
  });
});
