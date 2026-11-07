# Phase 46 Security Audit (logic part)

## Position
Client-side gating is a UX/progression mechanism, not an authorization boundary. Phase 46 adds no server enforcement and none was planned (D-01: no DB column, no migration). Anything an athlete can do through the API or Supabase RLS with a valid session, they can do regardless of level.

## Integrity of the level input
- `athlete_state` has SELECT-only RLS (`athlete_state_select_own`, migration 20260831120000); only `record_athlete_decision()` writes it, with `tier = GREATEST(...)`. An athlete cannot raise their own tier from the client. PASS.
- Client cannot forge the level except by tampering with the app binary/memory (local-only effect, see below).

## Server-side bypass inventory (all out of scope for Phase 46; for Phase 47 / hardening)
| Surface | Level enforced server-side? | Evidence |
|---|---|---|
| `POST /plugins/:id/install`, `PATCH /plugins/:id/toggle` | No | backend/api/src/routes/plugins.ts:26-80 (admin client upsert, only checks registry row) |
| Direct `ziko_user_plugins` upsert via Supabase | No (RLS own-row only) | store/index.tsx:132 |
| AI chat tools (`/ai/chat`, `/ai/chat/stream`, `/ai/tools/execute`) | No: `buildSDKTools` exposes all `allToolSchemas` to every user; `getToolExecutor(name)` has no tier check | routes/ai.ts:124-190, tools/registry.ts |
| `POST /ai/programs/generate` (ai-programs, level 4) | No (credit gate only) | routes/ai.ts:519 |
| Plugin data tables (cardio, supplements, community, ...) | RLS by `user_id` only | per-table policies |
| Cron/push (notifications-cron) | No | n/a |
So a level-1 athlete can use level-4 AI tools in chat, call level-gated REST routes, and write plugin tables directly. Impact: product-intent bypass only (no privilege or data-isolation break). Cost exposure exists only through existing credit gates.

## Deep-link / route guard bypass paths
Guard: `(app)/(plugins)/_layout.tsx` applies to every route under `(plugins)`. Paths checked:
- Notification tap: `handleNotificationResponse` allows `/(app)/(plugins)/` prefix then `router.push` -> lands in guarded layout. Guarded. PASS.
- Universal/custom-scheme deep link and typed `/ (plugins)/...` URL: resolve to same group. Guarded. PASS.
- AI chat navigation map (`ai/index.tsx:29+`, `/(plugins)/...`) and `useSmartActions` navigate to guarded routes. PASS.
- Routes outside `(plugins)` that import plugin code: `ai/index.tsx` imports `@ziko/plugin-community` store/functions (`getOrCreateDMConversation`, community load) and `workout/session.tsx` imports `awardWorkoutXP` from gamification. These execute plugin logic without registration or level check. Not a screen bypass but community (L3) / gamification (L3) data paths are reachable at level 1. LOW.
- Plugin store (`store/index.tsx`, `store/[id].tsx`): installs and registers locked plugins (no level check); registry tile appears though routes are guarded. MEDIUM (see 46-REVIEW.md).
- Guard races: while `levelLoaded=false` gated routes render null (fail-closed); after sign-out/sign-in the stale level is fail-open (MEDIUM, 46-REVIEW.md).
- Fail-open on unknown plugin directory id (gating.ts:99-103), mitigated by CI sync test.
- Guard is client code: a modified client skips it. Acceptable given the position above.

## Other
- No secrets, no new endpoints, no new storage, no PII added. i18n strings static; `showAlert` receives plugin name/level from static map only (no injection surface).

## Verdict
No exploitable security defect introduced by Phase 46. Server enforcement is absent by design; if levels must be authoritative (monetization, AI cost), add it in Phase 47: tier check in `buildSDKTools`/`getToolExecutor` and in `/plugins/:id/install|toggle`, `/ai/programs/generate`.
