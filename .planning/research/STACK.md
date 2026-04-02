# Stack Research — Security + Cloud Infrastructure (v1.3)

**Project:** Ziko Platform — v1.3 Security + Cloud Infrastructure milestone
**Researched:** 2026-04-02
**Scope:** NEW stack additions only. Validated existing: Hono v4 (`^4.7.0`), `@supabase/supabase-js` (`^2.50.0`),
`zod` (`^4.3.6`), Vercel deployment, `hono/cors` (already wired in `app.ts`). None of these are re-researched.

---

## Context: What the Existing API Looks Like

`backend/api/src/app.ts` currently registers:

1. `hono/logger` — global
2. `hono/cors` — global, origin-whitelist callback, already permits `*.vercel.app` broadly
3. Auth middleware — JWT validation via Supabase, per-route
4. Six route groups: `/ai`, `/plugins`, `/webhooks`, `/bugs`, `/supplements`, `/pantry`

The middleware chain is the insertion point for rate limiting and hardened CORS. Middleware order
in Hono is strictly positional — rate limiting must come BEFORE auth to block abuse before
incurring Supabase auth cost.

---

## New Dependencies

### 1. Rate Limiting — Upstash Redis + hono-rate-limiter

**The core constraint:** Vercel is a serverless/edge platform. Each function invocation is
stateless — there is no persistent in-process memory between requests. In-memory rate limiters
(e.g., `rate-limiter-flexible` with `MemoryStore`, or `express-rate-limit` defaults) accumulate
state per-instance and reset on every cold start. On Vercel with potentially hundreds of concurrent
instances, in-memory counters are siloed: User A's 10 requests could hit 10 different instances,
each seeing count=1, and the limit is never triggered. This makes in-memory rate limiting
**functionally useless** in serverless.

**Required:** An external, HTTP-based, atomic counter store that all Vercel instances share.
Upstash Redis is the canonical solution — it speaks REST (no TCP connection pooling, which is also
incompatible with serverless), is deployed globally, and integrates as a first-class Vercel
add-on.

**Recommended approach:** `hono-rate-limiter` + `@hono-rate-limiter/redis` adapter using Upstash
Redis as the store.

| Package | Version | Purpose |
|---------|---------|---------|
| `hono-rate-limiter` | `0.5.3` | Core Hono rate-limiting middleware (express-rate-limit inspired API) |
| `@hono-rate-limiter/redis` | `0.1.4` | RedisStore adapter that plugs into hono-rate-limiter |
| `@upstash/redis` | `1.37.0` | HTTP-based Upstash Redis client (REST, no persistent connections) |

**Why this combination over `@upstash/ratelimit` alone:**
`@upstash/ratelimit` (`2.0.8`) is the lower-level Upstash primitive. It provides sliding window,
fixed window, and token bucket algorithms directly. It can be used standalone in Hono middleware,
but requires writing the middleware wrapper manually. `hono-rate-limiter` provides the ergonomic
Hono middleware API (standard headers, `keyGenerator`, per-route config) and the RedisStore
adapter wires Upstash underneath. For this project, `hono-rate-limiter` + the Redis adapter is
the better DX — it is the same pattern used for the AI chat endpoint and produces standard
`RateLimit-*` response headers automatically.

**Install:**
```bash
npm install hono-rate-limiter @hono-rate-limiter/redis @upstash/redis
```
(Run from `backend/api/`)

**Usage pattern (per-route, after global CORS, before auth):**
```ts
import { rateLimiter } from 'hono-rate-limiter';
import { RedisStore } from '@hono-rate-limiter/redis';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Per-IP fallback, per-user when auth is present
const keyGenerator = (c: Context): string => {
  const userId = c.get('auth')?.userId;
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return userId ? `user:${userId}` : `ip:${ip}`;
};

// AI chat — expensive endpoint, tighter limit
export const aiRateLimiter = rateLimiter({
  windowMs: 60 * 1000,      // 1-minute window
  limit: 20,                // 20 req/min per user/IP
  keyGenerator,
  store: new RedisStore({ client: redis }),
});

// Barcode scan — moderate limit
export const barcodeRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator,
  store: new RedisStore({ client: redis }),
});
```

**Response headers emitted automatically:**
- `RateLimit-Limit` — the configured limit
- `RateLimit-Remaining` — requests left in window
- `RateLimit-Reset` — Unix timestamp of window reset

**New environment variables required:**
```
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```
Both are injected automatically by the Vercel Upstash integration (Dashboard → Storage → Upstash
Redis → Connect to project).

**Confidence:** HIGH — `@upstash/redis` and `@upstash/ratelimit` are the documented Vercel
solution for serverless rate limiting. `hono-rate-limiter` is the Hono-native wrapper. Version
numbers confirmed via `npm view` directly.

---

### 2. Input Validation — `@hono/zod-validator`

The project already has `zod ^4.3.6` in `backend/api/package.json`. The missing piece is the
Hono-specific middleware wrapper that validates incoming requests against Zod schemas.

| Package | Version | Purpose |
|---------|---------|---------|
| `@hono/zod-validator` | `0.7.6` | Validates request body/query/headers against Zod schemas in Hono routes |

**Peer dependency compatibility confirmed:**
`@hono/zod-validator` 0.7.6 declares `peerDependencies: { hono: ">=3.9.0", zod: "^3.25.0 || ^4.0.0" }`.
The project's `zod ^4.3.6` is within that range — install resolves cleanly without version
conflicts.

**Install:**
```bash
npm install @hono/zod-validator
```
(Run from `backend/api/`)

**Usage pattern:**
```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(32_000),
  })).min(1).max(50),
  conversation_id: z.string().uuid().optional(),
});

aiRouter.post('/chat', zValidator('json', chatSchema), authMiddleware, async (c) => {
  const body = c.req.valid('json'); // typed, validated
  // ...
});
```

Validation failures return HTTP 400 with a ZodError body by default. Custom error handler:
```ts
zValidator('json', chatSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
  }
})
```

**Why not valibot or yup:** `zod` is already a project dependency. Adding a second validation
library for the same purpose is pure noise.

**Confidence:** HIGH — official Hono middleware, peer deps verified via `npm view`.

---

### 3. Supabase Storage — No New Package

**Finding:** `@supabase/supabase-js ^2.50.0` already includes the Storage client. No new package
is required. The Storage API is part of the existing Supabase JS client.

**Key JS client methods available (supabase-js v2.x):**

```ts
// Create a private bucket (run once, or in migration)
await supabase.storage.createBucket('profile-photos', {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,   // 5 MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

// Upload a file from the backend (service role client)
const { data, error } = await supabase.storage
  .from('profile-photos')
  .upload(`${userId}/avatar.jpg`, fileBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });

// Generate a signed URL for client to download privately
const { data: urlData } = await supabase.storage
  .from('profile-photos')
  .createSignedUrl(`${userId}/avatar.jpg`, 60 * 60); // 1-hour TTL

// Generate a signed UPLOAD URL (mobile client uploads directly to Storage)
const { data: uploadData } = await supabase.storage
  .from('meal-photos')
  .createSignedUploadUrl(`${userId}/${Date.now()}.jpg`);
// Returns: { signedUrl, token, path }
// Client uses uploadToSignedUrl() — no backend bandwidth consumed

// List files in a user's folder
const { data: files } = await supabase.storage
  .from('profile-photos')
  .list(userId, { limit: 10 });

// Delete a file
await supabase.storage
  .from('profile-photos')
  .remove([`${userId}/old-avatar.jpg`]);
```

**Signed upload URL pattern** is preferred for mobile photo uploads (profile photos, meal scan
photos): the Hono backend generates a short-lived signed URL, the mobile client uploads directly
to Supabase Storage, and the backend never buffers the binary payload. This avoids Vercel's
function memory limits and 4.5 MB request body limit.

**Confidence:** HIGH — official Supabase docs confirmed. `@supabase/supabase-js` already in
`package.json`.

---

### 4. CORS Hardening — No New Package

**Finding:** `hono/cors` is already imported and wired in `app.ts`. No new package. The current
configuration is permissive (`*.vercel.app` wildcard). Hardening is a configuration change.

**Current issue in `app.ts`:**
```ts
/^https?:\/\/.*\.vercel\.app$/,  // too broad — allows ANY *.vercel.app
```

**Hardened pattern:**
```ts
cors({
  origin: (origin) => {
    const allowed = new Set([
      'https://ziko-api-lilac.vercel.app',   // production API
      'https://ziko-app.com',                 // marketing site
      process.env.APP_ORIGIN ?? '',           // override via env
    ]);
    // Expo dev tools / local development
    if (!origin || /^exp:\/\//.test(origin) || /^https?:\/\/localhost/.test(origin)) {
      return origin ?? '*';
    }
    return allowed.has(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  credentials: true,
})
```

This is a code change to `app.ts`, not a new dependency. Add `APP_ORIGIN` env var for
staging/preview environments.

**Confidence:** HIGH — `hono/cors` built-in docs confirmed full API.

---

## Integration Notes

### Middleware Order in Hono (critical — positional)

```
Request →
  1. hono/logger          (already in place)
  2. hono/cors            (already in place — hardened config)
  3. rateLimiter()        (NEW — must be before auth to block before Supabase cost)
  4. authMiddleware       (already in place — per-route)
  5. zValidator()         (NEW — per-route, after auth or before depending on endpoint)
  6. Route handler
```

Rate limiting BEFORE auth is deliberate: a brute-force attack should be blocked at the rate
limiter without ever reaching the Supabase auth call (which costs both latency and database load).

Rate limiting should be applied per-route, not globally, with different limits per endpoint type:
- `/ai/chat` and `/ai/chat/stream` — tightest limits (LLM calls are expensive)
- `/pantry/barcode/*` — moderate limits (external OFF API calls)
- `/ai/tools/execute` — same as `/ai/chat`
- `/health`, `/plugins` — no rate limiting (low-cost, read-only)

### Supabase Storage Buckets to Create

Three buckets are needed, all private:

| Bucket | Max file size | Allowed types | Notes |
|--------|--------------|---------------|-------|
| `profile-photos` | 5 MB | `image/jpeg, image/png, image/webp` | One file per user, upsert |
| `meal-photos` | 10 MB | `image/jpeg, image/png, image/webp` | One per meal scan log |
| `exports` | 25 MB | `application/pdf` | User data exports (future) |

Buckets are created via Supabase Dashboard SQL migration or via the JS client in a one-time
setup script. RLS policies on `storage.objects` restrict each user to their own path prefix
(`auth.uid()::text = (storage.foldername(name))[1]`).

### Lifecycle Policy (Object Cleanup)

**Finding:** Supabase Storage does NOT have native S3-style lifecycle policies (auto-expiry rules)
as of 2026-04-02. The `expires_at` metadata field exists on uploads but Supabase does not
automatically delete expired objects — it is only a marker.

**Recommended workaround:** pg_cron job (Supabase provides pg_cron as a built-in extension):

```sql
-- Run daily at 3am UTC — delete meal-photos older than 90 days
SELECT cron.schedule(
  'cleanup-meal-photos',
  '0 3 * * *',
  $$
    SELECT storage.fdelete('meal-photos', name)
    FROM storage.objects
    WHERE bucket_id = 'meal-photos'
      AND created_at < NOW() - INTERVAL '90 days';
  $$
);
```

This is a Supabase migration (SQL), not a new npm package or Vercel cron.

**Confidence:** MEDIUM — pg_cron availability confirmed (Supabase built-in), but the exact
`storage.fdelete` function signature should be verified against the current Supabase version
before shipping. The pattern is community-validated; official Supabase docs don't show this exact
function signature. Alternative: call `supabase.storage.from(bucket).remove([paths])` from a
Supabase Edge Function triggered by pg_cron.

---

## What NOT to Add

| Rejected option | Why |
|-----------------|-----|
| `rate-limiter-flexible` or `express-rate-limit` | In-memory stores — non-functional on Vercel serverless where each instance has isolated memory. Never use for multi-instance deployments. |
| `@upstash/ratelimit` standalone | Requires writing a custom Hono middleware wrapper. `hono-rate-limiter` + the Redis adapter provides the same Upstash backend with a complete Hono-native API. Only use `@upstash/ratelimit` directly if fine-grained algorithm control (token bucket, sliding window) is needed — not required here. |
| `helmet` (Node.js security headers) | Hono is not Express. `helmet` targets Node.js `http.IncomingMessage` and does not work with Hono's `Context`. Hono has a built-in `secureHeaders()` middleware (`hono/secure-headers`) that sets the same headers (X-Content-Type-Options, X-Frame-Options, etc.) natively. If security headers are in scope, use `hono/secure-headers`, not helmet. |
| `joi` or `yup` for validation | `zod` is already a project dependency at `^4.3.6`. A second validation library for the same purpose adds bundle weight and cognitive overhead with zero benefit. |
| `multer` or `formidable` for file uploads | Not compatible with Hono's Vercel adapter. More importantly, the signed upload URL pattern (Hono generates URL → mobile uploads directly to Supabase) means the backend never receives file payloads. No multipart parser needed. |
| `ioredis` or `redis` npm package | These use TCP connections, which are incompatible with Vercel's serverless environment (connections are closed between invocations, causing connection pool exhaustion). Upstash Redis communicates over HTTP/REST — it is the only Redis client appropriate for Vercel serverless. |
| A separate KV store (Vercel KV, Redis Cloud) | Upstash Redis is the documented first-class Vercel integration for rate limiting and is already recommended by Vercel's own templates. Introducing a second KV provider adds operational complexity for no gain. |
| `@supabase/storage-js` standalone | The storage client is already bundled inside `@supabase/supabase-js`. Installing it separately would be a duplicate. |

---

## Summary of New npm Installs

```bash
# From backend/api/
npm install hono-rate-limiter @hono-rate-limiter/redis @upstash/redis @hono/zod-validator
```

That is 4 new packages. No mobile app changes (`apps/mobile/`) are required for this milestone.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Rate limiting (Upstash + hono-rate-limiter) | HIGH | Versions confirmed via `npm view`. Upstash HTTP REST confirmed for serverless. Vercel first-class integration documented. |
| Input validation (`@hono/zod-validator`) | HIGH | Peer deps verified: `zod ^3.25.0 \|\| ^4.0.0` — compatible with project's `zod ^4.3.6`. |
| Supabase Storage API | HIGH | `@supabase/supabase-js` already installed. Storage client methods confirmed via official docs. |
| CORS hardening | HIGH | `hono/cors` already in place — configuration change only, no new package. |
| Lifecycle cleanup (pg_cron) | MEDIUM | pg_cron confirmed as Supabase built-in, but `storage.fdelete` function signature needs validation against live Supabase version before shipping. |

---

## Sources

- [GitHub: rhinobase/hono-rate-limiter](https://github.com/rhinobase/hono-rate-limiter) — v0.5.3, configuration API, RedisStore integration
- [npm: @hono-rate-limiter/redis](https://www.npmjs.com/package/@hono-rate-limiter/redis) — v0.1.4, Upstash RedisStore pattern
- [npm: @upstash/redis](https://www.npmjs.com/package/@upstash/redis) — v1.37.0, HTTP REST Redis client for serverless
- [npm: @upstash/ratelimit](https://www.npmjs.com/package/@upstash/ratelimit) — v2.0.8, algorithms reference
- [Upstash Documentation: Ratelimit Overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — serverless HTTP approach, no TCP connections
- [Vercel Template: Ratelimit with Upstash Redis](https://vercel.com/templates/next.js/ratelimit-with-upstash-redis) — confirms Vercel first-class integration
- [npm: @hono/zod-validator](https://www.npmjs.com/package/@hono/zod-validator) — v0.7.6, peerDeps `zod ^3.25.0 || ^4.0.0`
- [GitHub Issue #1148: Upgrade to zod v4](https://github.com/honojs/middleware/issues/1148) — confirms zod v4 support merged in PR #1173 (May 27 2025)
- [Hono Docs: CORS Middleware](https://hono.dev/docs/middleware/builtin/cors) — full configuration API
- [Supabase Docs: Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart) — bucket creation, upload
- [Supabase Docs: Create Signed Upload URL](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl) — mobile direct upload pattern
- [Supabase Docs: Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — upload options, contentType, upsert
- [GitHub Discussion: Expiring objects in Storage](https://github.com/orgs/supabase/discussions/20171) — confirms no native lifecycle policies, manual cleanup required
- [Supabase Docs: pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron) — scheduled cleanup approach
