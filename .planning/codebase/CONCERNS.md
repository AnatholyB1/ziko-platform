# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Large monolithic screens:**
- Issue: Multiple screens exceed 1500+ lines of code, mixing state management, UI rendering, and business logic
- Files: `apps/mobile/app/(app)/workout/session.tsx` (1574 lines), `plugins/stats/src/store.ts` (1557 lines), `plugins/stats/src/screens/StatsDashboard.tsx` (1502 lines), `packages/plugin-sdk/src/i18n.ts` (1434 lines)
- Impact: Difficult to maintain, test, and debug. High cognitive load. Changes to one feature risk breaking another.
- Fix approach: Extract RPE calculator, timers, and modal logic into dedicated components. Move analytics data fetching to separate hooks. Consider extracting i18n logic into configuration files instead of inline code.

**Inline RPE calculator duplicated across codebase:**
- Issue: RPE calculation logic (RPE10_PCT table, rpeCalc1RM function) is hardcoded inline in `apps/mobile/app/(app)/workout/session.tsx` (lines 22-39) instead of being imported from `@ziko/plugin-rpe`
- Files: `apps/mobile/app/(app)/workout/session.tsx` (lines 22-39)
- Impact: Code duplication, difficult to maintain formula consistency, creates discrepancies if formulas change
- Fix approach: Import and use shared RPE functions from plugin package rather than replicating logic

**Plugin manifest validation gap:**
- Issue: `PluginLoader.tsx` loads plugin manifests but only silently logs errors (line 93) with no validation that manifests contain required fields
- Files: `apps/mobile/src/lib/PluginLoader.tsx` (line 92-94)
- Impact: Invalid manifests (missing routes, icon, id) will fail at runtime with vague errors. No early warning.
- Fix approach: Add schema validation (Zod) for PluginManifest on load. Throw meaningful errors if required fields missing.

**Message persistence fire-and-forget:**
- Issue: `appendMessages()` in `backend/api/src/context/conversation.ts` (line 64) silently logs errors but doesn't retry or ensure persistence
- Files: `backend/api/src/context/conversation.ts` (line 64)
- Impact: Chat messages may be lost in failure scenarios. No notification to user. Conversation history corrupted.
- Fix approach: Implement retry logic with exponential backoff. Return error status to client. Log warnings to monitoring system.

**Missing notification implementation:**
- Issue: TODO comment in `backend/api/src/routes/webhooks.ts` (line 29) indicates welcome notifications via FCM/APNs not implemented
- Files: `backend/api/src/routes/webhooks.ts` (line 29)
- Impact: New users don't receive welcome messaging, reducing engagement. Onboarding flow incomplete.
- Fix approach: Implement FCM (Android) + APNs (iOS) notification dispatch on new user signup webhook.

## Known Bugs Fixed

The following issues were previously identified and fixed in CLAUDE.md "Known Bugs Fixed":
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` renamed to `EXPO_PUBLIC_SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY` removed from backend
- `authStore.ts` subscription now properly stored (but see "Subscription Management" below)
- Design system migrated to light sport orange theme
- AI SDK v6 API migration (inputSchema, stepCountIs, input/output)
- `findLast` polyfilled for ES2016 target
- `.env.production` removed from git tracking
- `Alert.alert` replaced with `showAlert` from plugin-sdk
- Emoji encoding issues in CardioTracker fixed
- GPS permissions declared in `app.json`

## Security Considerations

**Missing input validation on tool parameters:**
- Risk: Tool executors accept `Record<string, unknown>` parameters (line 95 in `backend/api/src/routes/ai.ts`) without schema validation
- Files: `backend/api/src/routes/ai.ts` (line 95), `backend/api/src/tools/registry.ts`
- Current mitigation: None observed. Tool functions assume valid input.
- Recommendations:
  - Add Zod schema validation for each tool's parameters before execution
  - Return 400 error with validation details on invalid input
  - Log validation failures for security audit

**Persona settings injection without access control:**
- Risk: `applyPersonaDynamicPrompt()` in `PluginLoader.tsx` (line 30) fetches persona settings by user_id without verifying RLS policies
- Files: `apps/mobile/src/lib/PluginLoader.tsx` (line 30-54)
- Current mitigation: Relies on Supabase client-side RLS (user authenticated via session)
- Recommendations:
  - Verify RLS policy on `persona_settings` table enforces user_id ownership
  - Add error handling for unauthorized access
  - Test RLS bypasses with JWT spoofing tests

**Base64 image size validation insufficient:**
- Risk: Vision endpoint accepts up to 14MB base64 (line 280 in `backend/api/src/routes/ai.ts`), but Claude vision API has lower limits
- Files: `backend/api/src/routes/ai.ts` (line 280)
- Current mitigation: Basic size check only
- Recommendations:
  - Reduce limit to 5MB base64 (~3.75MB actual image)
  - Add image format validation (reject if not jpeg/png/webp/gif)
  - Log rejected uploads for abuse detection

**Environment variables exposure risk:**
- Risk: `.env` files in `/apps/mobile/` and `/backend/api/` present — ensure not committed
- Files: Multiple `.env*` files exist but appear in `.gitignore`
- Current mitigation: `.env*` pattern in `.gitignore`, `.env.production` removed
- Recommendations:
  - Add pre-commit hook to block .env commits
  - Use `git-secrets` to scan for patterns (sk-*, ANTHROPIC_API_KEY=)
  - Rotate ANTHROPIC_API_KEY and SUPABASE keys quarterly

## Performance Bottlenecks

**Excessive state in StatsDashboard:**
- Problem: 22+ `useState` calls for analytics data (lines 70-100 in `plugins/stats/src/screens/StatsDashboard.tsx`)
- Files: `plugins/stats/src/screens/StatsDashboard.tsx` (lines 70-100)
- Cause: Each data type (habits, nutrition, gamification, cardio, etc.) has separate state arrays. Fetching all in one useEffect (full re-render on each load).
- Improvement path:
  - Consolidate into single `analyticsData` object with Zustand store
  - Implement lazy loading per tab (fetch only active tab data)
  - Memoize heavy computations (chart data generation)
  - Add pagination for large datasets (history timelines)

**GPS location updates may accumulate unbounded:**
- Problem: CardioTracker stores ALL GPS points in memory during session (line 64 in `plugins/cardio/src/screens/CardioTracker.tsx`). Multi-hour sessions could cause OOM.
- Files: `plugins/cardio/src/screens/CardioTracker.tsx` (line 64)
- Cause: No pruning of old points, no throttling of update frequency
- Improvement path:
  - Implement ring buffer of last N points (e.g. 1000)
  - Throttle location subscription to 5-10 second intervals
  - Persist intermediate route data every 30 seconds (avoid full loss on crash)
  - Consider splitting long sessions into segments

**Message history loaded entirely on each conversation:**
- Problem: `getOrCreateConversation()` loads ALL messages with `.select()` (line 26 in `backend/api/src/context/conversation.ts`). Conversations with 1000+ messages will be slow.
- Files: `backend/api/src/context/conversation.ts` (line 26)
- Cause: No pagination or limit on message fetch
- Improvement path:
  - Limit initial load to last 30 messages
  - Implement "load earlier" endpoint for pagination
  - Cache conversation metadata (title, message count) separately
  - Consider full-text search on conversation_id for retrieval optimization

**I18n inline object (1434 lines):**
- Problem: `packages/plugin-sdk/src/i18n.ts` contains entire translation corpus as inline object
- Files: `packages/plugin-sdk/src/i18n.ts` (1434 lines)
- Cause: Bundle bloat, slow parsing on app startup, no lazy loading per locale
- Improvement path:
  - Split translations into separate JSON files per locale
  - Lazy load only active locale on startup
  - Consider using i18next or react-i18next for better splitting

**Three-layer context fetch on every AI request:**
- Problem: `POST /ai/chat/stream` and `POST /ai/chat` both call `Promise.all([fetchUserContext, getOrCreateConversation])` (line 135 in `backend/api/src/routes/ai.ts`), making 2+ Supabase queries per request
- Files: `backend/api/src/routes/ai.ts` (lines 135, 217)
- Cause: User context fetched fresh on every turn, even if user hasn't changed
- Improvement path:
  - Cache user context in Redis with TTL (5-10 min)
  - Only refetch if explicit invalidation signal received
  - Add conversation history pagination (don't load all messages)

## Fragile Areas

**Cardio GPS route data persistence:**
- Files: `plugins/cardio/src/screens/CardioTracker.tsx`, `plugins/cardio/src/store.ts`, migration 021 (`supabase/migrations/021_*.sql`)
- Why fragile: Route points stored as JSONB array (potentially 1000+ elements). No validation of coordinate bounds. Elevation data optional but inconsistent.
- Safe modification:
  - Always validate lat/lng within bounds [-90,90] and [-180,180] before saving
  - Implement structured RoutePoint validation (Zod schema)
  - Add database constraint on JSON array length
  - Test with multi-hour sessions (5000+ points)
- Test coverage: No tests found for GPS data serialization or coordinate edge cases

**Session workout program state transitions:**
- Files: `apps/mobile/app/(app)/workout/session.tsx`, `apps/mobile/src/stores/workoutStore.ts`
- Why fragile: Complex state machine (idle → running → finished → saved) with multiple recovery paths. Free exercises can be added mid-session. Rest timers can be interrupted.
- Safe modification:
  - Document state transition diagram before changes
  - Add exhaustive switch on `trackingState` type
  - Test interrupted saves (network failure during Supabase insert)
  - Validate all state before operations (e.g. don't allow finish if session is 0 seconds)
- Test coverage: Large file with mixed concerns. No unit tests found for state transitions.

**Persona system prompt injection:**
- Files: `apps/mobile/src/lib/PluginLoader.tsx`, `backend/api/src/routes/ai.ts`, `plugins/persona/src/store.ts`
- Why fragile: User persona settings modify AI system prompt dynamically. No sanitization of user input (backstory, habits). Could cause prompt injection if stored values contain jailbreak attempts.
- Safe modification:
  - Validate persona fields (backstory max 500 chars, traits enum only)
  - Escape system prompt addition before injection
  - Add audit logging when persona changes
  - Rate-limit persona updates per user
- Test coverage: No tests found for prompt injection resistance

**Plugin manifest loading with falsy checks:**
- Files: `apps/mobile/src/lib/PluginLoader.tsx` (line 76: `if (error || !userPlugins) return;`)
- Why fragile: Silent failure if query error or no plugins. User never knows if plugin load failed.
- Safe modification:
  - Distinguish between "no plugins" and "query error"
  - Log errors to console and analytics
  - Show visual error badge in plugin store if load failed
  - Implement plugin health check on app startup
- Test coverage: No tests for plugin loader error handling

**Wearables sync without deduplication:**
- Files: `plugins/wearables/src/store.ts`, `supabase/migrations/014_*.sql`
- Why fragile: `syncAll()` fetches health data from Apple Health/Health Connect every time. No deduplication by date. Could create duplicate daily summaries.
- Safe modification:
  - Before inserting, check if `wearable_daily_summary` already has entry for (user_id, date)
  - Use upsert instead of insert
  - Log sync deltas (new vs updated vs unchanged)
  - Test with multiple sync runs same day
- Test coverage: No tests found for wearables sync idempotency

## Scaling Limits

**Conversation message storage unbounded:**
- Current capacity: Each conversation can store unlimited messages. Single query returns all.
- Limit: Database query time >5s for conversations with 1000+ messages. Client memory issue with large arrays.
- Scaling path:
  - Implement message pagination (50-message windows)
  - Archive old conversations after 90 days
  - Consider message compression or summarization for long conversations
  - Add database index on (conversation_id, created_at)

**Supabase RLS policy evaluation for each plugin query:**
- Current capacity: RLS policies evaluated for every `select()`, `insert()`, `update()`. Works for <100 concurrent users.
- Limit: At 1000+ concurrent users, RLS policy evaluation becomes bottleneck. Each policy check adds 10-50ms.
- Scaling path:
  - Consider service role client for trusted operations (with explicit permission checks in code)
  - Implement query result caching in Redis
  - Denormalize user_id into more tables for simpler RLS
  - Move auth checks to API middleware instead of database policies

**Workout session durability for long sessions:**
- Current capacity: Single session record with arrays of sets/exercises. App assumes Supabase insert succeeds in one shot.
- Limit: Network interruption during save = data loss. No checkpoint/resume.
- Scaling path:
  - Persist session draft to local storage after every set completion
  - Implement resumable upload to Supabase (chunks)
  - Add pre-save validation (at least 1 exercise logged)
  - Implement session recovery screen on app restart

**AI tool registry static at startup:**
- Current capacity: `allToolSchemas` loaded once at server startup. 50+ tools registered.
- Limit: Adding new tools requires server restart. Tool removal impossible without downtime.
- Scaling path:
  - Move tool schemas to database table
  - Reload tool registry on webhook event (new plugin installed)
  - Implement feature flags for tool enable/disable without restart
  - Cache tool schemas in Redis with TTL

## Dependencies at Risk

**Vercel AI SDK v6 rapid evolution:**
- Risk: AI SDK recently migrated from v3 → v6. Significant API breaks (inputSchema, stepCountIs). Further breaking changes possible.
- Impact: Future updates could require rewriting tool system. No LTS version available.
- Migration plan:
  - Pin to specific version `ai@6.0.116` in lockfile
  - Create abstraction layer around AI SDK calls (wrapper functions)
  - Monitor upstream releases monthly
  - Test major version upgrades in separate branch before deploy

**Supabase client version mismatch risk:**
- Risk: Mobile uses `@supabase/supabase-js@^2.99.2`, backend uses same. Point version churn common.
- Impact: Breaking changes in minor versions could affect RLS or auth. Different versions between mobile/backend could cause inconsistencies.
- Migration plan:
  - Pin to exact version `@supabase/supabase-js@2.99.2` (remove ^)
  - Test Supabase updates in staging environment first
  - Keep auth middleware test coverage high
  - Document RLS policy assumptions

**React 19.1.0 beta/unstable:**
- Risk: React 19 is relatively new. Future minor versions could introduce behavior changes.
- Impact: React Native component libraries may not support RC versions (compatibility gaps).
- Migration plan:
  - Pin to ^19.1.0 (allow patch updates only)
  - Test React updates with Expo Router v4 in parallel setup
  - Monitor React Native release notes for compatibility
  - Have rollback plan to v18 if issues arise

**Zod v4.3.6 EOL risk:**
- Risk: Zod 4.x is stable but v5 likely coming. Validation schema syntax could change.
- Impact: Schemas would need rewriting. No validation during migration period.
- Migration plan:
  - Pin to `zod@^4.3.6` for now
  - Plan Zod v5 migration as standalone task when released
  - Use schema composition (avoid monolithic validators) for easier refactoring

## Missing Critical Features

**No offline support:**
- Problem: Entire app requires internet connection. No local-first support. Users in areas with poor connectivity can't use app.
- Blocks: Can't log workouts offline. Can't view previous data offline. Can't chat with AI offline.
- Implementation path:
  - Add Redux Persist or similar for local state sync
  - Queue mutations (workout logs, habit completion) with offline detection
  - Sync queue on reconnection with conflict resolution
  - Implement basic offline screens (view cached data, show "offline" badge)

**No session recovery after crash:**
- Problem: If app crashes mid-workout, all data lost. No checkpoint recovery.
- Blocks: Long sessions risky. Users lose motivation if work lost.
- Implementation path:
  - Save session draft after every set (to AsyncStorage)
  - Show recovery prompt on app restart if draft exists
  - Merge recovered data with any cloud save
  - Implement cleanup of stale drafts (>48 hours old)

**No notification system:**
- Problem: Users don't get reminders for habits, water intake, stretching breaks. App must be open to interact.
- Blocks: Lower engagement. Users forget to log daily data.
- Implementation path:
  - Implement native notifications (FCM + APNs)
  - Backend endpoint to schedule/send notifications
  - User preferences for notification times/frequency
  - Integration with habit tracker (daily at 8am)

**No analytics/funnel tracking:**
- Problem: No visibility into user journeys. Can't tell if users are dropping off at onboarding, workout, or AI chat.
- Blocks: Can't prioritize product improvements. No data-driven decisions possible.
- Implementation path:
  - Add Segment or Mixpanel client
  - Track events: onboarding_step, workout_started, workout_completed, chat_sent, plugin_installed
  - Set up basic funnels in dashboard (signup → onboarding → first_workout)
  - Add user property tracking (age, goal, active_plugins)

**No dark mode support:**
- Problem: Design system explicitly excludes dark mode. Light-only theme.
- Blocks: Users wanting dark mode can't use app comfortably. Battery drain on high brightness.
- Implementation path:
  - Add theme variants (light, dark) to design tokens
  - Update all screens to respect `useColorScheme()` hook
  - Consider no-dark-mode deprecation or add secondary theme

## Test Coverage Gaps

**AI tool execution untested:**
- What's not tested: Tool executors (habits_log, nutrition_log_meal, etc.) in `backend/api/src/tools/*.ts`
- Files: `backend/api/src/tools/habits.ts`, `nutrition.ts`, `cardio.ts`, etc.
- Risk: Tool bugs discovered in production. Users can't trust AI to correctly log data.
- Priority: High

**Plugin manifest validation missing:**
- What's not tested: Plugin loader error paths, invalid manifest handling in `PluginLoader.tsx`
- Files: `apps/mobile/src/lib/PluginLoader.tsx` (lines 85-94)
- Risk: Broken plugin breaks entire app. Silent failures mask issues.
- Priority: High

**Workout session state transitions:**
- What's not tested: Complex state machine in `session.tsx`. Edge cases like interrupted saves, rapid pause/resume.
- Files: `apps/mobile/app/(app)/workout/session.tsx`
- Risk: Data corruption or loss during session recovery. Users lose workout data.
- Priority: High

**RLS policies for new plugins:**
- What's not tested: Row Level Security on tables added in migrations 012-021. Ensure users can't access other users' data.
- Files: `supabase/migrations/012-021_*.sql`
- Risk: Data leak or privilege escalation. User A sees User B's workouts/nutrition.
- Priority: Critical

**Cardio GPS coordinate validation:**
- What's not tested: Haversine distance calculation with edge cases (poles, dateline, altitude jumps)
- Files: `plugins/cardio/src/screens/CardioTracker.tsx` (lines 16-26)
- Risk: Distance/pace calculations wildly incorrect in rare cases. User frustrated with bad stats.
- Priority: Medium

**Conversation message persistence edge cases:**
- What's not tested: Concurrent message inserts, partial persistence on failure, orphaned messages
- Files: `backend/api/src/context/conversation.ts`
- Risk: Duplicate messages or missing messages in conversation history. User sees broken chat.
- Priority: High

**Rate limiting missing:**
- What's not tested: No rate limiting on any endpoints. Potential abuse vectors.
- Files: `backend/api/src/app.ts`, all routes
- Risk: Tool abuse (e.g., rapid habit_log calls), AI chat spam, vision analysis DOS
- Priority: Medium

---

*Concerns audit: 2026-03-26*
