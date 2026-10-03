---
phase: 06-cutover
plan: 07
status: complete
requirements: [CUTOVER-05, CUTOVER-03]
---

# 06-07 Summary: working line merged to main (migrate job dormant)

- Auto-chain `workflow._auto_chain_active` = false (workstream and root).
- Pre-merge: codemods unapplied (`12 --check` and `11 --check` exit 1), guards exit 0, no `db push` in ci.yml, `PORTFOLIO_MIGRATIONS_ENABLED` unset, origin/main ancestor (394 commits ahead).
- Local type-check/lint/test: failures all pre-existing or env-bound: plugin-coach TS6307 tsconfig, `apps/web` test/legal/retention-config, API live-DB RLS/coach specs (need Supabase env). main CI was already red on type-check before this merge (#32, #33).
- PR #37 opened; user typed `approve main option-merge-working-branch` (logged in 06-AUTHORIZATIONS.md); merged with a merge commit. origin/main = 1f87d3066fb60d48ee02ca4b5b1e73340bdcb1d7.
- CI on main (run 37081606336): `migrate-portfolio` skipped, `migration-guard` success, 0 `db push`/`migration repair` log lines. `type-check / lint / test` failed (plugin-coach TS6307, pre-existing).
- Pre-merge production rollback targets: API https://ziko-i2p60fb7m-anatholyb1s-projects.vercel.app; web https://ziko-h7ttj5e9h-anatholyb1s-projects.vercel.app.
- Post-merge production deployments (Ready): API https://ziko-5zc66dk2x-anatholyb1s-projects.vercel.app; web https://ziko-7xwkvllrp-anatholyb1s-projects.vercel.app. /health 200 before and after.

## Open item
plugins/coach TS6307 leaves CI red on main; not fixed in this plan.
