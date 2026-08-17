// Phase 5 plan 05-05 (T-05-10, ENTRY-03, D-04) — pins the new "Fondateurs" nav link
// in both HeaderClient and FooterClient: same visual weight as their respective
// neighbours (D-04), the header's existing coach-dashboard CTA untouched (D-03),
// and the header's right-hand row allowed to wrap on narrow viewports.
//
// happy-dom (this file matches `**/*.test.tsx`). The locale-aware `Link` from
// `@/i18n/navigation` is stubbed to a plain anchor carrying the href/className it
// was given, and the header's scroll-driven blur hooks are stubbed so the component
// mounts in an environment with no real viewport/scroll behavior — mirroring the
// convention `WaitlistRoleForm.test.tsx` and `WaitlistCounterClient.test.tsx` use for
// their own dependencies. No @testing-library/jest-dom in this repo — assertions
// read plain DOM properties.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderClient } from '@/components/layout/HeaderClient';
import { FooterClient } from '@/components/layout/FooterClient';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    className,
    locale,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    locale?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...(locale ? { 'data-locale': locale } : {})} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    // HeaderClient's scroll-driven blur opacity depends on real scroll events,
    // which happy-dom does not meaningfully dispatch. Stubbed to constants so the
    // component mounts deterministically with no viewport.
    useScroll: () => ({ scrollY: { get: () => 0, on: () => () => {} } }),
    useTransform: () => 0,
  };
});

const headerProps = {
  locale: 'fr',
  logo: 'Ziko',
  localeFR: 'FR',
  localeEN: 'EN',
  cta: "Télécharger l'app",
  founders: 'Fondateurs',
};

const footerProps = {
  copyright: '© 2026 Ziko. Tous droits réservés.',
  legal: 'Mentions légales',
  privacy: 'Politique de confidentialité',
  terms: 'CGU',
  cgv: 'CGV',
  deleteAccount: 'Supprimer mon compte',
  founders: 'Fondateurs',
};

describe('HeaderClient founders link (T-05-10, ENTRY-03, D-04)', () => {
  it('produces a link to the founders route bearing the founders label', () => {
    render(<HeaderClient {...headerProps} />);
    const link = screen.getByText('Fondateurs');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/fondateurs');
  });

  it("matches the unselected locale link's class list (D-04 equal-weight check, by comparison not a hardcoded string)", () => {
    render(<HeaderClient {...headerProps} />);
    const foundersLink = screen.getByText('Fondateurs');
    // locale="fr" is selected in headerProps, so the EN link is the unselected one.
    const unselectedLocaleLink = screen.getByText('EN');
    expect(foundersLink.className.split(' ').sort()).toEqual(
      unselectedLocaleLink.className.split(' ').sort(),
    );
  });

  it('still produces a link to the coach dashboard bearing the CTA label with its accent styling intact (D-03)', () => {
    render(<HeaderClient {...headerProps} />);
    const ctaLink = screen.getByText(headerProps.cta);
    expect(ctaLink.getAttribute('href')).toBe('/coach/dashboard');
    expect(ctaLink.className).toContain('bg-primary');
    expect(ctaLink.className).toContain('text-white');
  });

  it('appears before the locale switcher in document order', () => {
    const { container } = render(<HeaderClient {...headerProps} />);
    const texts = Array.from(container.querySelectorAll('a')).map((a) => a.textContent);
    const foundersIndex = texts.indexOf('Fondateurs');
    const localeFRIndex = texts.indexOf('FR');
    const localeENIndex = texts.indexOf('EN');
    expect(foundersIndex).toBeGreaterThan(-1);
    expect(foundersIndex).toBeLessThan(localeFRIndex);
    expect(foundersIndex).toBeLessThan(localeENIndex);
  });

  it("carries the same minimum touch-target height as the locale switcher's links", () => {
    render(<HeaderClient {...headerProps} />);
    const foundersLink = screen.getByText('Fondateurs');
    expect(foundersLink.className).toContain('min-h-[44px]');
  });

  it("the right-hand container permits its children to wrap", () => {
    render(<HeaderClient {...headerProps} />);
    const foundersLink = screen.getByText('Fondateurs');
    const rightHandContainer = foundersLink.parentElement;
    expect(rightHandContainer?.className).toContain('flex-wrap');
  });
});

describe('FooterClient founders link (T-05-10, ENTRY-03, D-04)', () => {
  it('produces a link to the founders route bearing the founders label, first in the nav list', () => {
    const { container } = render(<FooterClient {...footerProps} />);
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    const firstLink = nav?.querySelector('a');
    expect(firstLink?.getAttribute('href')).toBe('/fondateurs');
    expect(firstLink?.textContent).toBe('Fondateurs');
  });

  it('is rendered by the same helper as the legal, privacy, terms and CGV links (D-04) — identical class list, not a bespoke element', () => {
    render(<FooterClient {...footerProps} />);
    const foundersLink = screen.getByText('Fondateurs');
    const legalLink = screen.getByText(footerProps.legal);
    expect(foundersLink.className).toBe(legalLink.className);
  });
});
