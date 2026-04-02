# Architecture Research

**Domain:** Security + Cloud Infrastructure — Ziko Platform v1.3
**Researched:** 2026-04-02
**Confidence:** HIGH — all integration points verified from source files + official documentation

---

## Existing Structure

### Current Middleware Chain (app.ts)

```
Request
  |
  v
logger()                          ← global, line 15
  |
  v
cors()                            ← global, wildcard origin check, line 16-37
  |
  v
router.use('*', authMiddleware)   ← per-router, declared inside each route file
  |
  v
Route handler
```

**Declared in `backend/api/src/app.ts`:**

```typescript
app.use('*', logger());
app.use('*', cors({ ... }));          // origin array: exp://, localhost, *.vercel.app, APP_ORIGIN

app.get('/health', ...)               // unprotected
app.route('/ai', aiRouter);           // aiRouter adds authMiddleware at its own use('*')
app.route('/plugins', pluginsRouter);
app.route('/webhooks', webhooksRouter);
app.route('/bugs', bugsRouter);
app.route('/supplements', supplementsRouter);
app.route('/pantry', pantryRecipesRouter);
```

**Auth middleware (`src/middleware/auth.ts`):**
- Validates Supabase Bearer JWT via `adminClient.auth.getUser(token)`
- Sets `c.set('auth', { userId, email })` in `ContextVariableMap`
- Returns 401 on missing/invalid token

**Existing CORS config:**
- Allows: `exp://`, `http?://localhost*`, `https://*.vercel.app`, `process.env.APP_ORIGIN`
- Methods: GET, POST, PATCH, DELETE, OPTIONS
- Headers: Content-Type, Authorization
- `maxAge: 86400`

**Vercel deployment (vercel.json):**
- All requests rewrite to `/api/app`
- Weekly cron: `POST /supplements/cron/scrape` (Monday 03:00)
- Exports: `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` handlers from `app.ts`

**Current dependencies (package.json):**
- `hono: ^4.7.0` — no rate limiter yet
- `@supabase/supabase-js: ^2.50.0` — client exists, Storage not yet used
- `zod: ^4.3.6` — available for validation but not applied at middleware level

---

## Integration Points

### 1. Rate Limiting Injection Point

**The serverless constraint is decisive.** Vercel serverless functions have no persistent memory between invocations — in-memory state (`MemoryStore` from `hono-rate-limiter` default) resets on every cold start. This means a pure in-memory rate limiter provides false protection on Vercel: counts do not accumulate across concurrent function instances.

**Required:** An external Redis store that persists hit counts across invocations.

**Recommended store:** Upstash Redis via `@hono-rate-limiter/redis` + `@upstash/redis`. Reasons:
- HTTP-based (not TCP socket) — works in Vercel serverless without connection pool issues
- `@upstash/ratelimit` uses an ephemeral local cache per warm invocation to reduce Redis round-trips
- Vercel-native integration: one button provisions a KV store and injects `KV_REST_API_URL` + `KV_REST_API_TOKEN`
- `@hono-rate-limiter/redis` is the official Redis adapter for `hono-rate-limiter`

**Where to inject in the middleware chain:**

```
Request
  |
  v
logger()                          ← unchanged
  |
  v
cors()                            ← unchanged (but tighten origin list — see Modified Components)
  |
  v
[NEW] ipRateLimiter               ← global, applied BEFORE auth, protects against unauthenticated hammering
  |
  v
authMiddleware                    ← per-router (unchanged — stays inside route files)
  |
  v
[NEW] userRateLimiter             ← per-router, applied AFTER auth (has access to c.get('auth').userId)
  |
  v
[NEW] validationMiddleware        ← per-route, applied per endpoint
  |
  v
Route handler
```

**Two-tier rate limiting design:**

| Tier | Key | Limit | Applied at | Reason |
|------|-----|-------|-----------|--------|
| IP tier | `X-Forwarded-For` / `CF-Connecting-IP` | 200 req/15min | Global (before auth) | Blocks unauthenticated floods, no userId available yet |
| User tier | `c.get('auth').userId` + route path | Per-route (see below) | Per-router (after auth) | Fair per-user limits, harder to circumvent by rotating IPs |

**Per-route user limits (recommended):**

| Route | Limit | Window | Rationale |
|-------|-------|--------|-----------|
| `POST /ai/chat/stream` | 20 req | 60 min | AI calls are expensive; prevent runaway Anthropic billing |
| `POST /ai/chat` | 20 req | 60 min | Same pool as stream endpoint |
| `POST /ai/tools/execute` | 30 req | 60 min | Tool calls cheaper but still Anthropic API-backed |
| `POST /storage/upload` | 50 req | 60 min | Storage uploads — prevent storage abuse |
| `POST /bugs` | 10 req | 60 min | Bug reports — prevent spam |
| All other authenticated routes | 300 req | 15 min | General protection |

**keyGenerator pattern for user-tier limiter:**

```typescript
keyGenerator: (c) => {
  const auth = c.get('auth');
  const userId = auth?.userId ?? c.req.header('X-Forwarded-For') ?? 'anonymous';
  const path = c.req.routePath;
  return `${userId}:${path}`;
}
```

This combines userId with the route path — so hitting `/ai/chat/stream` does not consume the `/storage/upload` quota. Falls back to IP if auth context is somehow absent (defensive).

**Standard headers to return:**
- `standardHeaders: "draft-7"` — returns `RateLimit: limit=20, remaining=18, reset=1714500000`
- On 429: include `Retry-After` header (automatically added by `hono-rate-limiter`)

### 2. Supabase Storage Integration Point

**Current state:** The `authMiddleware` uses `SUPABASE_SERVICE_KEY ?? SUPABASE_PUBLISHABLE_KEY`. The publishable key is the one available in production (no service key hardcoded — correct). Storage operations require deciding between:

- **Service key upload (backend-side):** Backend receives binary from mobile, authenticates user, uploads to Supabase Storage on behalf of user. File is stored under `{userId}/{filename}`. Public URL returned to client and stored in DB column.
- **Presigned URL flow (client-initiated):** Backend generates a signed upload URL, client uploads directly to Supabase Storage. Backend never sees the binary.

**Recommendation: backend-proxied upload via service key** for v1.3. Reasons:
- Simpler mobile-side code: one `multipart/form-data` POST to the Hono API
- Consistent auth model: the Hono authMiddleware already validates the user — no separate Supabase Storage JWT flow needed on mobile
- Backend can enforce file size, MIME type, and path naming before storage touches the binary
- IMPORTANT: The service key is already available (`SUPABASE_SERVICE_KEY` env var). The `adminClient` in `auth.ts` uses it. The storage upload client should use the same service key to bypass Storage RLS.
- Storage RLS policy is still defined (INSERT by user path folder), but the service key bypasses it — this is safe because the backend has already verified the user identity before setting the storage path.

**Where the storage client lives:** A new `src/lib/storageClient.ts` utility, separate from the auth client, using the service key explicitly. This avoids importing `adminClient` from auth.ts into routes (leaking concerns).

**Storage buckets to create:**

| Bucket | Visibility | Max file size | Allowed MIME types | Path pattern |
|--------|------------|--------------|-------------------|-------------|
| `profile-photos` | Public | 5 MB | `image/jpeg`, `image/png`, `image/webp` | `{userId}/avatar.{ext}` |
| `meal-photos` | Private | 10 MB | `image/jpeg`, `image/png`, `image/webp` | `{userId}/{date}/{uuid}.{ext}` |
| `exports` | Private | 25 MB | `application/pdf`, `text/csv` | `{userId}/{filename}` |

**Public vs private rationale:**
- `profile-photos` public: avatars are viewed by other users (community plugin, leaderboards). Public bucket means no signed URL needed to display an avatar.
- `meal-photos` private: food photos are personal health data. Signed URLs required for display.
- `exports` private: user's full data export — never public.

**File upload data flow:**

```
Mobile app (multipart/form-data POST)
  |
  v
POST /storage/upload
  ├── authMiddleware validates JWT → sets c.get('auth').userId
  ├── userRateLimiter checks upload quota
  ├── validationMiddleware: file size, MIME type
  ├── storageClient.upload(bucket, `{userId}/{filename}`, fileBytes, { contentType })
  |
  v
Supabase Storage returns { path, fullPath }
  |
  v
storageClient.getPublicUrl(bucket, path) → { data: { publicUrl } }
  |
  v
Handler inserts publicUrl into DB column (user_profiles.avatar_url, etc.)
  |
  v
Response: { url: publicUrl, path }
```

**Lifecycle policy — no native Supabase TTL support (CONFIRMED LOW confidence):**
Supabase Storage has no built-in object expiration TTL as of 2026-04. The community workaround is a scheduled Supabase Edge Function or Vercel cron that queries `storage.objects` where `created_at < NOW() - INTERVAL 'N days'` and calls `storage.from(bucket).remove(paths)`. For v1.3, use the existing Vercel cron mechanism (add a `POST /storage/cron/cleanup` endpoint) with a weekly schedule — consistent with the supplement scraper cron already in `vercel.json`.

### 3. Input Validation Injection Point

**Current state:** The `bugs.ts` route does manual field checks (`if (!title || !description)`). No Zod schema validation at middleware level. Hono has no built-in validation for request bodies.

`zod` is already in `dependencies` — no new package needed.

**Recommended approach:** Per-route validation using Hono's built-in `validator` middleware with `zod`:

```typescript
import { validator } from 'hono/validator';
import { z } from 'zod';

router.post('/upload',
  validator('form', (value, c) => {
    // multipart form validation
  }),
  async (c) => { ... }
);
```

**Where validation fits in the chain:** After auth, before the handler. The `validator` middleware is applied per-route, not globally — this is the Hono convention. No new middleware file needed; schemas are co-located with their routes.

### 4. CORS Tightening

Current `cors()` config allows `*.vercel.app` which is overly broad (any Vercel-hosted site can call the API). For v1.3, add `process.env.MOBILE_ORIGIN` (the production Expo app deep link origin) and remove the wildcard `*.vercel.app` or replace it with specific origins.

This is a modification to `app.ts` only — no new file.

---

## New Components

### `backend/api/src/middleware/rateLimiter.ts` (NEW)

Exports two ready-to-use middleware factories:

```
export const ipRateLimiter   → rateLimiter({ windowMs: 15min, limit: 200, keyGenerator: IP })
export const userRateLimiter → rateLimiter({ windowMs: 60min, limit: 20,  keyGenerator: userId:path })
export const aiRateLimiter   → rateLimiter({ windowMs: 60min, limit: 20,  keyGenerator: userId:path })
```

Uses `RedisStore` from `@hono-rate-limiter/redis` with `@upstash/redis` client initialized from env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). Both env vars injected via Vercel KV integration.

Single file owns all rate limiter configuration so limits can be tuned in one place.

**Type consideration:** The `ContextVariableMap` augmentation in `auth.ts` already declares `auth: AuthContext`. The `rateLimiter.ts` file will import this type via Hono's module augmentation — no extra declaration needed.

### `backend/api/src/lib/storageClient.ts` (NEW)

Thin wrapper around `@supabase/supabase-js` Storage, initialized with the service key to bypass Storage RLS. Exports:

```typescript
export function uploadFile(bucket: string, path: string, file: File | ArrayBuffer, options: { contentType: string; upsert?: boolean }): Promise<{ url: string; path: string }>
export function deleteFile(bucket: string, paths: string[]): Promise<void>
export function getSignedUrl(bucket: string, path: string, expiresIn: number): Promise<string>
export function getPublicUrl(bucket: string, path: string): string
```

Keeps `createClient` calls out of route files. Single place for storage configuration.

**Why separate from `auth.ts` adminClient:** The `adminClient` in `auth.ts` is created with `autoRefreshToken: false, persistSession: false` for JWT validation. Storage operations have different semantics (file bodies, streaming). Keeping them separate avoids accidental misuse.

### `backend/api/src/routes/storage.ts` (NEW)

Hono router for file upload endpoints. Mounted at `/storage` in `app.ts`.

Routes:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/storage/upload/avatar` | Upload profile photo → `profile-photos` bucket |
| `POST` | `/storage/upload/meal-photo` | Upload meal scan photo → `meal-photos` bucket |
| `DELETE` | `/storage/delete` | Delete a file by path + bucket |
| `POST` | `/storage/cron/cleanup` | Vercel cron: delete files older than policy window |

All routes except `/cron/cleanup` are protected by `authMiddleware` + `userRateLimiter`. The cron endpoint is protected by a `CRON_SECRET` header check (Vercel cron convention).

Middleware chain inside this router:

```
router.use('*', authMiddleware)
router.use('*', userRateLimiter)    ← upload-specific quota
router.post('/upload/avatar',
  bodyLimit({ maxSize: 5 * 1024 * 1024 }),
  validator('form', avatarSchema),
  handler
)
```

### `supabase/migrations/026_storage_buckets.sql` (NEW)

Creates the three buckets and their RLS policies. Example pattern:

```sql
-- Create buckets via Supabase Storage API (not SQL migration directly)
-- RLS on storage.objects table:
CREATE POLICY "profile_photos_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_photos_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');  -- public bucket: no auth restriction on reads
```

Note: Buckets themselves (public/private flag, allowed MIME types, max file size) are configured via the Supabase Dashboard or `supabase/config.toml`, not SQL migrations. The SQL migration only sets the RLS policies on `storage.objects`. This is an important distinction — mark this in the phase plan.

---

## Modified Components

### `backend/api/src/app.ts` (MODIFY)

Changes:
1. Import `ipRateLimiter` from `./middleware/rateLimiter.js`
2. Import `storageRouter` from `./routes/storage.js`
3. Apply `ipRateLimiter` AFTER `cors()`, BEFORE any route (line ~38)
4. Mount `/storage` router
5. Tighten CORS origin list: remove wildcard `*.vercel.app`, add specific allowed origins via env var `ALLOWED_ORIGINS`
6. Export `PUT` handler from Vercel exports (for Storage presigned URL uploads if needed later)

```typescript
// After cors(), before routes:
app.use('*', ipRateLimiter);

// New route mount:
app.route('/storage', storageRouter);
```

### `backend/api/src/routes/ai.ts` (MODIFY)

Changes:
1. Import `aiRateLimiter` from `../middleware/rateLimiter.js`
2. Apply after `authMiddleware` at the router level

```typescript
const router = new Hono();
router.use('*', authMiddleware);
router.use('*', aiRateLimiter);   // ← ADD: per-user, per-path AI quota
```

No handler changes needed.

### `backend/api/src/routes/bugs.ts` (MODIFY)

Changes:
1. Import `userRateLimiter` from `../middleware/rateLimiter.js` (or a specific `bugsRateLimiter` variant with tighter limits: 10/hour)
2. Apply after `authMiddleware`
3. Replace manual `if (!title || !description)` check with a Zod `validator` schema (improves consistency and error message format)

### `backend/api/vercel.json` (MODIFY)

Add the storage cleanup cron:

```json
{
  "crons": [
    { "path": "/supplements/cron/scrape", "schedule": "0 3 * * 1" },
    { "path": "/storage/cron/cleanup",    "schedule": "0 4 * * 0" }
  ]
}
```

Sunday 04:00 UTC for storage cleanup — offset from supplement scraper to avoid simultaneous cron cold starts.

### `backend/api/package.json` (MODIFY)

Add new dependencies:

```json
{
  "dependencies": {
    "hono-rate-limiter": "^0.5.0",
    "@hono-rate-limiter/redis": "^0.5.0",
    "@upstash/redis": "^1.31.0"
  }
}
```

`@upstash/redis` replaces the need for `ioredis` or `@redis/client` — it uses HTTP so it works in Vercel serverless without TCP connection pool management.

---

## Build Order

Dependencies flow strictly from foundation to features. Each step is a prerequisite for the next.

### Step 1 — Redis Infrastructure (no code, no deploy)

Provision Upstash Redis via Vercel integration (dashboard: Storage → Create KV). This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into Vercel environment. Set the same two vars locally in `backend/api/.env` for development testing.

**Validation gate:** `curl -H "Authorization: Bearer $KV_REST_API_TOKEN" $KV_REST_API_URL/ping` returns `+PONG`.

### Step 2 — Install Packages

```bash
cd backend/api
npm install hono-rate-limiter @hono-rate-limiter/redis @upstash/redis
```

**Validation gate:** `npm run type-check` passes.

### Step 3 — Rate Limiter Middleware (`src/middleware/rateLimiter.ts`)

Build `rateLimiter.ts` with `ipRateLimiter`, `userRateLimiter`, `aiRateLimiter` exports. Test in isolation by writing a minimal test script that creates a `Hono` app with the middleware and sends 5 rapid requests — verify 429 on the 4th/5th.

**Validation gate:** 429 response returned with `RateLimit-Remaining: 0` and `Retry-After` header after limit exceeded.

### Step 4 — Apply Rate Limiters to Existing Routes

4a. Modify `app.ts`: add `ipRateLimiter` globally
4b. Modify `routes/ai.ts`: add `aiRateLimiter` at router level
4c. Modify `routes/bugs.ts`: add `userRateLimiter`

**Validation gate:** `POST /ai/chat` with 21 rapid requests from same user returns 429 on request 21. `/health` (unprotected) never returns 429 regardless of request count.

### Step 5 — Supabase Storage Buckets

Create buckets via Supabase Dashboard:
1. `profile-photos` (public, max 5 MB, allowed: image/*)
2. `meal-photos` (private, max 10 MB, allowed: image/*)
3. `exports` (private, max 25 MB, allowed: application/pdf, text/csv)

Then write `supabase/migrations/026_storage_rls.sql` with RLS policies on `storage.objects` for each bucket.

**Validation gate:** Attempting upload to `meal-photos` without auth returns 403. Authenticated upload to `{userId}/test.jpg` succeeds.

### Step 6 — Storage Client Utility (`src/lib/storageClient.ts`)

Build `storageClient.ts` as a standalone module. Test the `uploadFile` and `getPublicUrl` functions directly with a test script before wiring into routes.

**Validation gate:** `uploadFile('profile-photos', 'test-user/avatar.jpg', buffer, { contentType: 'image/jpeg' })` returns a non-null `url`.

### Step 7 — Storage Routes (`src/routes/storage.ts` + mount in `app.ts`)

Build `storage.ts` router with avatar upload, meal photo upload, delete, and cron cleanup. Wire into `app.ts`. Add Vercel cron entry in `vercel.json`.

**Validation gate:** `POST /storage/upload/avatar` with a valid JPEG returns `{ url, path }`. `POST /storage/upload/avatar` with an invalid MIME type returns 415. `POST /storage/cron/cleanup` without `CRON_SECRET` header returns 401.

### Step 8 — CORS Tightening

Replace wildcard `*.vercel.app` in `app.ts` cors config with an explicit list via `ALLOWED_ORIGINS` env var. Update env vars on Vercel.

**Validation gate:** Request from an unlisted origin receives CORS 403. Request from the Expo app origin (`exp://`) receives correct CORS headers.

### Step 9 — Deploy and Smoke Test

```bash
cd backend/api && vercel --prod --yes
```

Smoke test:
1. `GET /health` → 200
2. `POST /ai/chat` (authenticated) → responds normally
3. `POST /ai/chat` 21 times rapid → 429 on #21
4. `POST /storage/upload/avatar` (authenticated) → `{ url }` in response
5. Check Upstash dashboard: keys created with correct TTL

---

## Architectural Decisions

### Decision 1: Upstash over Vercel KV directly

Vercel KV is Upstash under the hood. Using `@upstash/redis` directly (rather than `@vercel/kv`) gives:
- Portability: not locked to Vercel-managed Redis if self-hosting later
- Direct access to `ephemeralCache` option in `@upstash/ratelimit` (warm-invocation caching reduces Redis calls)
- Same env vars either way (`KV_REST_API_URL` / `KV_REST_API_TOKEN`)

### Decision 2: Two-tier rate limiting (IP + user) rather than user-only

IP-tier runs BEFORE auth. This is essential for preventing authentication endpoint floods (someone hammering `POST /ai/chat` with invalid tokens never reaches `adminClient.auth.getUser()` — reduces Supabase Auth API costs). User-tier runs AFTER auth — uses the verified `userId` as the key, which is far more reliable than IP (NAT, VPN, shared WiFi all share one IP).

### Decision 3: Backend-proxied storage upload (not presigned URLs)

Presigned URLs would require the mobile app to:
1. Call `POST /storage/generate-url` → get signed URL
2. Call Supabase Storage directly with the signed URL

Two-step flow from mobile, additional error surface. Backend-proxied upload keeps mobile code simpler: one POST with `multipart/form-data`. The overhead (backend touches the binary) is acceptable for the file sizes involved (5–10 MB photos). Presigned URLs would be the right call at >100 MB or for bulk uploads — not the use case here.

### Decision 4: No native Supabase Storage lifecycle policy (workaround via cron)

Supabase Storage has no built-in object TTL/expiration as of 2026-04. The `storage.objects` table is queryable via the service key, so a weekly cron (`POST /storage/cron/cleanup`) that calls `storage.from(bucket).remove(oldPaths)` is sufficient for v1.3. Flag for re-evaluation if Supabase ships native lifecycle policies.

### Decision 5: Zod validation co-located with routes (not a global middleware)

A global body-validation middleware would need to know every route's schema. In Hono, `validator('json', schema)` or `validator('form', schema)` is applied per-route — the schema lives next to the handler, easy to read and maintain. This matches how the rest of the codebase is structured (manual checks inline, no framework-level validation today).

---

## Data Flow Changes

### Rate Limiting Data Flow

```
Request arrives at Vercel function
  |
  v
ipRateLimiter: key = X-Forwarded-For header
  → GET upstash:ratelimit:{ip}:{window}
  → increment + expire
  → if count > 200: return 429 with Retry-After
  |
  v
authMiddleware: validates JWT → sets userId in context
  |
  v
userRateLimiter: key = {userId}:{routePath}
  → GET upstash:ratelimit:{userId}:{route}:{window}
  → increment + expire
  → if count > limit: return 429 with RateLimit, Retry-After headers
  |
  v
Route handler executes normally
```

### File Upload Data Flow (new)

```
Mobile: POST /storage/upload/avatar
  Content-Type: multipart/form-data
  Body: file (JPEG/PNG, ≤5 MB)
  |
  v
authMiddleware → userId in context
  |
  v
userRateLimiter → upload quota check
  |
  v
bodyLimit({ maxSize: 5MB }) → 413 if exceeded
  |
  v
validator('form', schema) → 400 if MIME type invalid
  |
  v
storageClient.uploadFile(
  'profile-photos',
  `{userId}/avatar.{ext}`,
  await file.arrayBuffer(),
  { contentType: file.type, upsert: true }
)
  |
  v
supabase Storage → stores file, returns path
  |
  v
storageClient.getPublicUrl('profile-photos', path)
  → https://{project}.supabase.co/storage/v1/object/public/profile-photos/{userId}/avatar.jpg
  |
  v
UPDATE user_profiles SET avatar_url = publicUrl WHERE id = userId
  |
  v
Response: { url: publicUrl, path }
  |
  v
Mobile: stores url in user profile state,
        displays avatar from publicUrl directly (CDN-cached)
```

---

## Serverless Constraints Summary

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| No persistent memory between invocations | `MemoryStore` for rate limiting is useless | Upstash Redis (HTTP, not TCP) — state survives across invocations |
| 10s default function timeout on Vercel Hobby | Large file uploads may timeout | Set `maxDuration: 30` in `vercel.json` functions config for the storage route |
| 50 MB request body limit on Vercel | Photo uploads under 10 MB safe | `bodyLimit` middleware acts as secondary guard before Vercel's limit |
| Cold start latency | Redis call on first request adds ~50ms | `ephemeralCache` option in Upstash reduces Redis hits on warm invocations |
| No background threads | Cron cleanup must be a triggered endpoint | Vercel cron (`vercel.json`) calls `POST /storage/cron/cleanup` on schedule |

---

## Sources

- `backend/api/src/app.ts` — existing middleware chain, CORS config, route mounts
- `backend/api/src/middleware/auth.ts` — `ContextVariableMap` augmentation, adminClient pattern
- `backend/api/src/routes/ai.ts` — existing `router.use('*', authMiddleware)` pattern
- `backend/api/src/routes/bugs.ts` — existing manual validation pattern
- `backend/api/vercel.json` — cron configuration, rewrite pattern
- `backend/api/package.json` — current dependencies (hono 4.7, supabase-js 2.50, zod 4.3)
- `hono-rate-limiter` GitHub + Fiberplane article: https://fiberplane.com/blog/rate-limiting-intro/
- `@hono-rate-limiter/redis` npm: https://www.npmjs.com/package/@hono-rate-limiter/redis
- `@upstash/ratelimit` serverless features: https://upstash.com/blog/upstash-ratelimit
- Upstash on Vercel guide: https://upstash.com/blog/edge-rate-limiting
- Hono file upload docs: https://hono.dev/examples/file-upload
- Supabase Storage standard uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase Storage access control / RLS: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage buckets fundamentals: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase `getPublicUrl` API: https://supabase.com/docs/reference/javascript/storage-from-getpublicurl
- Supabase Storage delete objects: https://supabase.com/docs/guides/storage/management/delete-objects
- Supabase lifecycle policy (no native TTL): https://github.com/orgs/supabase/discussions/20171

---
*Architecture research for: Security + Cloud Infrastructure — Ziko Platform v1.3*
*Researched: 2026-04-02*
