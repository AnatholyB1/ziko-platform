// Phase 03-legal-cgv-cgu — 03-01 Task 1: the tracer's real end-to-end proof.
// Not a per-layer unit test — proves the whole path from footer link discovery
// through to genuinely divergent FR/EN prose, the exact defect this task must not
// reproduce (the existing /en/cgu serves French prose under an English title).
//
// All content assertions run against the *imported* constant values, never against
// raw file text, so a source comment can never invalidate them. The only raw-source
// assertions are positive substring matches on the page and footer files — mirroring
// the readFileSync + resolve(__dirname, ...) idiom already used in
// apps/web/test/purge/purge-delete.test.ts for cross-workspace-boundary reads.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CGV_SECTIONS_FR, CGV_SECTIONS_EN, cgvSections } from '../../src/content/legal/cgv';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

describe('CGV locale branching (LEGAL-01)', () => {
  it('has the same number of sections in FR and EN, at least 2', () => {
    expect(CGV_SECTIONS_FR.length).toBe(CGV_SECTIONS_EN.length);
    expect(CGV_SECTIONS_FR.length).toBeGreaterThanOrEqual(2);
  });

  it('diverges genuinely — every EN section has a different heading and body than its FR counterpart', () => {
    for (let i = 0; i < CGV_SECTIONS_FR.length; i += 1) {
      expect(CGV_SECTIONS_EN[i].heading).not.toBe(CGV_SECTIONS_FR[i].heading);
      expect(CGV_SECTIONS_EN[i].paragraphs.join(' ')).not.toBe(CGV_SECTIONS_FR[i].paragraphs.join(' '));
    }
  });

  it('the EN branch contains no French markers and does contain real English prose', () => {
    const joinedEn = CGV_SECTIONS_EN.map((s) => `${s.heading} ${s.paragraphs.join(' ')}`).join(' ');
    expect(joinedEn).not.toContain('conformément');
    expect(joinedEn).not.toContain('présentes');
    expect(joinedEn).not.toContain(' les ');
    expect(joinedEn).not.toContain(' une ');
    expect(joinedEn).toContain('Lifetime Premium');
  });

  it('the FR branch contains the "à vie" lifetime-scope marker', () => {
    const joinedFr = CGV_SECTIONS_FR.map((s) => `${s.heading} ${s.paragraphs.join(' ')}`).join(' ');
    expect(joinedFr).toContain('à vie');
  });

  it('cgvSections(locale) selects EN only for "en", FR for everything else', () => {
    expect(cgvSections('en')).toBe(CGV_SECTIONS_EN);
    expect(cgvSections('fr')).toBe(CGV_SECTIONS_FR);
    expect(cgvSections('de')).toBe(CGV_SECTIONS_FR);
  });
});

describe('CGV route and footer wiring (LEGAL-01)', () => {
  const pageSource = readFileSync(
    resolve(__dirname, '../../src/app/[locale]/(marketing)/cgv/page.tsx'),
    'utf8'
  );
  const footerClientSource = readFileSync(
    resolve(__dirname, '../../src/components/layout/FooterClient.tsx'),
    'utf8'
  );

  it('the CGV page renders the locale-branched selector, not hardcoded prose', () => {
    expect(pageSource).toContain('cgvSections(locale)');
  });

  it('the footer links to /cgv', () => {
    expect(footerClientSource).toContain('href="/cgv"');
  });

  it('Metadata.cgvTitle/cgvDescription and Footer.cgv exist, are non-empty, and the description differs by locale', () => {
    expect(fr.Metadata.cgvTitle).toBeTruthy();
    expect(fr.Metadata.cgvDescription).toBeTruthy();
    expect(fr.Footer.cgv).toBeTruthy();
    expect(en.Metadata.cgvTitle).toBeTruthy();
    expect(en.Metadata.cgvDescription).toBeTruthy();
    expect(en.Footer.cgv).toBeTruthy();
    expect(fr.Metadata.cgvDescription).not.toBe(en.Metadata.cgvDescription);
  });
});
