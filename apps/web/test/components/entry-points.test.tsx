// Phase 5 plan 05-04 (T-05-08, T-05-09) — pins every entry point this plan touches:
// the homepage founders section (ENTRY-01, D-05), and the two `/coachs` calls to
// action redirected to `/fondateurs` with the coach profile preselected (ENTRY-02,
// D-01), alongside standing guards for the decisions this plan must not disturb
// (D-02 coach onboarding untouched, D-03 header CTA unchanged, D-06 no `/coachs`
// section). happy-dom (this file matches `**/*.test.tsx`). No @testing-library/
// jest-dom in this repo — assertions read plain DOM properties, mirroring
// WaitlistRoleForm.test.tsx and WaitlistCounterClient.test.tsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CoachsHeroClient } from '@/components/marketing/CoachsHeroClient';
import { CoachsCtaFooterClient } from '@/components/marketing/CoachsCtaFooterClient';
import { FoundersOfferSectionClient } from '@/components/marketing/FoundersOfferSectionClient';
import { WAITLIST_ROLE_PARAM, WAITLIST_ROLE_COACH } from '@/components/marketing/WaitlistRoleForm';
import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';

// WaitlistRoleForm.tsx statically imports claimWaitlistSpot from this server-action
// module (for its own submission wiring); this suite only needs the two exported
// role constants, but the module import still pulls in the whole file otherwise —
// same mock WaitlistRoleForm.test.tsx already installs.
vi.mock('@/actions/waitlist', () => ({
  claimWaitlistSpot: vi.fn(),
}));

const heroProps = {
  badge: 'Bêta privée · 100% gratuit',
  headline: 'La CRM coaching à l\'IA',
  subtitle: 'Gérez vos clients.',
  cta: 'Rejoindre la liste des fondateurs',
  ctaNote: '200 places fondateurs disponibles',
};

const footerCtaProps = {
  heading: 'Rejoignez les premiers coachs sur Ziko.',
  subheading: 'Bêta privée ouverte — 100% gratuit, sans engagement.',
  button: 'Rejoindre la liste des fondateurs',
  note: '200 places fondateurs, premium à vie',
};

const counterProps = {
  counterStaticOffer: 'Les 200 premiers membres obtiennent le premium à vie.',
  counterRemainingTemplate: 'Plus que {remaining} places fondateur',
  counterCompleteHeading: 'Les 200 places fondateurs sont prises',
  counterCompleteBody: 'Inscrivez-vous quand même pour être averti·e du lancement.',
};

function anchorHref(container: HTMLElement): string | null {
  return container.querySelector('a')?.getAttribute('href') ?? null;
}

// Flatten a nested message object into a sorted array of dot-separated key paths,
// mirroring the plan's own acceptance-criteria key-tree parity check.
function keyTree(o: unknown, p = ''): string[] {
  if (typeof o !== 'object' || o === null) return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keyTree(v, p ? `${p}.${k}` : k));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CoachsHeroClient link target (T-05-09, ENTRY-02, D-01)', () => {
  it('produces an anchor to the French founders path carrying the coach role hint', () => {
    const { container } = render(<CoachsHeroClient locale="fr" {...heroProps} />);
    expect(anchorHref(container)).toBe(`/fr/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`);
  });

  it('produces an anchor to the English founders path carrying the coach role hint', () => {
    const { container } = render(<CoachsHeroClient locale="en" {...heroProps} />);
    expect(anchorHref(container)).toBe(`/en/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`);
  });

  it('no longer links to the coach onboarding path', () => {
    const { container } = render(<CoachsHeroClient locale="fr" {...heroProps} />);
    expect(anchorHref(container)).not.toContain('coach/onboarding');
  });
});

describe('CoachsCtaFooterClient link target (T-05-09, ENTRY-02, D-01)', () => {
  it('produces an anchor to the French founders path carrying the coach role hint', () => {
    const { container } = render(<CoachsCtaFooterClient locale="fr" {...footerCtaProps} />);
    expect(anchorHref(container)).toBe(`/fr/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`);
  });

  it('produces an anchor to the English founders path carrying the coach role hint', () => {
    const { container } = render(<CoachsCtaFooterClient locale="en" {...footerCtaProps} />);
    expect(anchorHref(container)).toBe(`/en/fondateurs?${WAITLIST_ROLE_PARAM}=${WAITLIST_ROLE_COACH}`);
  });

  it('no longer links to the coach onboarding path', () => {
    const { container } = render(<CoachsCtaFooterClient locale="fr" {...footerCtaProps} />);
    expect(anchorHref(container)).not.toContain('coach/onboarding');
  });
});

describe('Role hint contract (T-05-09)', () => {
  it('carries exactly the parameter name and value WaitlistRoleForm itself accepts, parsed from the href rather than a retyped guess', () => {
    const { container } = render(<CoachsHeroClient locale="fr" {...heroProps} />);
    const href = anchorHref(container);
    expect(href).not.toBeNull();
    const query = new URL(href as string, 'https://example.com').searchParams;
    expect(query.get(WAITLIST_ROLE_PARAM)).toBe(WAITLIST_ROLE_COACH);
  });
});

describe('FoundersOfferSectionClient (T-05-08, ENTRY-01, D-05)', () => {
  it('produces an anchor to the French founders path with no role hint', () => {
    const { container } = render(
      <FoundersOfferSectionClient
        locale="fr"
        heading="H"
        subheading="S"
        button="B"
        note="N"
        {...counterProps}
      />,
    );
    const href = anchorHref(container);
    expect(href).toBe('/fr/fondateurs');
    expect(href).not.toContain(`${WAITLIST_ROLE_PARAM}=`);
  });

  it('produces an anchor to the English founders path with no role hint', () => {
    const { container } = render(
      <FoundersOfferSectionClient
        locale="en"
        heading="H"
        subheading="S"
        button="B"
        note="N"
        {...counterProps}
      />,
    );
    const href = anchorHref(container);
    expect(href).toBe('/en/fondateurs');
    expect(href).not.toContain(`${WAITLIST_ROLE_PARAM}=`);
  });

  it("renders the counter widget's own copy rather than a locally-built badge", async () => {
    render(
      <FoundersOfferSectionClient
        locale="fr"
        heading="H"
        subheading="S"
        button="B"
        note="N"
        {...counterProps}
      />,
    );
    // Fetch never resolves (stubbed above) — the widget's own loading placeholder
    // shape renders, proving the badge content comes from WaitlistCounterClient and
    // not a second, homepage-local implementation, which would render immediately
    // with real text instead of a pulse placeholder.
    expect(screen.queryByText(/\d/)).toBeNull();
  });
});

describe('Homepage source order (ENTRY-01, D-05)', () => {
  it('mounts FoundersOfferSection textually after the hero component and before the how-it-works component', () => {
    const source = readFileSync(
      resolve(__dirname, '../../src/app/[locale]/(marketing)/page.tsx'),
      'utf-8',
    );
    const heroIndex = source.indexOf('<Hero');
    const foundersIndex = source.indexOf('<FoundersOfferSection');
    const howItWorksIndex = source.indexOf('<HowItWorks');

    expect(heroIndex).toBeGreaterThan(-1);
    expect(foundersIndex).toBeGreaterThan(-1);
    expect(howItWorksIndex).toBeGreaterThan(-1);
    expect(foundersIndex).toBeGreaterThan(heroIndex);
    expect(howItWorksIndex).toBeGreaterThan(foundersIndex);
  });
});

describe('Message key parity (T-05-08)', () => {
  it('neither message file gained a key the other lacks', () => {
    expect(keyTree(frMessages).sort()).toEqual(keyTree(enMessages).sort());
  });

  it('both locale files carry the Home.founders block', () => {
    expect((frMessages as { Home: { founders?: unknown } }).Home.founders).toBeDefined();
    expect((enMessages as { Home: { founders?: unknown } }).Home.founders).toBeDefined();
  });
});

describe('Standing guards (D-02, D-03) — not changed by this plan', () => {
  it("the header component's own call to action still points at the coach dashboard", () => {
    const headerSource = readFileSync(
      resolve(__dirname, '../../src/components/layout/HeaderClient.tsx'),
      'utf-8',
    );
    const matches = headerSource.match(/coach\/dashboard/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the coach onboarding route file still exists on disk', () => {
    const onboardingPagePath = resolve(__dirname, '../../src/app/[locale]/coach/onboarding/page.tsx');
    expect(existsSync(onboardingPagePath)).toBe(true);
  });
});
