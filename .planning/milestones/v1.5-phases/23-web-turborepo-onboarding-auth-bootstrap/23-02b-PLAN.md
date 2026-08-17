---
phase: 23-web-turborepo-onboarding-auth-bootstrap
plan: 02b
type: execute
wave: 1b
depends_on: [23-02, 23-03, 23-07]
contingent_on: "Plan 23-02 D-02 triple-green FAILED"
files_modified:
  - .planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-ROLLBACK.md
  - C:/ziko-web/.npmrc
  - C:/ziko-web/package.json
  - .github/workflows/publish-coach-sdk.yml (no edit — variable PUBLISH_COACH_SDK toggled)
autonomous: false
requirements: [ARCH-04, ARCH-05]
requirements_addressed: [ARCH-04, ARCH-05]
tags: [phase-23, wave-1b, fallback, dual-repo, d-04, contingent]
must_haves:
  truths:
    - "ziko-platform branch reset to pre-web-onboarding tag (apps/web removed from monorepo)"
    - "packages/coach-sdk survives the reset (re-cherry-picked if necessary)"
    - "vars.PUBLISH_COACH_SDK == 'true' set in repo settings"
    - "@ziko/coach-sdk@0.1.0 published to GitHub Packages"
    - "c:/ziko-web installs @ziko/coach-sdk via .npmrc + GITHUB_TOKEN"
    - "c:/ziko-web stays as separate repo; Phase 23 success criteria 1–5 re-evaluated against dual-repo"
  artifacts:
    - path: "C:/ziko-web/.npmrc"
      provides: "GitHub Packages registry config for @ziko scope"
      contains: "npm.pkg.github.com"
    - path: ".planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-ROLLBACK.md"
      provides: "Decision recorder updated with FAIL outcome and dual-repo continuation"
      contains: "Triple-green FAIL"
  key_links:
    - from: "C:/ziko-web (separate repo)"
      to: "@ziko/coach-sdk from GitHub Packages"
      via: "npm install with .npmrc + GITHUB_TOKEN auth"
      pattern: "@ziko:registry=https://npm.pkg.github.com"
    - from: ".github/workflows/publish-coach-sdk.yml"
      to: "@ziko/coach-sdk on npm.pkg.github.com"
      via: "vars.PUBLISH_COACH_SDK == 'true' gate flips ON"
      pattern: "PUBLISH_COACH_SDK"
---

<objective>
Contingency plan — activates ONLY if Plan 23-02 Task 3 D-02 triple-green checklist FAILS. Implements the D-04 dual-repo fallback per RESEARCH §12.3: reset monorepo, ensure `packages/coach-sdk` survives, flip the PUBLISH_COACH_SDK variable, publish to GitHub Packages, install in `c:/ziko-web`.

Purpose: Preserve ARCH-04 (coach-sdk shared schemas) and ARCH-05 (cookie-based auth — implemented standalone in c:/ziko-web) when the monorepo path is impossible. Phase 23 success criterion 1 changes from "apps/web lives in monorepo" to "documented dual-repo with published coach-sdk NPM package — decision recorded with rollback plan."

Output: ziko-platform contains `packages/coach-sdk` only (no apps/web); coach-sdk v0.1.0 live on GitHub Packages; c:/ziko-web consumes it; downstream Phase 23 waves (3–7) re-targeted to c:/ziko-web standalone repo.

**IMPORTANT:** This plan is a SCAFFOLD. Execution requires human decision (Vercel + GitHub admin) and replanning of subsequent waves. The planner does NOT execute Wave 1b unless Plan 23-02 explicitly records FAIL.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-CONTEXT.md
@.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-RESEARCH.md
@.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-ROLLBACK.md

<interfaces>
- `pre-web-onboarding` git tag was pushed to origin by Plan 23-01 Task 2.
- `packages/coach-sdk/` was created by Plan 23-03 (Wave 2). If executed BEFORE 23-02 spike, it survives the reset because Wave 2 commits live on top of Wave 1's subtree merge. Plan 23-02b Task 2 verifies/re-creates as needed.
- `.github/workflows/publish-coach-sdk.yml` was shipped by Plan 23-07; it's gated on `vars.PUBLISH_COACH_SDK == 'true'`.
- `c:/ziko-web` exists as a separate repo; the in-place archive `C:/ziko-web.archived-2026-05-14/` (created by Plan 23-02 Task 1 step 3) is the recovery source if anything in the spike attempt corrupted `c:/ziko-web`.
- GitHub Packages requires `GITHUB_TOKEN` with `read:packages` scope on the consumer side; GHA provides this automatically.
</interfaces>
</context>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 1: [BLOCKING DECISION] Confirm D-04 activation before reset</name>
  <decision>D-04 dual-repo fallback activation</decision>
  <context>
    Plan 23-02 Task 3 recorded triple-green FAIL in 23-ROLLBACK.md. Before executing destructive reset (force-push), human confirms (a) fix was attempted and failed, (b) dual-repo is the chosen path (not "retry spike with different fix").
  </context>
  <options>
    <option id="option-a">
      <name>Proceed with dual-repo</name>
      <pros>Unblocks Phase 23; coach-sdk still ships; c:/ziko-web stays as-is</pros>
      <cons>Loses monorepo benefits (single lockfile, atomic cross-app commits); ongoing operational cost for two-repo coordination</cons>
    </option>
    <option id="option-b">
      <name>Retry monorepo spike with targeted fix</name>
      <pros>Preserves monorepo benefits if RN leak source can be identified</pros>
      <cons>Time cost; risk of repeated failure. Per D-02: "If still red after 2 hours of investigation → fall back to D-04." Confirm 2-hour budget exhausted.</cons>
    </option>
    <option id="option-c">
      <name>Defer Phase 23, revise scope</name>
      <pros>Buys time for deeper investigation</pros>
      <cons>Blocks Phase 24+ which depend on apps/web (or c:/ziko-web with coach-sdk) being reachable</cons>
    </option>
  </options>
  <resume-signal>Select: option-a (proceed dual-repo), option-b (retry), or option-c (defer)</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Reset monorepo to pre-web-onboarding, preserve coach-sdk</name>
  <files>
    ziko-platform branch gsd/phase-23-web-turborepo-onboarding-auth-bootstrap
  </files>
  <read_first>
    - 23-ROLLBACK.md (current state — must show FAIL outcome before this task runs)
    - 23-RESEARCH.md §12.3 lines 1928–1959 (dual-repo activation procedure verbatim)
    - git log on phase branch to identify commits to cherry-pick (coach-sdk commits from Plan 23-03)
  </read_first>
  <action>
Per RESEARCH §12.3 step 1–2:

```bash
cd C:/ziko-platform
# Capture coach-sdk commit SHAs BEFORE reset (so they can be cherry-picked after)
git log --oneline --follow packages/coach-sdk > /tmp/coach-sdk-commits.txt

# Hard reset to pre-onboarding tag
git reset --hard pre-web-onboarding
git push --force-with-lease origin gsd/phase-23-web-turborepo-onboarding-auth-bootstrap

# packages/coach-sdk no longer exists after reset — re-create it.
# Option A: cherry-pick the commits from /tmp/coach-sdk-commits.txt
# Option B: re-run Plan 23-03 against the reset branch (clean re-execution)
# Prefer Option B for auditability: re-execute Plan 23-03 verbatim. Wave 2 produces the
# same package independently of Wave 1.
```

After reset, re-execute Plan 23-03 (Wave 2) verbatim on the reset branch. This produces `packages/coach-sdk/` from scratch with identical content.

Commit and push:
```bash
git add packages/coach-sdk
git commit -m "feat(23-03): coach-sdk re-created on dual-repo path (D-04 activated)"
git push
```
  </action>
  <verify>
    <automated>git tag --contains pre-web-onboarding | grep -q pre-web-onboarding &amp;&amp; ! test -d apps/web &amp;&amp; test -d packages/coach-sdk &amp;&amp; test -f packages/coach-sdk/dist/schemas/index.mjs</automated>
  </verify>
  <acceptance_criteria>
    - Phase branch reset to `pre-web-onboarding` tag (no `apps/web/` directory in current tree)
    - `packages/coach-sdk/` exists after re-execution of Plan 23-03
    - `npm run test --workspace=@ziko/coach-sdk -- --run` exits 0
    - `turbo run build --filter=@ziko/coach-sdk` exits 0
    - Force-push to origin succeeded
    - `23-ROLLBACK.md` decision recorder shows: `**OUTCOME (YYYY-MM-DD):** Triple-green FAIL — dual-repo path active.`
  </acceptance_criteria>
  <done>
    Monorepo reset; coach-sdk re-created on the reset branch.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: [BLOCKING] Set PUBLISH_COACH_SDK variable and publish v0.1.0</name>
  <what-built>
    `packages/coach-sdk` exists on the reset branch. `.github/workflows/publish-coach-sdk.yml` is shipped but gated on `vars.PUBLISH_COACH_SDK == 'true'`. Now the human flips that switch and the workflow publishes.
  </what-built>
  <how-to-verify>
Per RESEARCH §12.3 steps 3–5:

```bash
# 1. Set the variable (gh CLI or GitHub web UI: Settings → Secrets and variables → Actions → Variables)
gh variable set PUBLISH_COACH_SDK --body 'true'

# 2. Bump version in packages/coach-sdk/package.json from current to 0.1.0 (if not already 0.1.0).
#    Also confirm "private": false (see BLOCKER 5 fix in Plan 23-03 revision).
cat packages/coach-sdk/package.json | grep -E '"version"|"private"'

# 3. Commit and push to trigger the workflow.
git add packages/coach-sdk/package.json
git commit -m "release(coach-sdk): v0.1.0 — dual-repo path enabled"
git push

# 4. Monitor the workflow.
gh workflow view 'Publish @ziko/coach-sdk'
gh run watch
```

After workflow success, verify the package is live:
```bash
npm view @ziko/coach-sdk --registry=https://npm.pkg.github.com versions
# Expected: ['0.1.0'] (with GITHUB_TOKEN env set)
```

Update `23-ROLLBACK.md` decision recorder:
```
**Dual-repo activation completed YYYY-MM-DD:**
- @ziko/coach-sdk@0.1.0 published to GitHub Packages
- vars.PUBLISH_COACH_SDK = true
- Next step: configure c:/ziko-web/.npmrc and consume the package
```
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "published" (workflow green, package visible in registry)
    - Describe failure (auth, build, publish error) — Task may need retry with fixed config
  </resume-signal>
</task>

<task type="auto">
  <name>Task 4: Configure c:/ziko-web/.npmrc and install @ziko/coach-sdk</name>
  <files>
    C:/ziko-web/.npmrc
    C:/ziko-web/package.json
  </files>
  <read_first>
    - 23-RESEARCH.md §12.1 lines 1862–1869 (consumer-side .npmrc verbatim)
    - 23-RESEARCH.md §12.3 step 6 lines 1951–1955 (c:/ziko-web install commands)
    - C:/ziko-web/.gitignore (confirm `.npmrc` is NOT committed — token is environment-bound)
  </read_first>
  <action>
Per RESEARCH §12.1:

```bash
cd C:/ziko-web
```

Create `C:/ziko-web/.npmrc` with this content:

```
@ziko:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
always-auth=true
```

CRITICAL: Confirm `.gitignore` excludes `.npmrc` — the token reference is environment-bound, but the registry config is fine to commit. If you want the registry line committed AND the auth line ignored, use two files (`.npmrc.template` committed + `.npmrc` local). For Phase 23 simplicity, commit nothing and document setup in `C:/ziko-web/README.md` instead.

Install the package:

```bash
cd C:/ziko-web
# Ensure GITHUB_TOKEN is set in the env with read:packages scope
export GITHUB_TOKEN="<personal-access-token-with-read:packages>"
npm install '@ziko/coach-sdk@^0.1.0'
```

Verify the import resolves:

```bash
node -e "const m = require('@ziko/coach-sdk/schemas'); console.log(Object.keys(m));"
# Expected: [ 'ImportedProgramSchema', 'CoachClientLinkSchema', 'CoachProfileSchema' ]
```
  </action>
  <verify>
    <automated>test -f C:/ziko-web/.npmrc &amp;&amp; grep -q "@ziko:registry=https://npm.pkg.github.com" C:/ziko-web/.npmrc &amp;&amp; cd C:/ziko-web &amp;&amp; npm ls @ziko/coach-sdk --depth=0</automated>
  </verify>
  <acceptance_criteria>
    - `C:/ziko-web/.npmrc` exists with `@ziko:registry=https://npm.pkg.github.com` and `always-auth=true`
    - `C:/ziko-web/package.json` "dependencies" contains `"@ziko/coach-sdk": "^0.1.0"`
    - `cd C:/ziko-web && npm ls @ziko/coach-sdk --depth=0` exits 0
    - `node -e "require('@ziko/coach-sdk/schemas')"` succeeds and lists all 3 schema exports
  </acceptance_criteria>
  <done>
    c:/ziko-web consumes @ziko/coach-sdk from GitHub Packages.
  </done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Task 5: [BLOCKING] Re-plan Waves 3–7 against c:/ziko-web standalone repo</name>
  <decision>How to deliver Plans 23-04..23-08 deliverables (factories, ESLint, smoke route, Vercel, CI, verification) when apps/web does NOT exist in monorepo</decision>
  <context>
    The remaining waves were planned against `apps/web/` in the monorepo. On dual-repo path:
    - Factories (Plan 23-04) → live in `C:/ziko-web/src/lib/supabase/` (already partly there: admin.ts is preserved verbatim)
    - ESLint rules (Plan 23-05) → live in `C:/ziko-web/eslint.config.mjs`
    - Smoke route (Plan 23-06) → live in `C:/ziko-web/src/app/[locale]/(coach)/coach/_smoke/`
    - Vercel config (Plan 23-07) → only `c:/ziko-web` Vercel project (no apps/web project to create); backend stays in ziko-platform
    - CI workflow (Plan 23-07) → needs to run in BOTH repos (or just c:/ziko-web for web-side jobs)
    - Verification (Plan 23-08) → smoke deploy against c:/ziko-web's Vercel project
  </context>
  <options>
    <option id="option-a">
      <name>Re-plan Phase 23 (write 23-04b..23-08b plans targeting c:/ziko-web)</name>
      <pros>Clean separation; standalone plans for dual-repo</pros>
      <cons>Time cost; duplicated planning effort</cons>
    </option>
    <option id="option-b">
      <name>Patch Plans 23-04..23-08 in place (find/replace apps/web → C:/ziko-web/)</name>
      <pros>Fast; reuses existing plan structure</pros>
      <cons>Mixed paths in single plan files; less auditable</cons>
    </option>
  </options>
  <resume-signal>Select: option-a (re-plan) or option-b (patch in place)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ziko-platform → npm.pkg.github.com | Publish via GITHUB_TOKEN |
| c:/ziko-web → npm.pkg.github.com | Read via GITHUB_TOKEN with read:packages scope |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-23-02b-01 | T (Tampering) | force-push of reset to remote | accept | Gated by Task 1 human decision; pre-web-onboarding tag is immutable; coach-sdk is re-creatable from Plan 23-03. |
| T-23-02b-02 | I (Info Disclosure) | GITHUB_TOKEN exposed via committed .npmrc | mitigate | .npmrc uses `${GITHUB_TOKEN}` env interpolation, not literal token. .gitignore exclusion documented. |
| T-23-02b-03 | E (Elevation) | PUBLISH_COACH_SDK left enabled after dual-repo activation | accept | Variable is restricted to repo admin; downstream publish runs only on packages/coach-sdk/** path changes. |

</threat_model>

<verification>
```bash
cd C:/ziko-platform
git log --oneline -1   # commit after Plan 23-02b execution
git tag --contains pre-web-onboarding | grep pre-web-onboarding   # tag still exists
! test -d apps/web   # apps/web removed
test -d packages/coach-sdk   # coach-sdk preserved
gh variable get PUBLISH_COACH_SDK   # true

cd C:/ziko-web
test -f .npmrc
grep -q "@ziko/coach-sdk" package.json
node -e "console.log(Object.keys(require('@ziko/coach-sdk/schemas')))"
```
</verification>

<success_criteria>
- Reset clean; pre-web-onboarding tag preserved
- coach-sdk re-created on reset branch
- @ziko/coach-sdk@0.1.0 published to GitHub Packages
- c:/ziko-web consumes the package via .npmrc + GITHUB_TOKEN
- 23-ROLLBACK.md decision recorder updated with dual-repo activation timestamp
- Re-plan decision recorded for Waves 3–7 (option-a or option-b)
</success_criteria>

<output>
After completion, create `.planning/phases/23-web-turborepo-onboarding-auth-bootstrap/23-02b-SUMMARY.md` recording: reset commit SHA, coach-sdk re-creation method, published version, c:/ziko-web npm ls output, replan decision.
</output>
