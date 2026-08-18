---
phase: 03-legal-cgv-cgu
plan: 01
subsystem: legal-content
tags: [legal, cgv, i18n, next-intl, marketing-pages]
dependency-graph:
  requires: []
  provides:
    - apps/web/src/content/legal/founder-offer.ts (LocalizedText clause constants, single source of truth)
    - apps/web/src/content/legal/cgv.ts (CGV_SECTIONS_FR/EN, cgvSections(locale))
    - "/[locale]/cgv route"
  affects:
    - apps/web/src/components/layout/Footer.tsx
    - apps/web/src/components/layout/FooterClient.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
tech-stack:
  added: []
  patterns:
    - "locale-branched plain-string content arrays (LegalSection[]), selected via cgvSections(locale) — no JSX in content module, importable/assertable in a plain node test environment"
    - "shared LocalizedText clause constants module (founder-offer.ts) as single source of truth for clauses that must appear byte-identical across CGV/CGU/Politique"
key-files:
  created:
    - apps/web/src/content/legal/founder-offer.ts
    - apps/web/src/content/legal/cgv.ts
    - "apps/web/src/app/[locale]/(marketing)/cgv/page.tsx"
    - apps/web/test/legal/cgv-locale.test.ts
    - apps/web/test/legal/cgv-content.test.ts
  modified:
    - apps/web/src/components/layout/Footer.tsx
    - apps/web/src/components/layout/FooterClient.tsx
    - apps/web/messages/fr.json
    - apps/web/messages/en.json
decisions:
  - "LANGUAGE_PRECEDENCE_CLAUSE drafted from scratch (not in UI-SPEC's copy table) within D-08's guardrail: French sole authoritative version, English courtesy translation, French controls on discrepancy"
  - "cgv/page.tsx includes the CGU/Politique cross-document link paragraph (originally scoped to Task 2) already in Task 1's tracer commit, since the page shell needed to be final-shape stable before Task 2 only edited content — kept Task 2's own commit scoped to cgv.ts content growth + the new test file"
  - "Section 2 (Identité de l'éditeur) and section 7 (Données personnelles) point to Mentions légales / Politique de confidentialité by name rather than duplicating their content, per Task 2's explicit instruction not to restate"
  - "Section 10 (Droit applicable et litiges) deliberately does not name a specific tribunal or import the CGU's unresolved [A COMPLÉTÉ] placeholder — flagged to counsel structurally by omission, not copied forward"
metrics:
  duration: ~35min
  completed: 2026-08-14
actuals:
  tokens: 7000
  tasks: 2
  commits: 2
status: complete
---

# Phase 3 Plan 01: End-to-end bilingual CGV route Summary

Shipped a real, reachable, genuinely bilingual `/cgv` route — French authoritative, English a
courtesy translation — carrying the milestone's two highest-severity clauses (AI-credit-cap parity
and the "à vie" lifetime-scope + narrow shutdown-only modification clause), gated behind a visible
draft-pending-legal-review banner, with the codebase's existing `/en/cgu`-serves-French-prose defect
deliberately not reproduced.

## What Was Built

**Task 1 (tracer) — end-to-end wiring, one path proven real:**
- `apps/web/src/content/legal/founder-offer.ts` — the shared `LocalizedText` clause-constants
  module: `WAITLIST_RETENTION_YEARS` (3), `DRAFT_REVIEW_BANNER`, `AI_CREDIT_CAP_SENTENCE`,
  `LIFETIME_SCOPE_SENTENCE`, `SHUTDOWN_MODIFICATION_CLAUSE` (with its `[TBD — nombre de jours...]`
  placeholder preserved, not invented), `RETENTION_STATEMENT`, and a self-drafted
  `LANGUAGE_PRECEDENCE_CLAUSE` (D-08).
- `apps/web/src/content/legal/cgv.ts` — `LegalSection` type, `CGV_SECTIONS_FR`/`CGV_SECTIONS_EN`,
  `CGV_LAST_UPDATED`, and the `cgvSections(locale)` selector (EN only for `locale === 'en'`, FR
  otherwise). Task 1 seeded the two load-bearing sections (lifetime scope, AI-credit-cap parity).
- `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` — new route mirroring `cgu/page.tsx`'s
  metadata/shell shape, rendering the draft-pending-review banner (`border-warning`/`bg-warning-subtle`
  tokens per UI-SPEC, not the CGU's `border-primary`/`bg-orange-50` precedent) immediately after
  `<h1>`, then `cgvSections(locale)` mapped into `<section>` blocks — the one place this task
  deliberately diverges from the existing (broken) CGU precedent of hardcoded French JSX.
- `Footer.tsx`/`FooterClient.tsx` — `cgv` prop threaded through, `<AnimatedLink href="/cgv">`
  inserted after the existing `/cgu` link.
- `fr.json`/`en.json` — `Metadata.cgvTitle`/`cgvDescription`, `Footer.cgv` added alongside the
  existing `cgu*`/`terms` keys.
- `apps/web/test/legal/cgv-locale.test.ts` — 8 assertions proving the whole path: section-array
  parity and index-for-index divergence, absence of French markers in the EN branch, presence of
  `'Lifetime Premium'`/`'à vie'`, `cgvSections()` locale selection, raw-source checks that the page
  calls the selector and the footer links to `/cgv`, and non-empty divergent metadata in both
  message files.

**Task 2 — complete ten-section body:**
- Grew `CGV_SECTIONS_FR`/`CGV_SECTIONS_EN` to the full ten-section contract, French drafted first
  and English translated from it (never two independent drafts): (1) Objet et champ d'application,
  (2) Identité de l'éditeur (pointer to Mentions légales), (3) L'offre fondateurs, (4) Portée de
  l'engagement « à vie » (unchanged from Task 1), (5) Fonctionnalités Premium et crédits IA
  (unchanged from Task 1), (6) Évolution et cessation du Service (the only clause permitting the
  founder benefit to end — carries `SHUTDOWN_MODIFICATION_CLAUSE` with its `[TBD]` placeholder
  intact), (7) Données personnelles (retention statement + pointer to Politique de
  confidentialité), (8) Absence de paiement et droit de rétractation, (9) Langue du contrat (D-08
  precedence clause), (10) Droit applicable et litiges — no specific tribunal named, no
  `[A COMPLÉTÉ]` placeholder carried forward from the existing CGU.
- `apps/web/test/legal/cgv-content.test.ts` — 11 assertions covering LEGAL-02 (positive: exact
  substring match of `AI_CREDIT_CAP_SENTENCE` in both locales; negative: no
  illimité/unlimited/uncapped claim anywhere), LEGAL-03 (positive: `LIFETIME_SCOPE_SENTENCE` and
  `SHUTDOWN_MODIFICATION_CLAUSE` present verbatim both locales; negative: no section combines
  `'à tout moment'` with `'sans préavis'`, no `'à sa seule discrétion'`/`'at its sole discretion'`
  anywhere), D-04 (`[TBD` placeholder integrity preserved), D-08 (language-precedence clause
  present both locales).

## Verification

- `cd apps/web && npx vitest run test/legal` — 2 files, 19 tests, all green.
- `cd apps/web && npm run test` — 13 files passed, 1 skipped (DB-gated, unaffected), 185 tests
  passed, 4 skipped, no regressions in `test/purge`, `test/actions`, or `safe-next` suites.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — zero errors in any file this plan created
  or modified (`content/legal/`, the `cgv` route, `Footer.tsx`/`FooterClient.tsx`,
  `test/legal/`). Pre-existing unrelated errors in `test/purge/*.test.ts` (untouched by this plan,
  caused by `.mjs` module type inference) are out of scope per the deviation-rules scope boundary.

## Deviations from Plan

None — plan executed as written. `cgv/page.tsx`'s cross-document links paragraph (originally
scoped to Task 2's action) was written in Task 1's commit since the page shell needed no further
structural changes in Task 2 — only `cgv.ts`'s content array grew. This is documented above under
Decisions rather than as a deviation since it changes no acceptance criterion for either task; both
tasks' acceptance criteria were independently verified green.

## Known Stubs

None. The `[TBD — nombre de jours à confirmer par le conseil]` / `[TBD — day count to be confirmed
by counsel]` placeholder in `SHUTDOWN_MODIFICATION_CLAUSE` is an intentional, plan-mandated
unresolved value (D-04) — not a stub, a flagged open legal question routed to counsel via plan 03's
counsel-briefing package, verified present in both locales by `cgv-content.test.ts`.

## Self-Check: PASSED

All 9 created/modified files verified present on disk. Both commits (`d311614`, `97f5ac0`) verified
in `git log`.
