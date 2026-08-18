---
phase: 25
plan: 05
subsystem: web-athlete-redeem
tags: [next-intl, server-actions, state-machine, safe-next, open-redirect-prevention]
requires:
  - 25-03 (backend /coach/clients/links/* endpoints)
  - 25-04 (RevokeConfirmModal — reused with athlete copy)
  - 25-01 (CoachPreviewPayload type from @ziko/coach-sdk)
provides:
  - athlete-redeem-surface: /redeem (manual entry) + /r/[code] (deep-link)
  - safeNext extension: /redeem + /r/[A-Z2-9]{6} anchored regex
  - CoachPreviewCard + CodeInput shared components
affects:
  - apps/web/src/actions/login.ts (safeNext now accepts redeem targets)
tech-stack:
  added: []
  patterns: [server-action-discriminated-union, useTransition, three-state-machine, constant-time-error-copy]
key-files:
  created:
    - apps/web/src/components/coach/CodeInput.tsx
    - apps/web/src/components/coach/CoachPreviewCard.tsx
    - apps/web/src/components/coach/RedeemStateMachine.tsx
    - apps/web/src/lib/redeem/actions.ts
    - apps/web/src/app/[locale]/redeem/page.tsx
    - apps/web/src/app/[locale]/r/[code]/page.tsx
  modified:
    - apps/web/src/actions/login.ts (NEXT_PARAM_ALLOWLIST + REDEEM_DEEPLINK_RE)
decisions:
  - Server Actions hoisted to apps/web/src/lib/redeem/actions.ts (bracket-free path) instead of colocating under [locale]/redeem/ to avoid TS path-alias resolution edge cases
  - Single i18n key CoachRedeem.errors.invalidOrExpired for all preview/redeem failure causes (constant-time on UI side)
  - 429 differentiated copy (rateLimited) accepted — HTTP layer is observable anyway, hiding it would not improve security
  - State C surfaced over deep-link preview when user already has active link (avoids confusion + matches DB single-active-link constraint)
metrics:
  tasks: 2
  files-created: 6
  files-modified: 1
  completed: 2026-05-17
---

# Phase 25 Plan 05: Web (athlete side) /redeem + /r/[code] Summary

State-machine athlete redemption surface (A manual → B preview → C linked) on apps/web with open-redirect-safe safeNext extension and athlete-side reuse of plan 04's RevokeConfirmModal.

## Commits

| Task | Commit  | Description                                                              |
| ---- | ------- | ------------------------------------------------------------------------ |
| 1    | 53673a8 | safeNext extension + CodeInput + CoachPreviewCard                        |
| 2    | 0fc9a83 | actions.ts + RedeemStateMachine + /redeem page + /r/[code] deep-link page |

## Files

### Created (6)

- `apps/web/src/components/coach/CodeInput.tsx` — 6-char `[A-Z2-9]` filtered uppercase input bound to `CoachRedeem.stateA.{inputLabel,inputPlaceholder}`.
- `apps/web/src/components/coach/CoachPreviewCard.tsx` — photo + display_name + KYC chip (verified/pending) + specialties + bio Voir plus toggle (200-char word-boundary truncation).
- `apps/web/src/components/coach/RedeemStateMachine.tsx` — client component holding A → B → C state with `useTransition`, success toast, deep-link auto-preview on mount, athlete revoke modal.
- `apps/web/src/lib/redeem/actions.ts` — Server Actions: `previewCodeAction`, `redeemCodeAction`, `revokeLinkAction`, `fetchActiveLinkAction`. All bearer-JWT via `createServerSupabase`, all `cache: 'no-store'`, all return discriminated unions.
- `apps/web/src/app/[locale]/redeem/page.tsx` — `force-dynamic` Server Component; auth-gates → `/login?next=/redeem`; reads active link server-side; renders State A or C.
- `apps/web/src/app/[locale]/r/[code]/page.tsx` — `force-dynamic` Server Component; validates code regex `/^[A-Z2-9]{6}$/` (redirects invalid → `/redeem`); auth-gates → `/login?next=/r/CODE` (URL-encoded); if user already linked, surfaces State C of existing coach; otherwise passes code to State A for auto-preview.

### Modified (1)

- `apps/web/src/actions/login.ts` — `NEXT_PARAM_ALLOWLIST` extended with `'/redeem'`; new constant `REDEEM_DEEPLINK_RE = /^\/r\/[A-Z2-9]{6}$/` (anchored); `safeNext` falls through allowlist → regex → default `/coach/dashboard`. Existing role-aware redirect logic (line 65) preserved.

## safeNext Correctness Table

Verified via `node -e` inline test against the compiled regex:

| Input                              | Expected return        | Actual          | Pass |
| ---------------------------------- | ---------------------- | --------------- | ---- |
| `/redeem`                          | `/redeem`              | `/redeem`       | ✓    |
| `/r/ABC234`                        | `/r/ABC234`            | `/r/ABC234`     | ✓    |
| `/r/abc234` (lowercase)            | `/coach/dashboard`     | rejected        | ✓    |
| `/r/AAAAAAA` (7 chars)             | `/coach/dashboard`     | rejected        | ✓    |
| `/r/AAAA` (4 chars)                | `/coach/dashboard`     | rejected        | ✓    |
| `/r/../admin` (path traversal)     | `/coach/dashboard`     | rejected        | ✓    |
| `https://evil.com/r/ABC234`        | `/coach/dashboard`     | rejected        | ✓    |
| `/coach/onboarding`                | `/coach/onboarding`    | preserved       | ✓    |
| `null`                             | `/coach/dashboard`     | default         | ✓    |

The regex `/^\/r\/[A-Z2-9]{6}$/` is anchored (^ and $) and matches the DB `CHECK (code ~ '^[A-Z2-9]{6}$')` in migration `035_coach_invitations_links_rls.sql` and the backend `CODE_REGEX` in `backend/api/src/coach/clients/service.ts:17`.

## State Machine Transition Map

```
                ┌──────────────────────────────────────────────────────────────┐
                │                                                              │
                ▼                                                              │
[mount: no link] ─► State A (manual entry)                                     │
                │                                                              │
                │  click Valider (code.length === 6)                           │
                ▼                                                              │
              previewCodeAction(code)                                          │
                │                                                              │
                │  ok=true                              ok=false / 429         │
                ▼                                              │               │
                State B (CoachPreviewCard + Lier mon compte)   │               │
                │  │                                           ▼               │
                │  │ click Annuler / back                  State A + error      │
                │  └──────────────────────────────────────────┘                │
                │                                                              │
                │  click Lier mon compte                                       │
                ▼                                                              │
              redeemCodeAction(code)                                           │
                │                                                              │
                │  ok=true                              ok=false / 429         │
                ▼                                              │               │
                State C (banner + card + Retirer)              ▼               │
                │                                          State A (code='') +error
                │  click Retirer ce coach                                      │
                ▼                                                              │
              RevokeConfirmModal (input === 'COACH')                           │
                │                                                              │
                │  click Retirer                                               │
                ▼                                                              │
              revokeLinkAction(linkId) ──────────────────────────────────────►┘
                                       (ok=true) → back to State A

[mount: /r/CODE & not linked] ─► State A with initialCode=CODE
                                  ─► useEffect auto-calls runPreview(CODE)
                                  ─► transitions to State B if valid

[mount: /r/CODE & already linked] ─► State C (existing coach, not the deep-link's coach)

[mount: /redeem & already linked] ─► State C
```

## Manual Smoke Test Plan

Plan 06 (validation) will exercise these manually against a deployed env:

1. Logged-out browser → `/fr/r/ABC234` → redirects to `/fr/login?next=%2Fr%2FABC234`
2. Log in → lands back at `/fr/r/ABC234`
3. Code auto-preview runs; State B card appears with coach preview
4. Click "Lier mon compte" → State C with linked banner + success toast `Vous êtes maintenant lié à {Coach}.`
5. Click "Retirer ce coach" → modal opens; type `COACH`; click "Retirer" → State A
6. `/fr/redeem` (manual entry) — input filters to uppercase `A-Z2-9`; submit at 6 chars

## Threat Model Mitigations

| Threat ID         | Mitigation Implemented                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| T-25-04 (spoofing/open-redirect) | `NEXT_PARAM_ALLOWLIST` exact-string + anchored regex `/^\/r\/[A-Z2-9]{6}$/`; verified table above |
| T-25-01 (info disclosure)        | Single key `errors.invalidOrExpired` returned for all underlying causes                                |
| T-25-03 (brute-force)            | 429 rate-limit honored from backend; UI surfaces `errors.rateLimited` copy                             |
| T-25-06 (photo URL)              | Backend sends signed URL only (5-min TTL); component never constructs/sees bucket path                 |
| Auth gate bypass                 | Both Server Components call `supabase.auth.getUser()` and `redirect(/login?next=...)` if no user        |
| Self-XSS via display_name        | React auto-escapes all rendered strings; data sourced from authenticated coach profile (Phase 24)       |
| Already-linked deep-link         | `/r/[code]/page.tsx` checks active link first; surfaces existing coach (State C) over deep-link preview |

## Deviations from Plan

**None — plan executed exactly as written.**

### Notes (not deviations)

- The plan's "extended" verification block (lines 783-789 of PLAN.md) includes a test case `['/r/ABC23O', false]` that is inconsistent with the canonical alphabet `[A-Z2-9]` (uppercase letter O is in `[A-Z]`). The DB `CHECK (code ~ '^[A-Z2-9]{6}$')` (migration 035) and backend `CODE_REGEX` both accept O. The Task 1 acceptance verification block (which we ran) does not include this case and passed. No regex change required.
- The `npm run build` in apps/web cannot complete due to pre-existing module-resolution errors for `@supabase/ssr` in `src/lib/supabase/{server,middleware,client}.ts` and missing types in `src/lib/supabase/__tests__/factories.spec.ts`. These errors are unrelated to plan 25-05 — they exist on the base commit `ca281ec`. TypeScript check on plan 25-05 files alone introduces zero new errors (verified via filtered `tsc --noEmit`).
- The package `@ziko/coach-sdk` is junction-linked from `node_modules/@ziko/coach-sdk` to `C:\ziko-platform\packages\coach-sdk` (main repo, not worktree). Its dist was stale (pre-Phase 25); rebuilt during Task 1 verification (`npm run build` from the main-repo path) to surface `CoachPreviewPayload` and `CoachInvitationWithStatus`.

## Open Redirect Prevention — Verified

- Anchored regex `^...$` cannot be bypassed by `https://evil.com/r/ABC234` (no leading `/`).
- Case-sensitive alphabet rejects lowercase deep-links.
- Length-locked at exactly 6 chars.
- No URL-decode happens before regex test (next-param arrives as already-decoded string from `searchParams.get`).
- `safeNext` always returns from a known-good set; default fallthrough is `/coach/dashboard`.

## Self-Check: PASSED

- `apps/web/src/components/coach/CodeInput.tsx` exists.
- `apps/web/src/components/coach/CoachPreviewCard.tsx` exists.
- `apps/web/src/components/coach/RedeemStateMachine.tsx` exists.
- `apps/web/src/lib/redeem/actions.ts` exists.
- `apps/web/src/app/[locale]/redeem/page.tsx` exists.
- `apps/web/src/app/[locale]/r/[code]/page.tsx` exists.
- `apps/web/src/actions/login.ts` contains `REDEEM_DEEPLINK_RE` and `'/redeem'` in allowlist.
- Commits `53673a8` and `0fc9a83` present in `git log`.
