---
plan: 31-01
phase: 31-ai-tools-coach
status: complete
commit: d70b81c
---

# Plan 31-01 Summary: Coach Tool Implementation File

## What was built

Created `backend/api/src/tools/coach.ts` with two exported async functions following the habits.ts gold standard pattern.

## Functions implemented

### `coach_get_link(params, userId, userToken?)`
- Returns `{ linked: false, message: 'Authentication required.' }` when no userToken
- Returns `{ linked: false, message: '...' }` when no active coach link (D-06)
- Returns `{ linked: true, link_id, coach_name, linked_at, kyc_verified, bio, specialties }` when linked (D-05)
- Maps `kyc_status === 'verified'` → `kyc_verified: boolean` (actual type union uses 'verified', not 'approved' as stated in CONTEXT.md)

### `coach_revoke_link(params, userId, userToken?)`
- Returns `confirmation_required` error when `confirmed !== true` (D-01)
- Returns `no_active_link` error when confirmed but no link found
- Calls `revokeLink(userToken, userId, link.id)` and returns `{ ok: true, link_id, revoked_at }`
- Self-contained: fetches link ID internally via `getActiveLink` (no link_id param, D-03)

## Deviation logged

**kyc_verified comparison**: CONTEXT.md D-05 specified `kyc_status === 'approved'` but the actual `CoachPreviewPayload` type union is `'pending' | 'submitted' | 'verified' | 'rejected' | null`. Used `=== 'verified'` to match the real type and pass TypeScript compile.

## Verification

- `npx tsc --noEmit -p backend/api/tsconfig.json` → no errors in coach.ts
- File exports: `coach_get_link`, `coach_revoke_link`
- Import path: `'../coach/clients/db.js'` (ESM .js extension)
