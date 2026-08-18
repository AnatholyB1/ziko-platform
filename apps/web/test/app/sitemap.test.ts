// Phase 5 plan 05-05 (T-05-11, ENTRY-05) — pins the founders route's sitemap entry
// for both locales with correct language alternates, confirms the four pre-existing
// entries survive unmodified (no accidental duplicate/drop), and confirms nothing in
// robots.ts blocks the new route from being crawled.
//
// Node environment (this file matches `{src,test}/**/*.{spec,test}.{ts,tsx}` but not
// `**/*.test.tsx`, so it runs under the default `node` environment per
// `environmentMatchGlobs`). NEXT_PUBLIC_SITE_URL is set before importing so the
// generated URLs are deterministic.
import { beforeAll, describe, expect, it } from 'vitest';

const SITE_URL = 'https://ziko-app.com';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
});

describe('sitemap (T-05-11, ENTRY-05)', () => {
  it('contains an entry for /fr/fondateurs and one for /en/fondateurs, each carrying both language alternates', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();

    const fr = entries.find((e) => e.url === `${SITE_URL}/fr/fondateurs`);
    const en = entries.find((e) => e.url === `${SITE_URL}/en/fondateurs`);

    expect(fr).toBeDefined();
    expect(en).toBeDefined();

    expect(fr?.alternates?.languages).toEqual({
      fr: `${SITE_URL}/fr/fondateurs`,
      en: `${SITE_URL}/en/fondateurs`,
    });
    expect(en?.alternates?.languages).toEqual({
      fr: `${SITE_URL}/fr/fondateurs`,
      en: `${SITE_URL}/en/fondateurs`,
    });
  });

  it('each founders entry carries a lastModified date and a numeric priority', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    const fr = entries.find((e) => e.url === `${SITE_URL}/fr/fondateurs`);

    expect(fr?.lastModified).toBeInstanceOf(Date);
    expect(typeof fr?.priority).toBe('number');
  });

  it('keeps all four pre-existing page paths present', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    for (const locale of ['fr', 'en']) {
      expect(urls).toContain(`${SITE_URL}/${locale}`);
      expect(urls).toContain(`${SITE_URL}/${locale}/mentions-legales`);
      expect(urls).toContain(`${SITE_URL}/${locale}/politique-de-confidentialite`);
      expect(urls).toContain(`${SITE_URL}/${locale}/cgu`);
    }
  });

  it('the total entry count equals the page count times the locale count (catches a duplicate or a dropped entry)', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    // 5 hand-maintained pages (4 pre-existing + this plan's one addition) x 2 locales.
    expect(entries.length).toBe(5 * 2);
  });

  it('the robots rules produce no disallow entry matching either founders URL', async () => {
    const robots = (await import('@/app/robots')).default;
    const result = robots();
    const disallow = Array.isArray(result.rules)
      ? result.rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []))
      : Array.isArray(result.rules.disallow)
        ? result.rules.disallow
        : result.rules.disallow
          ? [result.rules.disallow]
          : [];

    expect(disallow.some((d) => d.includes('fondateurs'))).toBe(false);
  });

  it('the robots rules still disallow both locales of the account-deletion page, unchanged', async () => {
    const robots = (await import('@/app/robots')).default;
    const result = robots();
    const disallow = Array.isArray(result.rules)
      ? result.rules.flatMap((r) => (Array.isArray(r.disallow) ? r.disallow : r.disallow ? [r.disallow] : []))
      : Array.isArray(result.rules.disallow)
        ? result.rules.disallow
        : result.rules.disallow
          ? [result.rules.disallow]
          : [];

    expect(disallow).toContain('/fr/supprimer-mon-compte');
    expect(disallow).toContain('/en/supprimer-mon-compte');
  });
});
