# Phase 3: Legal — CGV & CGU - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 9
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` (NEW) | route/component | request-response (SSR content) | `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` | exact |
| `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` (MODIFIED — AI-credit-cap §, banner) | route/component | request-response (SSR content) | itself (revise in place) | exact |
| `apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx` (MODIFIED — retention/erasure §) | route/component | request-response (SSR content) | `cgu/page.tsx` (sibling legal page, same shape) | exact |
| `apps/web/src/components/layout/Footer.tsx` (MODIFIED) | component (server) | request-response | itself (add one prop) | exact |
| `apps/web/src/components/layout/FooterClient.tsx` (MODIFIED) | component (client) | request-response | itself (add one `AnimatedLink`) | exact |
| `apps/web/messages/fr.json` / `en.json` (MODIFIED) | config (i18n messages) | CRUD (static key/value) | existing `Metadata.cgu*` / `Footer.terms` keys | exact |
| `supabase/migrations/<NEW>_waitlist_retention_config.sql` | migration | CRUD (seed insert) | `supabase/migrations/20260812_waitlist_founder_offer.sql` §5 `app_config` seed | exact |
| `scripts/waitlist-erasure/run.mjs` (OPTIONAL, Claude's discretion) | utility/script | event-driven (manual human trigger → RPC call) | `scripts/purge-test-accounts/lib.mjs` (+ `delete.mjs`) | role-match |
| `apps/web/test/legal/*.test.ts` (NEW, Wave 0 gap) | test | transform (content assertions) | `apps/web/test/purge/purge-delete.test.ts` (style) | role-match (not read this pass — see Metadata) |

## Pattern Assignments

### `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` (route, request-response)

**Analog:** `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` (full file read, 172 lines)

**Imports pattern** (lines 1-3):
```tsx
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
```

**Metadata pattern** (lines 5-34) — copy verbatim, swap `cgu` → `cgv`:
```tsx
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('cgvTitle'),
    description: t('cgvDescription'),
    alternates: {
      canonical: `/${locale}/cgv`,
      languages: { fr: '/fr/cgv', en: '/en/cgv' },
    },
    openGraph: {
      title: t('cgvTitle'),
      description: t('cgvDescription'),
      url: `/${locale}/cgv`,
      siteName: 'Ziko',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: t('ogImageAlt') }],
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('cgvTitle'),
      description: t('cgvDescription'),
      images: ['/og-image.png'],
    },
  }
}
```

**Page shell + section shape** (lines 36-49, 133-172):
```tsx
export default async function CgvPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">
      <h1 className="text-3xl font-semibold">{/* CGV title, both locales — Display 30px/600 per UI-SPEC */}</h1>

      {/* Draft-pending-review banner — see Shared Patterns below, immediately after <h1> */}

      <section>
        <h2 className="text-xl font-semibold mt-8 mb-3">{/* section title */}</h2>
        <p className="text-text leading-relaxed mb-4">{/* prose */}</p>
      </section>
      {/* ...repeat sections... */}

      <p className="text-muted text-sm mt-12">
        {/* "Dernière mise à jour : ..." / "Last updated: ..." */}
      </p>
    </main>
  );
}
```

**CRITICAL — locale branching is NOT in the analog.** `cgu/page.tsx` hardcodes French prose with zero `locale` conditional for body text (only the `<title>`/OG metadata is locale-aware via `t()`). Per `03-RESEARCH.md` Pattern 2, do **NOT** copy this gap. Branch body content explicitly:
```tsx
const content = locale === 'en' ? enContent : frContent
// where frContent/enContent are arrays of section objects or JSX blocks defined
// above the component, not per-paragraph next-intl message keys (too unwieldy
// for long-form legal prose — matches existing precedent's *reason* for
// hardcoding JSX, just adds the missing branch).
```

**Cross-document link pattern** (lines 88-94, reuse for CGV → CGU / CGV → Politique links):
```tsx
<Link href="/politique-de-confidentialite" className="text-primary underline">
  Politique de confidentialit&eacute;
</Link>
```

---

### `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` (MODIFIED, route, request-response)

**Analog:** itself — this is a targeted revision, not a rewrite.

**What to touch:**
1. Section on data/premium (near §5/§6) — insert or align the AI-credit-cap parity sentence (see UI-SPEC Copywriting Contract, byte-identical translated text vs. CGV) — LEGAL-04.
2. Add the draft-pending-review banner (see Shared Patterns) immediately after `<h1>`, before the first `<section>` — same placement rule as CGV.
3. Leave §9 modification clause (lines 153-158) unchanged this phase — flag it in the counsel-briefing package per Open Question 3 in RESEARCH.md; do not silently rewrite it.

**Existing §9 clause to leave alone but flag** (lines 153-158):
```tsx
<section>
  <h2 className="text-xl font-semibold mt-8 mb-3">9. Modification des CGU</h2>
  <p className="text-text leading-relaxed mb-4">
    Ziko se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU &agrave; tout moment. Les modifications seront notifi&eacute;es aux utilisateurs par e-mail ou via l&apos;application avec un pr&eacute;avis raisonnable. La poursuite de l&apos;utilisation du Service apr&egrave;s notification vaut acceptation des nouvelles CGU.
  </p>
</section>
```

---

### `apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx` (MODIFIED)

**Analog:** `cgu/page.tsx` — same page shell/section shape (not independently re-read this pass since the shape is identical to `cgu/page.tsx`, confirmed by RESEARCH.md's verified-lines citation `politique-de-confidentialite/page.tsx:36-228`).

**What to add:** a new `<section>` following the exact `<h2 className="text-xl font-semibold mt-8 mb-3">` / `<p className="text-text leading-relaxed mb-4">` shape, containing:
- Retention statement copy (LEGAL-08, D-05 — "3 years from last contact" / CNIL NS-048) — exact FR/EN text in UI-SPEC.
- Erasure-request copy (LEGAL-09, D-06 — `support@ziko-app.com`, one-month GDPR Art. 12 deadline) — exact FR/EN text in UI-SPEC.

Same locale-branching caveat as CGV applies if this page currently has zero body-locale-branching (RESEARCH.md flags this file has the identical gap).

---

### `apps/web/src/components/layout/Footer.tsx` (MODIFIED, component/server)

**Analog:** itself.

**Current full file** (15 lines) — add `cgv={t('cgv')}` following the existing `terms={t('terms')}` pattern:
```tsx
import { getTranslations } from 'next-intl/server'
import { FooterClient } from './FooterClient'

export async function Footer() {
  const t = await getTranslations('Footer')
  return (
    <FooterClient
      copyright={t('copyright')}
      legal={t('legal')}
      privacy={t('privacy')}
      terms={t('terms')}
      cgv={t('cgv')}          {/* NEW */}
      deleteAccount={t('deleteAccount')}
    />
  )
}
```

---

### `apps/web/src/components/layout/FooterClient.tsx` (MODIFIED, component/client)

**Analog:** itself.

**Props type extension** (lines 20-26):
```tsx
type Props = {
  copyright: string
  legal: string
  privacy: string
  terms: string
  cgv: string              // NEW
  deleteAccount: string
}
```

**Nav insertion point** (lines 37-44) — add the `AnimatedLink` for `/cgv` next to `/cgu`, same order as UI-SPEC's footer copy contract (`"CGV"` / `"Terms of Sale"`):
```tsx
<nav className="flex flex-wrap gap-6 justify-center">
  <AnimatedLink href="/mentions-legales">{legal}</AnimatedLink>
  <AnimatedLink href="/politique-de-confidentialite">{privacy}</AnimatedLink>
  <AnimatedLink href="/cgu">{terms}</AnimatedLink>
  <AnimatedLink href="/cgv">{cgv}</AnimatedLink>   {/* NEW */}
  <Link href="/supprimer-mon-compte" className="text-sm text-muted hover:text-text transition-colors">
    {deleteAccount}
  </Link>
</nav>
```
`AnimatedLink` itself (lines 6-18) needs no change — reused as-is.

---

### `apps/web/messages/fr.json` / `en.json` (MODIFIED, config)

**Analog:** existing `Metadata` and `Footer` namespace blocks (`fr.json:82-102`).

**Pattern to extend** (fr.json lines 82-102):
```json
"Metadata": {
  ...
  "cguTitle": "CGU",
  "cguDescription": "Conditions générales d'utilisation de l'application Ziko.",
  "cgvTitle": "CGV",                                                            // NEW
  "cgvDescription": "Conditions générales de vente de l'offre fondateurs Ziko.", // NEW
  ...
},
"Footer": {
  "copyright": "© 2026 Ziko. Tous droits réservés.",
  "legal": "Mentions légales",
  "privacy": "Politique de confidentialité",
  "terms": "CGU",
  "cgv": "CGV",              // NEW
  "deleteAccount": "Supprimer mon compte"
}
```
`en.json` mirrors the same key names with English values (`"Terms of Sale"` etc. per UI-SPEC's Metadata namespace table). These are short label/title strings only — the long-form CGV/CGU body prose does NOT go through this file (see locale-branched-JSX pattern above); only page `<title>`/OG metadata and the footer nav label use `next-intl` keys.

---

### `supabase/migrations/<NEW dated file>_waitlist_retention_config.sql`

**Analog:** `supabase/migrations/20260812_waitlist_founder_offer.sql` §5 (lines 155-172), the `app_config` seed idiom.

**Exact pattern to replicate** (lines 159-172):
```sql
-- app_config already exists (created idempotently in 20260812_waitlist_founder_offer.sql).
-- This migration only adds a new seed row — do NOT re-create the table, do NOT edit
-- the 20260812 file.

INSERT INTO public.app_config (key, value)
VALUES ('waitlist_retention_years', '3')
ON CONFLICT (key) DO NOTHING;
```
Notes from the analog: `app_config` has `CREATE TABLE IF NOT EXISTS`, RLS enabled with **deliberately zero `CREATE POLICY` statements** (deny-all), `value` column is `JSONB`. `ON CONFLICT (key) DO NOTHING` is the idempotency guard used throughout this table — keep it. Follow the file-naming convention of the newer series: `YYYYMMDD_description.sql` (the 2026 files in this repo already use this pattern, e.g. `20260812_waitlist_founder_offer.sql`).

---

### `scripts/waitlist-erasure/run.mjs` (OPTIONAL — Claude's discretion per D-06/RESEARCH Open Question 2)

**Analog:** `scripts/purge-test-accounts/lib.mjs` (full file read, 60 lines) — the admin-client + fail-fast idiom.

**Imports + admin client pattern** (lines 13-19, 38-59):
```js
import { createClient } from '@supabase/supabase-js';

// Own admin client — mirrors, does NOT import, apps/web/src/lib/supabase/admin.ts
// (that file has `import 'server-only'` and cannot run outside Next.js).
export function createAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```
**Difference from the analog:** Phase 2's script enumerates/classifies/deletes via the Admin API (`auth.admin.deleteUser`); Phase 3's script would instead call the already-built RPC:
```js
const { data, error } = await supabase.rpc('anonymize_waitlist_signup', { p_email: email });
```
No dry-run/export/two-person ceremony is required proportionate to this operation (single-row, non-destructive UPDATE, not a cascading delete) — RESEARCH.md Open Question 2 explicitly notes Phase 2's full rigor is not required here. A lighter single-file script with an explicit `--confirm` CLI flag (matching the *shape*, not the full weight, of Phase 2's convention) is sufficient; a documented runbook (`RUNBOOK.md`-style, see `scripts/purge-test-accounts/RUNBOOK.md`) is an equally valid alternative per Claude's discretion.

---

## Shared Patterns

### Draft-pending-review banner (D-01, new to this phase — not a literal copy of the CGU medical-disclaimer box)

**Structural source (proportions/placement only):** `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` lines 98-120 (medical-disclaimer box) — but UI-SPEC explicitly overrides the color tokens (`border-primary`/`bg-orange-50` → `border-warning`/`bg-warning-subtle`, since `--color-warning: #F59E0B` and `--color-warning-subtle: #FFFBEB` already exist in `globals.css`'s `@theme` block and are unused elsewhere).

**Apply to:** CGV page (immediately after `<h1>`, before first `<section>`) and CGU page (same placement).

```tsx
<div className="rounded-lg border-2 border-warning bg-warning-subtle p-6 space-y-3">
  <p className="font-semibold text-warning text-xl flex items-center gap-2">
    <IoWarningOutline aria-hidden="true" />
    {/* FR: Document en cours de relecture juridique / EN: Document under legal review */}
  </p>
  <p className="text-text leading-relaxed">
    {/* FR/EN body text — exact copy in 03-UI-SPEC.md Copywriting Contract table */}
  </p>
</div>
```
Icon import: `import { IoWarningOutline } from 'react-icons/io5'` (already used elsewhere, e.g. `apps/web/src/components/coach/ArchiveModal.tsx:5`, per UI-SPEC Design System table — not independently verified this pass, cite from UI-SPEC).

### Page shell / metadata / locale-param handling

**Source:** `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` lines 1-38 (full pattern above under CGV's Pattern Assignment).
**Apply to:** CGV (new), CGU (unchanged shell, only body edited), Politique de confidentialité (unchanged shell, only body edited).

### Locale-branched body content (the one deviation from existing precedent, mandatory for this phase)

**Source:** Not present in the codebase yet — this is RESEARCH.md's Pattern 2 correction to the existing (broken) precedent. Apply the `locale === 'en' ? enContent : frContent` branch to every legal page body this phase creates or touches for bilingual compliance (CGV always; CGU/Politique only for the specific sections revised this phase — do not retrofit untouched sections).

### `app_config` seed-row idempotency

**Source:** `supabase/migrations/20260812_waitlist_founder_offer.sql` lines 167-172 (`ON CONFLICT (key) DO NOTHING` + explanatory comment convention).
**Apply to:** the new retention-config migration.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/03-COUNSEL-BRIEFING.md` | documentation artifact | — | Not a code file — plain Markdown, no rendering/runtime surface, no closest-analog search performed (not applicable per UI-SPEC's own scoping note) |
| `apps/web/test/legal/*.test.ts` (Wave 0 gap files listed in RESEARCH.md) | test | transform (content assertions) | No `test/legal/` directory exists yet; RESEARCH.md names `apps/web/test/purge/purge-delete.test.ts` as the stylistic analog for "hand-rolled-fake" assertions but that file was not read this pass — planner should read it directly when the test-writing plan executes, or request a follow-up pattern pass scoped to `test/purge/` if the plan needs concrete excerpts |

## Metadata

**Analog search scope:** `apps/web/src/app/[locale]/(marketing)/`, `apps/web/src/components/layout/`, `apps/web/messages/`, `supabase/migrations/`, `scripts/purge-test-accounts/`
**Files scanned:** `cgu/page.tsx` (full read), `Footer.tsx` (full read), `FooterClient.tsx` (full read), `fr.json` (Metadata/Footer sections), `scripts/purge-test-accounts/lib.mjs` (first 60 lines), `supabase/migrations/20260812_waitlist_founder_offer.sql` (lines 155-184)
**Pattern extraction date:** 2026-08-14
