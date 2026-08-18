// T-05-02 — pins the /fondateurs route's metadata contract without rendering React:
// title/description resolve from the real message files, canonical + both language
// alternates are correct, OpenGraph and Twitter blocks are complete (ENTRY-04), the
// route stays static (no `dynamic`/`revalidate` export, WAIT-08's cheapest guard short
// of a full build), and both image-convention modules export the right size/content type.
import { describe, expect, it, vi } from 'vitest';
import fr from '../../messages/fr.json';
import en from '../../messages/en.json';

// The route module transitively imports `@/actions/waitlist` -> `@/lib/supabase/admin`,
// which imports 'server-only'. That import throws outside a React Server Component
// context, so it must be stubbed before the route module is imported in this plain
// Vitest process — same guard `test/actions/waitlist.concurrency.test.ts` uses.
vi.mock('server-only', () => ({}));

type Messages = typeof fr;
const messagesByLocale: Record<string, Messages> = { fr, en };

function readMessage(source: unknown, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
  if (typeof value !== 'string') {
    throw new Error(`fondateurs.metadata.test.ts: missing message for path "${path}"`);
  }
  return value;
}

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const source = (messagesByLocale[locale] as unknown as Record<string, unknown>)[namespace];
    return (key: string) => readMessage(source, key);
  },
  setRequestLocale: () => {},
}));

const pageModule = await import('../../src/app/[locale]/(marketing)/fondateurs/page');
const ogImageModule = await import('../../src/app/[locale]/(marketing)/fondateurs/opengraph-image');
const twitterImageModule = await import('../../src/app/[locale]/(marketing)/fondateurs/twitter-image');

const LOCALES = ['fr', 'en'] as const;

describe('/fondateurs metadata contract', () => {
  it('generateStaticParams resolves to exactly the two locale objects (WAIT-01)', async () => {
    const params = await pageModule.generateStaticParams();
    expect(params).toEqual([{ locale: 'fr' }, { locale: 'en' }]);
  });

  it.each(LOCALES)('generateMetadata(locale=%s) returns non-empty title and description', async (locale) => {
    const metadata = await pageModule.generateMetadata({ params: Promise.resolve({ locale }) });
    const title =
      typeof metadata.title === 'object' && metadata.title && 'absolute' in metadata.title
        ? (metadata.title as { absolute?: string }).absolute
        : metadata.title;

    expect(typeof title).toBe('string');
    expect((title as string).length).toBeGreaterThan(0);
    expect(typeof metadata.description).toBe('string');
    expect((metadata.description as string).length).toBeGreaterThan(0);
  });

  it.each(LOCALES)('generateMetadata(locale=%s) sets the canonical and both language alternates', async (locale) => {
    const metadata = await pageModule.generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.alternates?.canonical).toBe(`/${locale}/fondateurs`);
    expect(metadata.alternates?.languages).toEqual({ fr: '/fr/fondateurs', en: '/en/fondateurs' });
  });

  it.each(LOCALES)('generateMetadata(locale=%s) sets a complete OpenGraph block', async (locale) => {
    const metadata = await pageModule.generateMetadata({ params: Promise.resolve({ locale }) });
    // Next's `OpenGraph` type is a discriminated union keyed by `type`, so plain
    // property access on the union doesn't narrow — this is a metadata-shape
    // assertion, not app code, so a permissive read here is the right tool.
    const openGraph = metadata.openGraph as Record<string, unknown> | undefined;
    expect(openGraph?.siteName).toBe('Ziko');
    expect(openGraph?.type).toBe('website');
    expect(openGraph?.locale).toBe(locale === 'fr' ? 'fr_FR' : 'en_US');
    expect(openGraph?.url).toBe(metadata.alternates?.canonical);
  });

  it.each(LOCALES)('generateMetadata(locale=%s) sets an explicit summary_large_image Twitter card (ENTRY-04)', async (locale) => {
    const metadata = await pageModule.generateMetadata({ params: Promise.resolve({ locale }) });
    const twitter = metadata.twitter as Record<string, unknown> | undefined;
    expect(twitter?.card).toBe('summary_large_image');
  });

  it('the route module exports neither a `dynamic` nor a `revalidate` symbol (WAIT-08 guard)', () => {
    expect('dynamic' in pageModule).toBe(false);
    expect('revalidate' in pageModule).toBe(false);
  });

  it('the opengraph-image module exports the 1200x630 size and image/png content type', () => {
    expect(ogImageModule.size).toEqual({ width: 1200, height: 630 });
    expect(ogImageModule.contentType).toBe('image/png');
  });

  it('the twitter-image module re-exports the same 1200x630 size and image/png content type', () => {
    expect(twitterImageModule.size).toEqual({ width: 1200, height: 630 });
    expect(twitterImageModule.contentType).toBe('image/png');
  });
});
