# Phase 14: Supabase Storage — Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Three distinct layers:
1. **Supabase SQL migration** — create storage buckets (`profile-photos`, `scan-photos`, `exports`) with path-prefix RLS policies
2. **Backend route** — `GET /storage/upload-url?bucket=&path=` returning Supabase signed upload URLs (60s TTL), auth-protected, bucket allowlisted
3. **Mobile migration** — two screens updated to use signed URL upload flow instead of base64-in-body

All changes are in:
- `supabase/migrations/025_storage_buckets.sql`
- `backend/api/src/routes/storage.ts` (new file)
- `backend/api/src/app.ts` (mount storage router)
- `backend/api/src/routes/ai.ts` (vision/nutrition: accept storage_path)
- `apps/mobile/app/(app)/profile/settings.tsx` (profile photo upload)
- `plugins/nutrition/src/screens/LogMealScreen.tsx` (meal scan photo upload)

</domain>

<decisions>
## Implementation Decisions

### Bucket configuration
- **D-01:** `profile-photos` bucket — PRIVATE for writes, PUBLIC for reads. Profile photos must be displayable without expiring URLs. Pattern: same as existing `avatars` bucket (migration 017) but with path-prefix RLS. Store `publicUrl` in `user_profiles.avatar_url`.
- **D-02:** `scan-photos` bucket — PRIVATE (no public reads). Owner can upload/read via signed URLs only. Meal scan photos are ephemeral.
- **D-03:** `exports` bucket — PRIVATE. Owner can read their own exports via signed download URLs. No uploads from mobile (server-side only in Phase 15).
- **D-04:** Existing `avatars` bucket (migration 017) is left as-is for backward compatibility — existing avatar URLs remain valid.

### RLS policy pattern (all buckets)
- **D-05:** Path prefix enforcement: `(storage.foldername(name))[1] = auth.uid()::text` — prevents cross-user access
- **D-06:** `profile-photos`: INSERT + UPDATE for authenticated, SELECT for `public` (anyone can read profile photos)
- **D-07:** `scan-photos`: INSERT + SELECT + DELETE for authenticated (own folder only)
- **D-08:** `exports`: SELECT for authenticated (own folder only) — no mobile INSERT policy
- **D-09:** No bucket is publicly writable (SC-03)

### Signed upload URL endpoint
- **D-10:** Route: `GET /storage/upload-url` — protected by `authMiddleware`
- **D-11:** Query params: `bucket` (required) and `path` (required)
- **D-12:** Bucket allowlist: `['profile-photos', 'scan-photos', 'exports']` — reject unknown buckets with 400
- **D-13:** Path prefix enforcement: path MUST start with `${userId}/` — reject with 403 if not
- **D-14:** Use `supabase.storage.from(bucket).createSignedUploadUrl(path, { expiresIn: 60 })` — 60-second TTL (SC-05)
- **D-15:** Response: `{ upload_url: string, path: string, token: string }` — client uses `upload_url` for PUT
- **D-16:** Backend uses `SUPABASE_PUBLISHABLE_KEY` (already in env) — `createSignedUploadUrl` works with the publishable key when RLS policies allow it. If not, use the service key via `SUPABASE_SERVICE_KEY` env var (currently available as fallback in auth.ts: `process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY`).
- **D-17:** New Supabase client in `routes/storage.ts` with `{ auth: { autoRefreshToken: false, persistSession: false } }` — same pattern as `middleware/auth.ts`

### Profile photo upload (mobile)
- **D-18:** Replace base64 upload in `settings.tsx` with signed URL flow:
  1. Call `GET /storage/upload-url?bucket=profile-photos&path=${userId}/avatar.${ext}`
  2. PUT `blob` (not base64) directly to `upload_url` with correct `Content-Type`
  3. Get public URL via `supabase.storage.from('profile-photos').getPublicUrl(filePath)` (bucket is public)
  4. Persist `publicUrl` to `user_profiles.avatar_url`
- **D-19:** `ImagePicker` options: `base64: false` (not needed), `quality: 0.7`, `allowsEditing: true`, `aspect: [1,1]`
- **D-20:** Use `fetch(asset.uri)` to get the blob, then PUT to signed URL: `fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: blob })`
- **D-21:** Bucket remains `profile-photos` — the existing `avatars` bucket migration (017) is NOT removed. New uploads go to `profile-photos`; old avatar URLs in `avatars` continue to work.

### Meal scan photo upload (mobile + backend)
- **D-22:** Update `LogMealScreen.tsx`: replace base64 flow with signed URL flow:
  1. Pick image (camera or gallery) — `base64: false`
  2. `GET /storage/upload-url?bucket=scan-photos&path=${userId}/scan-${Date.now()}.jpg`
  3. `fetch(asset.uri)` → blob → PUT to signed URL
  4. POST to `/ai/vision/nutrition` with `{ storage_path: "userId/scan-xxx.jpg", meal_context }` (no base64)
- **D-23:** `POST /ai/vision/nutrition` backend: accept `storage_path` field (new) OR `image` (base64, old — keep for backward compat)
  - If `storage_path`: generate a short-lived signed download URL, pass to Claude as `{ type: 'image', image: new URL(signedDownloadUrl) }`
  - If `image` (base64): existing behavior unchanged
- **D-24:** Signed download URL for vision: `supabase.storage.from('scan-photos').createSignedUrl(path, 300)` — 300 seconds is enough for Claude to fetch and analyze
- **D-25:** Claude vision with URL: Vercel AI SDK v6 accepts `{ type: 'image', image: new URL(signedUrl) }` in the messages array — replace the `image: base64Data, mediaType` fields

### Claude's Discretion
- Exact Supabase client reuse vs. new instance in storage routes
- Error message wording for invalid bucket / path prefix mismatch
- Whether to extract a shared `createSupabaseStorageClient()` helper or inline the client

</decisions>

<specifics>
## Specific Ideas

- The `exports` bucket is infrastructure for Phase 15 (lifecycle cleanup cron). No upload UI needed in Phase 14.
- The existing `avatars` bucket (public, created in migration 017) stays — backward compat for existing avatar_url values.
- `profile-photos` is the new permanent home for profile photos going forward.
- `settings.tsx` currently uses `decode(asset.base64!)` from `base64-arraybuffer` — this import can be removed after migration.
- `LogMealScreen.tsx` currently requests `base64: true` from ImagePicker — change to `base64: false`.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 14 — success criteria (5 verifiable conditions)

### Existing code to modify
- `apps/mobile/app/(app)/profile/settings.tsx` — `pickAndUploadAvatar()` function (lines 37–74): base64 upload to `avatars` bucket → replace with signed URL flow to `profile-photos`
- `plugins/nutrition/src/screens/LogMealScreen.tsx` — `pickImage()` (lines 139–162) and `analyzeImage()` (lines 164–180+): replace base64 with signed URL upload + storage_path POST
- `backend/api/src/routes/ai.ts` — `POST /vision/nutrition` (line 309+): currently accepts `{ image: string (base64), meal_context? }` → add `storage_path` alternative
- `backend/api/src/app.ts` — mount storage router

### Existing patterns to follow
- `backend/api/src/middleware/auth.ts` — Supabase admin client pattern
- `backend/api/src/routes/supplements.ts` — Hono router pattern with auth middleware
- `supabase/migrations/017_avatars_storage.sql` — RLS policy pattern for storage buckets
- `backend/api/src/lib/redis.ts` — single-client initialization pattern

### Current state of relevant files
- `settings.tsx` uses `base64-arraybuffer` decode for upload — this dependency can be dropped
- `017_avatars_storage.sql`: `avatars` bucket is public, has INSERT + UPDATE + SELECT policies
- Next migration number: `025` (migrations go up to `024_food_products.sql`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Profile photo upload (settings.tsx lines 37–74)
```typescript
const pickAndUploadAvatar = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: true, aspect: [1,1], quality: 0.7, base64: true,
  });
  if (result.canceled || !result.assets[0].base64) return;
  const asset = result.assets[0];
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filePath = `${user.id}/avatar.${ext}`;
  // ↑ REPLACE: upload to profile-photos via signed URL instead
  await supabase.storage.from('avatars').upload(filePath, decode(asset.base64!), { contentType: mimeType, upsert: true });
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
  await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
};
```

### Vision nutrition route (ai.ts line 309+)
```typescript
router.post('/vision/nutrition', barcodeScanLimiter, async (c) => {
  const { image, meal_context } = await c.req.json<{ image: string; meal_context?: string; }>();
  if (!image) return c.json({ error: 'image (base64) is required' }, 400);
  // ... base64 validation + Claude vision call
  const { text } = await generateText({
    model: AGENT_MODEL,
    messages: [{ role: 'user', content: [{ type: 'image', image: base64Data, mediaType }, { type: 'text', text: prompt }] }],
  });
});
```

### Auth middleware (auth.ts) — pattern to follow in storage.ts
```typescript
const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

### Supabase signed upload URL API
```typescript
// createSignedUploadUrl (Supabase JS SDK)
const { data, error } = await supabase.storage
  .from(bucket)
  .createSignedUploadUrl(path, { expiresIn: 60 });
// data: { signedUrl, token, path }

// createSignedUrl for downloads
const { data: readData } = await supabase.storage
  .from(bucket)
  .createSignedUrl(path, 300); // 300s TTL
// readData: { signedUrl }
```

### Mobile signed URL upload pattern
```typescript
// Step 1: get signed upload URL from backend
const urlRes = await fetch(`${apiUrl}/storage/upload-url?bucket=profile-photos&path=${userId}/avatar.jpg`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { upload_url } = await urlRes.json();

// Step 2: fetch blob from local URI
const blobRes = await fetch(asset.uri);
const blob = await blobRes.blob();

// Step 3: PUT to Supabase Storage directly
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': mimeType },
  body: blob,
});
```

</code_context>

<deferred>
## Deferred Ideas

- Migrate existing `avatar_url` values from `avatars` bucket to `profile-photos` — deferred, old URLs continue to work
- Presigned download URL caching (for profile display) — deferred, unnecessary for now since profile-photos is publicly readable
- Community plugin: other users' profile photos displayed in leaderboards — deferred

</deferred>

---

*Phase: 14-supabase-storage*
*Context gathered: 2026-04-03*
