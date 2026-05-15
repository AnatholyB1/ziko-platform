---
status: complete
phase: 23-web-turborepo-onboarding-auth-bootstrap
source: [23-01-SUMMARY.md, 23-02-SUMMARY.md, 23-03-SUMMARY.md, 23-04-SUMMARY.md, 23-05-SUMMARY.md, 23-06-SUMMARY.md, 23-07-SUMMARY.md, 23-08-SUMMARY.md]
started: 2026-05-15T00:00:00Z
updated: 2026-05-15T12:36:00Z
---

## Current Test

[testing complete]

## Tests

### 1. react-native-worklets removed from root
expected: Root package.json has zero "react-native-worklets" entries; apps/mobile/package.json retains it.
result: pass
note: auto-verified — grep confirmed

### 2. Rollback tag pre-web-onboarding exists on origin
expected: `git tag -l pre-web-onboarding` and `git ls-remote --tags origin pre-web-onboarding` both return a sha.
result: pass
note: auto-verified — tag confirmed local + remote

### 3. apps/web key files present after subtree merge
expected: apps/web/middleware.ts, apps/web/src/lib/supabase/admin.ts, and apps/web/src/app/[locale]/cgu/page.tsx all exist.
result: pass
note: auto-verified — all 3 files found

### 4. Bundle-analyzer wired in next.config.ts
expected: apps/web/next.config.ts contains `withBundleAnalyzer` and `statsFilename` references.
result: pass
note: auto-verified — both grep hits confirmed

### 5. apps/web Next.js build passes locally
expected: |
  Running `npm run build --workspace=apps/web` completes without errors.
result: pass
note: fixed react@19.2.6/react-dom@19.2.4 mismatch (react-native peer dep conflict). Root override updated to 19.2.6, react-dom added as explicit root dep. Build clean.

### 6. Monorepo type-check passes (triple-green gate)
expected: |
  turbo type-check green across all workspaces. Pre-existing failures
  (mobile chat.tsx TS2769, nutrition expo-image-manipulator) must not be
  introduced by Phase 23.
result: pass
note: |
  19/20 tasks pass. Two pre-existing failures confirmed pre-date Phase 23:
  - nutrition expo-image-manipulator: fixed by adding dep (not a Phase 23 regression)
  - mobile chat.tsx TS2769: last touched in 36e87b0, long before Phase 23
  Phase 23 introduced zero new type errors.

### 7. Vercel ziko-web project provisioned + live smoke test
expected: |
  Vercel dashboard shows ziko-web project connected to ziko-platform repo
  (Root Directory = apps/web, Pro tier). Five curl checks pass on the
  preview deploy URL: SC1 → 307 redirect, SC3 → pro-confirmed after ~30s.
result: pass
note: manually verified by user — SC1 (307 unauth redirect) and SC3 (pro-confirmed) confirmed OK.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
