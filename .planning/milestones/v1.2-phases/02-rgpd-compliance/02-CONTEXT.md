# Phase 2: RGPD Compliance - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the three legal page stubs (Mentions légales, Politique de confidentialité, CGU) with real production content, add a `/supprimer-mon-compte` account deletion page with a server-side Supabase admin deletion and rate limiting via Upstash Redis.

This phase delivers legal compliance only. No marketing content (Phase 3), no SEO optimization (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Operator Data
- **D-01:** Legal entity name: **Ziko**
- **D-02:** Publication director: **BRICON Anatholy**
- **D-03:** SIRET: `[À COMPLÉTER]` — placeholder, fill before launch
- **D-04:** Physical address: `[À COMPLÉTER]` — placeholder, fill before launch
- **D-05:** Hosting provider: **Vercel** (already documented in roadmap)

### Legal Pages
- **D-06:** All three legal pages (Mentions légales, Politique de confidentialité, CGU) get real production content — not "coming soon" stubs. Operator fields with missing data use `[À COMPLÉTER]` placeholders.
- **D-07:** French only — no English translations for the legal pages. Legal obligations are French law; EN visitors see the FR content.
- **D-08:** Politique de confidentialité must name **Anthropic** as a data processor and document processing of: health data (measurements, sleep, habits), GPS data (cardio tracking), and AI coaching interactions.
- **D-09:** CGU must include an AI health advice liability disclaimer (AI is a coaching tool, not a medical device).

### Account Deletion Page
- **D-10:** Route: `/supprimer-mon-compte` — FR clean URL, consistent with `localePrefix: 'as-needed'` convention from Phase 1.
- **D-11:** Footer gets a "Supprimer mon compte" link — makes the deletion flow accessible from every page (RGPD Art. 17 accessibility).
- **D-12:** Form flow: email input → checkbox "Je comprends que cette action est irréversible" + user must type **SUPPRIMER** to activate the submit button — high friction, makes the action deliberate.
- **D-13:** On success: show a clear confirmation message (account deleted, no redirect needed). On error: show inline error (account not found, or rate limit exceeded).
- **D-14:** Server action uses `supabase.auth.admin.deleteUser()` — requires the service role key. The existing `admin.ts` currently uses `SUPABASE_PUBLISHABLE_KEY` by mistake; this must be corrected to `SUPABASE_SERVICE_ROLE_KEY`.

### Rate Limiting
- **D-15:** Rate limiting via **Upstash Redis** using `@upstash/ratelimit` + `@upstash/redis` packages.
- **D-16:** Limit: 5 requests per minute per IP — sliding window algorithm.
- **D-17:** IP extracted from `x-forwarded-for` header (Vercel sets this). Fallback to `127.0.0.1` in local dev.
- **D-18:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` added as server-only env vars (no `NEXT_PUBLIC_` prefix).

### Claude's Discretion
- Exact prose and structure of the three legal pages (Claude generates full French legal content matching RGPD requirements, using the operator data above)
- Styling of the deletion page and legal pages — use the established design system (max-w-screen-xl, px-8, py-16 pattern from Phase 1 stubs)
- Whether the deletion form uses a Server Action or an API Route Handler — Server Action preferred (Next.js App Router convention)
- Error handling details (what message to show for "email not found" vs "already deleted")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/PROJECT.md` — Vision, constraints, security requirements (service role key server-only)
- `.planning/REQUIREMENTS.md` — RGPD-01 through RGPD-06 acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependency on Phase 1

### Phase 1 Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — Stack decisions (Next.js 15, next-intl v4, `localePrefix: 'as-needed'`, admin client pattern)
- `.planning/research/ARCHITECTURE.md` — Folder structure and static rendering patterns established in Phase 1

### Existing Code (read before implementing)
- `src/lib/supabase/admin.ts` — Admin client (needs SERVICE_ROLE_KEY fix — D-14)
- `src/components/layout/Footer.tsx` — Footer to extend with deletion link
- `src/app/[locale]/mentions-legales/page.tsx` — Stub to replace with real content
- `src/app/[locale]/politique-de-confidentialite/page.tsx` — Stub to replace with real content
- `src/app/[locale]/cgu/page.tsx` — Stub to replace with real content
- `messages/fr.json` — Translation keys (needs expansion for legal content and deletion flow)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/layout/Footer.tsx` — Async server component, uses `getTranslations('Footer')` and `Link` from `@/i18n/navigation` — same pattern for the new deletion link
- Page layout pattern: `<main className="max-w-screen-xl mx-auto px-8 py-16">` established in all three legal stubs
- `src/lib/supabase/admin.ts` — `createAdminClient()` function with `import 'server-only'` — reuse directly after fixing the key

### Established Patterns
- Server components with `setRequestLocale(locale)` + `getTranslations()` — every `[locale]` page follows this pattern
- `src/app/[locale]/*/page.tsx` file structure for locale-aware pages
- Translation keys in `messages/fr.json` — flat namespace per feature (e.g., `Footer.copyright`, `LegalStub.comingSoon`)

### Integration Points
- Deletion Server Action connects to Supabase admin client — needs `SUPABASE_SERVICE_ROLE_KEY` env var
- Upstash rate limiter connects via REST API — needs `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars
- Footer component extended with new link — affects all pages via root layout

</code_context>

<specifics>
## Specific Ideas

- Deletion page: two-step confirmation — checkbox "Je comprends que cette action est irréversible" AND the user must type the word **SUPPRIMER** before the button activates. Both conditions must be met.
- Admin client bug: `admin.ts` currently passes `SUPABASE_PUBLISHABLE_KEY` to `createClient`. Must be corrected to `SUPABASE_SERVICE_ROLE_KEY` — this is a hard requirement for `auth.admin.deleteUser()` to work.
- Legal pages are static (`generateStaticParams` already in Phase 1 pattern) — no dynamic rendering needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-rgpd-compliance*
*Context gathered: 2026-03-26*
