---
phase: 05-storage-migration
plan: 08
subsystem: storage
tags: [codemod, buckets, patch, worktree]
requires: ["05-02", "05-03"]
provides:
  - "scripts/portfolio-migration/patches/05-bucket-codemod.patch (29 files, round-trips)"
  - "scripts/portfolio-migration/patches/05-bucket-codemod.manifest.txt"
  - "local unmerged, unpushed branch gsd/phase-5-bucket-codemod (commit ce99b853)"
affects: [05-07 --with-codemod-patch, phase-6-cutover]
key-files:
  created:
    - scripts/portfolio-migration/patches/05-bucket-codemod.patch
    - scripts/portfolio-migration/patches/05-bucket-codemod.manifest.txt
requirements-completed: [STORAGE-01, STORAGE-04]
completed: 2026-10-02
---

# Phase 5 Plan 08: Bucket codemod applied, captured, restored

The codemod was applied in place, validated, captured as a patch, and the tree was restored. The result also lives on a local branch that is not merged and not pushed.

## Scan (real tree, zero unclassified)
57 occurrences in 26 files: storage-from 31, array-member 11, in-string 5, comment 2, const-decl 2, call-arg 2, test-literal 2, false-positive 2.
Per surface (files): apps/mobile 5, apps/web 8, backend/api 7 (incl. one spec), plugins 3, scripts/exercise-import 3.

## Apply and checks
- `--apply --manifest-out ...manifest.txt` then `--check`: exit 0 ("no residual old bucket literals; constant modules and imports consistent").
- Manifest: 25 modified source files, `packages/plugin-sdk/src/index.ts` modified, and three added modules (backend/api/src/config/buckets.ts, apps/web/src/lib/buckets.ts, packages/plugin-sdk/src/buckets.ts). The patch covers 29 files (+115/-52).
- Independent repo-wide git grep gate (after `git add -N` of the three modules) was run with the plan's exclusions plus `':!**/package.json' ':!**/package-lock.json'`. The only hits without those two exclusions were `"exports": {` keys in 24 package.json files, which are already in the codemod's FALSE_POSITIVES. With them excluded, the output is empty (exit 1). Final command:

```
git grep -nE "['\"`/=](avatars|ai-imports|coach-exercises|coach-kyc|coach-logos|coach-videos|exercise-media|exports|profile-photos|scan-photos)['\"`/&?]" -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.json' '*.sql' ':!**/node_modules/**' ':!**/dist/**' ':!**/.next/**' ':!.planning/**' ':!supabase/migrations/**' ':!scripts/portfolio-migration/**' ':!scripts/auth-merge/**' ':!scripts/purge-test-accounts/**' ':!apps/web/src/app/api/__live__/**' ':!plugins/coach/src/screens/VideoListScreen.tsx' ':!**/package.json' ':!**/package-lock.json'
```
Output: empty.

## Baseline vs post-codemod validation
Baseline was measured on the unmodified tree first, then repeated on the applied tree. Results are identical, so the codemod introduced no regressions. The baseline is not fully green, for reasons unrelated to the codemod.

| Check | Baseline (pre-codemod) | Applied tree |
|-------|------------------------|--------------|
| `npx turbo run type-check --continue --force` | 23/24 ok; `@ziko/plugin-coach` fails with 2 TS6307 errors (authStore.ts imports queryClient.ts and onboardingRecompute.ts, not listed in plugins/coach tsconfig) | identical: same 2 errors, 23/24 ok |
| `cd backend/api && npx vitest run` | 20 files / 27 tests fail, 180 pass (dummy-test-project.supabase.co ENOTFOUND, no network or live env) | identical failing file set (diffed), 27 failed / 180 passed |
| `cd apps/web && npx vitest run` | 1 file fails, 328 tests pass | identical failing file set, 328 pass |
| `npx vitest run scripts/exercise-import` | 12 files / 151 tests pass | 12 files / 151 tests pass |

Note: the plan said "All must pass". The pre-existing plugin-coach tsconfig issue and the backend suites that need a live Supabase are failing on HEAD without the codemod. They were not fixed (out of scope).

## Capture, restore, round trip
- Patch generated with `git diff --binary` after `git add -N`, then restored with `git restore --staged --worktree` on the tracked manifest paths, `git reset -q` and `rm` on the added files. No `git add -A`, stash or reset --hard was used, so unrelated uncommitted changes (packages/*/dist, .planning/*) were left alone.
- `git status --porcelain -- apps backend plugins packages/plugin-sdk scripts/exercise-import` is empty.
- `git apply --check` OK, `git apply` followed by `--check` OK, `git apply -R` leaves porcelain empty.
- `grep -c ziko-profile-photos` on the patch: 5. The secret, UUID and email gate: 0 matches.
- Commit a2a5df3d on fix/mobile-audit-2026-08-22: patch and manifest only.

## Branch
- `gsd/phase-5-bucket-codemod`, commit **ce99b853**, created via `git worktree add -b` (worktree removed; the main checkout stayed on fix/mobile-audit-2026-08-22).
- Local only: no remote counterpart, not an ancestor of main, not pushed, no PR.
- Phase 6 instruction: re-run `node scripts/portfolio-migration/11-codemod-buckets.mjs --apply` on a fresh main (preferred) or rebase this branch, and merge together with the Vercel env flip.

## Deviations from Plan
- Grep gate got two extra exclusions (`**/package.json`, `**/package-lock.json`) for the `"exports"` key false positive, consistent with the codemod's FALSE_POSITIVES (05-02 decision). No codemod or source change was needed.
- Validation compared to a measured baseline rather than requiring all-green (see above).

## Known Stubs
None.

## Self-Check: PASSED
- Patch and manifest exist and are committed (a2a5df3d); branch ce99b853 exists; the working tree of the five source roots is clean.
