# Codebase Concerns

**Analysis Date:** 2026-05-28

## Tech Debt

**Large monolithic screens and stores:**
- Issue: Multiple files far exceed single-responsibility sizing. `PreviewClient.tsx` 1469 lines, `AnnotationPanel.tsx` 723 lines, `plugins/stats/src/store.ts` 1557 lines, `plugins/ai-programs/src/screens/ImportFileScreen.tsx` 1042 lines, `plugins/community/src/store.ts` 913 lines, `plugins/hydration/src/screens/HydrationPlugin.tsx` 894 lines
- Files: `apps/web/src/app/[locale]/(coach)/coach/imports/[id]/PreviewClient.tsx`, `plugins/stats/src/store.ts`, `plugins/community/src/store.ts`
- Impact: High cognitive load, difficult to maintain or test, changes risk regressions
- Fix approach: Extract sub-components, split store into domain slices, move large data-fetch logic to hooks

**Inline RPE logic duplicated:**
- Issue: RPE10_PCT table and calc logic inlined in `workout/session.tsx` (lines ~22-39), duplicating `plugins/rpe/src/index.ts`
- Files: `apps/mobile/app/(app)/workout/[id].tsx`, `plugins/rpe/src/index.ts`
- Impact: Formula drift if one copy changes; defeats the plugin-sdk purpose
- Fix approach: Import `calc1RM` and `rpeToPercent` from `@ziko/plugin-rpe` in session screen

**Hardcoded model strings in token logging:**
- Issue: `backend/api/src/routes/ai.ts` (lines 206, 299, 427, 456) and `backend/api/src/coach/ai/service.ts` (line 498) hard-code model IDs in `logTokenUsage()` calls instead of using the exported constants from `backend/api/src/config/models.ts`
- Files: `backend/api/src/routes/ai.ts`, `backend/api/src/coach/ai/service.ts`
- Impact: Token logs will misattribute usage if models are updated in `config/models.ts`
- Fix approach: Import model ID strings from `config/models.ts` and reuse them in logging calls

**Community chat uses poll-on-mount instead of realtime:**
- Issue: `ConversationScreen.tsx` loads messages once on mount via `loadMessages()` with no Supabase Realtime subscription — messages from other users only appear on manual refresh
- Files: `plugins/community/src/screens/ConversationScreen.tsx`, `plugins/community/src/store.ts`
- Impact: Chat is not real-time; fundamentally broken UX for a feature marketed as community
- Fix approach: Subscribe to `supabase.channel()` on `community_messages` filtered by `conversation_id`; append to store on `INSERT`

**Placeholder i18n key not replaced:**
- Issue: `packages/plugin-sdk/src/i18n.ts` (lines 811, 1635) contains `'coach.state_a.placeholder': 'XXXXXX'` in both English and French locales
- Files: `packages/plugin-sdk/src/i18n.ts`
- Impact: Users see literal "XXXXXX" in UI if this key is ever rendered
- Fix approach: Replace with production copy before app store submission

**gluestack-ui in mobile dependencies but unused:**
- Issue: `@gluestack-style/react`, `@gluestack-ui/config`, `@gluestack-ui/themed` all appear in `apps/mobile/package.json` but grep finds zero imports in `apps/mobile/src` or plugins
- Files: `apps/mobile/package.json`
- Impact: Dead dependencies increase JS bundle size; risk of version conflicts
- Fix approach: Remove all three gluestack packages from `apps/mobile/package.json`

**`motion` package in mobile dependencies but unused in mobile:**
- Issue: `"motion": "^12.38.0"` in `apps/mobile/package.json`; no `import ... from 'motion'` found in any mobile file
- Files: `apps/mobile/package.json`
- Impact: Bundles web-only animation library into mobile JS, increasing bundle size needlessly
- Fix approach: Remove from mobile `package.json`; already present in `apps/web/package.json`

**Hardcoded goals/defaults not backed by DB columns:**
- Issue: `apps/mobile/src/hooks/useHomeData.ts` comments document that `daily_water_goal_ml`, `weekly_goal`, and `sleep_goal` do not exist as DB columns — hardcoded defaults `{hydrationGoalMl:2500, sleepTargetH:8, weeklyGoalDefault:4}` used instead
- Files: `apps/mobile/src/hooks/useHomeData.ts`
- Impact: Personalisation features don't persist across devices; values can't be changed by users
- Fix approach: Add these columns to `user_profiles` or a dedicated `user_prefs` table; migrate defaults via SQL

**Message persistence fire-and-forget in AI conversation context:**
- Issue: `appendMessages()` in `backend/api/src/context/conversation.ts` silently logs errors but does not retry or surface failure to the caller
- Files: `backend/api/src/context/conversation.ts`
- Impact: Chat messages may silently drop on DB timeout or transient errors; conversation history corrupted
- Fix approach: Propagate errors to caller; implement retry with exponential backoff; alert on repeated failures

---

## Security Considerations

**Duplicate migration numbers:**
- Risk: Supabase applies migrations in filename order. Pairs `022_default_theme_unlock.sql` / `022_pantry_schema.sql`, `027_ai_cost_log.sql` / `027_earn_rpc.sql`, `054_coach_branding.sql` / `054_notification_schema.sql`, and `055_coach_exercises_schema.sql` / `055_forms_schema.sql` share the same number prefix. Depending on deployment tooling, one file in each pair may never be applied.
- Files: `supabase/migrations/022_*.sql`, `027_*.sql`, `054_*.sql`, `055_*.sql`
- Current mitigation: None detected
- Recommendations: Renumber all duplicate-prefixed migrations with unique sequential numbers; verify all tables exist in production; add CI check that prevents duplicate prefixes

**CRON_SECRET passes through when env var is absent:**
- Risk: `verifyCronSecret()` in `backend/api/src/routes/notifications-cron.ts` (lines 23-26), `backend/api/src/routes/storage.ts` (lines 132-135), and `backend/api/src/routes/supplements.ts` (lines 133-135) return `true` when `CRON_SECRET` is not set — cron endpoints are publicly callable on deployments that omit the env var
- Files: `backend/api/src/routes/notifications-cron.ts`, `backend/api/src/routes/storage.ts`, `backend/api/src/routes/supplements.ts`
- Current mitigation: Production deployments should set `CRON_SECRET`; there is no hard-fail guard
- Recommendations: Add startup assertion `if (!process.env.CRON_SECRET) throw new Error(...)` in production; add middleware that returns 503 (not 200) when env is absent

**Sentry DSN hardcoded as fallback in source:**
- Risk: `apps/mobile/src/lib/sentry.ts` line 3 hard-codes the Sentry DSN as a fallback string. The DSN is not a secret but its public exposure means anyone could send events to the project
- Files: `apps/mobile/src/lib/sentry.ts`
- Current mitigation: DSN only allows event submission; it cannot read data
- Recommendations: Remove hardcoded fallback; require `EXPO_PUBLIC_SENTRY_DSN` to be set; fail silently (don't init Sentry) if missing

**App Store ID placeholder in production settings screen:**
- Risk: `apps/mobile/app/(app)/profile/settings.tsx` line 635 points to `https://apps.apple.com/app/id6744155867` with a TODO comment stating this is a placeholder. If this is not the real ID, rate/review links will 404 or link to the wrong app.
- Files: `apps/mobile/app/(app)/profile/settings.tsx` (line 635)
- Current mitigation: None
- Recommendations: Verify the real App Store ID before production release; add integration test to confirm URL resolves

**Legal page contains placeholder entity information:**
- Risk: `apps/mobile/app/(app)/profile/legal.tsx` (lines 8, 77, 176) has three TODO comments indicating legal entity details (SIRET, legal form, competent court) are not filled in
- Files: `apps/mobile/app/(app)/profile/legal.tsx`
- Current mitigation: None
- Recommendations: Complete all legal entity fields before app store submission; add content review gate in release checklist

**Marketing pages contain placeholder content:**
- Risk: `apps/web/src/components/marketing/CoachsFounderSectionClient.tsx` (lines 41, 46, 53) uses placeholder founder story, photo, and name. `CoachsVideoPlaceholderClient.tsx` shows static placeholder where a product video should appear.
- Files: `apps/web/src/components/marketing/CoachsFounderSectionClient.tsx`, `apps/web/src/components/marketing/CoachsVideoPlaceholderClient.tsx`
- Current mitigation: Placeholders are silently rendered in production
- Recommendations: Replace before public launch; implement content review checklist

**SUPABASE_SERVICE_KEY falls back to publishable key:**
- Risk: Across >15 files in `backend/api/src/`, the pattern `process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!` is used. If `SUPABASE_SERVICE_KEY` is absent, a publishable (non-admin) key is silently used for service-level operations that bypass RLS — these operations will then silently fail or return partial data.
- Files: `backend/api/src/middleware/auth.ts`, `backend/api/src/routes/ai.ts`, `backend/api/src/services/creditService.ts`, and ~10 others
- Current mitigation: `notificationService.ts` throws on startup if `SUPABASE_SERVICE_KEY` is absent (correct pattern); other files do not
- Recommendations: Apply the same startup-throw guard to all files that require the service key; document which operations require service key vs. publishable key

---

## Performance Bottlenecks

**N+1 query in coach dashboards athlete list:**
- Problem: `backend/api/src/coach/dashboards/db.ts` runs `Promise.all(profiles.map(async p => supabase.from('workout_sessions').select(...).eq('user_id', p.id)))` — one Supabase query per athlete
- Files: `backend/api/src/coach/dashboards/db.ts` (lines ~174-179)
- Cause: No batch query or join for last-active session per athlete
- Improvement path: Use a single query with `GROUP BY user_id` or a Postgres RPC to fetch last session dates for all athletes in one round-trip

**Three-layer context fetch on every AI request:**
- Problem: `POST /ai/chat/stream` and `POST /ai/chat` both call `fetchUserContext()` + `getOrCreateConversation()` — minimum 2 Supabase queries per turn with no caching
- Files: `backend/api/src/routes/ai.ts`, `backend/api/src/context/user.ts`
- Cause: User context re-fetched on every turn even if profile unchanged
- Improvement path: Cache user context in Redis (5-10 min TTL) keyed by `userId`; invalidate on profile update webhook

**Conversation message history loaded unbounded:**
- Problem: `getOrCreateConversation()` loads ALL messages with no `.limit()` — long conversations degrade request latency linearly
- Files: `backend/api/src/context/conversation.ts`
- Cause: No pagination on AI message history
- Improvement path: Limit context window to last 50 messages; add "load more" endpoint; truncate older messages for AI context while keeping full history in DB

**GPS location updates may accumulate unbounded in memory:**
- Problem: `CardioTracker.tsx` appends every GPS fix to an in-memory array during session — multi-hour runs at 1Hz accumulate thousands of `RoutePoint` objects
- Files: `plugins/cardio/src/screens/CardioTracker.tsx`
- Cause: No ring-buffer or periodic flush to storage
- Improvement path: Flush route segments to AsyncStorage every 60 points; use a ring buffer of last 200 points for live display; reconstruct full route on session end

**i18n translation corpus inlined as a single 1600+ line object:**
- Problem: `packages/plugin-sdk/src/i18n.ts` contains the complete English + French translation corpus as a single exported object, loaded on every module import regardless of which keys are needed
- Files: `packages/plugin-sdk/src/i18n.ts` (1600+ lines)
- Cause: No locale splitting or lazy loading
- Improvement path: Split into `en.json` and `fr.json`; load only active locale; use dynamic import for secondary locale

---

## Fragile Areas

**Duplicate Supabase client instantiation per module:**
- Files: `backend/api/src/middleware/auth.ts`, `backend/api/src/middleware/creditGate.ts`, `backend/api/src/routes/ai.ts`, `backend/api/src/services/creditService.ts`, and ~10 more
- Why fragile: Each module creates its own `createClient()` instance at module scope. This bypasses connection pooling; under load, many idle connections accumulate. There is also no centralized client configuration point.
- Safe modification: Create a singleton client factory in `backend/api/src/lib/supabase.ts` returning a cached service client and a cached publishable client; import from there everywhere
- Test coverage: No tests for connection pool behaviour

**ErrorBoundary covers only root layout — plugin screens unprotected:**
- Files: `apps/mobile/app/_layout.tsx` (lines 110, 129), `apps/mobile/src/components/ErrorBoundary.tsx`
- Why fragile: The single `<ErrorBoundary>` wraps the entire app but each plugin screen renders inside a deeply nested Expo Router stack. A render error in a plugin screen will propagate to the root boundary, resetting the entire app state including the active workout session.
- Safe modification: Add per-screen `<ErrorBoundary>` wrappers in plugin screens; scope recovery to the failing screen only
- Test coverage: ErrorBoundary has no tests

**Wearables sync without deduplication:**
- Files: `plugins/wearables/src/store.ts`, `supabase/migrations/014_wearables_schema.sql`
- Why fragile: `syncAll()` fetches health data and inserts into `wearable_daily_summary` without checking for existing rows for the same date. Multiple syncs per day create duplicate rows; analytics over-count.
- Safe modification: Use `UPSERT` with `ON CONFLICT (user_id, date)` in both the mobile store and the DB migration; add a UNIQUE constraint
- Test coverage: No tests found for sync idempotency

**Persona system prompt injection without sanitization:**
- Files: `plugins/persona/src/store.ts`, `backend/api/src/routes/ai.ts` (system prompt builder)
- Why fragile: User-supplied persona fields (backstory, coaching style) are injected verbatim into the Claude system prompt. No length cap or character filtering exists. A malicious user could attempt prompt injection via these fields.
- Safe modification: Truncate backstory to 500 chars max; strip XML/angle brackets; validate coaching style against enum whitelist before injection
- Test coverage: No tests for prompt injection resistance

**Session workout state machine not isolated:**
- Files: `apps/mobile/src/stores/workoutStore.ts` (391 lines), `apps/mobile/app/(app)/workout/[id].tsx`
- Why fragile: The `workoutStore` mixes persistence logic (AsyncStorage + Supabase), timer state, and program tracking in one large Zustand store. Any state mutation can affect unrelated slices.
- Safe modification: Split into `sessionStore` (active tracking), `programStore` (program/exercise catalog), and `timerStore` (rest timer); document state transition diagram
- Test coverage: No unit tests found for store actions

---

## Scaling Limits

**Supplement scraper runs sequentially per brand (Vercel function timeout risk):**
- Current capacity: `backend/api/src/scrapers/index.ts` iterates 11 brands with `for...of` (sequential). Each scraper performs HTTP requests to external sites.
- Limit: Combined scraper duration likely exceeds Vercel's 60s function timeout on cold-start weeks. Partial runs produce inconsistent data.
- Scaling path: Parallelize scrapers with `Promise.allSettled()`; split into per-brand cron invocations; add timeout per scraper (10s cap); store per-brand `last_scraped_at` for partial recovery

**Notification cron fetches all notification tokens without pagination:**
- Current capacity: `backend/api/src/routes/notifications-cron.ts` queries `notification_tokens` and `notification_log` with no `.limit()` — all rows returned in memory
- Limit: At 10,000+ users each with a token, the response payload and in-process array will OOM the Vercel function
- Scaling path: Paginate queries in 500-row batches; process in chunks; track progress in Redis cursor

**Plugin registry is static (17 plugins hard-coded in PluginLoader):**
- Current capacity: `apps/mobile/src/lib/PluginLoader.tsx` has a hardcoded `PLUGIN_LOADERS` map. Adding a plugin requires a code change and app release.
- Limit: Cannot hot-add or A/B test new plugins without a full app update
- Scaling path: Fetch enabled plugins list from `plugins_registry` DB table at runtime; use dynamic import() with registry-provided bundle URL; validate manifest schema before registration

---

## Dependencies at Risk

**`xlsx` (SheetJS) v0.18.5 — known vulnerabilities, abandoned community edition:**
- Risk: SheetJS v0.18.x is the last open-source release; maintainers moved to a commercial model. Known prototype pollution CVEs exist (GHSA-4r6h-8v6p-xvhc). npm audit may flag this.
- Impact: Excel import parsing (`backend/api/src/coach/imports/parse/excel.ts`) could be exploited via malicious .xlsx uploads
- Files: `backend/api/package.json`, `backend/api/src/coach/imports/parse/excel.ts`
- Migration plan: Evaluate `exceljs` as a drop-in replacement; alternatively switch to server-side CSV conversion with LibreOffice; add MIME-type + file-size validation before parse

**`@sentry/react-native` ~7.2.0 — significantly outdated:**
- Risk: Sentry RN SDK is at v7.2.0 (pinned with `~`). Current release is v5.x of the new `@sentry/react-native`. The `~7.x` version is from the old major. Limited support for Expo SDK 54 features.
- Impact: Missing crash symbolication for hermes engine, missing replay support, possible compatibility gaps with React 19
- Files: `apps/mobile/package.json`
- Migration plan: Upgrade to `@sentry/react-native@^6.0.0`; test sourcemap upload in EAS build pipeline

**`pdfjs-dist` v5 requires Node.js DOM polyfills:**
- Risk: `backend/api/src/coach/imports/parse/pdf.ts` installs global `DOMMatrix`, `document`, and `Path2D` polyfills before loading pdfjs-dist. These globals are set at module scope and may conflict with other libraries or tests.
- Impact: Memory leaks or unexpected DOM-related errors in long-running Vercel functions. Hard to debug.
- Files: `backend/api/src/coach/imports/parse/pdf.ts`
- Migration plan: Isolate PDF parsing in a separate worker thread or separate Vercel function to scope the polyfills; evaluate `pdf-parse` as a lighter alternative for text extraction

**Vercel AI SDK v6 rapid evolution:**
- Risk: `ai@^6.0.116` was a major breaking release from v3. The SDK is under active development with frequent minor-version changes. `streamText`, `generateText`, and tool schema APIs have changed multiple times.
- Impact: Future updates could break the SSE stream format, tool calling, or `stepCountIs` semantics
- Files: `backend/api/package.json`, `backend/api/src/routes/ai.ts`
- Migration plan: Pin to exact version `ai@6.0.116` (remove `^`); wrap AI SDK calls in an abstraction layer; test upgrades in an isolated branch

---

## Missing Critical Features

**Welcome notification not implemented:**
- Problem: `backend/api/src/routes/webhooks.ts` (line 29) has a `// TODO: send welcome notification via FCM/APNs` comment. New user registrations produce no onboarding push notification.
- Blocks: First-session engagement, habit formation nudges
- Implementation path: Implement FCM + APNs dispatch in `notificationService.ts`; hook into the `user_profiles INSERT` webhook; include deeplink to onboarding step 1

**Audio playback on mobile for vocal feedback deferred:**
- Problem: `plugins/coach/src/screens/VideoPlayerScreen.tsx` line 455 has `{/* TODO: audio player on mobile — post-v1.13 */}`. Vocal feedback audio plays only on web.
- Blocks: Mobile athletes cannot hear coach audio feedback; core coaching feature degraded on mobile
- Implementation path: Use `expo-av` (already a dependency) to play audio from Supabase signed URL; add play/pause controls

**Coach client dashboard hardcodes `clientId` instead of client name:**
- Problem: `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/dashboard/page.tsx` (line 48) has `// TODO: replace clientId with client name when available from config`
- Blocks: Dashboard title shows UUID instead of athlete name; poor coach UX
- Implementation path: Fetch `user_profiles.name` via `coach_client_links` join; pass to page title

---

## Test Coverage Gaps

**No tests for mobile app (zero test files in `apps/mobile/src`):**
- What's not tested: All mobile stores (`workoutStore`, `authStore`, `aiStore`), hooks (`useHomeData`, `useNotifications`), and components
- Files: Entire `apps/mobile/src/` directory
- Risk: Regressions in critical flows (workout session, auth) detected only in production
- Priority: High

**No tests for plugin screens (zero test files across all 17 plugins):**
- What's not tested: All plugin UI components, plugin store actions, plugin manifest schemas
- Files: `plugins/*/src/`
- Risk: Broken plugin renders go undetected until user-reported
- Priority: Medium

**No integration tests for AI tool executors:**
- What's not tested: Tool executors in `backend/api/src/tools/*.ts` — the actual Supabase reads/writes each tool performs
- Files: `backend/api/src/tools/habits.ts`, `nutrition.ts`, `cardio.ts`, `sleep.ts`, etc.
- Risk: AI logs incorrect data (wrong user_id, malformed JSONB, wrong column names); user trust destroyed
- Priority: High

**Web app tests cover only 6 vocal/dashboard utility files:**
- What's not tested: Coach program editor, client management, forms builder, imports preview, branding — nearly all business-critical web surfaces
- Files: `apps/web/src/app/[locale]/(coach)/coach/` (all route components)
- Risk: Coach feature regressions undetected; coach app is a revenue-generating surface
- Priority: High

**RLS policy coverage not verified by automated tests:**
- What's not tested: Whether user A can access user B's data via direct API calls with a valid JWT
- Files: `supabase/migrations/001-061_*.sql` (all RLS definitions)
- Risk: Privilege escalation; data leaks between users or between coaches and athletes
- Priority: Critical
- Note: `backend/api/test/rls/` contains some RLS specs — extend to cover all tables added after migration 009

---

*Concerns audit: 2026-05-28*
