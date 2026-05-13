# Research Summary — v1.5 Coach Platform & CRM

**Researched:** 2026-05-13
**Confidence:** HIGH (Stack/Architecture), MEDIUM-HIGH (Features), HIGH (Pitfalls)

---

## Executive Summary

v1.5 transforms Ziko from a single-tenant athlete app into a two-sided platform: a coach-facing CRM on the Next.js web app (`apps/web/(coach)/`) reading client data via cross-user RLS, plus athlete-side Strava OAuth and AI file imports. The architectural keystone is `coach_client_links` + a `SECURITY DEFINER` SQL function `is_coach_of(coach, client)` that extends every existing data table's RLS with an `OR is_coach_of(auth.uid(), user_id)` clause — coach reads, never writes. Everything else is additive: 6 new tables (migrations 034–037), one `role` column on `user_profiles`, four extensions on `workout_programs`, six bounded-context Hono modules (`coach/{identity,clients,programs,invitations,imports,ai}`), three new AI tools, and Strava as a separate `integrations/strava/` module.

Biggest insights: (1) **bounded-contexts pay off only if enforced** — service-only cross-module imports + ESLint guards are mandatory or v1.6 ERP refactor will be painful; (2) **AI file imports are interactive, not batch** — preview-then-commit, two-pass extraction (raw transcribe → Zod-structured), per-page credit pricing, async upload path because Vercel max function duration is 60s on Pro; (3) **CSV is dead, Claude native PDF/vision is the import substrate** — `unpdf`/`exceljs`/`mammoth` are fallbacks only, no `pdf-parse`/SheetJS; (4) **the web app moves into the Turborepo** as `apps/web/` (currently external) — this is Phase 0 risk and the most coupled decision in the milestone.

Top three risks: **RLS recursion / revocation-bypass in `is_coach_of()`** (catastrophic if buggy, low if reviewed — every cross-user policy depends on it); **AI tool data leakage** (service-role client inside tool = full RLS bypass; tool output PII persisted in `ai_messages` survives revocation); **Strava rate-limit ban + webhook idempotency** (200/15min app-wide ceiling, at-least-once webhook delivery doubles `cardio_sessions` without UNIQUE constraint).

Build order: 10 phases, three parallelizable lanes (web onboarding ∥ backend identity, Strava ∥ coach modules, marketing landing after onboarding URL stable).

---

## Stack Additions

**No new mobile packages.** Strava and file imports reuse `expo-web-browser`, `expo-linking`, `expo-document-picker` already installed.

### Backend (`backend/api/`) — 4 new packages

| Package | Version | Purpose |
|---------|---------|---------|
| `unpdf` | `^1.6.2` | PDF page-count validation + fallback text extraction (serverless-safe, no `canvas` deps). **Primary path is native Claude PDF parsing, not unpdf.** |
| `exceljs` | `^4.4.0` | Streaming `.xlsx`/`.xls` → JSON rows (6× lower memory than SheetJS in 512MB Vercel functions, MIT) |
| `mammoth` | `^1.12.0` | `.docx` → clean text via `extractRawText({buffer})` — skip `convertToHtml` (adds CSS noise) |
| `nanoid` | `^5.0.0` | 6-char invitation codes via `customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ')`. **Verify ESM/CJS** against backend `package.json` `"type"` before installing — may need v4 if CJS. |

**Strava: no SDK.** Direct `fetch` + Zod-typed wrappers in `backend/api/src/integrations/strava/service.ts`. Strava's surface is 6 endpoints; available SDKs are unmaintained.

### Web (`apps/web/`) — 4 new packages (workspace currently external, must be onboarded in Phase 0)

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/ssr` | `^0.5.x` | Server-side auth for App Router. **Use this, NOT** deprecated `@supabase/auth-helpers-nextjs`, **NOT** raw `@supabase/supabase-js` (no cookie access). |
| `@tanstack/react-table` | `^8.21.3` | Headless CRM table (full Tailwind v4 + Ziko-token control, ~14kb gz vs AG Grid's ~200kb, MIT no Enterprise gate) |
| `@tanstack/react-virtual` | `^3.10.x` | Row virtualization for >200-client coaches (lazy-loaded only on clients-list) |
| `react-dropzone` | `^14.2.x` | Drag-drop upload UX for AI imports — just the primitive, not a full upload manager |
| `lucide-react` (conditional) | `^0.460.x` | Icons — **verify what v1.0 landing uses first**; do NOT add a second icon set if `@heroicons/react` already present |

### Existing infrastructure reused (no new deps)

- Vercel AI SDK v6 (`ai ^6.0.116` + `@ai-sdk/anthropic ^3.0.58`) — `generateObject` + Zod for all import parsing
- `@upstash/redis ^1.37.0` + `@upstash/ratelimit ^2.0.8` — rate limits on redemption + Strava queue
- Supabase Storage signed-URL pattern from v1.3 — new bucket `import-uploads`, path-prefix RLS `(storage.foldername(name))[1] = auth.uid()::text`
- v1.4 dual-table credit system (`user_ai_credits` + `ai_credit_transactions`) + `creditCheck`/`creditDeduct` middleware — 3 new credit classes: `import_pdf`, `import_excel_word`, `import_image`
- `@supabase/supabase-js ^2.50.0` — no version bump; RLS policies on existing tables get one-line OR extensions
- AI tool registry pattern (`backend/api/src/tools/registry.ts`) — 3 new coach tools register identically to the 30+ existing plugin tools

### Explicit NOT-additions (anti-deps)

- ❌ Any CSV parser (`papaparse`, `csv-parse`) — AI imports replace CSV per PROJECT.md
- ❌ `@supabase/auth-helpers-nextjs` — deprecated, replaced by `@supabase/ssr`
- ❌ Strava SDK (`strava-v3`, etc.) — unmaintained, 6 endpoints don't need a wrapper
- ❌ AG Grid (any tier) — bundle + license + Tailwind theming friction
- ❌ `pdf-parse`, `pdfjs-dist` raw — pull `canvas` native deps, break Vercel cold starts
- ❌ SheetJS CE (`xlsx`) — in-memory only, OOM risk; streaming requires SheetJS Pro
- ❌ `tesseract.js`, `sharp`, `jimp` — Claude vision handles OCR + image processing natively
- ❌ LangChain / LlamaIndex / direct `@anthropic-ai/sdk` — AI SDK v6 already covers it
- ❌ Materialized views — bypass RLS at read time (Pitfall 1.5)
- ❌ `bullmq`, `pg-boss`, Inngest — no background queue needed; `waitUntil` + polling cover the AI import async path

### Shared package

`packages/coach-sdk/` (NEW) — Zod schemas (`ImportedProgramSchema`, `CoachClientLinkSchema`, etc.) shared between Hono backend, Next.js web, and mobile. Mirrors the `plugin-sdk` pattern.

---

## Feature Categorization

### Client Management (Phase 5 of build order)

**Table stakes (MUST ship):** client list with search + last-active indicator; tabbed client detail (profile + program + sessions + measurements + nutrition + habits + sleep + cardio, all read-only); coach-private notes (`coach_client_notes` — separate table); client revoke from mobile (immediate effect via `revoked_at`).

**Differentiators (cheap):** unified "executive summary" card (compliance %, last workout, latest measurement, mood trend); roster filters by signal ("missed last 2 sessions"); custom tags per client.

**Anti-features:** ❌ coach editing of athlete journals/nutrition/sleep (breaks trust + GDPR) ❌ granular per-domain permissions (deferred to v1.7) ❌ per-client custom-field builder ❌ bulk-message broadcast.

### Programs (Phase 6)

**Table stakes:** program templates (multi-week, sessions, exercises with sets/reps/RPE/rest); template library with search; one-click assign-to-client → forked copy (`template_source_id`); week-by-week structure (`weeks_data JSONB`); edit-assigned-without-touching-template; exercise picker from existing 1000+ Ziko library + free-text fallback.

**Differentiators:** folder organization for templates (Hevy Coach pattern, coaches love this); 5–10 expert-curated launch templates (PPL, 5/3/1, Hyrox prep, body-recomp); AI program generation; per-exercise RPE/RIR; right-click duplicate.

**Anti-features:** ❌ real-time collaborative editing (overkill for solo coaches) ❌ algorithmic auto-deload (paternalistic) ❌ in-program video upload (storage + moderation) ❌ marketplace (v2.0+).

### AI Imports (Phase 7)

**Table stakes:** PDF / image / Excel / Word upload; structured preview-then-commit (NEVER auto-commit); athlete flow (own data) + coach flow (template); credit-gated via v1.4 system.

**Differentiators:** multi-page PDF (full 12-week programs); .docx support (underserved by competitors); confidence score per field with low-confidence flagging; re-upload-to-diff.

**Anti-features:** ❌ Garmin `.fit` import (deferred) ❌ Google Sheets API (deferred) ❌ CSV (deleted) ❌ Strava bulk-export (OAuth covers ongoing) ❌ OCR of handwritten programs (high failure, frustrating UX).

### AI Coach Tools (Phase 8)

**Table stakes:** 3 tools — `analyze_client(client_id)`, `generate_coaching_program(client_id, goal, weeks, ...)`, `monitor_client_alerts(client_id?)`; web chat UI reusing `/ai/chat/stream` SSE; auto-inject viewed-client context.

**Differentiators:** proactive weekly digest ("Monday morning briefing"); inline "Adapt this program for X" on a template page; auto-flag concerning patterns ("Sophie's sleep dropped 30% + missed 2 sessions").

**Anti-features:** ❌ AI directly messages clients on coach's behalf (liability) ❌ full autopilot ❌ voice-cloned coach replies ❌ AI medical advice (hard refuse in system prompt).

### Invitations (Phase 4)

**Table stakes:** 6-char alphanumeric code (server-generated, retry-on-conflict in PG); expires_at NOT NULL DEFAULT now()+14d; mobile redemption screen; auto-create `coach_client_links` on accept; coach signup self-serve with `role=coach`; light async KYC (non-blocking).

**Differentiators:** invitation link (deep-link `ziko-app.com/invite/ABC123`); QR code (in-gym scenario); athlete sees coach profile preview before accepting; welcome auto-message.

**Anti-features:** ❌ email blast invites (spam-adjacent) ❌ multi-coach per athlete (v2.0) ❌ coach re-invite without consent on revoke ❌ hard-KYC blocking signup.

### Mobile Athlete UX — "Mon coach" (Phase 4)

**Table stakes:** empty state with code input; linked state with coach card (name, photo, certs); active program viewer (today's session preview); coach contact CTA (mailto in v1.5 — messaging is v1.6); revoke button in settings with 2-step confirmation; "Programme prescrit par Sophie" read-only badge.

**Differentiators:** compliance widget ("75% this week"); coach's last note visible; sync indicator ("Synced with Sophie's view").

**Anti-features:** ❌ athlete editing prescribed program ❌ showing coach-private notes to athlete ❌ push for every coach action.

### Public Marketing `/coachs` (Phase 10)

**Table stakes:** FR/EN above-the-fold; "Rejoindre la bêta privée" CTA (NO pricing); 3-4 feature blocks; FAQ (free during beta? clients pay? GDPR?); legal footer; existing `next-intl` setup.

**Differentiators:** 60s muted auto-play demo video; "Built by athletes, for coaches" founder note; honest comparison table vs Trainerize/TrueCoach.

**Anti-features:** ❌ testimonials (no real coaches yet — don't fake) ❌ pricing page (deferred) ❌ schedule-a-demo form (friction) ❌ chat widget.

---

## Bounded Contexts Architecture

Six backend modules under `backend/api/src/coach/` mirror six web route groups under `apps/web/src/app/(coach)/`. Module boundary rule: **each module owns its tables, routes, types, and AI tools; cross-module reads go through a single `service.ts` index — never direct table reads from another module's code.** Enforce with ESLint `no-restricted-imports`: only `coach/<m>/service` importable from outside, `coach/<m>/db` and `coach/<m>/internal/*` blocked.

```
coach/identity     ← root, no deps. Owns: coach_profiles, user_profiles.role
   ↑
coach/invitations  ← depends: identity (coach-role gate), clients (calls createLink on redeem)
   ↑                Owns: coach_invitations + redeem RPC
coach/clients      ← depends: identity. Owns: coach_client_links + is_coach_of() function
   ↑                Provides: isCoachOf(), getClientAggregate(), getLinkedClients()
coach/programs     ← depends: identity, clients (validate link on assign)
   ↑                Owns: workout_programs extensions (no new table)
coach/imports      ← depends: programs (commit path), clients (mode=coach_for_client), credits, storage
                    Owns: ai_imports
coach/ai           ← depends: clients (link verify + reads), programs (generation write path)
                    No own tables. Registers 3 tools in tools/registry.ts. Extends /ai/chat/stream.
```

**Cross-module communication: direct service-layer imports within the same Hono process.** No internal HTTP, no event bus. Hono runs in a single Vercel function — cross-module calls become typed function calls. Web → backend is always HTTPS to Hono with Supabase JWT (no direct DB writes from `apps/web`).

**Strava is NOT a coach module.** Lives at `backend/api/src/integrations/strava/` because it's athlete-facing; placing it under `coach/` would mis-bind it.

### ERP Migration Promises (v1.6+)

| Surface | Stability promise |
|---------|-------------------|
| `coach_client_links` table shape | Frozen — every future ERP module joins this. Column additions allowed; removals forbidden. |
| `is_coach_of(coach, client)` function signature | Frozen — every cross-user RLS policy depends on it. |
| `user_profiles.role` enum (`client`/`coach`/`both`) | Permanent. New roles (admin, etc.) require a separate column. |
| Tool registry `AITool` + executor shape | Frozen — 30+ existing tools depend on it. |
| `coach-sdk` `ImportedProgramSchema` Zod | Versioned with semver, v1.x additive only, `__v` field persisted in `ai_imports.parsed_json`. |

Future `coach/billing` (v1.6) and `coach/scheduling` (v1.6) are pure additions — no v1.5 schema changes. Future `coach/messaging` (deferred) adds tables that FK to `coach_client_links`.

---

## Data Model

### New tables (migrations 034 → 037, split for blast-radius control)

**Migration 034 — `coach_role_and_profile.sql`**
- `user_profiles.role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','coach','both'))` — partial index `WHERE role <> 'client'`.
- `coach_profiles (user_id PK FK auth.users, display_name, bio, specialties TEXT[], website, kyc_status enum, kyc_data JSONB, timestamps)` + `updated_at` trigger + RLS.

**Migration 035 — `coach_links_and_invitations.sql`**
- `coach_invitations (id, coach_id, code TEXT UNIQUE CHECK '^[A-Z2-9]{6}$', expires_at NOT NULL, max_uses INT DEFAULT 1, used_count INT DEFAULT 0, created_at)` + indexes on `(coach_id, created_at DESC)` and `code`.
- `coach_client_links (id, coach_id, client_id, status enum 'active'|'revoked', invited_via FK coach_invitations, created_at, revoked_at, CHECK coach_id <> client_id)` — partial UNIQUE index on `(coach_id, client_id) WHERE status='active'`.
- `is_coach_of(p_coach UUID, p_client UUID) RETURNS BOOLEAN` — `SECURITY DEFINER STABLE SET search_path = public`. `REVOKE FROM PUBLIC; GRANT EXECUTE TO authenticated`.
- `redeem_invitation_code(p_code, p_client_id)` — SECURITY DEFINER, atomic SELECT FOR UPDATE on the invitation, INSERT link, UPDATE used_count++.
- RLS rewrite on every cross-user-readable table (habits, habit_logs, workout_sessions, session_sets, body_measurements, nutrition_logs, sleep_logs, cardio_sessions, hydration_logs, journal_entries, stretching_logs): **split into separate `FOR SELECT` (owner OR `is_coach_of`) and `FOR ALL` (owner only).** Never widen existing FOR ALL.

**Migration 036 — `coach_programs_and_imports.sql`**
- `workout_programs` extensions: `created_by_coach_id FK auth.users SET NULL`, `assigned_to_user_id FK auth.users CASCADE`, `is_template BOOLEAN DEFAULT FALSE`, `weeks_data JSONB`, `template_source_id FK self SET NULL` + indexes.
- `ai_imports (id, user_id, mode enum, target_client_id, source_storage_path, source_mime, status enum, parsed_json JSONB, committed_program_id FK workout_programs SET NULL, error_message, credit_cost, timestamps)`.

**Migration 037 — `strava_integration.sql`**
- `strava_accounts (user_id PK, athlete_id BIGINT UNIQUE, access_token, refresh_token, expires_at, scope, last_sync_at, last_cursor_id, timestamps)` + own-RLS.
- `strava_webhook_events (id BIGSERIAL, athlete_id, object_type, object_id, aspect_type, event_time, processed BOOLEAN DEFAULT FALSE, processed_at, payload JSONB, created_at)` — no RLS, service-role only.
- `cardio_sessions` extensions: `external_strava_id BIGINT`, `external_source TEXT CHECK ('strava')` + partial UNIQUE index for idempotent UPSERT.

### Critical SECURITY DEFINER function

```sql
CREATE OR REPLACE FUNCTION public.is_coach_of(p_coach UUID, p_client UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_client_links
    WHERE coach_id = p_coach AND client_id = p_client
      AND status = 'active' AND revoked_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_coach_of(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach_of(UUID, UUID) TO authenticated;
```

---

## Critical Data Flows

### AI File Import (async + poll)
1. `POST /coach/imports/upload-url` → role+link check, insert `ai_imports`, return signed Storage URL (5-min TTL, path-prefix RLS).
2. Client `PUT (binary) → signed_url` (direct to Storage, bypasses Vercel 4.5MB).
3. `POST /coach/imports/:id/parse` → `creditCheck`, `status='parsing'`, fetch file → Claude `generateObject(ImportedProgramSchema)` (PDF native; Excel via `exceljs`; Word via `mammoth`; image via Haiku). Validate Zod. `creditDeduct` on success. `status='preview_ready'`.
4. Client polls `GET /coach/imports/:id` every 2s — **mandatory async** even if usually fast.
5. `POST /coach/imports/:id/commit` → writes to `workout_programs`, `status='committed'`.

**Critical:** `maxDuration=60` on `/parse`. Vercel Pro mandatory. Lifecycle cron cleans `import-uploads/*` after 30d.

### Strava OAuth + Sync
1. Mobile: `WebBrowser.openAuthSessionAsync(strava oauth URL, redirect ziko://strava/callback, scope read+activity:read_all)`.
2. Mobile POSTs `code` → backend exchanges, upserts `strava_accounts`, registers webhook subscription once, backfills 30d throttled.
3. Activity event → `POST /webhooks/strava` validates `subscription_id`, inserts `strava_webhook_events (processed=false)`, **returns 200 in <2s**.
4. Cron `*/5 * * * *` processes with `FOR UPDATE SKIP LOCKED LIMIT 50`, single-flight token refresh, UPSERT `cardio_sessions ON CONFLICT (external_strava_id)`.
5. Daily reconcile cron `0 3 * * *` catches missed webhooks.

### Invitation Redemption
1. Coach `POST /coach/invitations { expires_in_days: 14 }` → 6-char `[A-Z2-9]` retry-on-UNIQUE.
2. Coach shares peer-to-peer.
3. Client mobile `POST /coach/invitations/redeem { code }` (rate-limited, constant-time).
4. SECURITY DEFINER `redeem_invitation_code` with `FOR UPDATE`, INSERT `coach_client_links ON CONFLICT DO NOTHING`, increment used_count.

### Coach AI Tool Execution
1. `POST /ai/chat/stream` with coach JWT → existing middleware chain.
2. `fetchUserContext(userId)` detects `role='coach'` → expand tool set + system prompt addendum with linked clients.
3. Claude calls `analyze_client({ client_id })` → `coach/ai/tools.analyze_client(userId, params, userToken)`:
   - **Defense in depth:** `isCoachOf()` first → throw clean 4xx if false.
   - Supabase client uses **user's JWT**, not service role.
   - Returns structured JSON.
4. Persist to `ai_tool_audit` table.
5. SSE chunks to client.

---

## Phase Build Order (Suggested)

| # | Phase | Rationale | Parallel with |
|---|-------|-----------|---------------|
| **1** | **Schema foundation (migrations 034–036)** | Every module depends on tables + `is_coach_of()`. Smoke tests per table. | — |
| **2** | **`apps/web/` Turborepo onboarding + auth bootstrap** | `@supabase/ssr`, `(coach)` segment, layered auth, Pro tier, `maxDuration=60`. | Phase 3 backend |
| **3** | **`coach/identity` module + signup** | Backend skeleton + ESLint boundaries, `POST /signup` promotes role, web `(coach)/onboarding`. | Phase 2 web |
| **4** | **`coach/invitations` + `coach/clients` link primitives + mobile "Mon coach" minimal** | Codes + redemption RPC + mobile redemption + read-only coach card. | — |
| **5** | **`coach/clients` aggregate + web CRM list/detail** | `getClientAggregate`, TanStack Table, `force-dynamic`, tabbed read-only views. | — |
| **6** | **`coach/programs` templates + assignments** | `workout_programs` extensions, fork-on-assign. | — |
| **7** | **`coach/imports` AI file imports** | Storage bucket, upload+parse+commit, two-pass extraction, preview-then-commit UI, async polling. | — |
| **8** | **`coach/ai` orchestrator tools + observability** | 3 tools, `ai_tool_audit`, web chat UI, dashboards. | — |
| **9** | **Strava OAuth + sync (migration 037)** | OAuth + webhook + crons + mobile button. | Parallel with Phases 3–8 after Phase 1 |
| **10** | **Public landing `/coachs` FR/EN** | `(marketing)/coachs` + signup CTA → onboarding. | Parallel with Phases 4–9 once Phase 3 stable |

### Research flags
- **Needs research:** Phase 1 (RLS/`is_coach_of` validation), Phase 2 (Turborepo onboarding spike), Phase 7 (AI import prompts + credit calibration).
- **Standard patterns, skip research:** Phases 3, 4, 5, 6, 8, 9, 10.

---

## Top Risks & Mitigations

| # | Risk | Phase | Severity | Mitigation |
|---|------|-------|----------|------------|
| 1 | **`is_coach_of()` recursion / revocation bypass** | 1 | HIGH | SECURITY DEFINER + STABLE + `revoked_at IS NULL` + direct-self-read policy on `coach_client_links`; exhaustive unit tests. |
| 2 | **AI tool uses service-role → full RLS bypass** | 8 | HIGH | Tools accept per-request user-JWT Supabase client; CI grep ban `SERVICE_ROLE` in `coach/`. |
| 3 | **AI imports — prompt injection + hallucination** | 7 | HIGH | Tool-less parsing call, two-pass extraction, Zod bounds, `weight_source` enum, mandatory preview. |
| 4 | **Vercel timeout on large PDFs** | 7 | HIGH | Pro tier; `maxDuration=60`; async Storage + polling; credits post-success only. |
| 5 | **Strava rate-limit ban + webhook double-create** | 9 | HIGH | Upstash token-bucket 90/15min; UNIQUE `(user_id, external_strava_id)`; 200 in <2s + cron with `FOR UPDATE SKIP LOCKED`. |
| 6 | **Wrong cookie helper / middleware-only auth** | 2 | HIGH | `@supabase/ssr` only; layered auth (middleware refresh + layout `getUser()` + Server Action re-check); ESLint ban. |
| 7 | **Coach data cache leak across coaches** | 5 | HIGH | `force-dynamic` + `revalidate=0` + `cache: 'no-store'`; E2E test coach-A vs coach-B. |
| 8 | **Tool output PII persisted in `ai_messages` survives revocation** | 8 | HIGH | Separate `ai_tool_outputs` table with own RLS keyed to caller+target; revocation cleanup nulls revoked rows. |

### Secondary (MEDIUM) risks
- Cross-user RLS performance — benchmark on 1000-coach × 50-client × 30d seed before launch.
- Brute-force invitation redemption — Upstash 5/15min IP + 10/hr user + constant-time.
- Service-role key leak to client bundle — never in `apps/web/.env*`; CI grep build output.
- Cron at-least-once delivery — `pg_try_advisory_lock` + `ON CONFLICT DO NOTHING`.
- GDPR retention after revocation — `source_client_id` tag + redaction prompt + email summary.
- Monorepo bundling RN deps into web — strict `transpilePackages` allowlist + ESLint.
- Web/mobile role desync — role lives ONLY in `user_profiles.role`; mobile reads from `/me` with 60s cache.

---

## Open Questions / Decisions Needed Before Roadmap

1. **Turborepo onboarding of `apps/web/`** — pull external `ziko-app.com` repo in as `apps/web/` (recommended) OR keep dual-repo with published `coach-sdk` NPM package? **Phase 2 blocker.**
2. **Vercel Pro tier confirmation** — mandatory (Hobby 10s timeout kills imports).
3. **AI import credit cost calibration** — target €0.05/import within €0.75/user/month freemium. Per-page pricing model?
4. **GDPR retention on revocation** — `workout_programs.assigned_to_user_id ON DELETE CASCADE` vs `SET NULL`? Product/legal call.
5. **Icon library on web** — verify `lucide-react` vs `@heroicons/react` in existing v1.0 landing.
6. **`nanoid` ESM vs CJS** — v5 is ESM-only; verify `package.json "type"` before installing.
7. **Coach KYC blocking vs non-blocking** — non-blocking per PROJECT.md; admin back-office deferred to v1.6.
8. **AI tool audit table** — recommend new in v1.5 Phase 8 (mandatory for incident response), not deferred.
9. **Strava webhook callback URL** — unguessable UUID path; persist in `strava_subscriptions` metadata.

---

## Watch Out For

- **`is_coach_of()` is the keystone.** A bug locks coaches out OR leaks data across coaches. Unit-test before any policy uses it. Every RLS migration after Phase 1 runs the 4-case smoke test.
- **Never widen an existing `FOR ALL` policy.** Add NEW `FOR SELECT` for coach reads. Coach is read-only in v1.5.
- **AI document parser is tool-less and identity-less.** No system prompt with user info, no tools, no orchestrator context. Prompt injection in uploads cannot escalate beyond text-out.
- **AI imports MUST be async-by-design.** Polling from day one. Don't optimize fast-path and break slow-path.
- **`@supabase/ssr` not `@supabase/supabase-js` in Server Components.** Centralize in `lib/supabase/{server,client}.ts`, ESLint-ban raw imports.
- **Cache is the enemy on coach pages.** `force-dynamic` + `revalidate=0` + `cache: 'no-store'` everywhere.
- **Strava webhook returns 200 in <2s.** Process in cron, not in handler.

---

## Sources

### Stack
- unpdf vs pdf-parse vs pdf.js (PkgPulse 2026), Claude PDF Support docs, AI SDK 6 / Anthropic Provider, SheetJS vs ExcelJS (PkgPulse 2026), mammoth.js GitHub, Strava Authentication / Rate Limits / Webhooks, TanStack Table Docs, @supabase/ssr (npm), Supabase SSR Next.js Auth, nanoid + collision calculator.

### Features
- Hevy Coach vs Trainerize / TrueCoach, 12REPS/TrueCoach/Everfit/MyPTHub/Trainerize 2026 comparison, Trainerize Master Workout Library + AI Workout Builder, Hevy Coach Features, Everfit, FitFloww CRM, FitBudd CRM.

### Architecture
- `backend/api/src/app.ts`, `tools/registry.ts`, migrations 001/026/032/033, `.planning/PROJECT.md`, `.planning/research/v1.4/ARCHITECTURE.md`, `CLAUDE.md`.

### Pitfalls
- Supabase RLS Performance Best Practices, Next.js Caching docs, Next.js Server Actions Security, Vercel Function Limits / Cron Jobs / Fluid Compute, Anthropic Prompt Injection, OWASP LLM01, v1.4 PITFALLS.md.

---
*Research synthesis for: v1.5 Coach Platform & CRM — Ziko Platform*
*Synthesized: 2026-05-13*
