# Phase 23 — Rollback Procedure

**Tag:** `pre-web-onboarding` (pushed to origin 2026-05-14)
**Branch:** `gsd/phase-22-schema-foundation-rls-keystone`
**Archive source:** `C:/ziko-web` (live as of tag); also copy to `C:/ziko-web.archived-2026-05-14/` before the merge runs in Wave 1.

## When to invoke

Activate rollback IF any of the following fail during the Wave 1 spike (per D-02 triple-green gate):

1. `turbo run build --filter=web` exits non-zero AND the error is RN/web cross-contamination (not a fixable build error)
2. `cd apps/mobile && npx expo prebuild --clean` exits non-zero AND root-cause is web-deps bleeding into mobile
3. Bundle analyzer regex `react-native(?!-web)` matches in `apps/web/.next/analyze/stats.json` AND a 2-hour investigation cannot eliminate the leak

## Rollback commands

```bash
cd C:/ziko-platform
git reset --hard pre-web-onboarding
git push --force-with-lease origin gsd/phase-22-schema-foundation-rls-keystone
```

If `C:/ziko-web` is somehow dirty after the merge attempt, the archive `C:/ziko-web.archived-2026-05-14/` is the recovery source.

## After rollback — activate D-04 dual-repo fallback

Per RESEARCH §12.3:

1. Keep `packages/coach-sdk/` (it lands in ziko-platform regardless of monorepo decision). Re-cherry-pick the coach-sdk commits after the reset.
2. Activate publish workflow: `gh variable set PUBLISH_COACH_SDK --body 'true'`
3. Bump `packages/coach-sdk/package.json` version, commit, push — `.github/workflows/publish-coach-sdk.yml` auto-publishes to GitHub Packages.
4. In `C:/ziko-web/`, create `.npmrc`:
   ```
   @ziko:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   always-auth=true
   ```
   Then: `npm install '@ziko/coach-sdk@^0.1.0'`

## Decision recorder

This file MUST be updated by the executor of Plan 23-02 (spike) with one of:
- `**OUTCOME (YYYY-MM-DD):** Triple-green PASS — monorepo path active. Rollback NOT invoked.`
- `**OUTCOME (YYYY-MM-DD):** Triple-green FAIL on step N — rollback invoked, dual-repo path active.`
