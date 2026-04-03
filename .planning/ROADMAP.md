# Roadmap: Ziko Platform

## Milestones

- ✅ **v1.0 Landing Page** — Phases 1–5 (shipped 2026-03-28)
- ✅ **v1.1 Smart Pantry Plugin** — Phases 6–9 (shipped 2026-04-02)
- ✅ **v1.2 Barcode Enrichment + Tech Debt** — Phases 10–11 (shipped 2026-04-02)
- 🚧 **v1.3 Security + Cloud Infrastructure** — Phases 12–15 (in progress)

## Phases

<details>
<summary>✅ v1.0 Landing Page (Phases 1–5) — SHIPPED 2026-03-28</summary>

Five phases took the Ziko web marketing site from an empty repo to a publicly-launched product. Phase 1 installed the technical foundation — i18n routing, design tokens, and the static rendering architecture. Phase 2 shipped all RGPD and French legal requirements. Phase 3 built the three marketing sections. Phase 4 hardened SEO metadata. Phase 5 threw the switch: custom domain live, site public.

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-03-26
- [x] Phase 2: RGPD Compliance (3/3 plans) — completed 2026-03-26
- [x] Phase 3: Marketing Content (3/3 plans) — completed 2026-03-27
- [x] Phase 4: SEO + Performance (3/3 plans) — completed 2026-03-27
- [x] Phase 5: Launch (2/2 plans) — completed 2026-03-28

</details>

<details>
<summary>✅ v1.1 Smart Pantry Plugin (Phases 6–9) — SHIPPED 2026-04-02</summary>

Four phases added the Smart Pantry Plugin to the Ziko mobile app — a kitchen brain with inventory tracking, barcode scan for item lookup, AI macro-aware recipe suggestions, automatic calorie logging to the nutrition plugin, and a rule-based shopping list.

- [x] Phase 6: Smart Inventory (4/4 plans) — completed 2026-03-29
- [x] Phase 7: AI Recipe Suggestions (4/4 plans) — completed 2026-03-29
- [x] Phase 8: Calorie Tracker Sync (3/3 plans) — completed 2026-03-30
- [x] Phase 9: Smart Shopping List (3/3 plans) — completed 2026-04-01

</details>

<details>
<summary>✅ v1.2 Barcode Enrichment + Tech Debt (Phases 10–11) — SHIPPED 2026-04-02</summary>

Two phases enriched the nutrition plugin with Open Food Facts barcode scanning — users can scan any food product and see its Nutri-Score, Eco-Score, macros, and photo before logging. All v1.1 tech debt closed: SHOP-03 quantity prompt, AI tool registry migration, Nyquist VALIDATION.md audit.

- [x] Phase 10: Data Foundation + Tech Debt (3/3 plans) — completed 2026-04-02
- [x] Phase 11: Barcode UI + Score Display (3/3 plans) — completed 2026-04-02

</details>

### 🚧 v1.3 Security + Cloud Infrastructure (In Progress)

**Milestone Goal:** Securiser le backend Hono contre les abus avec du rate limiting distribue via Upstash Redis, durcir l'API (CORS, headers, validation Zod), et gerer les assets media via Supabase Storage avec upload direct depuis le mobile et lifecycle policies.

#### Phase 12: Infra + Rate Limiting
**Goal**: The API is protected against unauthenticated floods and per-user quota abuse — all rate-limited routes return 429 with Retry-After headers, backed by a persistent distributed Redis store that survives Vercel cold starts
**Depends on**: Phase 11
**Requirements**: INFRA-01, RATE-01, RATE-02, RATE-03, RATE-04, RATE-05
**Success Criteria** (what must be TRUE):
  1. Upstash Redis is provisioned and connected — a ping from the backend returns a valid response and `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are present in both local `.env` and Vercel environment
  2. An unauthenticated client sending 201 rapid requests to any endpoint receives HTTP 429 with a `Retry-After` header on the 201st request — `GET /health` never returns 429 regardless of request count
  3. An authenticated user sending 21 consecutive POST requests to `/ai/chat` or `/ai/chat/stream` within 60 minutes receives HTTP 429 with `Retry-After` on the 21st request
  4. An authenticated user sending 31 consecutive POST requests to `/ai/tools/execute` within 60 minutes receives HTTP 429 on the 31st request
  5. An authenticated user sending requests beyond quota to the barcode scan endpoint receives HTTP 429; brute-force attempts on auth endpoints from a single IP are blocked after the per-IP threshold
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — Redis client + rate limiter middleware (packages, redis.ts, rateLimiter.ts)
- [x] 12-02-PLAN.md — Wire limiters into app.ts and routes/ai.ts

#### Phase 13: API Security Hardening
**Goal**: The API enforces strict CORS, emits security headers on every response, and validates all inputs reaching Claude Sonnet — so malformed or malicious payloads are rejected before touching any AI or database layer
**Depends on**: Phase 12
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. A request from an unlisted origin (e.g. `https://evil.example.com`) receives a CORS rejection — the wildcard `*.vercel.app` origin is no longer accepted
  2. Every API response includes security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security` — verifiable via `curl -I`
  3. A POST to `/ai/chat` with a malformed `messages` array (missing `role`, wrong type, extra unknown fields) returns HTTP 400 with a structured validation error — the request never reaches the Claude Sonnet API call
  4. A valid payload to `/ai/chat`, `/ai/chat/stream`, and `/ai/tools/execute` passes validation and reaches the handler without modification
**Plans**: 1 plan
Plans:
- [x] 13-01-PLAN.md — CORS lockdown, secureHeaders, Zod validation on AI routes

#### Phase 14: Supabase Storage
**Goal**: Users can upload and retrieve profile photos and meal scan photos directly from the mobile app without routing binary data through the Hono API — uploads use signed URLs to bypass Vercel's 4.5 MB body limit, and all buckets are private with correct path-prefix RLS policies
**Depends on**: Phase 13
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04
**Success Criteria** (what must be TRUE):
  1. A user can update their profile photo from the mobile app — the photo is stored in the `profile-photos` bucket under their userId path and the public URL is persisted in `user_profiles`
  2. The mobile app can upload a meal scan photo by first calling `GET /storage/upload-url` to obtain a signed URL, then uploading directly to Supabase Storage — the Hono API never receives binary data
  3. An unauthenticated upload attempt to any storage bucket returns HTTP 403 — no bucket is publicly writable
  4. The `exports` bucket exists and is accessible via signed URL — the infrastructure is in place for future PDF exports even though no export UI exists yet
  5. `GET /storage/upload-url?bucket=&path=` returns a signed upload URL valid for 60 seconds — a subsequent PUT to that URL produces a real file visible in the Supabase Storage dashboard
**Plans**: 3 plans
Plans:
- [x] 14-01-PLAN.md — SQL migration: storage buckets + RLS (profile-photos, scan-photos, exports)
- [ ] 14-02-PLAN.md — Backend storage route: GET /storage/upload-url with signed URL generation
- [ ] 14-03-PLAN.md — Mobile + backend vision migration: signed URL upload flow end-to-end

#### Phase 15: Lifecycle & Cleanup
**Goal**: Ephemeral storage assets are automatically purged on schedule — scan photos older than 90 days and exports older than 7 days are removed via the Vercel cron endpoint, keeping storage costs bounded without manual intervention
**Depends on**: Phase 14
**Requirements**: INFRA-02
**Success Criteria** (what must be TRUE):
  1. `POST /storage/cron/cleanup` is registered as a Vercel cron job in `vercel.json` and runs on schedule — the endpoint is authenticated via `CRON_SECRET` header (401 without it)
  2. Calling the cleanup endpoint removes `scan-photos` objects with metadata `expires_at` older than 90 days — objects within the retention window are not affected
  3. Calling the cleanup endpoint removes `exports` objects older than 7 days — the removal uses `supabase.storage.from(bucket).remove([paths])` (not raw SQL DELETE) so no orphaned storage objects remain
**Plans**: TBD

---

## Phase Details

### Phase 12: Infra + Rate Limiting
**Goal**: The API is protected against unauthenticated floods and per-user quota abuse — all rate-limited routes return 429 with Retry-After headers, backed by a persistent distributed Redis store that survives Vercel cold starts
**Depends on**: Phase 11
**Requirements**: INFRA-01, RATE-01, RATE-02, RATE-03, RATE-04, RATE-05
**Success Criteria** (what must be TRUE):
  1. Upstash Redis is provisioned and connected — a ping from the backend returns a valid response and `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are present in both local `.env` and Vercel environment
  2. An unauthenticated client sending 201 rapid requests to any endpoint receives HTTP 429 with a `Retry-After` header on the 201st request — `GET /health` never returns 429 regardless of request count
  3. An authenticated user sending 21 consecutive POST requests to `/ai/chat` or `/ai/chat/stream` within 60 minutes receives HTTP 429 with `Retry-After` on the 21st request
  4. An authenticated user sending 31 consecutive POST requests to `/ai/tools/execute` within 60 minutes receives HTTP 429 on the 31st request
  5. An authenticated user sending requests beyond quota to the barcode scan endpoint receives HTTP 429; brute-force attempts on auth endpoints from a single IP are blocked after the per-IP threshold
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — Redis client + rate limiter middleware (packages, redis.ts, rateLimiter.ts)
- [x] 12-02-PLAN.md — Wire limiters into app.ts and routes/ai.ts

### Phase 13: API Security Hardening
**Goal**: The API enforces strict CORS, emits security headers on every response, and validates all inputs reaching Claude Sonnet — so malformed or malicious payloads are rejected before touching any AI or database layer
**Depends on**: Phase 12
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. A request from an unlisted origin (e.g. `https://evil.example.com`) receives a CORS rejection — the wildcard `*.vercel.app` origin is no longer accepted
  2. Every API response includes security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security` — verifiable via `curl -I`
  3. A POST to `/ai/chat` with a malformed `messages` array (missing `role`, wrong type, extra unknown fields) returns HTTP 400 with a structured validation error — the request never reaches the Claude Sonnet API call
  4. A valid payload to `/ai/chat`, `/ai/chat/stream`, and `/ai/tools/execute` passes validation and reaches the handler without modification
**Plans**: 1 plan
Plans:
- [x] 13-01-PLAN.md — CORS lockdown, secureHeaders, Zod validation on AI routes

### Phase 14: Supabase Storage
**Goal**: Users can upload and retrieve profile photos and meal scan photos directly from the mobile app without routing binary data through the Hono API — uploads use signed URLs to bypass Vercel's 4.5 MB body limit, and all buckets are private with correct path-prefix RLS policies
**Depends on**: Phase 13
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04
**Success Criteria** (what must be TRUE):
  1. A user can update their profile photo from the mobile app — the photo is stored in the `profile-photos` bucket under their userId path and the public URL is persisted in `user_profiles`
  2. The mobile app can upload a meal scan photo by first calling `GET /storage/upload-url` to obtain a signed URL, then uploading directly to Supabase Storage — the Hono API never receives binary data
  3. An unauthenticated upload attempt to any storage bucket returns HTTP 403 — no bucket is publicly writable
  4. The `exports` bucket exists and is accessible via signed URL — the infrastructure is in place for future PDF exports even though no export UI exists yet
  5. `GET /storage/upload-url?bucket=&path=` returns a signed upload URL valid for 60 seconds — a subsequent PUT to that URL produces a real file visible in the Supabase Storage dashboard
**Plans**: 3 plans
Plans:
- [ ] 14-01-PLAN.md — SQL migration: storage buckets + RLS (profile-photos, scan-photos, exports)
- [ ] 14-02-PLAN.md — Backend storage route: GET /storage/upload-url with signed URL generation
- [ ] 14-03-PLAN.md — Mobile + backend vision migration: signed URL upload flow end-to-end

### Phase 15: Lifecycle & Cleanup
**Goal**: Ephemeral storage assets are automatically purged on schedule — scan photos older than 90 days and exports older than 7 days are removed via the Vercel cron endpoint, keeping storage costs bounded without manual intervention
**Depends on**: Phase 14
**Requirements**: INFRA-02
**Success Criteria** (what must be TRUE):
  1. `POST /storage/cron/cleanup` is registered as a Vercel cron job in `vercel.json` and runs on schedule — the endpoint is authenticated via `CRON_SECRET` header (401 without it)
  2. Calling the cleanup endpoint removes `scan-photos` objects with metadata `expires_at` older than 90 days — objects within the retention window are not affected
  3. Calling the cleanup endpoint removes `exports` objects older than 7 days — the removal uses `supabase.storage.from(bucket).remove([paths])` (not raw SQL DELETE) so no orphaned storage objects remain
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-03-26 |
| 2. RGPD Compliance | v1.0 | 3/3 | Complete | 2026-03-26 |
| 3. Marketing Content | v1.0 | 3/3 | Complete | 2026-03-27 |
| 4. SEO + Performance | v1.0 | 3/3 | Complete | 2026-03-27 |
| 5. Launch | v1.0 | 2/2 | Complete | 2026-03-28 |
| 6. Smart Inventory | v1.1 | 4/4 | Complete | 2026-03-29 |
| 7. AI Recipe Suggestions | v1.1 | 4/4 | Complete | 2026-03-29 |
| 8. Calorie Tracker Sync | v1.1 | 3/3 | Complete | 2026-03-30 |
| 9. Smart Shopping List | v1.1 | 3/3 | Complete | 2026-04-01 |
| 10. Data Foundation + Tech Debt | v1.2 | 3/3 | Complete | 2026-04-02 |
| 11. Barcode UI + Score Display | v1.2 | 3/3 | Complete | 2026-04-02 |
| 12. Infra + Rate Limiting | v1.3 | 2/2 | Complete   | 2026-04-02 |
| 13. API Security Hardening | v1.3 | 1/1 | Complete   | 2026-04-03 |
| 14. Supabase Storage | v1.3 | 1/3 | In Progress|  |
| 15. Lifecycle & Cleanup | v1.3 | 0/? | Not started | -- |

---
*Roadmap created: 2026-03-26 -- Milestone v1.0 Landing Page*
*Updated: 2026-04-02 -- v1.2 shipped; v1.3 Security + Cloud Infrastructure phases 12-15 added*
*Updated: 2026-04-02 -- Phase 12 planned: 2 plans in 2 waves*
*Updated: 2026-04-03 -- Phase 13 planned: 1 plan in 1 wave*
*Updated: 2026-04-03 -- Phase 14 planned: 3 plans in 3 waves*
