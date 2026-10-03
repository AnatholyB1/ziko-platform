# Phase 3 to Phase 6 Hand-off: Auth Merge Constraints

Written by plan 03-02. Phase 6 (client cutover) must carry every item below. Identifiers are masked; no email addresses appear here.

## 1. Signup paths that must pass options.data { app: 'ziko' }

The Ziko triggers on portfolio `auth.users` (D-05) only create a profile and 5 welcome credits when `raw_user_meta_data->>'app' = 'ziko'`. Every Ziko-originated user creation must set it.

Enumeration command (re-run in Phase 6 and diff against this table):

```
grep -rnE "signUp|signInWithOAuth|signInWithOtp|admin\.createUser|inviteUserByEmail|generateLink|admin\.listUsers" apps backend packages plugins --include=*.ts --include=*.tsx --include=*.mjs --include=*.js --include=*.swift --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next
```

Result at 2026-10-01 (production code only; test files omitted):

| Path | File:line | Call | Required change | Notes |
|------|-----------|------|-----------------|-------|
| Mobile email signup | `apps/mobile/app/(auth)/register.tsx:37` | `supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })` | Add `app: 'ziko'` to `options.data` | Must ship in the cutover binary; old binaries cannot be patched |
| Mobile Google OAuth | `apps/mobile/app/(auth)/welcome.tsx:13` | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Cannot carry the flag, see section 2 | Google disabled on both projects today |
| Web account lookup | `apps/web/src/actions/account.ts:41` | `admin.auth.admin.listUsers({ page: 1, perPage: 1000 })` | Not a creation path; scope the lookup, see section 5 | Spans rh_/gecko_ users after merge |
| Web/backend user creation | none found | | | No web signup form, server action or backend route creates users |
| iOS SwiftUI dev launcher | none found | | | No `signUp()` Swift call in `apps`, `packages`, `plugins` |
| Admin-created users | `backend/api/test/rls/fixtures.ts:42`, `scripts/portfolio-migration/04-rls-smoke-test.js:93` | `auth.admin.createUser` | Test-only; add `user_metadata: { app: 'ziko' }` in Ziko RLS fixtures that expect a profile | Not production signup |
| Purge tooling | `scripts/purge-test-accounts/lib.mjs:76` | `admin.listUsers` | Not a creation path | Re-check it cannot touch non-Ziko users on the shared pool |

## 2. OAuth cannot carry the flag (D-13)

`signInWithOAuth` has no user-metadata option, so a Google signup would hit the gated triggers unflagged and get no Ziko profile or credits. Google is disabled on ziko and on portfolio today, and ziko has zero OAuth identities. Phase 6 must either keep Google disabled on portfolio, or implement the deferred lazy ensure-profile fallback (create profile and welcome credits on first authenticated Ziko request) before enabling it. The Google button in `welcome.tsx` is currently dead UI.

## 3. Residual risk accepted: client-controllable flag

`raw_user_meta_data` is user-writable at signUp. An rh_ or gecko_ client could set `app: 'ziko'` and receive one Ziko profile and 5 welcome credits. Accepted per D-05 (threat T-3-07); impact is bounded to one profile plus 5 credits per account and the backend credit gate (`creditGate.ts`) remains authoritative for spending.

## 4. Session/JWT consequence (D-11)

Portfolio's JWT secret differs from ziko's. The 52 ziko sessions are not migrated. After cutover all 39 users must sign in again with the same email and password (password hashes are imported). Existing refresh tokens fail; the app must route to login cleanly.

## 5. Shared-pool leaks to close in Phase 6

- `backend/api/src/middleware/auth.ts` (`adminClient.auth.getUser(token)`, line 30) accepts any valid portfolio JWT, including rh_/gecko_ users. Add a tenant check (a Ziko profile row or `app` marker) before treating the caller as a Ziko user.
- `apps/web/src/actions/account.ts` (`listUsers`, line 41) now spans rh_/gecko_ users; look up by email through a scoped query rather than listing the whole pool.

## 6. Final delta sync procedure

Before cutover, in order. See `scripts/auth-merge/RUNBOOK.md`.

1. `01-collision-check.mjs`. Any new collision is a blocking human checkpoint (D-04).
2. `02-import-auth.mjs --delta-report`.
3. Only if the report shows `password_changed > 0` and a human reviewed the UUID list: `02-import-auth.mjs --dry-run --apply-password-updates`, then `--apply --apply-password-updates`. Otherwise plain `--apply` (inserts new signups only).
4. `04-sync-waitlist-seq.mjs` (value read live, D-09/D-15).
5. `06-verify.mjs --check all`.

### Changed ziko password hashes

`ON CONFLICT (id) DO NOTHING` never refreshes an existing row, so a ziko user who changed password after the first import would keep the stale hash. Contract implemented in Plan 05:

- `--delta-report` lists these UUIDs separately as `password_changed`, computed by md5 inside each database; no hash is printed.
- Updates happen only with the explicit `--apply-password-updates` flag.
- Only non-collision ids, and only when the hash differs.
- Guarded by the target digest seen at report time (optimistic concurrency).
- Executed in the same single transaction with a count assertion; reported as UUIDs.
- The collision user (portfolio UUID) is never updated by this path. Its non-NULL portfolio values are never overwritten (D-03); only the existing IS NULL fills apply.
- Other changed fields (email, metadata, banned_until, deleted_at) are report-only and require a human decision.

## 7. Re-login notice send (D-12): AUTHMIG-05 completes in Phase 6

Phase 6 planning chooses the send date, sets `NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` (web) and `EXPO_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE` (mobile, next binary), and runs `07-notify-relogin.mjs --send` a few days before cutover.

The actual send is a Phase 6 task. AUTHMIG-05 / success criterion 5 (users have been informed) must NOT be marked complete on Phase 3 dry-run evidence; Phase 3 delivers the template, recipient list, send script and in-app surfaces only. AUTHMIG-05 is complete only when notify-log.json shows a send for every to_send recipient.

Phase 6 planning must carry an explicit task for the send.
