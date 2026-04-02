# Research Summary — v1.3 Security + Cloud Infrastructure

**Project:** Ziko Platform
**Domain:** API security hardening + Supabase Storage on Vercel serverless (Hono v4 / Expo React Native)
**Researched:** 2026-04-02
**Confidence:** HIGH

---

## Executive Summary

Milestone v1.3 is a purely additive backend hardening pass — no existing behavior needs to be torn out. The core challenge is that two of the most intuitive implementation paths (in-memory rate limiting, proxying file uploads through the Hono API) are silently wrong on Vercel serverless and will pass all local tests before failing in production. The research consensus is unambiguous: rate limiting requires an external HTTP-based Redis store (Upstash), and file uploads must bypass the Hono API entirely via Supabase Storage signed URLs — Vercel enforces a hard 4.5 MB function body limit that no middleware can override.

The recommended approach is to add 4 packages (`hono-rate-limiter`, `@hono-rate-limiter/redis`, `@upstash/redis`, `@hono/zod-validator`), apply a two-tier rate limiting strategy (IP-tier before auth keyed on `x-real-ip`, user-tier after auth keyed on `userId:routePath`), create 3 private Supabase Storage buckets with path-prefix RLS policies, and implement a signed URL upload flow on both the Hono and mobile sides. CORS tightening and `secureHeaders()` are zero-cost configuration changes against already-installed packages. Lifecycle cleanup for ephemeral assets is handled via a Vercel cron endpoint — a pattern already established in this project for the supplement scraper.

The highest-risk item is Storage RLS. All 24 existing Supabase migrations use `auth.uid() = user_id` — that pattern does not work on `storage.objects`, which requires `(storage.foldername(name))[1] = auth.jwt()->>'sub'`. Copying from an existing migration will produce silently denied 403s on every upload and download. A secondary risk is the React Native upload path: passing a `File` object or raw base64 string to `supabase.storage.upload()` produces 0-byte or garbled files on iOS — the only safe pattern is `decode(base64)` from `base64-arraybuffer` decoded into an `ArrayBuffer`.

---

## Stack Additions

| Package | Version | Purpose |
|---------|---------|---------|
| `hono-rate-limiter` | `0.5.3` | Hono-native rate limiting middleware; emits standard `RateLimit-*` headers automatically |
| `@hono-rate-limiter/redis` | `0.1.4` | RedisStore adapter that wires Upstash into hono-rate-limiter |
| `@upstash/redis` | `1.37.0` | HTTP-based Redis client — the only Redis client compatible with Vercel serverless (no TCP connections) |
| `@hono/zod-validator` | `0.7.6` | Per-route Zod schema validation middleware; peer-compatible with existing `zod ^4.3.6` |
| `base64-arraybuffer` | current | Required on mobile for safe binary upload from Expo ImagePicker (decode base64 to ArrayBuffer) |

**No package needed for:**
- Supabase Storage — already inside `@supabase/supabase-js ^2.50.0`
- CORS hardening — `hono/cors` already wired in `app.ts` (configuration change only)
- Secure headers — `hono/secure-headers` is built into Hono (zero-install)

**Rejected options (do not revisit):** `rate-limiter-flexible` / `express-rate-limit` (in-memory, non-functional on serverless), `helmet` (Express-only, incompatible with Hono), `ioredis` / `@redis/client` (TCP connections break Vercel serverless), `multer` / `formidable` (binary upload must never reach Hono), `@upstash/ratelimit` standalone (requires hand-writing Hono middleware wrapper; `hono-rate-limiter` provides it already).

---

## Key Decisions

**Middleware order is fixed and non-negotiable:**
`logger → cors → ipRateLimiter → [route mount] → authMiddleware → userRateLimiter → zValidator → handler`

CORS must be first — preflight OPTIONS must never hit auth middleware (causes 401 that appears as a network error on mobile). IP rate limiter must precede auth — blocks floods before incurring Supabase Auth API cost. User rate limiter must follow auth — needs `userId` from JWT context.

**Two-tier rate limiting:**
- Tier 1 (IP, global, before auth): 200 req / 15 min — blocks unauthenticated floods
- Tier 2 (userId:routePath, per-router, after auth): AI chat 20/60min, tools 30/60min, uploads 50/60min, bugs 10/60min, general 300/15min
- Key selection priority: `userId` (authenticated) > `x-real-ip` (Vercel-set, reliable) > `x-forwarded-for` (last resort). Never use `x-forwarded-for` as primary — Vercel overwrites it with egress proxy IPs, collapsing all users into the same bucket.

**Signed URL upload pattern — not backend-proxied:**
PITFALLS research overrules the backend-proxied approach suggested in ARCHITECTURE.md. Vercel's 4.5 MB hard body limit is applied before the Hono handler runs and cannot be bypassed. Modern phone camera photos routinely exceed this. Adopted pattern: `POST /storage/upload-token` (Hono, JSON only) returns a signed URL with 300-second expiry → mobile calls `uploadToSignedUrl` directly to Supabase Storage. Hono never touches binary payloads.

**Three private buckets:**
All three buckets are private. `profile-photos` (5 MB, images, upsert per user) and `meal-photos` (10 MB, images, 90-day retention) serve files via signed URLs. `exports` (25 MB, PDF/CSV, 7-day retention) is ephemeral. Public buckets are explicitly rejected for personal health data.

**Storage RLS uses path-prefix, not user_id column:**
Every Storage policy uses `(storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')`. Upload paths are always `{userId}/{filename}`. Never copied from existing table migrations — `storage.objects` has no `user_id` column.

**Lifecycle cleanup via Vercel cron:**
Supabase Storage has no native lifecycle or TTL policies as of 2026-04. Cleanup is implemented as `POST /storage/cron/cleanup` added to `vercel.json`, reusing the cron pattern from the existing supplement scraper. Files are tagged with `expires_at` in `user_metadata` at upload time and removed by calling `supabase.storage.from(bucket).remove([paths])` — not raw SQL DELETE (which orphans the object).

**Zod validation co-located with routes, not global:**
`zValidator('json', schema)` applied per-route. Priority: `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute` first (unvalidated input reaches Claude Sonnet API directly — critical), then `/bugs`, `/pantry`, `/nutrition` PATCH routes as a secondary pass.

**Mobile upload uses ArrayBuffer, never File objects or raw base64:**
Expo ImagePicker with `base64: true` → `decode(base64)` from `base64-arraybuffer` → `ArrayBuffer` passed to `.upload()` with explicit `contentType`. No `File` objects. No global `Content-Type: application/json` on the Supabase client (corrupts every binary upload silently).

---

## Build Order

**Phase 1 — External Store Provisioning (infrastructure, no code)**
Provision Upstash Redis via Vercel dashboard (Storage → Create KV). Inject `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into Vercel environment and local `backend/api/.env`. Validate with a ping. This is the gating dependency — all rate limiting code is inert without it.

**Phase 2 — Install Packages + Rate Limiting Middleware**
Run `npm install hono-rate-limiter @hono-rate-limiter/redis @upstash/redis @hono/zod-validator` from `backend/api/`. Build `src/middleware/rateLimiter.ts` exporting `ipRateLimiter`, `userRateLimiter`, `aiRateLimiter`. Validate: 429 returned with `RateLimit-Remaining: 0` and `Retry-After` header after exceeding limit.

**Phase 3 — Apply Rate Limiters to Existing Routes**
Modify `app.ts` to apply `ipRateLimiter` globally after CORS. Modify `routes/ai.ts` to apply `aiRateLimiter` at router level (after `authMiddleware`). Modify `routes/bugs.ts` to apply `userRateLimiter`. Validate: 21 rapid AI chat requests → 429 on request 21; `GET /health` never returns 429.

**Phase 4 — CORS Tightening + Secure Headers**
Replace `*.vercel.app` wildcard in `app.ts` CORS config with explicit origin list via `ALLOWED_ORIGINS` env var. Add `secureHeaders()` middleware globally in `app.ts`. Update Vercel environment variables. Validate: unlisted origin receives CORS 403; Expo app origin receives correct headers.

**Phase 5 — Supabase Storage Buckets + RLS Migration**
Create 3 buckets via Supabase Dashboard (public/private flag, file size limits, allowed MIME types). Write `supabase/migrations/026_storage_rls.sql` using `storage.foldername(name)[1]` path-prefix RLS pattern — written from scratch, not copied from any existing migration. Validate: unauthenticated upload → 403; authenticated upload to `{userId}/test.jpg` → success.

**Phase 6 — Storage Client + Upload Token Endpoint**
Build `src/lib/storageClient.ts` (service-key-backed, separate from the existing `adminClient` in `auth.ts`). Build `src/routes/storage.ts` with `POST /storage/upload-token`, `DELETE /storage/delete`, `POST /storage/cron/cleanup`. Mount at `/storage` in `app.ts`. Add cron schedule to `vercel.json`. Validate: token endpoint returns signed URL; cron endpoint without `CRON_SECRET` header → 401; upload to returned signed URL produces a real file in Supabase Storage dashboard.

**Phase 7 — Input Validation on Critical Routes**
Apply `zValidator('json', schema)` to `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute`. Validate: malformed `messages` array → structured 400 error; valid payload passes through to handler.

**Phase 8 — Mobile Upload Integration**
Add `base64-arraybuffer` to mobile if not present. Implement two-step upload flow: `POST /storage/upload-token` → `uploadToSignedUrl` directly to Supabase Storage. Generate signed URL at confirm step (not picker open). Set expiry to 300 seconds. Validate end-to-end on a real device: photo upload succeeds and file appears in Supabase Storage dashboard with correct MIME type.

**Phase 9 — Deploy + Smoke Test**
`vercel --prod --yes` from `backend/api/`. Smoke test: health check, AI chat rate limiting (429 on 21st request), avatar upload end-to-end, Upstash dashboard key inspection.

---

## Critical Pitfalls

| Pitfall | Prevention |
|---------|------------|
| In-memory rate limiting is silently useless on Vercel — each function instance has isolated state; counts never accumulate across warm instances; appears to work locally | Provision Upstash Redis before writing any middleware code. Use `RedisStore` from `@hono-rate-limiter/redis`. The `MemoryStore` default in `hono-rate-limiter` provides zero protection on serverless. |
| `x-forwarded-for` collapses all users to Vercel egress IPs on non-Enterprise plans — one power user rate-limits everyone | Use `userId` from JWT for all authenticated routes. Use `x-real-ip` (Vercel-set header) for unauthenticated fallback. Never use `x-forwarded-for` as primary key. |
| Storage RLS `auth.uid() = user_id` pattern silently denies all operations — `storage.objects` has no `user_id` column | Write Storage RLS from scratch using `(storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')`. Never copy from any existing table migration in this project. |
| Vercel 4.5 MB hard body limit blocks modern phone photos before Hono handler runs — no log entry, no error on backend | Never proxy binary uploads through Hono. Implement signed URL flow: `POST /storage/upload-token` (tiny JSON exchange) → mobile uploads directly to Supabase Storage. |
| React Native upload produces 0-byte files (File object on iOS), garbled binary (raw base64), or wrong MIME type (global JSON header on Supabase client) | Always `decode(base64)` from `base64-arraybuffer` and pass the resulting `ArrayBuffer` with explicit `contentType`. No global `Content-Type: application/json` on the Supabase client instance. |
| CORS middleware placed after auth middleware causes OPTIONS preflight → 401, which appears as a network error on mobile — expensive to diagnose | `app.use('*', cors(...))` must be the very first middleware registered in `app.ts`. Current `app.ts` already has this correct; do not reorder when inserting `ipRateLimiter`. |
| Signed upload URL expires in 60 seconds by default — too short for mobile UX (pick → crop → confirm) | Always set `expiresIn: 300` (5 minutes). Generate the signed URL at the confirm step, not when the photo picker opens. Retry on expiry by fetching a fresh token. |

---

## Open Questions

| Question | Impact | Recommended Approach |
|----------|--------|---------------------|
| `storage.fdelete` pg_cron function signature not confirmed against live Supabase version | MEDIUM — affects lifecycle cleanup implementation | Use Vercel cron + `supabase.storage.from(bucket).remove([paths])` via JS client. Avoids unverified pg_cron function signature entirely; consistent with existing supplement scraper cron. |
| `profile-photos` bucket: public vs private | LOW — affects signed URL complexity on community and leaderboard screens | Default to private with 7-day signed URLs for v1.3. Revisit if leaderboard feature requires public CDN URLs at scale. |
| `SUPABASE_SERVICE_KEY` availability in Vercel env — `auth.ts` falls back to publishable key if absent | LOW — `storageClient.ts` needs service key to bypass Storage RLS for backend operations | Confirm service key is present in Vercel dashboard before Phase 6. If absent, use publishable key with strict path-prefix RLS on all storage operations. |
| `exports` bucket scope for v1.3 — no export UI exists yet | MEDIUM — bucket + cron adds complexity for a feature without a UI | Defer `exports` bucket to v2. Build only `profile-photos` and `meal-photos` in v1.3 to reduce migration and cron scope. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (packages, versions, rationale) | HIGH | All 4 packages confirmed via `npm view`. Peer dependency compatibility (`@hono/zod-validator 0.7.6` + `zod ^4.3.6`) verified. Rejected options confirmed incompatible from official docs. |
| Features (table stakes vs differentiators vs anti-features) | HIGH | Hono middleware, Supabase Storage, and Vercel constraints all verified against official documentation. Differentiator tiers based on real endpoint cost differences. |
| Architecture (middleware order, upload pattern, component boundaries) | HIGH | All integration points verified against actual source files (`app.ts`, `auth.ts`, `routes/ai.ts`, `vercel.json`, `package.json`). PITFALLS research corrected the backend-proxied upload recommendation from ARCHITECTURE.md — signed URL pattern is the right call. |
| Pitfalls (serverless gotchas, RLS pattern, React Native upload) | HIGH (CRIT-01 through CRIT-04), MEDIUM (INT-04 pg_cron function signature) | Critical pitfalls confirmed from official Vercel and Supabase documentation. React Native upload patterns confirmed from official Supabase React Native blog post and community issues with maintainer responses. |

**Overall confidence:** HIGH

### Gaps to Address

- **pg_cron `storage.fdelete` signature:** MEDIUM confidence. The pg_cron approach is community-validated but `storage.fdelete` function signature is not in official Supabase docs. Resolved by using the JS client `remove()` call from a Vercel cron endpoint instead.
- **`SUPABASE_SERVICE_KEY` in production Vercel env:** Must confirm before Phase 6. If the service key is not present, the storageClient falls back to publishable key and RLS policies must be written to permit it.
- **`exports` bucket deferral decision:** Recommend deferring to v2. If kept in v1.3 scope, the PDF generation approach must use `@react-pdf/renderer` (not Puppeteer/Chromium — confirmed to exceed Vercel timeout on free plan cold starts).

---

## Sources

### Primary (HIGH confidence)
- Official Hono docs — CORS, secure-headers, validator, bodyLimit middleware
- Official Vercel docs — 4.5 MB body limit, `x-real-ip` header behavior, cron configuration
- Official Supabase docs — Storage access control, RLS with `foldername` helper, signed upload URLs, `storage.objects` schema, React Native storage guide
- Official Upstash docs — serverless ratelimit, HTTP REST pattern, Vercel integration
- `backend/api/src/app.ts`, `auth.ts`, `routes/ai.ts`, `vercel.json`, `package.json` — actual integration points verified from source

### Secondary (MEDIUM confidence)
- `hono-rate-limiter` GitHub (rhinobase) — MemoryStore serverless caveat in Stores section
- Supabase GitHub Discussions #20171 — no native lifecycle policies confirmed (community + maintainer)
- Supabase GitHub Discussions #2336, #34982 — React Native 0-byte and MIME corruption patterns (community, multiple reproducers)
- Fiberplane rate limiting article — distributed state failure analysis on serverless

### Tertiary (LOW confidence — validate during execution)
- `storage.fdelete` pg_cron function signature — community pattern only, not in official Supabase docs; use JS client `remove()` instead

---

*Research completed: 2026-04-02*
*Ready for roadmap: yes*
