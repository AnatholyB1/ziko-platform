# Feature Landscape — Security + Cloud Infrastructure (v1.3)

**Domain:** API security hardening + Supabase Storage for a Hono v4 / Expo React Native fitness platform
**Researched:** 2026-04-02
**Confidence:** HIGH (Hono middleware verified via official docs + hono-rate-limiter GitHub; Supabase Storage verified via official Supabase docs; Vercel WAF verified via Vercel blog; patterns validated across multiple sources)

---

## Summary

Milestone v1.3 adds four distinct capability areas on top of the existing Hono v4 backend and Supabase stack:

1. **Rate limiting** — per-user + per-IP request throttling on AI chat, barcode scan, and auth endpoints
2. **Supabase Storage** — structured buckets for profile photos, scan meal photos, and PDF exports
3. **Lifecycle policies** — automated cleanup of old assets to control storage costs
4. **API security hardening** — tighten CORS, add input validation, add secure headers, prevent abuse

The existing infrastructure already has partial CORS (`cors()` in `app.ts`), JWT auth middleware (`authMiddleware` in `middleware/auth.ts`), and structured error handling. Rate limiting and validation are currently absent. Supabase Storage is not yet configured. This means v1.3 is purely additive — no existing behavior needs to be torn out.

The key dependency chain: **rate limiting requires `authMiddleware` to already have run** so the user ID from JWT is available in `c.get('auth').userId` for per-user keying. The existing middleware architecture already supports this — `authMiddleware` runs first on all `/ai/*` and protected routes.

---

## Table Stakes

Features users (and security auditors) expect any production API to have. Missing these = the API is not production-ready.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Per-user rate limiting on `/ai/chat/stream` and `/ai/chat` | AI chat endpoints call Claude Sonnet — each request costs money. Without per-user limits, a single compromised account drains the Anthropic budget. Standard in every AI-serving API | Medium | Existing `authMiddleware` (user ID from JWT). Upstash Redis for distributed state across Vercel serverless instances |
| Per-IP rate limiting on unauthenticated endpoints (`/health`, public routes) | Shields against scraping and enumeration before auth happens. Standard web API practice | Low | No dependency — IP from `c.req.header('x-forwarded-for')` |
| Standard rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) | Mobile clients need to back off gracefully. RFC 6585 / IETF draft standard. `hono-rate-limiter` emits these automatically | Low | Rate limiting middleware in place |
| 429 Too Many Requests response with `{ error, retryAfter }` body | Clients must distinguish 429 from 401/500. Mobile app must show "wait X seconds" not a generic error | Low | Rate limiting middleware |
| Supabase Storage bucket for profile photos | Users changing their avatar is a baseline feature expectation. Storing a data URL in a DB column doesn't scale — binary blobs in Postgres degrade query performance | Low-Medium | Supabase Storage configured, RLS policies on `storage.objects` |
| RLS policies on storage buckets | Supabase Storage docs: "by default Storage does not allow any uploads to buckets without RLS policies." Without RLS, any authenticated user can read any other user's files | Low | Supabase Storage bucket creation |
| Strict CORS origin list (no wildcard `*`) | The existing `app.ts` CORS config allows any `*.vercel.app` subdomain — too permissive for production. An attacker can spin up a malicious Vercel preview and make credentialed requests | Low | Existing Hono `cors()` middleware — tighten `origin` allowlist |
| Input validation on all POST bodies (Zod schema) | The AI chat routes, bug report route, and supplement routes accept free-form JSON. Without Zod validation, malformed input reaches tool execution. `@hono/zod-validator` is the standard Hono approach | Medium | `@hono/zod-validator` package. All POST route handlers need schema wrappers |
| Reject oversized file uploads (max file size per bucket) | Without a file size limit, a user can upload a 500MB video as a "profile photo." Supabase Storage bucket settings accept `fileSizeLimit` at bucket creation | Low | Supabase Storage bucket configuration |

---

## Differentiators

Features beyond minimum viable security — worth building for Ziko's specific context but not universally expected at this scale.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tiered rate limits per endpoint (AI chat stricter than others) | AI chat is expensive (Claude Sonnet); barcode scan is cheap (Supabase read). Applying the same limit to both wastes capacity and frustrates users. Apply `20 req/min` on AI chat, `60 req/min` on barcode/nutrition endpoints | Medium | `hono-rate-limiter` supports multiple middleware instances with different configs stacked on different route groups |
| Scan meal photo bucket with auto-compression pipeline | Users who photograph meals via the AI photo scan feature generate large JPEG images (3-8 MB from modern phones). Storing originals in Supabase wastes storage. Resizing to 800px max dimension before storage reduces costs 80%+ while preserving usability | High | Requires image processing (sharp or Expo ImageManipulator client-side resize before upload). Higher complexity than profile photos |
| PDF export bucket with lifecycle TTL (7-day expiry) | If a future feature exports workout programs or nutrition reports as PDFs, these are ephemeral — users download once. Auto-deleting after 7 days prevents unbounded storage growth | Medium | pg_cron + Supabase Storage delete API (SQL-only delete doesn't remove the bucket object — must call Storage API). No native Supabase lifecycle policy exists as of 2025 |
| Secure headers middleware (CSP, HSTS, X-Frame-Options) | Hono ships `secureHeaders()` middleware out of the box. Applying it costs nothing and hardens the API against content injection. Particularly relevant if the API ever serves HTML (error pages) | Low | Hono built-in `secureHeaders` from `hono/secure-headers` |
| Rate limit exceeded alerting via Supabase Edge Function or pg_notify | When a user or IP hits limits repeatedly, logging to a `rate_limit_events` table enables abuse pattern detection without a paid observability tool | Medium | Supabase pg_cron + custom table. Alternative: Upstash `analytics` flag on their ratelimit SDK |
| Signed URLs for private scan photos | Scan meal photos are personally identifiable (photo of food on your plate). Making the bucket public leaks these URLs. Signed URLs with short TTL (1 hour) serve them securely to the authenticated user only | Medium | Supabase `createSignedUrl()` instead of `getPublicUrl()`. Requires update to any photo-display components |

---

## Anti-Features / Out of Scope

Features that would be over-engineered for v1.3's scale, or that solve problems Ziko does not yet have.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom CAPTCHA on login / AI chat | Ziko uses Supabase Auth for login — CAPTCHA is Supabase's responsibility. Adding a custom CAPTCHA on the Hono API duplicates auth-layer concerns and degrades mobile UX (CAPTCHA in a React Native app is painful) | Rely on Supabase Auth's built-in abuse protection |
| IP blocklisting / geo-blocking | Requires managing a blocklist that goes stale fast. At Ziko's current scale, the cost/benefit is negative — you spend engineering time maintaining blocks that sophisticated actors bypass in seconds with VPNs | Rate limiting is sufficient. Geo-blocking is a Vercel WAF concern, not application code |
| Per-subscription-tier rate limits (free vs paid) | Ziko is a free app with no paid tier. Tiering rate limits requires a billing system that doesn't exist. Building rate-tier logic now is speculative engineering | Apply a single generous limit. Revisit when a premium tier exists |
| DDoS protection at the application layer | Application-layer DDoS mitigation (challenge pages, bot detection, traffic fingerprinting) belongs at the CDN/WAF layer. Vercel WAF handles this. Implementing it in Hono middleware is wasteful and ineffective | Configure Vercel WAF rules if DDoS becomes a real threat |
| Full-body encryption for file uploads | Supabase Storage uses TLS in transit and AES at rest. Adding a second encryption layer (client-side encrypt before upload) for profile photos adds key management complexity with no benefit for a fitness app | TLS + Supabase at-rest encryption is sufficient |
| Image CDN with edge transformations | CDN image transforms (resize on-the-fly at edge) are a Cloudflare Images / imgix feature. Supabase Storage does support basic image transforms via the `transform` parameter, but setting up a full edge CDN pipeline is disproportionate for profile avatars and scan photos at Ziko's scale | Resize client-side before upload (Expo ImageManipulator). Supabase Storage's built-in transform param covers simple use cases |
| Video upload support | The fitness app has workout programs and timers but no user-generated video content. Video upload pipelines (transcoding, multiple resolutions, CDN delivery) are a fundamentally different complexity level | Not a v1.3 or planned feature. Mark as deferred unless a feature roadmap item requires it |
| Audit log for every API call | Full API audit logs (who called what, when, with what params) require a write-heavy append-only table or a logging service. At Ziko's scale, `console.error` in the Hono error handler + Vercel's built-in function logs are sufficient | Vercel function logs + Supabase auth logs provide enough forensics for incident response at this scale |

---

## Category Notes

### Rate Limiting: Dependency on Existing JWT Middleware

The existing `authMiddleware` in `backend/api/src/middleware/auth.ts` validates the Supabase Bearer token and sets `c.set('auth', { userId, email })`. Rate limiting middleware on protected routes **must run after `authMiddleware`** to access `c.get('auth').userId` as the rate limit key. The current route structure applies `authMiddleware` at the router level (`router.use('*', authMiddleware)`), so per-route rate limit middleware stacked after it will have access to user identity.

For unprotected endpoints (e.g., `/health`, `/plugins`), rate limiting must be keyed by IP only, extracted from `x-forwarded-for` (Vercel sets this header). The `keyGenerator` function in `hono-rate-limiter` handles both cases.

**Recommended limits based on endpoint cost:**
- `/ai/chat/stream`, `/ai/chat` — 20 requests / 60 seconds per user (AI cost control)
- `/ai/tools/execute` — 30 requests / 60 seconds per user
- `/supplements/cron/scrape` — 1 request / day, IP-locked to Vercel cron IP
- All other authenticated routes — 60 requests / 60 seconds per user (generous, prevents runaway loops)
- Unauthenticated routes — 30 requests / 60 seconds per IP

**Storage backend:** Upstash Redis is the correct choice for Vercel serverless — it uses HTTP (not TCP), so it works across multiple serverless instances. The `@hono-rate-limiter/redis` package wraps `@upstash/redis` natively.

### Supabase Storage: Three-Bucket Architecture

Three distinct buckets based on access pattern and sensitivity:

| Bucket | Access | File Size Limit | Typical File | Lifecycle |
|--------|--------|-----------------|--------------|-----------|
| `profile-photos` | Private (signed URL or public) | 5 MB | JPEG avatar, 640x640px | Keep until user deletes |
| `scan-photos` | Private (signed URL only) | 10 MB | JPEG meal photo from camera | Auto-delete after 90 days (pg_cron) |
| `exports` | Private (signed URL only) | 20 MB | PDF workout/nutrition report | Auto-delete after 7 days (pg_cron) |

Profile photos can reasonably be public (the user chose to upload a profile picture). Scan meal photos are personally identifiable and should be private with signed URLs. Exports are ephemeral and should be private.

**RLS pattern for each bucket:**
- Upload: `auth.uid()::text = (storage.foldername(name))[1]` — users can only upload to their own path (e.g., `profile-photos/{userId}/avatar.jpg`)
- Read: same check, or public read for `profile-photos` if decided public
- Delete: same user check

### Input Validation: Which Routes Need It

Not all routes carry equal risk. Priority order for applying `@hono/zod-validator`:

1. `POST /ai/chat` and `POST /ai/chat/stream` — accepts `{ messages, conversation_id? }`. Unvalidated `messages` array reaches the Claude Sonnet API. **Critical.**
2. `POST /ai/tools/execute` — accepts free-form tool name + args. **Critical.**
3. `POST /bugs` — accepts `{ title, description, severity, category, device_info }`. User-submitted, lower risk but should be validated.
4. `POST /supplements/cron/scrape` — internal, but still validate caller identity.
5. `PATCH` routes on pantry, nutrition — moderate priority.

Validation should reject malformed input with `400` and a structured error. Do NOT leak Zod error internals in production responses — sanitize to `{ error: "Invalid request", details: [...field names only] }`.

### Lifecycle Policies: Supabase Has No Native TTL

As of early 2026, Supabase Storage does not expose a native object expiry / lifecycle policy in the dashboard or API. The confirmed workaround is:

1. Store `expires_at` in `storage.objects.user_metadata` at upload time
2. Schedule a pg_cron job (e.g., `'0 3 * * *'` — 3am UTC daily) that calls a Supabase Edge Function
3. The Edge Function queries `storage.objects` for expired entries and calls `supabase.storage.from(bucket).remove([paths])`
4. **Must use Storage API for deletion** — SQL DELETE on `storage.objects` orphans the file in the bucket

Alternative: write a Vercel cron endpoint (`/cleanup/cron`) that the Vercel scheduler calls, which runs the same Storage API cleanup. This avoids Edge Function complexity if the team prefers TypeScript in a single codebase.

### Monitoring: Minimal Viable Approach

Vercel provides function logs out of the box. Supabase provides Auth logs and DB query logs. For v1.3, a custom monitoring setup is overkill. The minimal approach:

- Log rate limit exceeded events to a `rate_limit_events` Supabase table (user_id, endpoint, timestamp, ip) — enables after-the-fact abuse investigation
- Set Vercel spend alerts (50%/75%/100% thresholds) to catch AI cost runaway
- Vercel WAF can be configured to rate limit at the infrastructure level as a complementary layer

A third-party observability platform (Datadog, Sentry, etc.) is a differentiator for v2, not v1.3.

---

## Feature Dependencies

```
JWT authMiddleware (EXISTS)
    └── REQUIRED BY: per-user rate limiting (user ID as key)
          └── hono-rate-limiter + Upstash Redis
                └── applied per-route group in ai.ts, bugs.ts, etc.

Supabase Storage buckets (NEW)
    └── REQUIRED BY: profile photo upload
    └── REQUIRED BY: scan meal photo storage
    └── REQUIRED BY: PDF export download
          └── RLS policies on storage.objects
                └── signed URL generation (scan-photos, exports)
                      └── pg_cron lifecycle cleanup
                            └── Supabase Edge Function OR Vercel cron endpoint

@hono/zod-validator (NEW)
    └── applied to POST /ai/chat, /ai/chat/stream, /ai/tools/execute (PRIORITY)
    └── applied to POST /bugs, PATCH routes (SECONDARY)

hono/secure-headers (BUILT-IN, zero cost)
    └── applied globally in app.ts alongside existing cors()
```

---

## MVP Definition

### Must-have for v1.3

- [ ] `hono-rate-limiter` + Upstash Redis — per-user limit on AI chat endpoints, per-IP on public endpoints
- [ ] Standard rate limit headers (`X-RateLimit-*`) on all rate-limited responses
- [ ] Supabase Storage: `profile-photos` bucket with RLS (user can upload/read own files)
- [ ] Supabase Storage: `scan-photos` bucket with RLS (private, signed URLs only)
- [ ] Tighten CORS origin allowlist — remove `*.vercel.app` wildcard, enumerate explicit allowed origins
- [ ] Zod validation on `/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute` POST bodies
- [ ] `secureHeaders()` middleware applied globally in `app.ts`

### Add After Validation (v1.3+)

- [ ] `exports` bucket + Vercel cron cleanup endpoint for 7-day TTL
- [ ] `scan-photos` lifecycle cleanup (90-day pg_cron)
- [ ] `rate_limit_events` table for abuse monitoring
- [ ] Zod validation on remaining POST/PATCH routes (bugs, pantry, nutrition)
- [ ] Client-side image resize (Expo ImageManipulator) before profile photo upload

### Future Consideration (v2+)

- [ ] Vercel WAF rules for infrastructure-level rate limiting
- [ ] Signed URL refresh flow for long-lived scan photo display
- [ ] Tiered rate limits when a paid subscription tier is introduced
- [ ] Third-party observability (Sentry errors + Datadog metrics)

---

## Sources

- [Hono Rate Limiter (rhinobase/hono-rate-limiter)](https://github.com/rhinobase/hono-rate-limiter) — HIGH confidence, official GitHub
- [hono-rate-limiter Redis adapter (@hono-rate-limiter/redis)](https://www.npmjs.com/package/@hono-rate-limiter/redis) — HIGH confidence, official npm
- [Hono CORS Middleware — Official Docs](https://hono.dev/docs/middleware/builtin/cors) — HIGH confidence, official
- [Hono Secure Headers Middleware — Official Docs](https://hono.dev/docs/middleware/builtin/secure-headers) — HIGH confidence, official
- [Hono Validation — Official Docs](https://hono.dev/docs/guides/validation) — HIGH confidence, official
- [@hono/zod-validator — npm](https://www.npmjs.com/package/@hono/zod-validator) — HIGH confidence, official Hono middleware package
- [Supabase Storage Buckets — Official Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals) — HIGH confidence, official
- [Supabase Storage Access Control — Official Docs](https://supabase.com/docs/guides/storage/security/access-control) — HIGH confidence, official
- [Supabase Storage Delete Objects — Official Docs](https://supabase.com/docs/guides/storage/management/delete-objects) — HIGH confidence, official
- [Supabase Expiring Objects Discussion — GitHub](https://github.com/orgs/supabase/discussions/20171) — MEDIUM confidence, community discussion confirming no native lifecycle policy
- [Upstash Ratelimit SDK — Official Docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — HIGH confidence, official
- [Vercel WAF Rate Limiting — Official Blog](https://vercel.com/blog/vercel-waf-upgrade-brings-persistent-actions-rate-limiting-and-api-control) — HIGH confidence, official
- [Rate Limiting Hono Apps — DEV Community / Fiberplane](https://dev.to/fiberplane/an-introduction-to-rate-limiting-3j0) — MEDIUM confidence, community article
- [Mobile App Security Best Practices 2025](https://isitdev.com/mobile-app-security-best-practices-2025-3/) — MEDIUM confidence, industry article
- [React Native Supabase Storage — Official Supabase Blog](https://supabase.com/blog/react-native-storage) — HIGH confidence, official

---
*Feature research for: Ziko Security + Cloud Infrastructure (v1.3 milestone)*
*Researched: 2026-04-02*
