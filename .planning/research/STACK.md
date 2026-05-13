# Stack Research — v1.5 Coach Platform & CRM

**Project:** Ziko Platform — v1.5 Coach Platform & CRM
**Researched:** 2026-05-13
**Confidence:** HIGH
**Scope:** Additive only. Existing validated stack (Expo SDK 54, RN 0.81, Hono v4 `^4.7.0`,
`@supabase/supabase-js ^2.50.0`, `zod ^4.3.6`, `@upstash/redis ^1.37.0`,
`@upstash/ratelimit ^2.0.8`, `ai ^6.0.116`, `@ai-sdk/anthropic ^3.0.58`, NativeWind v4,
Zustand v5, TanStack Query v5, Next.js 14 App Router + next-intl + Tailwind v4 on
ziko-app.com) is NOT re-researched. v1.4 credit middleware (`creditCheck`/`creditDeduct`)
and atomic `deduct_ai_credits` RPC remain authoritative — all new AI surfaces re-use them.

---

## Overview

v1.5 needs three capability bundles: **(1)** an authenticated `/coach` section
on the existing Next.js website (table-driven CRM, server-side Supabase auth,
modular bounded-context routes); **(2)** AI-driven multi-format file imports
(PDF/Excel/Word/image → `generateObject` + Zod → `workout_programs`); **(3)** Strava
OAuth client + webhooks for cardio sync. Net additions: **6 backend packages**,
**4 web packages**, **0 new mobile packages**. All AI calls route through existing
`@ai-sdk/anthropic ^3.0.58` and existing credit middleware — no new AI infra.

The web app (`apps/web/`) does **not yet exist in this monorepo** — the Next.js
`ziko-app.com` repo currently lives separately. Phase 0 of v1.5 must either
(a) onboard that repo into the Turborepo workspace as `apps/web/` or (b) keep it
external and treat its dependencies as a separate package.json target. Recommendation:
**onboard** — bounded-context modules in `apps/web/src/app/(coach)/` share types
with `backend/api/src/coach/` and Supabase migrations, and Turborepo `dependsOn`
graphs let `npm run dev` start mobile + backend + web together.

---

## New Dependencies

### Backend (`backend/api/`)

| Library | Version | Purpose | Why this over alternatives |
|---------|---------|---------|----------------------------|
| `unpdf` | `^1.6.2` | Server-side PDF text/page extraction in serverless (Vercel Node runtime) — used as a **fallback** when Claude PDF native parsing rejects a file or when we need a quick page count / size validation pre-flight | Pure-JS, zero native deps, works on Vercel. `pdf-parse` and `pdfjs-dist` pull `canvas` (Python/C++ build chain) which breaks on Vercel cold starts. unpdf is the unjs-maintained wrapper around pdf.js with explicit serverless build. |
| `exceljs` | `^4.4.0` | Parse `.xlsx`/`.xls` uploads into JSON rows for downstream Claude structuring | 6× lower memory than SheetJS in serverless (verified for 512MB Vercel functions). Streaming API avoids loading 5MB workbooks fully into RAM. SheetJS Pro streaming is paid; SheetJS CE is in-memory only. ExcelJS is MIT, no commercial license. |
| `mammoth` | `^1.12.0` | Extract raw text + light HTML structure from `.docx` (coach program docs) | Industry standard. `extractRawText({buffer})` returns clean paragraphs — exactly what Claude needs as input. `docx-preview`/`docxtemplater` target rendering/templating, not extraction. |
| `nanoid` | `^5.0.0` | Generate 6-character invitation codes (`customAlphabet` with no-lookalike alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`) | Battle-tested collision math, 118-byte runtime, supports custom alphabets natively. `crypto.randomBytes` would work but requires manual alphabet mapping + collision retry logic. nanoid's collision calculator confirms 6 chars × 32-char alphabet = ~1B IDs at 1% collision risk — fine for invitation codes that we also check unique against DB. |
| `strava-v3` or **direct fetch** | n/a | Strava OAuth token exchange + webhook subscription management | **Recommendation: skip the SDK, use direct `fetch` calls to Strava's REST API.** Strava's OAuth flow is 3 endpoints (`/oauth/authorize`, `/oauth/token`, `/api/v3/oauth/token` for refresh) and the webhook surface is 2 endpoints (`POST /push_subscriptions`, `GET /push_subscriptions/:id`). Existing fetch + Zod validators in `backend/api/` are sufficient. SDKs like `strava-v3` are unmaintained (last update >2 years) and `@james-langridge/strava-sdk` has <1k weekly downloads. Adding a thin `backend/api/src/lib/strava.ts` helper (typed wrappers around the 6 endpoints we need) is lower risk than a stale SDK. |
| `@supabase/supabase-js` (existing) | `^2.50.0` | Reused for `coach_client_links` RLS queries — no version bump | Already installed. RLS policies on existing tables get JOIN-extended (see ARCHITECTURE.md). |

**Net backend additions: 4 new packages** (`unpdf`, `exceljs`, `mammoth`, `nanoid`). Strava handled with direct fetch.

### Web (`apps/web/` — new workspace, currently in separate repo)

Existing web stack from v1.0 landing (must remain installed): Next.js 14+ App Router,
`next-intl`, Tailwind v4, `@supabase/supabase-js`, `server-only`, `next/font`.

| Library | Version | Purpose | Why this over alternatives |
|---------|---------|---------|----------------------------|
| `@supabase/ssr` | `^0.5.x` (verify latest) | Server-side Supabase auth — cookie-based session sharing between RSC, server actions, route handlers, middleware | **Required** for authenticated `/coach/*` routes. The deprecated `@supabase/auth-helpers-nextjs` is replaced by `@supabase/ssr` for App Router. Handles the "cookies are read-only in Server Components" caveat with the try/catch pattern. Uses publishable key (`sb_publishable_*`) — matches v1.3 key rotation. |
| `@tanstack/react-table` | `^8.21.3` | CRM client-list table (sort, filter, pagination, row selection) | **Headless** — gives us full control over rendering with Tailwind v4 + Ziko design tokens. 1.6M weekly downloads, de facto React standard. AG Grid Community works but locks copy-paste/pivot/Excel-select behind Enterprise. With <10k clients/coach (realistic ceiling), TanStack Table + `react-virtual` is faster than AG Grid's full-grid initialization. Already in our ecosystem (v5 TanStack Query is installed — same team, similar patterns). |
| `@tanstack/react-virtual` | `^3.10.x` | Row virtualization for client lists > 200 rows | Companion to TanStack Table. Only loaded on the clients-list page (dynamic import). |
| `react-dropzone` | `^14.2.x` | Drag-and-drop file upload UI for AI imports (web only — mobile uses `expo-document-picker` already) | Most-used React DnD primitive (~2M/week). MIT, accessible, type-safe. Alternatives (`react-uploady`, custom `<input type="file">`) either add too much (full upload manager) or too little (no DnD UX). |
| `lucide-react` (existing or new) | `^0.460.x` | Icons in CRM tables/cards on web — mirrors Ionicons used on mobile | Already standard on Next.js. If the v1.0 landing uses `@heroicons/react` instead, keep it — don't add a second icon set. Verify before installing. |

**Server-side AI imports library duplication note:** unpdf, exceljs, mammoth are **backend
only** — file parsing happens server-side in Hono after upload to Supabase Storage. The web
app sends signed-URL refs to the backend; it does NOT parse files in the Next.js layer. This
keeps the web bundle small and lets us reuse the same import code paths for mobile uploads.

**Net web additions: 4 new packages** (`@supabase/ssr`, `@tanstack/react-table`,
`@tanstack/react-virtual`, `react-dropzone`).

### Mobile (`apps/mobile/`)

| Library | Version | Purpose | Why this over alternatives |
|---------|---------|---------|----------------------------|
| `expo-web-browser` | already installed (`~14.x` SDK 54) | Strava OAuth flow — opens in-app browser to `strava.com/oauth/mobile/authorize`, returns via deep link | Already in the project from prior OAuth-style flows. Use `WebBrowser.openAuthSessionAsync` for the round-trip. |
| `expo-linking` | already installed | Deep-link callback handler for Strava redirect | Already installed. Configure `scheme: "ziko"` in `app.json` (already there). |
| `expo-document-picker` | already installed | File upload for AI imports from mobile (athlete side) | Already installed for the photo-scan flow — supports `.pdf`, `.xlsx`, `.docx`, images. |

**Net mobile additions: 0 new packages.** Strava OAuth and file imports re-use existing
Expo modules. Confirm in Phase 0 that the project's existing `app.json` already declares
`expo-web-browser` and `expo-linking` — based on `CLAUDE.md` documentation it does.

---

## File Parsing Strategy (for AI imports)

**Core principle:** Maximize use of Claude's native multimodal capabilities. Only run
local parsers when (a) the file format isn't natively supported by Claude or (b) we need
deterministic structure pre-AI (Excel rows). Always feed Claude through `generateObject`
+ Zod for typed, validated output. Always count tokens through existing v1.4 `ai_cost_log`
+ credit middleware.

| File type | Strategy | Library (if any) | Claude model | Token cost (typical) | Notes |
|-----------|----------|------------------|--------------|----------------------|-------|
| **PDF** (text + tables, ≤32MB, ≤100 pages) | **Native Claude** — send base64 via AI SDK `file` content type with `mediaType: 'application/pdf'`. Claude extracts text + reads tables visually. | None for happy path. `unpdf` as fallback (page count validation, oversized rejection, optional pre-extract for very small PDFs to save Sonnet tokens). | `claude-sonnet-4-20250514` (programs need reasoning over multi-page tables) | ~3-8k input + ~1k output ≈ $0.025/import | AI SDK passes PDF directly to Anthropic API. Claude returns structured `weeks_data` via `generateObject` with Zod schema. Validate page count ≤100 server-side BEFORE forwarding (use unpdf). |
| **Image** (screenshot, workout photo, JPG/PNG/HEIC, ≤10MB) | **Native Claude vision** — send as `image` content type via AI SDK | None | `claude-haiku-4-5-20251001` for OCR-style screenshots (cheaper, fast); `claude-sonnet-4-20250514` if image is a complex multi-week program photo | Haiku: ~1k in + ~500 out ≈ $0.0035. Sonnet: ~$0.015 | Re-use the v1.4 food-scan signed-URL pattern (Supabase Storage → signed URL → AI SDK `image` content). Haiku already validated for vision in v1.4. |
| **Excel** (`.xlsx`, `.xls`, ≤5MB, ≤50k rows) | **Two-stage**: ExcelJS streams workbook → JSON array of rows → send JSON-as-text to Claude for semantic structuring (which column is reps? which is weight? what's the week schema?) | `exceljs ^4.4.0` | `claude-sonnet-4-20250514` (semantic mapping needs reasoning) | After ExcelJS: ~2-5k in + ~1k out ≈ $0.015-$0.03 | We compress dimensionality before AI. A 1000-row workout sheet becomes a 100-line JSON sample (first 5 rows of each sheet + headers). Saves ~80% input tokens vs raw upload. |
| **Word** (`.docx`, ≤10MB) | **Two-stage**: mammoth extracts raw text → send to Claude for structuring | `mammoth ^1.12.0` | `claude-sonnet-4-20250514` | ~2-6k in + ~1k out ≈ $0.020 | `mammoth.extractRawText({buffer})` gives clean paragraphs. Skip `convertToHtml` — adds noise (CSS) that wastes tokens. |
| **CSV** | **EXPLICITLY DEFERRED** — replaced by AI imports per PROJECT.md "Out of Scope" | None | — | — | Anti-feature. AI handles CSV-via-Excel path if user renames. No CSV parser to maintain. |
| **Plain text / Markdown** | **Direct to Claude** as text content. No library. | None | `claude-sonnet-4-20250514` | Variable | Edge case (rare in coach world). |

**Common pre-flight checks (all formats):**
1. Validate MIME type matches extension (mobile / web both lie).
2. Hard-cap file size: PDF 32MB, image 10MB, Excel 5MB, Word 10MB.
3. Run `creditCheck` middleware for the **import-specific cost class** (NEW credit class — see Integration Points below).
4. Upload to Supabase Storage `ai-imports/{user_id}/{uuid}.{ext}` bucket (NEW — covered in ARCHITECTURE.md).
5. Generate signed URL (5 min TTL) and pass to AI SDK.
6. After AI returns structured `workout_programs` JSON, present a **preview-then-commit** UI — never auto-save.

**Schema validation:** All `generateObject` calls use a shared Zod schema:

```ts
// backend/api/src/coach/imports/schemas.ts
export const ImportedProgramSchema = z.object({
  title: z.string().min(1).max(200),
  weeks: z.array(z.object({
    week_number: z.number().int().positive(),
    sessions: z.array(z.object({
      day_label: z.string(),
      exercises: z.array(z.object({
        name: z.string(),
        sets: z.number().int().positive(),
        reps: z.string(), // "8-10" / "AMRAP" / "12"
        weight_kg: z.number().optional(),
        rpe: z.number().min(1).max(10).optional(),
        rest_seconds: z.number().int().optional(),
        notes: z.string().optional(),
      })),
    })),
  })),
  goal: z.enum(['hypertrophy', 'strength', 'endurance', 'cardio', 'mixed']).optional(),
  duration_weeks: z.number().int().positive(),
});
```

The Zod schema gates AI hallucination (missing reps, invalid units, fictional structures)
before the data ever reaches `workout_programs`.

---

## Strava OAuth Integration

### Token storage approach

- **Supabase table `strava_tokens`** (new migration in v1.5):
  - `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `athlete_id BIGINT NOT NULL` (Strava athlete identifier)
  - `access_token TEXT NOT NULL` (encrypted at rest via Supabase column encryption — defer to v1.6 if column encryption not yet enabled; for v1.5, RLS-only with service-role write is acceptable)
  - `refresh_token TEXT NOT NULL`
  - `expires_at TIMESTAMPTZ NOT NULL`
  - `scope TEXT NOT NULL DEFAULT 'read,activity:read_all'`
  - `connected_at TIMESTAMPTZ DEFAULT now()`
- **RLS**: user can read their own row; only backend service role can write/update. Refresh happens server-side only — refresh_token NEVER leaves backend.

### Initial token exchange flow

1. Mobile: button "Connecter Strava" → `WebBrowser.openAuthSessionAsync('https://www.strava.com/oauth/mobile/authorize?client_id=…&redirect_uri=ziko://strava/callback&response_type=code&scope=read,activity:read_all&approval_prompt=auto')`
2. Strava redirects back to `ziko://strava/callback?code=…&scope=…`
3. Mobile sends `code` to `POST /strava/exchange` (Hono, auth-required)
4. Backend POSTs to `https://www.strava.com/api/v3/oauth/token` with `client_id`, `client_secret` (from `backend/api/.env`), `code`, `grant_type=authorization_code`
5. Backend stores `{ access_token, refresh_token, expires_at, athlete_id }` in `strava_tokens`
6. Backend triggers initial sync: fetch last 30 days of activities, insert into `cardio_sessions` with `source='strava'` and `strava_activity_id` (NEW column)

### Refresh strategy

Strava access tokens expire every 6h. Implement **just-in-time refresh** in a helper:

```ts
// backend/api/src/coach/clients/strava/getValidToken.ts (simplified pseudocode)
async function getValidStravaToken(userId: string): Promise<string> {
  const row = await db.from('strava_tokens').select('*').eq('user_id', userId).single();
  if (Date.now() < row.expires_at - 60_000) return row.access_token; // 1min buffer
  // Refresh
  const res = await fetch('https://www.strava.com/api/v3/oauth/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });
  const fresh = await res.json();
  await db.from('strava_tokens').update({
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token, // Strava rotates refresh tokens
    expires_at: new Date(fresh.expires_at * 1000),
  }).eq('user_id', userId);
  return fresh.access_token;
}
```

The token-refresh round trip does NOT count against Strava's API quota — confirmed in Strava docs.

### Webhook subscription

- **Endpoint**: `GET /strava/webhook` (verification challenge) + `POST /strava/webhook` (event delivery).
- **Verification**: On `GET`, return `{ "hub.challenge": req.query["hub.challenge"] }` if `hub.verify_token` matches `STRAVA_WEBHOOK_VERIFY_TOKEN` env var.
- **Event handling**: On `POST`, validate `subscription_id`, look up `owner_id` (Strava athlete ID) → `user_id` in `strava_tokens`, enqueue an async fetch of the new activity (use Vercel's `waitUntil` if available, or just `await` — events are simple). Insert into `cardio_sessions`.
- **Subscription creation** is a one-time backend bootstrap (cron or manual `POST /api/v3/push_subscriptions` to Strava once per environment).
- **No SDK needed.** Six total API calls (authorize, exchange, refresh, list activities, get activity detail, subscription mgmt). Direct `fetch` + Zod-validated response schemas.

### Rate limits

- **200 requests / 15 min, 2000 requests / day, per app**. Not per user.
- Strategy: webhook-driven (push) instead of polling. Backfill on connect is bounded to 30 days × ~5 activities/wk = ~20 requests per user. With 100 new connections/day, that's 2000 — at the daily limit. **Mitigation**: throttle backfill to 1 user/minute via Upstash rate limiter (already installed). Spreads load across 24h.
- If 429 returned: read `X-RateLimit-Limit` and `X-RateLimit-Usage` headers, back off with exponential delay (max 1h), surface a non-blocking UI warning "Sync paused — retrying in X minutes".

### Fallback

If Strava webhook fails or is delayed >24h, a daily cron (Vercel cron, already available)
runs `GET /athletes/{id}/activities?after=<last_sync_timestamp>` to catch any missed
activities. Existing lifecycle cron infra in v1.3 covers this.

---

## CRM Table/Data-Grid for Next.js

### Choice: `@tanstack/react-table ^8.21.3` + `@tanstack/react-virtual ^3.10.x`

**Why TanStack Table (headless)**:
- **Full design control**: Tailwind v4 `@theme` tokens + Ziko design system (orange #FF5C1A, light theme) integrate cleanly. AG Grid's CSS theme system fights Tailwind.
- **Bundle size**: ~14kb gzipped vs AG Grid Community's ~200kb.
- **License-clean**: MIT, no Enterprise gate on copy-paste/sort/filter/pivot. AG Grid Community lacks several features we'd want (pivot, server-side row model).
- **Already in the ecosystem**: TanStack Query v5 is already installed — same team, same mental model.
- **Coach data shape is small**: realistic v1.5 ceiling is 200 clients per coach. Virtualization is overkill but trivial to add with `@tanstack/react-virtual` for the rare power-user case.

**What we don't get from headless TanStack Table** (and how to compensate):
- No built-in cell editing → not needed for v1.5 (CRM is read-only client view + program assignment dropdown). Defer rich editing to v1.6.
- No built-in column resizing UI → use TanStack's `getResizeHandler()` + a styled `<div>` separator.
- No built-in export → not in v1.5 scope. PDF export is the future ERP's concern.

**Alternative rejected**: AG Grid Community. Pros: batteries-included filters, virtualization out of the box. Cons: heavier bundle, MIT/Enterprise license confusion (some features look free but trigger an Enterprise warning at runtime — bad DX), CSS theming friction with Tailwind v4 `@theme`.

**Alternative rejected**: `react-data-grid` (Adazzle). Pros: MIT, copy-paste in Community. Cons: smaller ecosystem (~250k weekly downloads vs TanStack 1.6M), less active maintenance, awkward TypeScript types in v7.

### Pattern (sketch, do not implement here)

```tsx
// apps/web/src/app/(coach)/clients/page.tsx (Server Component)
const supabase = await createServerClient(); // @supabase/ssr
const { data: clients } = await supabase
  .from('user_profiles_for_coach')   // View with RLS JOIN on coach_client_links
  .select('user_id, name, email, last_session_at, current_program_title')
  .order('last_session_at', { ascending: false });

return <ClientsTable initialData={clients} />; // Client Component below
```

```tsx
// apps/web/src/app/(coach)/clients/ClientsTable.tsx (Client Component, use client)
const table = useReactTable({
  data: clients,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});
// Render with Tailwind, link rows to /coach/clients/[id]
```

Data fetched server-side (RSC, RLS-protected); table state (sort, filter) client-side.
Match the existing v1.0 landing's RSC patterns.

### Server Actions vs Route Handlers — decision

| Use case | Pattern | Reason |
|----------|---------|--------|
| Invitation code generation, program assign, client revoke | **Server Actions** | Internal mutations from RSC forms. No external caller. Built-in CSRF + revalidation via `revalidatePath`. |
| AI import endpoints, AI chat | **Hono routes (existing backend)** | Mobile also calls these. SSE streaming for chat is non-trivial in Server Actions but native in Hono. Re-use v1.4 credit middleware. |
| Strava webhook | **Hono route** | External service callback. Needs custom headers/status codes Server Actions don't expose cleanly. |
| Coach signup, profile update | **Server Actions** | Internal, form-based, RSC-revalidating. |

**Rule of thumb confirmed across sources**: Server Actions for internal mutations,
Hono Route Handlers for anything externally callable or needing streaming/HTTP control.
This matches makerkit's guidance and Vercel's official recommendations.

---

## Integration Points

### How new deps wire into existing stack

| Integration | How it connects |
|-------------|-----------------|
| **AI imports → Supabase Storage** | New bucket `ai-imports` follows v1.3 signed-URL pattern. Path-prefix RLS: `(storage.foldername(name))[1] = auth.uid()::text`. Mobile + web both upload directly to Storage (bypassing Vercel 4.5MB body limit). Backend receives only the signed URL ref. |
| **AI imports → existing credit middleware** | Three new credit classes route through existing `creditCheck`/`creditDeduct`: `import_pdf`, `import_excel_word`, `import_image`. Costs added to v1.4 `models.ts` cost table. Same atomic `deduct_ai_credits` RPC; no schema change to credit system. |
| **AI imports → existing ai_cost_log** | Token usage from `generateObject` (Sonnet) flows into existing `ai_cost_log` table. Add column `import_type TEXT` (optional, nullable) so we can analyze cost-per-format separately. |
| **AI coach tools → existing AI tool registry** | Three new tools (`analyze_client`, `generate_coaching_program`, `monitor_client_alerts`) register in `backend/api/src/tools/registry.ts` exactly like the existing 30+ plugin AI tools. Coach orchestrator agent in `backend/api/src/coach/ai/agent.ts` re-uses the same `streamText` + `stopWhen: stepCountIs(5)` pattern from `routes/ai.ts`. |
| **Coach AI chat → existing /ai/chat/stream pattern** | New route `POST /coach/ai/chat/stream` mirrors `POST /ai/chat/stream` — same SSE format, same `creditCheck` middleware, same conversation persistence. Difference: system prompt loads **coach context** (`fetchCoachContext(coachId)` returns recent clients, alerts, program templates) instead of athlete context. |
| **Strava → cardio_sessions** | Adds columns: `cardio_sessions.source TEXT DEFAULT 'manual'`, `cardio_sessions.strava_activity_id BIGINT UNIQUE NULLABLE`. Webhook handler inserts/updates. Unique constraint on `strava_activity_id` makes ingestion idempotent (retry-safe). |
| **Coach ↔ Client RLS** | New table `coach_client_links` (coach_id, client_id, granted_at, revoked_at, status). RLS on existing tables (sessions, measurements, habits, nutrition, sleep, cardio) **extended** via OR clause: `auth.uid() = user_id OR EXISTS (SELECT 1 FROM coach_client_links WHERE coach_id = auth.uid() AND client_id = user_id AND revoked_at IS NULL)`. This is a one-line policy extension per table — covered in ARCHITECTURE.md. |
| **Web → Hono backend** | `apps/web/src/lib/api.ts` thin client wraps `fetch('/ai/...')` etc. Backend already supports CORS for `ziko-app.com`. Coach session JWT (Supabase) sent as `Authorization: Bearer` — existing `authMiddleware` validates. |
| **Web → mobile shared types** | `packages/coach-types/` (new) exports Zod schemas (`ImportedProgramSchema`, `CoachClientLinkSchema`, etc.) shared between Hono backend and Next.js web. Mobile imports the same package. |
| **next-intl** | All new coach-facing pages get FR + EN keys. Existing `messages/fr.json` + `messages/en.json` extended. Reuse the existing routing config. |

---

## What NOT to Add

| Rejected | Why | Use Instead |
|----------|-----|-------------|
| **CSV parser** (`papaparse`, `csv-parse`) | PROJECT.md explicitly out-of-scope: "AI imports replace CSV". Users rename .csv → .xlsx if needed (Excel handles both as input). | AI import flow |
| **`@supabase/auth-helpers-nextjs`** | Deprecated. Replaced by `@supabase/ssr`. | `@supabase/ssr` |
| **Strava SDK** (`strava-v3`, `@james-langridge/strava-sdk`) | Unmaintained or low adoption. Strava API surface we need is 6 endpoints — direct `fetch` + Zod is lower risk than a stale dependency. | Direct `fetch` with typed wrappers in `backend/api/src/lib/strava.ts` |
| **AG Grid** (any tier) | Heavier bundle (~200kb vs 14kb), CSS theming friction with Tailwind v4, Enterprise gate on features that look free. | TanStack Table headless |
| **LangChain / LlamaIndex** | Heavy abstraction over LLM calls. Adds 10s of MB to backend bundle. AI SDK + Zod already gives us structured outputs natively. | Existing `ai` SDK |
| **Anthropic SDK direct** (`@anthropic-ai/sdk`) | Already on `@ai-sdk/anthropic` v6 — using both creates dual-SDK confusion. v6's `file` content type supports PDF natively. | `@ai-sdk/anthropic ^3.0.58` |
| **`pdf-parse` / `pdfjs-dist` (raw)** | Both pull `canvas` (Python/C++ native deps) → breaks on Vercel serverless cold starts. | `unpdf` (pure JS, serverless-safe) — used only as fallback; primary path is Claude native PDF |
| **`xlsx` (SheetJS CE)** | In-memory only loads full workbook → OOM risk on 512MB Vercel functions for large workbooks. Streaming requires SheetJS Pro (commercial). | `exceljs` (streaming, 6× lower memory, MIT) |
| **`docxtemplater`, `docx-preview`, `officegen`** | Templating/rendering targets, not extraction. Wrong tool. | `mammoth` |
| **Stripe / payment SDK** | Coach billing explicitly deferred per PROJECT.md ("Coach ERP — future milestone, after v1.5 CRM ships"). | Future milestone |
| **`react-uploady`, `uppy`** | Full upload manager UIs. Overkill for our 1-file-at-a-time AI import flow. | `react-dropzone` (just the drop zone primitive) |
| **`uuid` v4 for invitation codes** | UUID is 36 chars — unreadable for a code users type into mobile. | `nanoid` `customAlphabet` (6 chars, no-lookalike alphabet) |
| **Real-time messaging** (Supabase Realtime, Ably, Pusher) | PROJECT.md "Deferred to v1.6+": "Real-time messaging coach↔client". | Future milestone |
| **Garmin `.fit` parser** (`fit-decoder`, `fit-file-parser`) | PROJECT.md "Deferred to v1.6+": "Garmin `.fit` file import". | Future milestone |
| **Google Sheets API client** (`googleapis`) | PROJECT.md "Deferred to v1.6+": "Google Sheets API OAuth import". | Future milestone |
| **Separate auth system** | Supabase Auth + RLS + JWT covers coach role gating. New `role` column on `user_profiles` (client/coach/both). | Existing Supabase Auth |
| **In-memory rate limiter** for new endpoints | PROJECT.md key decision v1.3: useless on Vercel serverless. | Existing `@upstash/ratelimit` |
| **Separate web framework** (Remix, Astro) | Next.js 14 App Router is non-negotiable per PROJECT.md constraints. | Existing Next.js |
| **Image processing** (`sharp`, `jimp`) for import previews | Claude vision handles images natively. No server-side resize needed before AI. | Native Claude vision |
| **OCR library** (`tesseract.js`) for screenshot imports | Claude Haiku vision = OCR + understanding in one call, cheaper than tesseract.js (which adds 2MB to cold start). v1.4 already validated Haiku for scan path. | `claude-haiku-4-5-20251001` via existing AI SDK |
| **Background job queue** (`bullmq`, `pg-boss`, Inngest) | AI imports are interactive (user-initiated, preview-then-commit). Strava webhooks are <1s synchronous handlers. No long-running async work in v1.5. | Direct invocation + `waitUntil` for fire-and-forget Strava activity fetches |

---

## Verification Notes

Versions to double-check during Phase 0 (before npm install):

| Package | Stated version | Verify against |
|---------|----------------|----------------|
| `@supabase/ssr` | `^0.5.x` | npm registry (was at 0.5.x in early 2026 — confirm current major) |
| `@tanstack/react-table` | `^8.21.3` | Already at 8.21.3 since 2024; v9 is in alpha — stay on v8 |
| `@tanstack/react-virtual` | `^3.10.x` | Confirm latest 3.x — v4 may exist by now |
| `unpdf` | `^1.6.2` | Latest as of February 2026; confirm against npmjs.com/package/unpdf |
| `exceljs` | `^4.4.0` | Stable, no updates for >12 months — that's fine (mature format, mature parser) |
| `mammoth` | `^1.12.0` | Updated March 2026 |
| `nanoid` | `^5.0.0` | v5 is ESM-only; if backend `package.json` `"type"` is not module, may need `^4.0.0`. **Verify** with `node -e "require('./backend/api/package.json').type"`. |
| `react-dropzone` | `^14.2.x` | Stable |
| `lucide-react` | conditional on existing landing page choice | Check what the v1.0 landing on ziko-app.com uses; do NOT add a second icon set |

Capabilities to verify with Context7 (HIGH-priority pre-implementation):

1. **Context7 query**: "@ai-sdk/anthropic file content type PDF" — confirm AI SDK v6 PDF syntax matches the snippet in this doc (recently changed: `mediaType` vs `mimeType` field name).
2. **Context7 query**: "@supabase/ssr Next.js 14 cookies" — confirm Server Component try/catch pattern still recommended in May 2026.
3. **Context7 query**: "nanoid customAlphabet ESM CommonJS" — verify which major version pairs with our Node runtime.
4. **Direct verify**: hit `https://www.strava.com/api/v3/oauth/token` schema with a test client to confirm response shape (Strava docs occasionally lag).
5. **Direct verify**: confirm Supabase Storage signed-URL TTL 5min is sufficient for AI parsing roundtrip (Sonnet on a 30MB PDF can take 30-60s).

Cost ceiling to validate empirically in Phase 1:

- Target: AI import flow stays under €0.05/import on average (within v1.4 €0.75/user/month with ~15 imports/month free tier).
- Risk: large coach program PDFs (20+ pages) could exceed €0.10/import on Sonnet. Mitigation: progressive disclosure — preview first 4 weeks, ask user to confirm before parsing the full program.

---

## Sources

- [unpdf vs pdf-parse vs pdf.js: PDF Parsing and Text Extraction in Node.js (2026) — PkgPulse](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — confirms unpdf is serverless-safe, others need canvas
- [unpdf — npm](https://www.npmjs.com/package/unpdf) — v1.6.2 confirmed
- [unpdf — UnJS](https://unjs.io/packages/unpdf/) — serverless build, zero native deps
- [Claude API Docs — PDF Support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) — native PDF, ≤32MB, ≤100 pages, base64 content type
- [AI SDK — Anthropic Provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) — `file` content type with `mediaType: 'application/pdf'`
- [AI SDK 6 — Vercel](https://vercel.com/blog/ai-sdk-6) — generateObject unified with multi-step tool loops; structured outputs
- [SheetJS vs ExcelJS vs node-xlsx — PkgPulse](https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026) — ExcelJS 6× lower memory in serverless
- [exceljs — npm](https://www.npmjs.com/package/exceljs) — v4.4.0 confirmed (stable, MIT)
- [mammoth.js — GitHub](https://github.com/mwilliamson/mammoth.js/) — extractRawText API, Node.js Buffer input
- [mammoth — npm](https://www.npmjs.com/package/mammoth) — v1.12.0 confirmed
- [Strava Developers — Authentication](https://developers.strava.com/docs/authentication/) — OAuth flow, 6h access token, refresh rotation
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/) — 200/15min, 2000/day per app, OAuth doesn't count
- [Strava Webhook Events API](https://developers.strava.com/docs/webhooks/) — verification challenge, subscription mgmt
- [TanStack Table — Introduction](https://tanstack.com/table/latest/docs/introduction) — headless, framework-agnostic
- [TanStack Table vs AG Grid vs react-data-grid 2026 — PkgPulse](https://www.pkgpulse.com/guides/tanstack-table-vs-ag-grid-vs-react-data-grid-2026) — bundle size, license, ecosystem comparison
- [@tanstack/react-table — npm](https://www.npmjs.com/package/@tanstack/react-table) — v8.21.3 stable
- [@supabase/ssr — npm](https://www.npmjs.com/package/@supabase/ssr) — current package for Next.js App Router auth
- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — official cookie pattern
- [Server Actions vs Route Handlers — makerkit](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — when to use each
- [nanoid — GitHub](https://github.com/ai/nanoid) — customAlphabet, collision math, 118-byte runtime
- [nanoid-dictionary — GitHub](https://github.com/CyberAP/nanoid-dictionary) — no-lookalike alphabet for invitation codes
- [Nano ID Collision Calculator](https://alex7kom.github.io/nano-nanoid-cc/) — verify 6×32 alphabet collision risk

---

*Stack research for: v1.5 Coach Platform & CRM*
*Researched: 2026-05-13*
