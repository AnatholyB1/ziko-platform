# Stack Research — Waitlist Landing Page

**Domain:** Public waitlist / early-access email-capture landing page, bolted onto an existing production Next.js 15.5 + Hono v4 + Supabase stack
**Researched:** 2026-08-12
**Confidence:** HIGH (all versions verified against the npm registry directly; React 19 / Next 15 App Router compatibility checked via published `peerDependencies`)

This is a **subsequent-milestone** research file. It assumes everything in `apps/web/package.json` and `backend/api` is fixed and already in production. It only covers what's genuinely missing for a 200-spot founder waitlist page.

---

## What already covers this (verified in `apps/web/package.json` / `backend/api/package.json` / codebase — do not re-add)

| Need | Already have | Where |
|------|---------------|-------|
| Framework / rendering | Next.js 15.5.14 App Router, Turbopack, React 19.2.6 | `apps/web` |
| Styling | Tailwind v4, tokens in `@theme` (`--color-primary: #FF5C1A`, etc.) | `apps/web/src/app/globals.css` |
| i18n | next-intl 4.8.3, `[locale]` routing, `generateStaticParams` + `setRequestLocale` | `apps/web/src/app/[locale]/(marketing)/` |
| Schema validation | Zod 4.3.6 — root workspace dependency, hoisted, already the schema layer for `@ziko/coach-sdk` | root `package.json`, not yet directly imported in `apps/web/src` but resolvable |
| Rate limiting | `@upstash/ratelimit` 2.0.8 + `@upstash/redis` 1.37.0, lazy-singleton pattern with no-op fallback when Upstash env vars absent | `apps/web/src/lib/ratelimit.ts`; backend equivalent `backend/api/src/middleware/rateLimiter.ts` |
| Transactional email | Resend (backend: `^6.12.3` installed, `6.19.0` latest) + `@ziko/email` React Email templates (`@react-email/components` 1.0.12) | `backend/api/src/coach/{ai,videos}/service.ts`, `packages/email/` — **backend-only today, not in `apps/web`** |
| Client data fetching / polling | `@tanstack/react-query` 5.100.14 | `apps/web/package.json` |
| Icons / motion | `react-icons` 5.6.0, `lucide-react` 1.16.0, `framer-motion` 12.38.0, `gsap` 3.15.0 | `apps/web/package.json` |
| Server Action + native form pattern | `useActionState` + `'use server'` + `FormData`, no form library, already the house style (`DeleteAccountForm.tsx`, `WizardStep1Role.tsx`/`Step2`/`Step3`, `LoginForm.tsx`) | `apps/web/src/actions/*.ts`, `apps/web/src/components/{account,coach}/*` |
| Bounded-context backend module pattern | `service.ts` (routes) + `db.ts` (queries) + `types.ts` per `backend/api/src/coach/<module>/` | `backend/api/src/coach/invitations/` as template |
| Web Analytics | **Not installed.** `PROJECT.md` claims v1.0 shipped "Plausible analytics" but there is no Plausible script, no `@vercel/analytics`, and no analytics import anywhere in `apps/web/src` or `next.config.ts` — the root layouts (`apps/web/src/app/layout.tsx`, `apps/web/src/app/[locale]/layout.tsx`) have zero analytics wiring. Treat this as a genuine gap, not something to skip. | verified via grep, confirmed empty |

---

## Recommended Stack (new additions)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| *(none — no new framework-level dependency needed)* | — | — | Next.js 15 Server Actions + Route Handlers + Zod (already hoisted) are sufficient for a 2–3 field capture form. Adding a framework-level dependency for this milestone would be disproportionate. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mailchecker` | `6.0.21` (npm registry verified, published 11 days ago — actively maintained, 55k+ disposable domain DB) | Reject disposable/throwaway email domains at capture time | In the waitlist Server Action / backend route, after Zod syntax validation passes, before insert |
| `botid` | `1.5.11` (peer: `next: "*"`, `react: "^18.0.0 \|\| ^19.0.0"` — **React 19 confirmed**) | Invisible bot detection (Vercel-native, zero visible UI) for the public capture endpoint | Wrap `next.config.ts` with `withBotId`, call `checkBotId()` server-side in the Server Action / Route Handler before insert |
| `@marsidev/react-turnstile` | `1.6.0` (peer: `react: "^17.0.2 \|\| ^18.0.0 \|\| ^19.0"` — **React 19 confirmed**) | Visible Cloudflare Turnstile challenge — Cloudflare's own recommended React wrapper | Only if BotID's invisible layer proves insufficient after launch (see Bot Protection section) |
| `@vercel/analytics` | `2.0.1` (peer: `next: ">= 13"`, `react: "^18 \|\| ^19"` — **React 19 confirmed**) | Page views + custom conversion event (`waitlist_signup`) tracking | `<Analytics />` in `apps/web/src/app/layout.tsx`; `track('waitlist_signup', {...})` in the client component on successful submit |
| `@vercel/speed-insights` | `2.0.0` | Core Web Vitals on the new page (low-cost add given `@vercel/analytics` is already going in) | Optional — same root layout, only if the team wants CWV visibility on this specific page |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Zod `z.email()` | Syntax-level email validation (RFC 5322 pattern built in) | Already resolvable from workspace root (`^4.3.6`); no new dependency — just the first `apps/web/src` import of it. Zod v4 deprecated `z.string().email()` in favor of `z.email()`. |
| `unstable_cache` + `revalidateTag` (Next.js built-in) | Cache the waitlist count query, invalidate it precisely on signup | No install — part of `next/cache` |

---

## Installation

```bash
# From apps/web/
npm install mailchecker botid @vercel/analytics @vercel/speed-insights

# Only if BotID proves insufficient post-launch:
npm install @marsidev/react-turnstile

# Zod is already a hoisted workspace dependency (root package.json ^4.3.6) —
# no install needed, just `import { z } from 'zod'` in a new apps/web file.
```

If the waitlist submission is implemented as a new backend Hono module (recommended — see Architecture Notes), `mailchecker` and the Zod schema live in `backend/api/` instead, where `resend` and `zod` are already dependencies; no new backend installs beyond `mailchecker`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Native `useActionState` + Server Action + Zod `safeParse(FormData)` | `react-hook-form` 7.85.0 + `@hookform/resolvers` (Zod resolver) | Only if the waitlist form grows past ~4-5 fields with complex client-side interaction (multi-step, conditional fields, array fields). RHF 7.85.0 does have React 19 peer support (`^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`), but the community consensus (GitHub Discussion #11832, multiple 2025/2026 writeups) is that combining it with `useActionState` for Next 15 Server Actions is "hacky" and needs workarounds for double-submit — not worth it for 2-3 fields, and inconsistent with every other form in this codebase (`DeleteAccountForm`, `LoginForm`, all 3 coach wizard steps), which use the native pattern exclusively. |
| `mailchecker` for disposable-domain check | `disposable-email-domains` (1.0.62, last published 4 years ago — stale) | Never for this project — `mailchecker` is materially better maintained (updated 11 days ago vs. 4 years) with a larger, actively-curated domain list. |
| `botid` (invisible) as the primary bot layer | `@marsidev/react-turnstile` (visible challenge) as the primary bot layer | Use Turnstile-first only if the team specifically wants a visible "I'm not a robot" affordance for legal/trust-signal reasons, or if BotID's free Basic tier proves insufficient and the $1/1000 Deep Analysis tier is not wanted — Turnstile is also fully free. Otherwise BotID is strictly better for a conversion-sensitive landing page because it adds **zero visible friction**. |
| ISR (`revalidate` + `revalidatePath`/`revalidateTag`) for the counter | Supabase Realtime (websocket subscription) | Only if the product requirement becomes "counter visibly increments in real time across all open tabs the instant *anyone* signs up, no poll delay." At 200 total spots, that requirement doesn't exist yet — polling/ISR is proportionate. |
| Backend Hono module (`backend/api/src/waitlist/`) owning Resend + DB insert, thin Server Action proxy in `apps/web` | Direct Supabase admin client + Resend call from an `apps/web` Server Action (the `account.ts` pattern) | The `account.ts` pattern is viable and slightly simpler (one fewer network hop), but it's the outlier in this codebase — the closer precedent (`redeem/actions.ts`, unauthenticated-code-flow) proxies to the Hono backend. Since Resend + `@ziko/email` templates already live backend-side only, and `RESEND_API_KEY` is not currently in `apps/web/.env.local`, proxying keeps the email-sending secret backend-only rather than duplicating it into a second environment. Use the direct-Supabase pattern instead if the team wants to avoid touching `backend/api` at all this milestone. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| **Third-party waitlist SaaS** (Waitlist.email, LaunchList, GetWaitlist) | These are justified when a team has *no* backend, *no* database, and *no* transactional email — none of which is true here. Embedding one means: (1) waitlist data lives outside Supabase, breaking the single-source-of-truth + RLS security model every other table in this project follows; (2) a second billing relationship for a capability that is ~1 table + 1 Zod schema + 1 Resend template, all of which are already paid-for and wired; (3) confirmation emails can't reuse the `@ziko/email` React Email brand templates, so the founder's first touchpoint looks off-brand; (4) most of these embed via iframe/script, which breaks the page's static-generation performance story and the `@theme` design-token visual consistency. Not justified. | Supabase table + RLS, Resend + `@ziko/email` template, Upstash rate limit — all already in the stack. |
| **Typeform / Mailchimp embed forms** | Same argument as above but worse for this specific page: an iframe-embedded third-party form on a page whose entire job is conversion will hurt Core Web Vitals (extra origin, extra JS, layout shift) and cannot be styled to match `#FF5C1A` / `#F7F6F3` tokens pixel-for-pixel. It also means the "claimed / 200" counter (which needs the same underlying row count) would have to be built separately anyway — you gain nothing. | Native form, see above. |
| `react-hook-form` for this form specifically | See Alternatives table — inconsistent with house style, adds React-19/Server-Action friction for zero benefit at 2-3 fields. | `useActionState` + Server Action + Zod |
| MX-record / SMTP-handshake email verification (e.g. calling an external email-verification API per signup) | Real mailbox-existence checks add latency (DNS/SMTP round trip per submission, often 500ms-2s), are unreliable (many providers greylist or block verification probes, producing false negatives), and cost money per check via third-party APIs (ZeroBounce, Kickbox, etc.). For a lead-capture form where the actual cost of a bad email is "one wasted founder slot + one bounced confirmation email," this is disproportionate. | Zod syntax check (`z.email()`) + `mailchecker` disposable-domain check. If a confirmation email later bounces, that's an acceptable, cheap failure mode — don't build infrastructure to prevent it up front. |
| Supabase Realtime (websocket) for the live counter | Adds persistent-connection management (reconnect/backoff logic client-side), a distinct Supabase billing dimension, and operational complexity for a number that only needs to be "not visibly stale," not "instantaneous to the millisecond." At a 200-row ceiling this is significant over-engineering. | ISR (`export const revalidate`) + `revalidatePath`/`revalidateTag` fired synchronously from the signup action, optionally backed by a lightweight `@tanstack/react-query` client poll (already installed) at a 15-20s interval for the "still climbing while I watch" feel. |
| Adding a second, separate Upstash rate-limit instance/config in `apps/web` for the waitlist route if the submission goes through the Hono backend | `backend/api/src/middleware/rateLimiter.ts` already provides a per-IP sliding-window limiter (200 req/60s) plus the `EXEMPT_PATHS`/prefix mechanism; adding a *duplicate* web-side limiter for the same request is redundant. | Add a dedicated, tighter limiter (e.g. sliding window 5/60s, prefix `rl:waitlist`) as a **new Ratelimit instance inside the existing backend `rateLimiter.ts` / a route-specific middleware**, not a second Upstash client in `apps/web`. If instead the waitlist Server Action talks to Supabase directly from `apps/web` (the `account.ts` pattern), reuse `apps/web/src/lib/ratelimit.ts` by adding a new named export (`waitlistRatelimit`) following the existing `rolePromotionRatelimit`/`kycUploadRatelimit` pattern — don't invent a new file/pattern. |
| A generic npm `validator`/`isEmail`-style library for syntax checking | Zod v4's `z.email()` already ships a proper RFC 5322-derived pattern and is already a workspace dependency (root `^4.3.6`). A second syntax-checking dependency is pure duplication. | `z.email()` |

---

## Stack Patterns by Variant

**If the waitlist submission is implemented as a new backend module (recommended):**
- Add `backend/api/src/waitlist/` following the `service.ts` + `db.ts` + `types.ts` pattern used by `backend/api/src/coach/invitations/`
- Mount it in `backend/api/src/app.ts` at `/waitlist` (public, unauthenticated — add to `rateLimiter.ts` with a tighter dedicated limiter, not the global 200/60s one)
- Add a new `packages/email/src/templates/WaitlistConfirmation.tsx` React Email template alongside the existing `WeeklyDigest`, exported the same way (`tsup` build, `dist/WaitlistConfirmation.{cjs,mjs,d.ts}`)
- `apps/web/src/actions/waitlist.ts` becomes a thin `'use server'` proxy (`fetch(`${API_URL}/waitlist`, ...)`) exactly mirroring `apps/web/src/lib/redeem/actions.ts` — no Supabase/Resend secrets needed in `apps/web` for this flow

**If the team wants to avoid touching `backend/api` this milestone:**
- Follow the `account.ts` pattern instead: `apps/web/src/actions/waitlist.ts` uses `createAdminClient()` (service role, already guarded by `server-only`) to insert directly into a new `waitlist_signups` table, and calls Resend directly
- Requires adding `resend` as a **new** `apps/web` dependency and `RESEND_API_KEY` to `apps/web/.env.local` (currently backend-only) — this is the actual cost of choosing this path, flag it for the roadmap
- Add a new `waitlistRatelimit` export to `apps/web/src/lib/ratelimit.ts` following the existing lazy-singleton pattern

**For the live counter, regardless of which submission path is chosen:**
- Page stays statically shelled (`generateStaticParams` unchanged) with `export const revalidate = 30` (or similar) on the waitlist page segment — converts pure SSG to ISR
- The signup action calls `revalidatePath('/[locale]/waitlist')` (or a tag-based `revalidateTag('waitlist-count')` if the count query is wrapped in `unstable_cache`) synchronously on success — this makes the number exactly correct immediately after *any* signup, not just time-bound stale
- Optionally layer a small Client Component that does not block SSR: receives the server-computed initial count as a prop, then re-fetches from a tiny Route Handler (`apps/web/src/app/api/waitlist/count/route.ts`) via `@tanstack/react-query`'s `refetchInterval: 15000` for a "ticking" feel without affecting the page's static rendering
- The count Route Handler should use a service-role Supabase client (or a Postgres RPC/view restricted to `count()` only) so the anon key never needs a public SELECT policy on rows containing raw emails

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `mailchecker@6.0.21` | Node 20 (backend), Next.js 15.5 Server Actions/Route Handlers (web) | Pure JS, no native deps, safe in either environment |
| `botid@1.5.11` | `next: "*"`, `react: "^18.0.0 \|\| ^19.0.0"` | Confirmed against React 19.2.6 / Next 15.5.14 currently installed; requires wrapping `next.config.ts` with `withBotId` (proxy rewrites) — must be merged with the existing `withBundleAnalyzer(withNextIntl(nextConfig))` composition in `apps/web/next.config.ts` |
| `@marsidev/react-turnstile@1.6.0` | `react: "^17.0.2 \|\| ^18.0.0 \|\| ^19.0"` | Confirmed against React 19.2.6 |
| `@vercel/analytics@2.0.1` | `next: ">= 13"`, `react: "^18 \|\| ^19"` | Confirmed against Next 15.5.14 / React 19.2.6; ships a `/next` entrypoint specifically for App Router |
| `zod@4.3.6` (workspace root) | `@ziko/coach-sdk` peerDependency `^4.0.0` | Already the pinned major across the monorepo — do not introduce a second Zod major version anywhere in this milestone |
| `@upstash/ratelimit@2.0.8` | Already in both `apps/web` and `backend/api` | New limiter instances (web or backend) must reuse the existing `Redis.fromEnv()` / lazy-singleton-with-noop-fallback pattern so local dev without Upstash env vars doesn't crash SSR, exactly as `apps/web/src/lib/ratelimit.ts` already does |

---

## Sources

- npm registry (`registry.npmjs.org`), queried directly for `react-hook-form`, `botid`, `resend`, `@vercel/analytics`, `@vercel/speed-insights`, `@marsidev/react-turnstile` — version + `peerDependencies` verified 2026-08-12 (HIGH confidence, primary source)
- WebSearch: "react-hook-form React 19 support" — corroborated the "hacky with useActionState" community consensus (GitHub Discussion #11832, Markus Oberlehner blog) (MEDIUM confidence, community sources, cross-checked against registry peerDeps which are HIGH confidence)
- WebSearch: disposable-email-domain packages — compared `mailchecker` vs `disposable-email-domains` recency (HIGH confidence, npm registry data)
- WebSearch: Vercel BotID — `vercel.com/docs/botid/get-started`, `vercel.com/kb/guide/protect-ai-endpoints-with-vercel-botid` (HIGH confidence, official Vercel docs)
- WebSearch: Zod v4 email validation — confirmed `z.email()` is the current API (`z.string().email()` deprecated), and that syntax validation alone doesn't catch disposable domains (MEDIUM confidence community writeups, consistent with Zod's own documented scope)
- Codebase inspection (this repo, this worktree): `apps/web/package.json`, `backend/api/package.json`, `apps/web/next.config.ts`, `apps/web/src/lib/ratelimit.ts`, `apps/web/src/actions/account.ts`, `apps/web/src/lib/redeem/actions.ts`, `backend/api/src/middleware/rateLimiter.ts`, `packages/email/package.json`, root `package.json`, layout files — grep-verified absence of `react-hook-form`, Plausible, `@vercel/analytics` anywhere in the tree (HIGH confidence, direct file reads)

---
*Stack research for: public waitlist / early-access landing page (v1.16 milestone, `lien-invite` workstream)*
*Researched: 2026-08-12*
