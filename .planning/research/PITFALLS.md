# Pitfalls Research: Security + Cloud Infrastructure (v1.3)

**Domain:** Serverless rate limiting (Hono v4 on Vercel) + Supabase Storage (React Native / Expo)
**Researched:** 2026-04-02
**Milestone context:** Adding rate limiting and Supabase Storage buckets to an existing Hono v4 API already deployed on Vercel serverless. Mobile client is Expo SDK 54 with the Supabase JS client.

---

## Summary

The v1.3 feature surface has two distinct failure clusters:

1. **Rate limiting in serverless** — In-memory stores are silently useless on Vercel (no shared state between function instances). IP-based limiting collapses under Vercel's proxy layer. Both failures pass local testing and provide zero protection in production.
2. **Supabase Storage integration** — RLS policy patterns differ fundamentally from all 24 existing migrations. File uploads from React Native have three distinct corruption failure modes (0-byte, wrong MIME type, garbled binary). Vercel's 4.5 MB body limit silently blocks large photos if uploads route through the API.

A third cluster applies only to the PDF export use case: Chromium-based PDF generation on Vercel serverless is unreliable due to cold-start timeouts exceeding the function execution budget.

---

## Critical Pitfalls

### CRIT-01: In-Memory Rate Limiting Is Silently Useless on Vercel

**What goes wrong:** `hono-rate-limiter` ships with a `MemoryStore` default. On a local dev server (single process), it works correctly. On Vercel serverless, each cold-start creates a fresh function instance with a blank in-memory `Map`. Warm instances do not share memory. A user sending 100 requests/minute can hit 10 separate warm instances and bypass a "10 req/min" limit — each instance counts only the fraction it received.

**Why it happens:** Vercel functions are stateless by design. There is no shared memory between concurrent invocations. The MemoryStore counter resets on every cold start and is never synchronized.

**Consequences:** The rate limiter appears to work in `npm run backend` (local), passes any pre-deploy test, and silently provides zero protection in production. The `hono-rate-limiter` README frames MemoryStore as "works out of the box" — the serverless caveat is in a secondary section.

**Prevention:** Use an external atomic store. Recommended: `@upstash/ratelimit` with Upstash Redis. It is HTTP-based (no persistent TCP connection), designed specifically for serverless, and the free tier (10,000 commands/day) is sufficient for a fitness app at early stage.

Minimal pattern for Hono:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
});

app.use("/ai/*", async (c, next) => {
  const identifier = c.get("auth")?.userId
    ?? c.req.header("x-real-ip")
    ?? "anon";
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(reset));
  if (!success) return c.json({ error: "Too Many Requests" }, 429);
  return next();
});
```

Required env vars in `backend/api/.env` AND Vercel dashboard:
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

**Detection:** Rate limiting works locally but repeated hammering of the deployed endpoint never returns 429.

**Phase warning:** Any plan that adds rate limiting must start with external store provisioning. The middleware is the easy part; the store is the gating dependency.

---

### CRIT-02: IP-Based Rate Limiting Breaks When Vercel Acts as Proxy

**What goes wrong:** Using raw request IP or naively reading `x-forwarded-for` for per-IP rate limiting can cause every user in a deployment to share a single rate limit bucket — specifically Vercel's own egress IPs.

**Why it happens:** On non-Enterprise Vercel plans, `x-forwarded-for` is overwritten by Vercel. Multiple real users appear as the same handful of Vercel egress IPs. A practical consequence is that the rate limiter rate-limits the entire user base simultaneously after a few power users trigger the threshold.

**Consequences:** A single active user triggers the per-IP bucket and rate-limits everyone sharing that Vercel egress IP. Or the limit is never triggered because the IP is constant and recognized as Vercel infrastructure.

**Prevention:**
1. For authenticated endpoints (AI chat, barcode scan), use `userId` from the Supabase JWT as the rate limit key. The auth middleware already sets `c.set('auth', { userId })`.
2. For unauthenticated endpoints, read `c.req.header('x-real-ip')` first — this header is set by Vercel to the actual client IP and is more reliable than `x-forwarded-for`.
3. Never use `x-forwarded-for` as the sole source — it can be spoofed before reaching Vercel and is overwritten at the Vercel layer.

```typescript
// Key selection order for rate limiting
const key = c.get("auth")?.userId           // authenticated: per user (preferred)
  ?? c.req.header("x-real-ip")              // unauthenticated: real client IP
  ?? c.req.header("x-forwarded-for")?.split(",")[0]
  ?? "unknown";
```

---

### CRIT-03: Supabase Storage RLS Cannot Use the Standard `auth.uid() = user_id` Pattern

**What goes wrong:** All 24 existing migrations use `auth.uid() = user_id` for RLS. Storage objects in user-owned buckets (profile photos, meal scan photos) do NOT have a `user_id` column. Copying any existing RLS migration block onto `storage.objects` produces a policy that matches nothing — every INSERT and SELECT is silently denied.

**Why it happens:** `storage.objects` is a special system table. Ownership must be expressed via path prefix using the `storage.foldername(name)` helper function, or via the `owner_id` system column set automatically at upload time. This is a known trap — the same `auth.uid() = user_id` assumption already burned the project on `food_products` (migration 024 required `auth.role() = 'authenticated'`). Storage is a different divergence but the same category of error.

**Consequences:** All uploads and downloads return 403. The Supabase JS client returns a storage error object rather than throwing, so the mobile app can swallow the error silently if the calling code does not check `if (error) throw error`.

**Prevention:** Use path-prefix scoping. All user-owned files must be stored under `{userId}/{filename}`:

```sql
-- Users may upload only to their own folder
CREATE POLICY "users_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);

-- Users may read only their own files
CREATE POLICY "users_read_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
);
```

Mobile upload path must match: always upload to `{userId}/avatar.jpg`, never to a flat `avatar.jpg` path.

For shared/catalogue buckets with no per-user ownership (e.g. a public exercise illustrations bucket):
```sql
CREATE POLICY "authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exercise-media');
```

**Detection:** `supabase.storage.from('bucket').upload(...)` returns `{ error: { message: 'new row violates row-level security policy' } }`. Always assert `if (storageError) throw storageError` after every Storage call.

---

### CRIT-04: Vercel 4.5 MB Body Limit Silently Blocks Photo Uploads Through the API

**What goes wrong:** If the mobile app uploads a photo by POSTing to the Hono API (which then proxies it to Supabase Storage), any file over 4.5 MB triggers `413 FUNCTION_PAYLOAD_TOO_LARGE` at the Vercel infrastructure layer before the Hono handler runs.

**Why it happens:** Vercel serverless functions enforce a hard 4.5 MB request body limit on all plans. Profile photos from iPhone 14+ and modern Android cameras routinely exceed this. The Hono handler never receives the request — there is no server-side log entry.

**Consequences:** Users with newer phones silently fail to upload profile photos. The mobile app receives a 413 with no JSON body; if the Supabase client wrapper does not handle non-JSON error responses, the app may crash or display a generic error with no actionable message.

**Prevention:** Never route binary file uploads through the Hono API. Use a signed URL flow:

1. Mobile calls `POST /storage/upload-token` on Hono (tiny JSON request — just auth + bucket + filename).
2. Hono calls `supabase.storage.from(bucket).createSignedUploadUrl(path)` and returns the `{ signedUrl, token, path }` to the mobile client.
3. Mobile uploads directly to Supabase Storage via `uploadToSignedUrl` — Vercel is not in the path.

```typescript
// Hono: token endpoint (tiny, always under 4.5 MB limit)
app.post("/storage/upload-token", authMiddleware, async (c) => {
  const { bucket, filename } = await c.req.json();
  const userId = c.get("auth").userId;
  const path = `${userId}/${filename}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { expiresIn: 300 });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
```

```typescript
// Mobile: direct upload to Storage (bypasses Vercel)
const { data: tokenData } = await apiClient.post("/storage/upload-token", {
  bucket: "profile-photos",
  filename: "avatar.jpg",
});
const { error } = await supabase.storage
  .from("profile-photos")
  .uploadToSignedUrl(tokenData.path, tokenData.token, arrayBuffer, {
    contentType: "image/jpeg",
  });
```

---

## Integration Pitfalls

### INT-01: React Native Upload Produces 0-Byte Files or Wrong MIME Type

**What goes wrong:** Three distinct failure modes observed in production React Native / Supabase Storage integrations:
- Uploading a `File` object → 0-byte file on iOS
- Uploading a raw base64 string (not decoded) → garbled binary stored as UTF-8 text
- Global `Content-Type: application/json` header on the Supabase client → file stored as `application/json` regardless of the `contentType` option passed to `.upload()`

**Why it happens:**
- React Native does not implement the browser `File` API for binary reading on iOS.
- Supabase Storage's `.upload()` requires a `Blob`, `ArrayBuffer`, or `ReadableStream` — not a base64 string.
- If the Supabase client was initialized with `headers: { 'Content-Type': 'application/json' }` (a common pattern copied from REST setup guides), it overrides the per-upload content type.

**Prevention:**

```typescript
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  base64: true,
  quality: 0.8,
});

if (!result.canceled && result.assets[0]?.base64) {
  const arrayBuffer = decode(result.assets[0].base64);
  const { error } = await supabase.storage
    .from('profile-photos')
    .upload(`${userId}/avatar.jpg`, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw error;
}
```

Do NOT initialize the Supabase client with a global `Content-Type` header. The storage upload uses multipart internally; a global JSON content-type header corrupts every binary upload silently.

---

### INT-02: Public Bucket Exposes All User Files Without Authentication

**What goes wrong:** Setting a bucket to `public: true` in the Supabase dashboard or via `createBucket` means anyone with the file URL — including unauthenticated users and scrapers — can read any file in the bucket. RLS policies are bypassed for GET requests on public buckets.

**Why it happens:** Public buckets are designed for genuinely public assets (marketing images, CDN-served illustrations). Teams use them for convenience (no signed URL generation) without realizing the RLS bypass.

**Consequences:** Profile photos and meal scan photos (personal health data) become publicly readable if the URL is guessed or leaked. This violates RGPD — personal health data must not be publicly accessible.

**Prevention:** Keep profile photos and meal scan photos in private buckets. Serve them via signed URLs with appropriate expiry:

```typescript
// For profile photo display (cache locally, long expiry)
const { data } = await supabase.storage
  .from('profile-photos')
  .createSignedUrl(`${userId}/avatar.jpg`, 60 * 60 * 24 * 7); // 7 days

// For transient meal scan photos (short-lived)
const { data } = await supabase.storage
  .from('meal-scans')
  .createSignedUrl(`${userId}/${scanId}.jpg`, 3600); // 1 hour
```

Only use a public bucket for non-personal, truly public assets such as a shared exercise illustration library.

---

### INT-03: Signed Upload URLs Expire in 60 Seconds — Mobile UX Trap

**What goes wrong:** The default `expiresIn` for `createSignedUploadUrl` is 60 seconds. If the upload token is generated when the user opens the photo picker, and they spend 90 seconds cropping and previewing, the token is expired when `uploadToSignedUrl` is called. The error response is a 400 with a non-obvious message that is easy to misidentify as a network or auth error.

**Why it happens:** Signed upload URLs are intentionally time-limited. 60 seconds is appropriate for automated server-to-server flows but is too short for interactive mobile UX with photo editing.

**Prevention:**
1. Generate the signed URL at the moment the user confirms upload (after preview), not when the picker opens.
2. Always set an explicit `expiresIn` of at least 300 seconds (5 minutes) for interactive flows.
3. On the mobile side, detect upload errors and retry by fetching a fresh token — never re-use an expired token.

```typescript
// In Hono: generate with explicit 5-minute expiry
const { data } = await supabase.storage
  .from(bucket)
  .createSignedUploadUrl(path, { expiresIn: 300 });
```

---

### INT-04: Supabase Storage Has No Native Lifecycle Policies

**What goes wrong:** The milestone requirement includes "lifecycle policies — auto-cleanup of old assets." Teams assume this mirrors AWS S3 TTL rules (declarative, set-and-forget). Supabase Storage does not expose S3 lifecycle APIs. There is no built-in object expiration mechanism.

**Why it happens:** Supabase Storage is S3-compatible at the protocol level but its hosted service does not surface the S3 lifecycle configuration API. This is an open feature request in the Supabase community as of 2025 with no delivery timeline.

**Consequences:** Meal scan photos and PDF exports accumulate indefinitely. Storage costs grow unbounded. The lifecycle cleanup requirement cannot be satisfied with a declarative policy — it requires code.

**Prevention:** Implement cleanup via a Vercel cron (already used for supplement scraping in the project). Pattern using `user_metadata.expires_at`:

At upload time, tag the file with an expiry:
```typescript
await supabase.storage.from('meal-scans').upload(path, arrayBuffer, {
  contentType: 'image/jpeg',
  metadata: { expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
});
```

In the cron job:
```typescript
// Query storage.objects for expired files
const { data: expired } = await supabase
  .from('objects') // storage.objects exposed via schema
  .select('name, bucket_id')
  .eq('bucket_id', 'meal-scans')
  .lt('user_metadata->>expires_at', new Date().toISOString());

if (expired?.length) {
  await supabase.storage.from('meal-scans')
    .remove(expired.map(f => f.name));
}
```

Alternatively list files per user and delete those older than the retention window. The cron pattern already exists in the project (`POST /supplements/cron/scrape`) — reuse it.

---

### INT-05: CORS Middleware Must Be the First Registered Middleware in Hono

**What goes wrong:** Placing `app.use(cors(...))` after `app.use('/ai/*', authMiddleware)` causes OPTIONS preflight requests to reach the auth middleware first and return 401. The CORS headers are never set on the 401 response. The Expo app's `fetch` layer sees a CORS error instead of an auth error.

**Why it happens:** Hono executes middleware in registration order. OPTIONS is a real HTTP method — if auth middleware runs first and rejects it, the browser/RN HTTP layer cannot distinguish a CORS failure from a network failure.

**Consequences:** Debugging is expensive. The backend logs show 401. The mobile app logs show a network or CORS error. Teams spend significant time diagnosing auth when the real issue is middleware order.

**Prevention:**

```typescript
// CORRECT: cors registered before everything else
app.use('*', cors({
  origin: [
    'https://ziko-api-lilac.vercel.app',
    'http://localhost:3000',
    'exp://localhost:8081',
  ],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}));

// Auth middleware registered after CORS
app.use('/ai/*', authMiddleware);
app.use('/storage/*', authMiddleware);
```

`allowHeaders` must list every custom header the Expo app sends. Missing `Authorization` from this list is the most common cause of preflight rejection. When using Vercel AI SDK on the client, also ensure `Content-Type` is listed.

---

### INT-06: PDF Generation on Vercel Serverless Timeouts on the Free Plan

**What goes wrong:** Using Puppeteer or Playwright to generate a PDF (for the "exports/PDF" bucket) exceeds Vercel's 10-second function timeout on the free plan. Cold-starting Chromium alone takes 10–20 seconds. Even on Pro (60-second timeout), cold starts on low-traffic endpoints remain unpredictable.

**Why it happens:** Headless Chromium is 50–100 MB unzipped. On a cold-start, the function must initialize the binary, launch the browser, and render the page within the execution window. Free-plan functions have a hard 10-second limit.

**Consequences:** PDF export endpoint returns 504 Gateway Timeout for the majority of requests. The failure is non-deterministic — warm instances may succeed, cold ones fail — making it hard to reproduce in testing.

**Prevention:** Two viable approaches, in order of preference:

1. **Avoid Chromium entirely.** Use `@react-pdf/renderer` (renders React component trees to PDF without a browser, runs in Node.js). Suitable for structured exports: workout history, nutrition summary, body measurements report. Fast, deterministic, no cold start penalty.

2. **If HTML-to-PDF is required.** Use `@sparticuz/chromium-min` (a stripped ~15 MB Chromium build designed for serverless) with `puppeteer-core`. Set Vercel function `maxDuration: 60` and target the `iad1` region (lowest cold start latency). This is still fragile — prefer option 1.

Never use the `puppeteer` package (which downloads its own full Chromium) on Vercel — it will exceed the 250 MB function bundle size limit.

---

### INT-07: `hono-rate-limiter` README Is Misleading About Serverless Environments

**What goes wrong:** Teams read the Getting Started section of `hono-rate-limiter`, implement `MemoryStore`, and deploy. The README documents the serverless caveat in a separate "Stores" section that is easy to skip.

**Exact README warning (Stores section):** "MemoryStore does not synchronize state across instances. Deployments requiring more consistently enforced rate limits should use an external store."

**Prevention:** Before writing any rate limiting code, read the Stores section. The implementation decision (which store) must precede the middleware code. See CRIT-01 for the correct store setup.

---

## Prevention Strategies

### Strategy A: External Store Before Any Middleware Code

Provision Upstash Redis and confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present in the Vercel environment dashboard before writing any middleware. The store is the gating dependency — without it, all rate limiting code provides false security.

### Strategy B: userId as Primary Rate Limit Key

Use `userId` from the Supabase JWT for all authenticated endpoints (AI chat, barcode scan). Fall back to `x-real-ip` for unauthenticated endpoints. Never use `x-forwarded-for` as the primary key. Never use IP as the key for authenticated routes — a VPN user gets a new IP on every reconnect.

### Strategy C: Signed URL Upload Pattern — Never Proxy Binaries Through Hono

The Hono API must never receive binary file bodies. All upload flows follow: mobile requests a signed URL from Hono (tiny JSON exchange) → mobile uploads directly to Supabase Storage. This sidesteps the Vercel 4.5 MB body limit and reduces function invocation count and cost.

### Strategy D: Storage RLS Uses Path Prefix, Not user_id Column

Every Storage RLS policy for user-owned buckets uses `(storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')`. File paths are structured as `{userId}/{filename}` in all client upload code. The RLS policy and the upload path convention must be consistent — if the client uploads to a flat path, the policy denies it.

### Strategy E: ArrayBuffer for All React Native File Uploads

All image uploads from React Native use `decode(base64)` from `base64-arraybuffer` before calling `.upload()`. Never pass `File`, `Blob` from a URI string, or raw base64 strings. Always pass `contentType` explicitly. Never set a global `Content-Type: application/json` header on the Supabase client instance.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Rate limiting middleware setup | CRIT-01: MemoryStore silently useless | Provision Upstash Redis before writing any middleware code |
| Per-IP limiting on unauthenticated routes | CRIT-02: Vercel IP address collapse | Use `x-real-ip`; use `userId` for authenticated routes |
| Supabase Storage bucket creation + RLS | CRIT-03: Copy-paste from user_id migrations | Write RLS from scratch using `storage.foldername(name)[1]` pattern; never copy existing migration |
| File upload flow design | CRIT-04: Vercel 4.5 MB body limit | Implement signed URL flow; never proxy binary bodies through Hono |
| Mobile image upload implementation | INT-01: 0-byte or corrupted files | Use `base64-arraybuffer` decode; explicit `contentType`; no global JSON header |
| Profile photo bucket | INT-02: Public bucket exposes personal data | Private bucket only; serve via signed URLs with appropriate expiry |
| Photo upload UX (pick → preview → confirm) | INT-03: Signed URL 60-second expiry | Generate signed URL at confirm step, not at picker open; set 5-minute expiry |
| Lifecycle cleanup for exports and meal scans | INT-04: No native lifecycle in Supabase Storage | Vercel cron + `.remove()` loop; tag files with `expires_at` in user_metadata at upload time |
| CORS configuration | INT-05: Auth middleware before CORS causes preflight 401 | `app.use('*', cors(...))` must be the first middleware registered |
| PDF export endpoint | INT-06: Chromium cold-start timeout | Use `@react-pdf/renderer` for structured data exports; avoid Puppeteer entirely |

---

## Sources

- [hono-rate-limiter (rhinobase/hono-rate-limiter)](https://github.com/rhinobase/hono-rate-limiter) — MemoryStore serverless warning; MEDIUM confidence (community package)
- [Rate Limiting Hono Apps: An Introduction (Fiberplane)](https://fiberplane.com/blog/rate-limiting-intro/) — distributed state failure analysis; MEDIUM confidence
- [Upstash Serverless Rate Limiting](https://upstash.com/blog/upstash-ratelimit) — sliding window, serverless-first design; HIGH confidence (official)
- [Vercel Functions Limitations — 4.5 MB body limit](https://vercel.com/docs/functions/limitations) — HIGH confidence (official docs)
- [How to bypass Vercel 4.5 MB body limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) — signed URL pattern; HIGH confidence (official KB)
- [Vercel Request Headers — x-real-ip](https://vercel.com/docs/headers/request-headers) — IP header behavior; HIGH confidence (official docs)
- [Add Rate Limiting with Vercel KV](https://vercel.com/guides/rate-limiting-edge-middleware-vercel-kv) — HIGH confidence (official guide)
- [Supabase Storage Access Control — RLS + foldername helper](https://supabase.com/docs/guides/storage/security/access-control) — HIGH confidence (official docs)
- [Supabase Storage Ownership — owner_id column](https://supabase.com/docs/guides/storage/security/ownership) — HIGH confidence (official docs)
- [Supabase Storage Hierarchical RLS Challenges](https://supabase.com/docs/guides/troubleshooting/supabase-storage-inefficient-folder-operations-and-hierarchical-rls-challenges-b05a4d) — HIGH confidence (official troubleshooting)
- [React Native file upload with Supabase Storage (Supabase Blog)](https://supabase.com/blog/react-native-storage) — ArrayBuffer + base64-arraybuffer pattern; HIGH confidence (official)
- [Upload of ArrayBuffer ends up corrupted (supabase/supabase #7252)](https://github.com/supabase/supabase/issues/7252) — content-type corruption; MEDIUM confidence (community issue)
- [Uploaded files as 0 bytes in React Native Expo (discussion #2336)](https://github.com/orgs/supabase/discussions/2336) — File object on iOS; MEDIUM confidence (community)
- [Supabase Storage saves as application/json despite contentType (discussion #34982)](https://github.com/orgs/supabase/discussions/34982) — global header override; MEDIUM confidence (community)
- [Hono CORS Content-Type issue (#4184)](https://github.com/honojs/hono/issues/4184) — CORS middleware ordering; MEDIUM confidence (maintainer response)
- [Expiring objects in Supabase Storage — no native lifecycle (discussion #20171)](https://github.com/orgs/supabase/discussions/20171) — lifecycle gap confirmed; MEDIUM confidence (community + maintainer)
- [HTML to PDF benchmark 2026: Playwright vs Puppeteer (pdf4.dev)](https://pdf4.dev/blog/html-to-pdf-benchmark-2026) — Chromium cold start timing; MEDIUM confidence (third-party benchmark)
