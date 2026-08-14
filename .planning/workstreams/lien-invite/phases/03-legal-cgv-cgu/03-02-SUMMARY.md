---
phase: 03-legal-cgv-cgu
plan: 02
subsystem: legal-content
tags: [legal, cgu, privacy-policy, rgpd, consent, i18n, next-intl]
dependency-graph:
  requires:
    - apps/web/src/content/legal/founder-offer.ts (AI_CREDIT_CAP_SENTENCE, DRAFT_REVIEW_BANNER, RETENTION_STATEMENT, WAITLIST_RETENTION_YEARS — plan 01)
    - apps/web/src/content/legal/cgv.ts (CGV_SECTIONS_FR/EN — plan 01)
  provides:
    - "apps/web/src/content/legal/founder-offer.ts — ERASURE_REQUEST_STATEMENT, CONSENT_CHECKBOX_LABEL, COLLECTION_POINT_NOTICE, CONSENT_VERSION"
    - "/[locale]/cgu route — Premium/AI-credits section + draft-review banner"
    - "/[locale]/politique-de-confidentialite route — waitlist retention/erasure section"
  affects:
    - apps/web/test/legal/cgv-cgu-consistency.test.ts
    - apps/web/test/legal/consent-copy.test.ts
tech-stack:
  added: []
  patterns:
    - "shared LocalizedText constant imported (not re-typed) across two documents — the structural mechanism that makes LEGAL-04 drift impossible rather than merely tested-for"
    - "template-literal interpolation of WAITLIST_RETENTION_YEARS into COLLECTION_POINT_NOTICE — the point-of-collection notice cannot state a retention number different from the one the CGV/privacy text and the database use"
key-files:
  created:
    - apps/web/test/legal/cgv-cgu-consistency.test.ts
    - apps/web/test/legal/consent-copy.test.ts
  modified:
    - apps/web/src/content/legal/founder-offer.ts
    - "apps/web/src/app/[locale]/(marketing)/cgu/page.tsx"
    - "apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx"
decisions:
  - "CGU sections renumbered 6-10 -> 7-11 (heading text only, body content byte-identical) to make room for the new '6. Accès Premium et crédits IA' section between the medical-disclaimer section and the personal-data section"
  - "Privacy-policy sections renumbered 7-10 -> 8-11 (heading text only) to insert the new waitlist retention/erasure section directly after the existing retention-duration section, as a specialisation of it rather than a separate, potentially-contradicting block"
  - "No draft-pending-review banner on the privacy-policy addition — the section restates an existing retention period plus a statutory GDPR right, not new contractual terms; the banner stays reserved for CGV/CGU per the UI-SPEC's own signal-preservation note"
  - "COLLECTION_POINT_NOTICE built with template literals interpolating WAITLIST_RETENTION_YEARS rather than a hardcoded '3', so the notice's retention figure and RETENTION_STATEMENT's figure can never independently drift"
metrics:
  duration: ~30min
  completed: 2026-08-14
actuals:
  tokens: 5140
  tasks: 3
  commits: 3
status: complete
---

# Phase 3 Plan 02: CGU/CGV consistency, privacy-policy retention section, frozen consent copy Summary

Made the CGU state the AI-credit cap by importing the CGV's exact sentence rather than re-typing it (LEGAL-04's real failure mode — drift — is now structurally impossible), gave the privacy policy a waitlist-specific retention and erasure section (LEGAL-08/09), and froze the final FR/EN consent-checkbox label and point-of-collection RGPD notice as reviewable constants for Phase 5 (LEGAL-06/07, copy only per D-07).

## What Was Built

**Task 1 — CGU states the identical AI-credit cap, by import not by paraphrase:**
- `cgu/page.tsx` gained a new section 6, "Accès Premium et crédits IA" / "Premium access and AI credits", inserted between the existing medical-disclaimer section and the personal-data section. Its body renders `AI_CREDIT_CAP_SENTENCE[locale === 'en' ? 'en' : 'fr']` imported from `@/content/legal/founder-offer` — the same constant object the CGV renders, not a second copy — plus a locale-branched sentence linking to `/cgv` via `Link` for the founder offer's own terms.
- The existing sections 6 through 10 (Données personnelles, Propriété intellectuelle, Limitation de responsabilité, Modification des CGU, Droit applicable et juridiction) were renumbered to 7 through 11 — heading text only, body prose untouched.
- The draft-pending-review banner (`DRAFT_REVIEW_BANNER`, `border-warning`/`bg-warning-subtle`, `IoWarningOutline` icon) was added immediately after `<h1>`, mirroring plan 01's CGV markup exactly, since the CGU is being materially revised this phase and enters review alongside the CGV.
- Section 9→10's modification clause and the final section's `[A COMPLÉTÉ]` court-designation placeholder were left byte-identical (verified via `git diff` — only their `<h2>` numbers changed), per D-04/Open Question 3: flagged to counsel via plan 03's briefing package, not silently rewritten.
- New `apps/web/test/legal/cgv-cgu-consistency.test.ts` (7 tests) proves LEGAL-04 structurally: the CGV side (joined section text contains `AI_CREDIT_CAP_SENTENCE` verbatim, both locales) plus the CGU side (raw source imports the constant and `@/content/legal/founder-offer`, does NOT contain the first 40 characters of the French sentence as a re-typed literal, contains `DRAFT_REVIEW_BANNER`/`border-warning`, still contains the untouched section-9 clause fragment, and genuinely branches on `locale === 'en'`).

**Task 2 — Privacy policy gains the waitlist retention and erasure section:**
- `ERASURE_REQUEST_STATEMENT` appended to `founder-offer.ts` as a `LocalizedText` holding the verbatim FR/EN erasure-request copy from 03-UI-SPEC.md — the `support@ziko-app.com` channel and the one-month Article 12 GDPR maximum, neither softened nor shortened.
- A new section 7, "Liste d'attente fondateurs — conservation et effacement" / "Founder waitlist — retention and erasure", was inserted immediately after the existing retention-duration section (old section 6), rendering `RETENTION_STATEMENT` and `ERASURE_REQUEST_STATEMENT` by locale, styled identically to its neighbours (`<h2 className="text-xl font-semibold mt-8 mb-3">` / `<p className="text-text leading-relaxed mb-4">`).
- Existing sections 7 through 10 (Vos droits, Sécurité, Cookies, Modifications de la politique) renumbered to 8 through 11 — heading text only.
- No draft-pending-review banner was added to this page — the addition restates an existing retention period and a statutory data-subject right rather than drafting new contractual terms, preserving the banner's signal for CGV/CGU specifically.

**Task 3 — Freeze the consent-checkbox label, collection notice, and consent version for Phase 5:**
- `CONSENT_CHECKBOX_LABEL` (`LocalizedText`) — the verbatim FR/EN opt-in label, worded as a standalone, freely-given, revocable marketing consent per Planet49 (CJEU C-673/17) / GDPR Recital 32. Contains no reference to the CGV, CGU, "Terms," or "conditions générales."
- `COLLECTION_POINT_NOTICE` (`LocalizedText`) — the verbatim FR/EN point-of-collection RGPD notice, built with template literals interpolating `WAITLIST_RETENTION_YEARS` so its retention figure can never independently drift from `RETENTION_STATEMENT`'s. Carries all six CNIL Article 13 minimum fields in one block: controller, purposes, legal basis, recipients, retention duration, data-subject rights with a contact channel.
- `CONSENT_VERSION = 'waitlist-consent-v1'` — the literal Phase 5 writes into `waitlist_signups.consent_version` alongside `consent_given_at` (the columns Phase 1 shipped empty for exactly this purpose, D-15/D-16), with a comment documenting the increment rule.
- All three are plain exported constants — no React, no component code — per D-07's copy-only phase boundary; the checkbox/notice UI itself remains Phase 5's job.
- New `apps/web/test/legal/consent-copy.test.ts` (8 tests): checkbox label non-empty + carries the unsubscribe/désinscrire marker + never bundles consent with CGV/CGU acceptance; collection notice carries all six Article 13 markers per locale and the same retention figure as `WAITLIST_RETENTION_YEARS`; `CONSENT_VERSION` equals `'waitlist-consent-v1'` and matches `/^waitlist-consent-v\d+$/`.

## Verification

- `cd apps/web && npx vitest run test/legal` — 4 files, 34 tests, all green (`cgv-content.test.ts` 11, `cgv-locale.test.ts` 8, `cgv-cgu-consistency.test.ts` 7, `consent-copy.test.ts` 8).
- `cd apps/web && npm run test` — 15 files passed, 1 skipped (DB-gated `waitlist.concurrency.test.ts`, unaffected), 200 tests passed, 4 skipped, no regressions in `test/purge`, `test/actions`, or `safe-next` suites.
- `cd apps/web && npx tsc --noEmit -p tsconfig.json` — zero errors in any file this plan created or modified (`content/legal/founder-offer.ts`, the `cgu` route, the `politique-de-confidentialite` route, `test/legal/`). Pre-existing unrelated errors in `test/purge/*.test.ts` (untouched by this plan, `.mjs` module-type inference) are out of scope, matching plan 01's documented boundary.
- `git diff` on `cgu/page.tsx` confirmed: only the `<h2>` heading numbers of the section-9 modification clause and the final Droit applicable section changed (9→10, 10→11); their paragraph bodies, including the `[A COMPLÉTÉ]` placeholder, are byte-identical to the pre-plan version.

## Deviations from Plan

None — plan executed as written. One clarification made where the plan text was ambiguous: Task 1's action prose said "renumber the four following sections to 7 through 11" (the range spans five sections, 7-8-9-10-11, matching the five sections that actually follow section 5 — Données personnelles through Droit applicable); the range `7 through 11` was followed literally since it unambiguously identifies the correct target numbers, and Task 2's privacy-policy section (which had no explicit renumbering instruction) was numbered the same way — new section takes the next sequential number, later sections shift down — for internal consistency with Task 1's approach and because "heading numbered to follow the existing sequence" (Task 2's own wording) implies the same mechanism.

## Known Stubs

None. `CONSENT_CHECKBOX_LABEL`, `COLLECTION_POINT_NOTICE`, and `CONSENT_VERSION` are intentional copy-only deliverables per D-07 — Phase 5 renders them into the actual waitlist form; this is the documented phase boundary, not an incomplete implementation.

## Self-Check: PASSED

All 5 created/modified files verified present on disk:
- `apps/web/src/content/legal/founder-offer.ts` (FOUND)
- `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` (FOUND)
- `apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx` (FOUND)
- `apps/web/test/legal/cgv-cgu-consistency.test.ts` (FOUND)
- `apps/web/test/legal/consent-copy.test.ts` (FOUND)

All 3 commits verified in `git log`: `7e8a75d` (Task 1), `35e9726` (Task 2), `0ba53cf` (Task 3).
