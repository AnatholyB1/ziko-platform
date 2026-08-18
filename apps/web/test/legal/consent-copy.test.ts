// Phase 03-legal-cgv-cgu — 03-02 Task 3: structural assertions over the three
// Phase-5 deliverables (LEGAL-06, LEGAL-07, consent_version). All assertions run
// against the imported constant values, never over raw file text — Phase 5 has
// not been built yet and no form UI exists to render these constants against.
import { describe, expect, it } from 'vitest';

import {
  CONSENT_CHECKBOX_LABEL,
  CONSENT_VERSION,
  COLLECTION_POINT_NOTICE,
  WAITLIST_RETENTION_YEARS,
} from '../../src/content/legal/founder-offer';

describe('LEGAL-06 — consent-checkbox label, standalone opt-in', () => {
  it('is non-empty in both locales', () => {
    expect(CONSENT_CHECKBOX_LABEL.fr.length).toBeGreaterThan(0);
    expect(CONSENT_CHECKBOX_LABEL.en.length).toBeGreaterThan(0);
  });

  it('carries the unsubscribe/désinscrire freely-given-consent marker', () => {
    expect(CONSENT_CHECKBOX_LABEL.fr).toContain('désinscrire');
    expect(CONSENT_CHECKBOX_LABEL.en).toContain('unsubscribe');
  });

  it('never bundles consent with acceptance of the CGV/CGU/general terms', () => {
    for (const text of [CONSENT_CHECKBOX_LABEL.fr, CONSENT_CHECKBOX_LABEL.en]) {
      expect(text).not.toContain('CGV');
      expect(text).not.toContain('CGU');
      expect(text).not.toContain('Terms');
      expect(text).not.toContain('conditions générales');
    }
  });
});

describe('LEGAL-07 — point-of-collection RGPD notice, all six Article 13 fields', () => {
  it('the FR notice carries all six CNIL Article 13 markers', () => {
    const notice = COLLECTION_POINT_NOTICE.fr;
    expect(notice).toContain('responsable du traitement');
    expect(notice).toContain('pour vous informer');
    expect(notice).toContain('consentement');
    expect(notice).toContain('aucun tiers');
    expect(notice).toContain('3');
    expect(notice).toContain('support@ziko-app.com');
  });

  it('the EN notice carries all six Article 13 counterparts', () => {
    const notice = COLLECTION_POINT_NOTICE.en;
    expect(notice).toContain('data controller');
    expect(notice).toContain('to notify you');
    expect(notice).toContain('consent');
    expect(notice).toContain('third parties');
    expect(notice).toContain('3');
    expect(notice).toContain('support@ziko-app.com');
  });

  it('both locales state the same retention duration as WAITLIST_RETENTION_YEARS', () => {
    expect(COLLECTION_POINT_NOTICE.fr).toContain(String(WAITLIST_RETENTION_YEARS));
    expect(COLLECTION_POINT_NOTICE.en).toContain(String(WAITLIST_RETENTION_YEARS));
  });
});

describe('CONSENT_VERSION — a traceable, versioned literal for Phase 5', () => {
  it('is exactly waitlist-consent-v1', () => {
    expect(CONSENT_VERSION).toBe('waitlist-consent-v1');
  });

  it('matches the versioned-literal pattern', () => {
    expect(CONSENT_VERSION).toMatch(/^waitlist-consent-v\d+$/);
  });
});
