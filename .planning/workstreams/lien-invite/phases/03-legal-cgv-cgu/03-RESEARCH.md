# Phase 3: Legal — CGV & CGU - Research

**Researched:** 2026-08-14
**Domain:** French consumer-law legal-page drafting (CGV/CGU) inside a Next.js 15 `next-intl` marketing site, plus a manual GDPR-erasure operational mechanism
**Confidence:** MEDIUM-HIGH. Codebase facts (existing page structure, RPC signature, app_config, footer wiring) are HIGH confidence — read directly this session, verbatim quoted below. French consumer-law drafting guidance is inherited from `research/PITFALLS.md` (already HIGH-confidence sourced from Légifrance/CNIL/DGCCRF) and synthesized here into concrete clause shapes; the synthesis itself is `[ASSUMED]` until outside counsel confirms it, which is exactly what D-01/D-02 exist to gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Counsel-review gate**

- **D-01:** This phase follows Phase 2's D-03 pattern: Claude drafts the highest-quality CGV/CGU text
  it can and builds the actual page routes, marked as a draft pending legal review — but the phase's
  final task is a **blocking checkpoint** that does not clear until the user confirms real outside
  counsel has reviewed and approved. Phase 3 is not "complete" on drafting alone; LEGAL-05's "reviewed
  by counsel before publish" is binding on the phase's own completion, not just on Phase 4's start.
  — **Reversibility:** costly — reverting to "publish now, review later" after this phase closes means
  re-opening a phase already marked complete and re-litigating whatever went live in the meantime.

- **D-02:** Deliver a **counsel-briefing package** alongside the draft text: a short document pulling
  together every open question `research/PITFALLS.md` already flagged for lawyer review — the "à vie"
  scope under `pratique commerciale trompeuse` (Pitfall 7), the black-list/grey-list line on the
  modification clause (Pitfall 8), and the free-vs-paid lifetime-benefit consumer-law nuance (Pitfall
  8) — so the user can hand it to any lawyer without re-deriving the open questions themselves.

**Drafting content** (provenance note: D-03/D-04 came from a checkpoint authoritative over this
session's independently-derived, less-specific version of the same decisions)

- **D-03:** The "à vie" clause is scoped to **the life of the Service**, not the person, per
  `research/PITFALLS.md` Pitfall 7: "l'avantage Premium à vie est valable pour toute la durée
  d'exploitation du Service par [Company]." **Premium is frozen at the offer date's feature set, with
  future additions extended to founders only at the company's discretion** (adding, not taking away —
  the exact checkpoint wording, narrower than "may or may not extend"). **The AI-credit cap is stated
  explicitly in the CGV with founder parity to any other premium user, and the cap value itself may
  evolve — but only as a platform-wide policy change that never singles out founders specifically.**
  No "premium = unlimited AI" implication anywhere, including marketing copy.

- **D-04:** No unconditional unilateral-modification clause (Pitfall 8's black-list trap). Modification
  rights follow the grey-list pattern: **narrow and notice-bearing** — genuine service-wide shutdown
  only, with an advance notice period and a data-export commitment, never a way to quietly remove the
  founder benefit while the rest of the app continues.

**Bilingual governing language**

- **D-08:** **French governs legally; English is a professional courtesy translation** with an
  explicit precedence clause stating French controls in case of discrepancy. Ziko is a French company
  and Code de la consommation is the applicable law. French is drafted first; English follows as
  translation, not parallel independent drafting.
  — **Reversibility:** costly — switching to dual-authoritative text after publish means re-verifying
  the two versions say the same thing with no gaps, effectively a re-draft.

**Retention & erasure (LEGAL-08/09)**

- **D-05:** Retention period is **3 years from last contact** — matches CNIL's NS-048 prospect-data
  ceiling. Stated explicitly in the collection-point notice and the CGV/privacy text.
  — **Reversibility:** reversible — a documented policy value, changeable with a new decision record.

- **D-06:** Erasure requests go through **email (`support@ziko-app.com`) with a manual trigger** — the
  privacy notice states the right and the contact channel; a human runs Phase 1's
  `anonymize_waitlist_signup()` RPC on request. No self-service UI is built this milestone.
  — **Reversibility:** reversible — a self-service link can be added later without touching this
  phase's text or the anonymization mechanism itself.

**Scope boundary vs. Phase 5**

- **D-07:** LEGAL-06/07 (consent checkbox + collection-point notice) are satisfied by Phase 3
  delivering **final FR+EN copy only** — the checkbox label text and the notice text, as reviewable
  content. The actual form UI that renders them doesn't exist until Phase 5 builds the waitlist page;
  wiring the copy in is Phase 5's job.
  — **Reversibility:** reversible — a boundary-placement decision, not a one-way door.

### Claude's Discretion

- Exact page routes/URL structure for the CGV/CGU pages under `apps/web` (follow existing legal-page
  conventions already in the codebase — Mentions légales, Politique de confidentialité, CGU already
  exist per `.planning/PROJECT.md`'s v1.0 shipped log).
- Exact wording within the D-03/D-04 guardrails — the research gives the shape of correct language,
  not verbatim clauses.
- Format and structure of the counsel-briefing document (D-02).
- How the "draft pending review" state is visually/textually marked on the live pages before
  counsel approval clears the checkpoint.

### Deferred Ideas (OUT OF SCOPE)

- Self-service erasure link in a confirmation email (ENG-02/ENG-01) — v2, per REQUIREMENTS.md.
- The waitlist form's actual checkbox/notice UI — Phase 5, per D-07.
- The credit-gate code change itself and its feature-flag activation — Phase 4 and Phase 6
  respectively; this phase only gates their start via LEGAL-05.
</user_constraints>

## Summary

Phase 3 is a content-and-small-code phase, not a feature-build phase. The heavy lifting is legal drafting (FR authoritative, EN courtesy translation) constrained by two locked decisions (D-03 "à vie" scope, D-04 no black-list modification clause) that this research turns into concrete clause skeletons. The codebase already has three live legal pages (`cgu`, `mentions-legales`, `politique-de-confidentialite`) under `apps/web/src/app/[locale]/(marketing)/` that establish the routing/metadata pattern to copy — **but their body text is hardcoded French JSX with zero locale branching**, which is a broken precedent for LEGAL-01's FR+EN requirement and must NOT be copied as-is; the planner needs a real per-locale content strategy. Phase 1 already built every backend primitive Phase 3 needs: the `anonymize_waitlist_signup(p_email TEXT)` RPC (service_role only, no HTTP surface yet), the `app_config` key/value table (deny-all RLS, one row: `waitlist_reveal_threshold`), and the `consent_given_at`/`consent_version` columns waiting for Phase 3 to define their values. Phase 3 must add exactly one new migration (never edit `20260812_waitlist_founder_offer.sql`) to seed a retention-period `app_config` row, and should follow Phase 2's proven `scripts/<name>/*.mjs` + CLI-flag convention if it builds a manual erasure-trigger script rather than documenting a raw-SQL runbook.

**Primary recommendation:** Build the CGV as a new `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` route mirroring `cgu/page.tsx`'s metadata/layout shape exactly, but render body content from two explicit locale-branched content blocks (not next-intl message keys — the prose is too long and structurally rich for flat key/value translation) so FR and EN are both genuinely present; revise `cgu/page.tsx` section on data/premium to state the AI-credit cap identically to the CGV; ship a "draft — pending legal review" banner using the exact `border-2 border-primary bg-orange-50` warning-box pattern already proven in `cgu/page.tsx`'s medical-disclaimer section; and gate phase completion on a `checkpoint:human-verify` task per D-01, not on the drafting task.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CGV/CGU page content (FR+EN) | Frontend Server (SSR) | — | Statically rendered `next-intl` marketing pages, same tier as existing `cgu`/`mentions-legales` pages |
| "Draft pending review" banner | Frontend Server (SSR) | — | Presentational JSX inside the same page component, no new state |
| Consent-checkbox / collection-notice copy | Frontend Server (SSR) | — | Copy-only deliverable per D-07; the actual checkbox component is Phase 5's job |
| Retention-period value | Database / Storage | — | `app_config` row, written via a new SQL migration (D-16), read back by `get_waitlist_founder_status()`-style RPCs if ever needed, but primarily just documented in copy |
| Erasure mechanism trigger | Database / Storage (RPC) | Operational script (Node/`.mjs`) | `anonymize_waitlist_signup()` already exists in the DB tier (Phase 1); D-06 only needs a human-triggered *invocation* path, which is a thin operational script, not an API route |
| Counsel-briefing package | — (documentation artifact) | — | Not an architectural tier — a Markdown document under the phase directory, consumed by a human, not by running code |
| Counsel-approval checkpoint | — (process gate) | — | `checkpoint:human-verify`-style blocking task in the plan, not a code artifact |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-intl` | `^4.8.3` [VERIFIED: apps/web/package.json:27] | FR/EN `[locale]` routing, `getTranslations`/`setRequestLocale` | Already the house i18n library; every existing legal page uses it |
| `next` | 15.5 (Turbopack) per CLAUDE.md | App Router pages under `(marketing)` | Existing convention |
| `@supabase/supabase-js` | already a dependency (used by `scripts/purge-test-accounts/lib.mjs` and `apps/web/src/lib/supabase/admin.ts`) | Admin client for a manual erasure-trigger script, if built | Matches Phase 1/2 precedent exactly, no new package |

No new npm packages are required for this phase — see Package Legitimacy Audit below.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | already a dependency (`FooterClient.tsx:4`) [VERIFIED: apps/web/src/components/layout/FooterClient.tsx:4] | Footer link hover animation | Only if a new CGV footer link should match the existing `AnimatedLink` treatment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Locale-branched JSX content blocks | `next-intl` message-key-per-paragraph | Message keys work for short strings (titles, labels, the CGU's ~10 section headers) but become unwieldy for dozens of long legal paragraphs with nested lists and emphasis — every existing legal page in this codebase already avoids this by hardcoding prose directly in JSX, just without the locale branch this phase must add |
| A standalone `.mjs` erasure script (Phase 2 pattern) | A one-off `psql`/Supabase SQL Editor runbook calling the RPC directly | A raw SQL Editor call works (the RPC is `SECURITY DEFINER`, callable by any role with sufficient database access) but breaks the "written, reviewable procedure" spirit PITFALLS.md Pitfall 13 established for this exact codebase; a thin script also produces an audit log the way `delete.mjs`'s `writeDeleteLog` does |

**Installation:** None — no new packages.

**Version verification:** `next-intl` version confirmed by direct read of `apps/web/package.json:27` this session — `"next-intl": "^4.8.3"`. No other new-package version claims are made in this research.

## Package Legitimacy Audit

No external packages are being newly installed by this phase — every dependency needed (`next-intl`, `@supabase/supabase-js`, `framer-motion`) is already present in `apps/web/package.json` and was verified there, not newly resolved. The Package Legitimacy Gate therefore does not apply; there is nothing to check against the registry.

**Packages removed due to [SLOP] verdict:** none — no new packages proposed.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Visitor (FR or EN)
        │
        ▼
 /[locale]/cgv, /[locale]/cgu, /[locale]/politique-de-confidentialite
        │  (Next.js App Router — SSR/static, no client fetch)
        ▼
 page.tsx: setRequestLocale(locale) → locale-branched content block
        │                                   │
        │ FR content (authoritative)        │ EN content (courtesy translation)
        └──────────────┬────────────────────┘
                        ▼
        "Draft — pending legal review" banner rendered inline
        (visible to every visitor until the counsel-approval
         checkpoint clears — this is a copy/JSX flag, not a
         feature flag; nothing server-side reads its state)

 ── separate, human-operated path (not visitor-facing) ──

 Support agent receives an erasure request at support@ziko-app.com
        │
        ▼
 node scripts/waitlist-erasure/<script>.mjs --email <addr> --confirm
        │  (mirrors scripts/purge-test-accounts/*.mjs: own admin client,
        │   own CLI flag gate, own audit-log write)
        ▼
 supabase.rpc('anonymize_waitlist_signup', { p_email: <addr> })
        │  (SECURITY DEFINER, service_role only — Phase 1, migration
        │   20260812_waitlist_founder_offer.sql:217-241)
        ▼
 waitlist_signups row: email/email_normalized/utm_* blanked,
 anonymized_at set, founder_rank + is_founder UNTOUCHED
 (keeps FOND-04 monotonicity — Phase 1 D-07)

 ── retention parameter, written once by this phase ──

 New migration (dated, e.g. 20260815_waitlist_retention_config.sql)
        │
        ▼
 INSERT INTO app_config (key, value)
   VALUES ('waitlist_retention_years', '3')
   ON CONFLICT (key) DO NOTHING;
        │  (same table, same seed-idiom as 'waitlist_reveal_threshold' —
        │   20260812_waitlist_founder_offer.sql:170-172)
        ▼
 Value quoted directly into the CGV/privacy-notice retention
 sentence (D-05: "3 years from last contact") — code and copy
 must state the same number.
```

### Recommended Project Structure
```
apps/web/src/app/[locale]/(marketing)/
├── cgu/page.tsx                     # existing — revise §3/§5-adjacent premium/AI-credit language for consistency (LEGAL-04)
├── cgv/page.tsx                     # NEW — CGV page (LEGAL-01/02/03)
├── mentions-legales/page.tsx        # existing — untouched by this phase
└── politique-de-confidentialite/page.tsx  # existing — add waitlist-specific retention/erasure section (LEGAL-08/09)

apps/web/src/components/layout/
├── Footer.tsx                        # add cgv translation prop
└── FooterClient.tsx                  # add AnimatedLink href="/cgv"

apps/web/messages/
├── fr.json                           # Metadata.cgvTitle/cgvDescription, Footer.cgv
└── en.json                           # same keys, English values

supabase/migrations/
└── <NEW dated file>                  # app_config retention-period seed row (D-16)

scripts/waitlist-erasure/             # OPTIONAL, Claude's discretion (D-06 only requires
├── run.mjs                           # "a human runs the RPC" — a thin script is the
└── (mirrors purge-test-accounts/ CLI-flag + audit-log shape)  # codebase-consistent way to do that manually

.planning/workstreams/lien-invite/phases/03-legal-cgv-cgu/
└── 03-COUNSEL-BRIEFING.md            # NEW — the D-02 deliverable, not shipped to apps/web
```

### Pattern 1: Existing legal-page metadata/layout shape (copy exactly for CGV)
**What:** Every existing legal page follows an identical `generateMetadata` + `setRequestLocale` + `<main className="max-w-screen-xl mx-auto px-8 py-16 space-y-8">` shape, with `alternates.languages` pointing at both locale paths.
**When to use:** For the new `cgv/page.tsx` route, verbatim.
**Example — read directly from the codebase:**
```tsx
// Source: apps/web/src/app/[locale]/(marketing)/cgu/page.tsx:1-34
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  return {
    title: t('cguTitle'),
    description: t('cguDescription'),
    alternates: {
      canonical: `/${locale}/cgu`,
      languages: { fr: '/fr/cgu', en: '/en/cgu' },
    },
    openGraph: { /* ...same shape... */ },
    twitter: { /* ...same shape... */ },
  }
}
```
For CGV, this becomes `namespace: 'Metadata'`, keys `cgvTitle`/`cgvDescription`, `canonical: /${locale}/cgv`, `languages: { fr: '/fr/cgv', en: '/en/cgv' }`.

### Pattern 2: The critical gap — body content has NO locale branching today
**What:** `cgu/page.tsx`, `mentions-legales/page.tsx`, and `politique-de-confidentialite/page.tsx` all call `getTranslations({ locale, namespace: 'Metadata' })` for the page `<title>`/description only. The entire visible body — every `<section>`, every `<p>` — is French JSX with **zero** `t()` calls and **zero** `locale === 'en'` branches. [VERIFIED: apps/web/src/app/[locale]/(marketing)/cgu/page.tsx:36-172 — full file read, confirms no locale-conditional rendering or translation namespace call for body text; same pattern confirmed in politique-de-confidentialite/page.tsx:36-228 and mentions-legales/page.tsx:36-122]. Visiting `/en/cgu` in production today renders the French contract text under an English `<title>`.
**Why this matters:** LEGAL-01 explicitly requires the CGV "en français et en anglais," and D-08 requires French to be drafted first with English as a genuine (not cosmetic) translation. Copying the existing pattern verbatim would silently violate LEGAL-01.
**How to avoid:** In the new `cgv/page.tsx` (and in any CGU section touched for LEGAL-04), branch the body content on `locale` — e.g. `const content = locale === 'en' ? enContent : frContent` where each is a local component/array of JSX blocks — and render the chosen branch. Do not attempt to translate legal prose through granular `next-intl` message keys; the existing precedent already avoids this for the same reason (long-form structured legal text).

### Pattern 3: "Draft — pending review" banner — reuse the CGU's own warning-box pattern
**What:** `cgu/page.tsx` §5 already has a public-page, non-hidden, high-visibility warning box for the AI medical disclaimer.
**When to use:** As the visual/textual template for D-01's "draft pending legal review" marking — it is proven to render on a live public legal page in this exact codebase.
**Example:**
```tsx
// Source: apps/web/src/app/[locale]/(marketing)/cgu/page.tsx:97-120 (verbatim structure, different copy)
<section>
  <div className="rounded-lg border-2 border-primary bg-orange-50 p-6 space-y-3">
    <p className="font-bold text-text text-lg">
      &#9888; [FR: Document en cours de relecture juridique]
    </p>
    <p className="text-text leading-relaxed">
      [FR: Ce texte a été rédigé mais n'a pas encore été validé par un avocat.
      Il peut être modifié avant sa version définitive.]
    </p>
  </div>
</section>
```
This satisfies the CONTEXT.md `<specifics>` note that the marking "should be honest and visible, not a hidden flag" — it is a real, styled block at the top of the page, not an HTML comment or a CSS class only Claude would notice.

### Pattern 4: Consent-proof columns already exist — Phase 3 only supplies the values
**What:** `waitlist_signups.consent_given_at` and `.consent_version` [VERIFIED: supabase/migrations/20260812_waitlist_founder_offer.sql:24-25 — `consent_given_at  TIMESTAMPTZ,               -- D-15, filled by phase 3/5` and `consent_version   TEXT,                      -- D-15, filled by phase 3/5`] were shipped empty in Phase 1. Phase 3's job (per D-07 and Phase 1's D-15) is to define what `consent_version` should *contain* — e.g. a stable string like `"waitlist-consent-v1"` or a date-stamped `"2026-08-15"` identifying which exact checkbox/notice copy version a signup consented to — so Phase 5 has a concrete literal to write when it wires the form.
**When to use:** Document this value alongside the D-07 checkbox/notice copy deliverable; do not leave it implicit.

### Pattern 5: Manual erasure trigger — mirror Phase 2's script convention, not a new API route
**What:** Phase 2 already established the codebase's convention for a human-run, credential-gated, one-off operational script: `scripts/<feature>/*.mjs`, own `createClient(...)` admin client (not importing `apps/web/src/lib/supabase/admin.ts`, which is guarded by `import 'server-only'` and cannot run in a plain Node script), explicit `--confirm`-style CLI flag, and a written audit-log output.
**Example (verified structure, not copied verbatim):**
```js
// Source: scripts/purge-test-accounts/lib.mjs:1-40 (structure)
import { createClient } from '@supabase/supabase-js';
// own admin client — mirrors, does not import, apps/web/src/lib/supabase/admin.ts
// (that file has `import 'server-only'` at its head and cannot run outside Next.js)
```
A Phase 3 erasure script would call `supabase.rpc('anonymize_waitlist_signup', { p_email })` instead of `deleteUser`, but should follow the same "own client, own CLI gate" shape. **This is Claude's discretion** per the CONTEXT.md — a documented raw-SQL runbook is also a valid, lighter-weight option since D-06 only asks for "a human runs the RPC," not necessarily a maintained CLI tool.

### Anti-Patterns to Avoid
- **Promising "premium = unlimited AI" anywhere in CGV/CGU/marketing copy:** directly contradicts D-03 and the CGU's eventual capped-credit language (Pitfall 7).
- **An unconditional unilateral-modification clause** (`"à tout moment," "sans préavis," "à sa seule discrétion"` attached to *removing* an already-granted benefit): void by law under Code de la consommation Art. R.212-1 (Pitfall 8). Note the **existing** `cgu/page.tsx` §9 already reads: *"Ziko se réserve le droit de modifier les présentes CGU à tout moment. Les modifications seront notifiées aux utilisateurs par e-mail ou via l'application avec un préavis raisonnable."* [VERIFIED: apps/web/src/app/[locale]/(marketing)/cgu/page.tsx:153-158] — this clause is about amending the *CGU itself* (a normal, near-universal ToS reservation, paired with a "reasonable notice" qualifier) and is materially different from a clause that would let Ziko revoke the founder Premium benefit specifically. It should **not** be read as license to write an equally broad clause for the founder-offer scope; flag it to counsel alongside the new CGV language for a consistency check, since both documents must reconcile without contradiction (LEGAL-04).
- **Translating the CGV/CGU through per-paragraph `next-intl` keys:** unwieldy for long-form legal prose; use locale-branched JSX blocks instead (Pattern 2).
- **Hiding the "draft pending review" state in a code comment or a class name with no visible text:** contradicts the explicit CONTEXT.md `<specifics>` instruction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RGPD Article 13 point-of-collection notice structure | A bespoke notice format | The CNIL-documented minimum field set: responsable de traitement, finalités, base légale, destinataires, durée de conservation, droits des personnes [CITED: cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence] | This is a well-defined regulatory checklist, not a creative-writing exercise — missing a field is a compliance gap, not a style choice |
| Erasure execution | A new admin API route or UI | The already-built `anonymize_waitlist_signup()` RPC (Phase 1) + a thin manual-trigger script mirroring Phase 2's pattern | The mechanism already exists and is tested; building a second path duplicates work Phase 1 already did and increases surface area for a milestone explicitly deferring self-service erasure to v2 |
| Consent-version tracking | An ad hoc string decided at Phase 5 implementation time | A version identifier defined now, in Phase 3, alongside the copy it tags (Pattern 4) | The column already exists waiting for a value; deciding it later means Phase 5 either invents a value with no traceability to which copy was live, or has to re-open Phase 3's artifacts |

**Key insight:** Almost nothing in this phase should be "built" in the sense of new abstractions — the database mechanism, the routing pattern, and the RGPD notice checklist are all already fixed by prior phases or by regulatory text. The actual creative/judgment work is entirely in the legal prose itself, which is exactly why D-01 puts a human counsel gate on it rather than treating drafting as sufficient completion.

## Common Pitfalls

### Pitfall: Copying the existing legal pages' "French-only body, English-only metadata" pattern
**What goes wrong:** The new CGV (and any CGU edits) ship with correct `<title>`/OG metadata in English but the actual contract text still in French at `/en/cgv`.
**Why it happens:** It is the literal, only precedent in this codebase (see Pattern 2) — following existing convention is usually the safe default, but not here.
**How to avoid:** Explicitly verify, page by page, that visiting `/en/cgv` and `/en/cgu` shows English prose, not just an English title.
**Warning signs:** A `git diff` on the new page shows no `locale === 'en'` branch or second content block.

### Pitfall: Retention duration stated in copy but never written to `app_config`
**What goes wrong:** The CGV/privacy text says "3 years" but no migration ever inserts the corresponding `app_config` row, leaving Phase 1's D-16 promise ("phase 3 writes the retention duration into app_config") unfulfilled and no machine-readable source of truth for a future cleanup job.
**Why it happens:** The retention statement feels purely like copy work; the database write is easy to forget since nothing currently *reads* that key.
**How to avoid:** Include the new migration (`INSERT INTO app_config ... ON CONFLICT (key) DO NOTHING`) as an explicit task, not an afterthought to the copy task.
**Warning signs:** `grep -r "waitlist_retention" supabase/migrations/` returns nothing after the phase is marked complete.

### Pitfall: CGV and CGU describe the AI-credit cap in subtly different terms
**What goes wrong:** LEGAL-04 requires the CGU to be "cohérentes avec les CGV sur le plafond de crédits IA" (identical, per CONTEXT.md's success criterion 2: "no contradiction between the two documents"), but drafting them at different times/passes introduces language drift (e.g. CGV says "plafond mensuel," CGU says "quota" with no explicit monthly cadence).
**Why it happens:** Two separate documents, drafted separately, reviewed separately.
**How to avoid:** Draft the exact AI-credit-cap sentence once, then paste the identical sentence (translated identically) into both documents rather than paraphrasing between them.
**Warning signs:** A word-diff between the CGV's credit-cap paragraph and the CGU's credit-cap paragraph shows more than a cross-reference difference.

### Pitfall: The counsel-briefing package re-derives open questions instead of pulling them verbatim
**What goes wrong:** D-02 explicitly asks for a package "so the user can hand it to any lawyer without re-deriving the open questions themselves" — if the briefing summarizes PITFALLS.md loosely instead of quoting its "Flag for lawyer review" call-outs directly, counsel gets a weaker starting point.
**How to avoid:** Pull the four flagged uncertainty items verbatim from `research/PITFALLS.md`'s closing "Uncertainty flagged for lawyer review" list (Pitfalls 4, 7, 8, 9) plus the three items in `REQUIREMENTS.md`'s "Lawyer Review Required" section, and organize the briefing document around exactly those seven items, each with its own drafted-clause excerpt for counsel to react to.

## Code Examples

### Existing metadata pattern, adaptable to CGV
```tsx
// Source: apps/web/src/app/[locale]/(marketing)/cgu/page.tsx:7-34 (read in full this session)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    title: t('cguTitle'),
    description: t('cguDescription'),
    alternates: {
      canonical: `/${locale}/cgu`,
      languages: { fr: '/fr/cgu', en: '/en/cgu' },
    },
    // openGraph / twitter blocks follow the same shape
  }
}
```

### Footer wiring for a new legal page
```tsx
// Source: apps/web/src/components/layout/FooterClient.tsx:28-48 (read in full this session)
export function FooterClient({ copyright, legal, privacy, terms, deleteAccount }: Props) {
  return (
    <footer className="bg-white">
      <div className="h-px w-full bg-gradient-to-r from-primary/20 to-transparent" />
      <div className="max-w-screen-xl mx-auto px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-primary">ZIKO</span>
          <p className="text-sm text-muted">{copyright}</p>
        </div>
        <nav className="flex flex-wrap gap-6 justify-center">
          <AnimatedLink href="/mentions-legales">{legal}</AnimatedLink>
          <AnimatedLink href="/politique-de-confidentialite">{privacy}</AnimatedLink>
          <AnimatedLink href="/cgu">{terms}</AnimatedLink>
          {/* NEW: <AnimatedLink href="/cgv">{cgv}</AnimatedLink> */}
          <Link href="/supprimer-mon-compte" className="text-sm text-muted hover:text-text transition-colors">
            {deleteAccount}
          </Link>
        </nav>
      </div>
    </footer>
  )
}
```
`Footer.tsx` [VERIFIED: apps/web/src/components/layout/Footer.tsx:1-15] would need a `cgv={t('cgv')}` prop added and passed through, with a matching `Footer.cgv` key added to `messages/fr.json`/`en.json`.

### The RPC this phase's erasure mechanism calls
```sql
-- Source: supabase/migrations/20260812_waitlist_founder_offer.sql:217-241 (read in full this session)
CREATE OR REPLACE FUNCTION public.anonymize_waitlist_signup(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_normalized TEXT := public.normalize_waitlist_email(p_email);
  v_updated    INTEGER;
BEGIN
  UPDATE public.waitlist_signups
  SET email            = 'anonymized+' || id::text || '@erased.invalid',
      email_normalized = 'anonymized-' || id::text,
      utm_source       = NULL,
      utm_campaign     = NULL,
      anonymized_at    = NOW()
  WHERE email_normalized = v_normalized AND anonymized_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anonymize_waitlist_signup(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_waitlist_signup(TEXT) TO service_role;
```
Signature: `anonymize_waitlist_signup(p_email TEXT) RETURNS BOOLEAN`. Callable only with `service_role` credentials — there is no `authenticated`/`anon` grant, confirming D-06's premise that this can only be invoked by a human with backend/admin credentials, never by an end user directly.

### The app_config seed pattern to replicate for the retention value
```sql
-- Source: supabase/migrations/20260812_waitlist_founder_offer.sql:159-172 (read in full this session)
CREATE TABLE IF NOT EXISTS public.app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- Deliberately ZERO CREATE POLICY statements, exactly like waitlist_signups (DATA-05).

INSERT INTO public.app_config (key, value)
VALUES ('waitlist_reveal_threshold', '30')
ON CONFLICT (key) DO NOTHING;
```
Phase 3's new migration should follow this exact shape for the retention value, e.g. `INSERT INTO public.app_config (key, value) VALUES ('waitlist_retention_years', '3') ON CONFLICT (key) DO NOTHING;` — same table, same `ON CONFLICT DO NOTHING` idempotency guard, in a **new** dated migration file, never appended to `20260812_waitlist_founder_offer.sql`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Pre-ticked or bundled consent checkboxes | Unchecked, standalone consent action, separate from the submit CTA | CJEU *Planet49* (C-673/17), 1 Oct 2019, and GDPR Recital 32 — long-settled, not a recent shift | Directly governs the checkbox copy this phase drafts (LEGAL-06) |
| Footer-only privacy-policy link as sufficient RGPD notice | Point-of-collection notice required at the exact moment of data capture (Art. 13 GDPR) | Standing GDPR requirement, reaffirmed in current CNIL guidance | Governs LEGAL-07's copy; footer link alone is insufficient |

**Deprecated/outdated:** None specific to this phase's technology stack — the legal-drafting guidance here is stable, settled law/case-law, not a fast-moving technical area.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Locale-branched JSX content blocks (rather than granular `next-intl` message keys) is the right approach for long-form CGV/CGU prose | Architecture Patterns, Pattern 2 | Low — this is an implementation-detail recommendation, not a legal claim; either approach can satisfy LEGAL-01 if genuinely bilingual, this is Claude's Discretion territory already flagged in CONTEXT.md |
| A2 | A retention-period `app_config` key named `waitlist_retention_years` (exact name not fixed anywhere) | Architecture diagram, Code Examples | Low — Phase 1's D-16 only commits to "phase 3 writes the retention duration into app_config," not a specific key name; the planner should pick a name and this research's suggested name is a placeholder, not a binding decision |
| A3 | A standalone `.mjs` script (vs. a documented raw-SQL runbook) is the better choice for the manual erasure trigger | Pattern 5, Don't Hand-Roll | Low-Medium — CONTEXT.md explicitly leaves this to Claude's Discretion; if the planner picks the lighter-weight runbook option instead, no requirement is violated, but the script option is codebase-consistent with Phase 2's established pattern |
| A4 | Concrete clause skeletons synthesized here (e.g. the sample "draft pending review" banner text, the AI-credit-cap parity phrasing) are legally sound in the shape PITFALLS.md's Pitfalls 7/8 describe | Architecture Patterns, Anti-Patterns | **HIGH** — this is exactly the category of claim D-01's blocking counsel-review checkpoint exists to catch; must not be treated as legally final without outside counsel sign-off |
| A5 | The existing CGU §9 modification clause ("Ziko se réserve le droit de modifier... à tout moment... avec un préavis raisonnable") is defensible as a normal ToS-amendment clause distinct from a founder-benefit-revocation clause | Anti-Patterns to Avoid | Medium — this is a reasoned distinction, not a settled ruling; flagged into the counsel-briefing package rather than asserted as fact |

## Open Questions

1. **Exact `app_config` key name for the retention period**
   - What we know: Phase 1's D-16 commits the mechanism ("phase 3 writes the retention duration into app_config") but not a specific key string.
   - What's unclear: Whether any downstream phase (e.g. a future cleanup cron, out of this milestone's v1 scope) will read this key by name, which would make the name load-bearing.
   - Recommendation: Planner picks a clear, descriptive key (e.g. `waitlist_retention_years`) and documents it in the plan's key-decisions; low cost to rename later since nothing in v1 reads it back programmatically.

2. **Whether the manual erasure trigger should be a script or a runbook**
   - What we know: D-06 requires only that "a human runs Phase 1's `anonymize_waitlist_signup()` RPC on request" — CONTEXT.md leaves the mechanism to Claude's Discretion.
   - What's unclear: Whether the two-person-rule rigor Phase 2 applied to the (irreversible, high-stakes) account-purge script is proportionate for a single-row, non-destructive (anonymizing, not deleting) RPC call.
   - Recommendation: A lighter-weight runbook (documented SQL/RPC invocation via Supabase's dashboard SQL editor or a one-file script, no export/dry-run/two-person ceremony) is proportionate given the operation is a single targeted UPDATE with no cascade risk — but note this recommendation is Claude's reasoning, not a locked decision, and CONTEXT.md's `<specifics>` doesn't weigh in on this specific question.

3. **Whether the existing CGU §9 unilateral-modification clause itself needs redrafting**
   - What we know: LEGAL-04 requires CGU/CGV consistency on the AI-credit-cap point specifically; D-04 constrains the *new* founder-offer language in the CGV.
   - What's unclear: Whether the pre-existing, general CGU amendment clause (unrelated to the founder offer, present since v1.0) also needs the grey-list-pattern narrowing D-04 describes, or whether it's acceptable as a standard ToS-amendment clause because it doesn't single out revoking a specific granted benefit.
   - Recommendation: Include this clause in the counsel-briefing package's review list even though CONTEXT.md's decisions don't explicitly scope it in — counsel reviewing CGU/CGV consistency will read it regardless, and flagging it proactively is cheaper than a follow-up question mid-review.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEGAL-01 | Une page CGV publique existe, en français et en anglais | New `apps/web/src/app/[locale]/(marketing)/cgv/page.tsx` following Pattern 1 (metadata shape) with genuine locale-branched body content (Pattern 2 — critical gap flagged) |
| LEGAL-02 | Les CGV énoncent que le premium ouvre toutes les fonctionnalités mais que les crédits IA restent plafonnés | D-03's exact drafting guidance (parity cap language, no "unlimited AI" claim) — Anti-Patterns section |
| LEGAL-03 | Les CGV précisent la portée de l'engagement « à vie » sans se réserver un droit de modification unilatérale illimité | D-03/D-04 synthesized into concrete clause shape — Architecture Patterns, Anti-Patterns; underlying legal basis in inherited PITFALLS.md Pitfalls 7/8 |
| LEGAL-04 | Les CGU sont révisées pour être cohérentes avec les CGV sur le plafond de crédits IA | Pitfall: "CGV and CGU describe the cap in subtly different terms" — draft once, paste identically; existing CGU §9 flagged as a related but distinct clause for counsel (Open Question 3) |
| LEGAL-05 | Le texte légal est en ligne avant ou en même temps que l'activation du code, jamais après | Process/sequencing constraint (D-01's blocking checkpoint), not a code artifact — enforced by phase-completion gating, not by anything in this research |
| LEGAL-06 | Case de consentement décochée par défaut, dissociée du bouton d'inscription | Copy-only deliverable per D-07; State of the Art section (Planet49/Recital 32) grounds the requirement; UI itself is Phase 5 |
| LEGAL-07 | Mention RGPD au point de collecte, pas seulement en pied de page | Don't Hand-Roll section — CNIL's Article 13 minimum field checklist; copy-only per D-07 |
| LEGAL-08 | Durée de conservation définie et documentée | D-05's "3 years" value; Code Examples section shows the exact `app_config` seed pattern to replicate in a new migration |
| LEGAL-09 | Un inscrit peut demander l'effacement et l'obtenir | Pattern 5 — `anonymize_waitlist_signup()` RPC already exists (Phase 1); this phase documents/builds the manual trigger path only |
</phase_requirements>

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` (for applying the new retention-config migration, and for any erasure script if built) | New migration; erasure script | ✗ (not available in this research/planning session, per Phase 1/2's already-documented gap) | — | CI applies migrations automatically on push to `main` when `supabase/migrations/` changes (per CLAUDE.md); the migration itself doesn't need local execution to be authored and committed |
| Outside legal counsel (human, not a tool) | D-01's blocking checkpoint | ✗ — external to this session by design | — | None — this is the literal gate the phase's final task exists to enforce; no technical fallback is appropriate |

**Missing dependencies with no fallback:**
- Outside counsel review — by design, this cannot and should not be worked around; it is the phase's own completion criterion (D-01).

**Missing dependencies with fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` — the new migration can be authored, committed, and applied automatically by CI on merge to `main`, matching how Phase 1's migration was handled.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest, `apps/web/vitest.config.ts` [VERIFIED: apps/web/package.json — `"test": "vitest run --passWithNoTests"`] |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run test/legal` (proposed new directory, mirrors `test/purge`, `test/actions`) |
| Full suite command | `cd apps/web && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEGAL-01 | `/fr/cgv` and `/en/cgv` both render, EN page contains English-language markers not present in FR page | unit/render (React Testing Library or plain string-assertion on exported content constants) | `npx vitest run test/legal/cgv-locale.test.ts -x` | ❌ Wave 0 |
| LEGAL-02 | CGV text contains the AI-credit-cap sentence; does NOT contain "illimité"/"unlimited" near "IA"/"AI" | content-assertion (grep-style string test over the exported content constant, not full render) | `npx vitest run test/legal/cgv-content.test.ts -x` | ❌ Wave 0 |
| LEGAL-03 | CGV "à vie" section contains the service-lifetime qualifier and does NOT contain an unqualified `"à tout moment"` + `"sans préavis"` pairing scoped to benefit removal | content-assertion (regex/string test) | `npx vitest run test/legal/cgv-content.test.ts -x` | ❌ Wave 0 |
| LEGAL-04 | CGV and CGU AI-credit-cap sentences are byte-identical (or a documented, deliberate cross-reference) | consistency test comparing the two exported content constants | `npx vitest run test/legal/cgv-cgu-consistency.test.ts -x` | ❌ Wave 0 |
| LEGAL-05 | Not independently testable by this phase — it's an ordering/process guarantee verified at the Phase 4 boundary (Phase 4's plan should assert Phase 3 is complete before its own credit-gate flag flips) | process gate | — (no automated test in this phase) | — |
| LEGAL-06/07 | Exported checkbox-label and collection-notice copy strings exist, are non-empty, and match the CNIL Article-13 minimum-field checklist (contain purpose, controller, retention mention) | content-assertion | `npx vitest run test/legal/consent-copy.test.ts -x` | ❌ Wave 0 |
| LEGAL-08 | The new migration's `app_config` INSERT is present and idempotent (`ON CONFLICT DO NOTHING`); value matches the "3" stated in copy | migration/SQL structural test, mirroring how `01-04`'s RLS suite tests `app_config` reads (`backend/api/test/rls/waitlist-config-rpc.spec.ts`) | `cd backend/api && npm run test:rls` (existing suite; extend, don't replace) | ✅ suite exists — extend it |
| LEGAL-09 | `anonymize_waitlist_signup()` is callable with `service_role` and unreachable by `anon`/`authenticated` (already covered by Phase 1's RLS suite); if a new script is built, its CLI parsing/gate logic gets hand-rolled-fake unit tests mirroring `purge-delete.test.ts` | unit test (script) + existing RLS coverage (RPC grants) | `cd backend/api && npm run test:rls` (existing) + new `apps/web/test/legal/erasure-script.test.ts` if a script is built | ✅ RPC grants covered; ❌ script tests, Wave 0, only if script is built |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run test/legal` (fast, no Supabase credentials needed for content-assertion tests)
- **Per wave merge:** `cd apps/web && npm run test` and, if the migration was touched, `cd backend/api && npm run test:rls` (subject to the same known gap already documented in STATE.md: no live `SUPABASE_SERVICE_ROLE_KEY` in this environment to actually execute it)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the D-01 human counsel-approval checkpoint — the latter is not a test, it is the actual phase-completion criterion.

### Wave 0 Gaps
- [ ] `apps/web/test/legal/cgv-content.test.ts` — string/content assertions over exported CGV copy constants (LEGAL-02, LEGAL-03)
- [ ] `apps/web/test/legal/cgv-cgu-consistency.test.ts` — cross-document consistency check (LEGAL-04)
- [ ] `apps/web/test/legal/consent-copy.test.ts` — checkbox/notice copy structural checks (LEGAL-06/07)
- [ ] `apps/web/test/legal/cgv-locale.test.ts` — confirms genuine FR/EN divergence, guards against Pitfall "copying the French-only body pattern" (LEGAL-01)
- [ ] Extend `backend/api/test/rls/waitlist-config-rpc.spec.ts` (existing) to cover the new `app_config` retention row (LEGAL-08)
- [ ] If an erasure script is built: `apps/web/test/legal/erasure-script.test.ts` mirroring `apps/web/test/purge/purge-delete.test.ts`'s hand-rolled-fake style (LEGAL-09)

**Important caveat specific to this phase:** automated tests here can only check *structural* and *consistency* properties of the legal text (presence/absence of specific phrases, cross-document identity, locale divergence). They cannot verify legal correctness or enforceability — that verification is exactly what D-01's human counsel-review checkpoint provides, and no test suite substitutes for it.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches no auth surface |
| V3 Session Management | No | N/A |
| V4 Access Control | Yes | The `anonymize_waitlist_signup()` RPC already enforces `service_role`-only execution (`REVOKE ... FROM PUBLIC, anon, authenticated` — verified above); any new erasure script must use the admin/service-role client, never expose the RPC to `anon`/`authenticated` |
| V5 Input Validation | Yes (minor) | If a script accepts an email argument, reuse the existing `normalize_waitlist_email()` plpgsql helper's behavior implicitly by passing the raw address straight to the RPC (the RPC normalizes internally per `20260812_waitlist_founder_offer.sql:224`) — do not re-implement normalization client-side |
| V6 Cryptography | No | N/A — no new secrets or cryptographic operations in this phase |

### Known Threat Patterns for this phase's surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A support agent (or attacker with support-channel access) anonymizes an arbitrary email without verifying the requester actually owns it | Repudiation / Elevation of privilege (social) | Out of this phase's automatable scope — this is a process control (verify the requester's email matches the anonymization target before running the script), not a code control; worth naming explicitly in the runbook/script's usage instructions |
| A "draft pending review" banner is later forgotten and never removed after counsel approval, permanently undermining the CGV's professional presentation | Information disclosure (of internal process state) / trust erosion | Not a security issue per se, but should be tracked as a follow-up task tied to the D-01 checkpoint's resolution — removing the banner is the natural "checkpoint cleared" action |

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` — full file read this session
- `apps/web/src/app/[locale]/(marketing)/mentions-legales/page.tsx` — full file read this session
- `apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx` — full file read this session
- `apps/web/src/components/layout/Footer.tsx` and `FooterClient.tsx` — full files read this session
- `supabase/migrations/20260812_waitlist_founder_offer.sql` — relevant sections read this session (table DDL, `app_config`, both RPCs)
- `scripts/purge-test-accounts/lib.mjs` — read this session, confirms the standalone-admin-client script convention
- `apps/web/src/lib/supabase/admin.ts` — read this session, confirms the `server-only` guard that rules out reusing it in a plain `.mjs` script
- `.planning/workstreams/lien-invite/research/PITFALLS.md` Pitfalls 1, 2, 3, 4, 6, 7, 8, 10 — already HIGH-confidence sourced (Légifrance, CNIL, DGCCRF, CJEU)
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md`, `02-CONTEXT.md`, `03-CONTEXT.md` — full files read this session

### Secondary (MEDIUM confidence)
- CNIL — [Conformité RGPD : comment informer les personnes et assurer la transparence ?](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) — Article 13 minimum-field checklist, confirmed via WebSearch this session
- CNIL — [Exemples de formulaire de collecte de données à caractère personnel](https://www.cnil.fr/fr/exemples-de-formulaire-de-collecte-de-donnees-caractere-personnel)

### Tertiary (LOW confidence)
- General legal-memo-structure sources (PostGrid, Clio, Bloomberg Law) consulted only for generic "memo organized around open questions" structure — not French-law-specific, used solely to shape the counsel-briefing package's document format, not its content

## Metadata

**Confidence breakdown:**
- Codebase facts (existing pages, RPC, app_config, footer, scripts convention): HIGH — every claim tagged VERIFIED was read directly this session with line citations
- Legal drafting guidance (D-03/D-04 clause shapes): MEDIUM — inherits PITFALLS.md's HIGH-confidence sourcing but the specific clause synthesis is this session's reasoning, explicitly gated by D-01's counsel checkpoint
- Validation architecture: MEDIUM — proposed test files don't exist yet (Wave 0 gaps); the framework and command patterns are HIGH confidence (read from `package.json`/existing `test/` structure)

**Research date:** 2026-08-14
**Valid until:** 30 days for codebase-fact claims (stable, unlikely to drift); the legal-drafting guidance itself doesn't expire on a fixed calendar but is explicitly provisional pending outside counsel per D-01/D-02 — treat it as "valid until counsel review," not a date.
