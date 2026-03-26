---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — Wave 0 installs nothing (no unit framework needed in Phase 1) |
| **Config file** | None — Wave 0 creates `next.config.ts`, `middleware.ts`, core i18n files |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` — verifies static rendering via `next build` output |
| **Estimated runtime** | ~30 seconds (type-check) / ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full `npm run build` must be green AND all `[locale]/*` routes must show as `○` (static)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| FOUND-01 | TBD | 1 | FOUND-01 | smoke | `npx tsc --noEmit` | ❌ Wave 0 | ⬜ pending |
| FOUND-02 | TBD | 1 | FOUND-02 | smoke | `npm run build` — check `[locale]/*` routes | ❌ Wave 0 | ⬜ pending |
| FOUND-03 | TBD | 1 | FOUND-03 | smoke+manual | `npx tsc --noEmit` + visual inspection | N/A | ⬜ pending |
| FOUND-04 | TBD | 1 | FOUND-04 | smoke | `npm run build` — ALL `[locale]/*` routes must be `○` | N/A | ⬜ pending |
| FOUND-05 | TBD | 2 | FOUND-05 | manual | Browser DevTools Network tab — no `fonts.gstatic.com` requests | N/A | ⬜ pending |
| FOUND-06 | TBD | 2 | FOUND-06 | manual | `grep -r "SUPABASE" .next/static/` returns empty | N/A | ⬜ pending |
| FOUND-07 | TBD | 2 | FOUND-07 | smoke+manual | `npm run build` succeeds + manual footer inspection on each page | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `next.config.ts` — must include `withNextIntl` wrapper
- [ ] `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts` — core next-intl config files
- [ ] `messages/fr.json` + `messages/en.json` — translation stubs with Phase 1 strings
- [ ] `src/app/globals.css` — must include `@import "tailwindcss"` + `@theme` block with Ziko tokens
- [ ] `middleware.ts` — exact matcher pattern at project root
- [ ] `src/lib/supabase/admin.ts` — with `import 'server-only'`

*No unit test framework needed in Phase 1 — build validation and type-check are the primary quality gates.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No Google Fonts CDN requests | FOUND-05 | Network requests not testable via CLI | Open page in browser → DevTools → Network tab → filter `fonts.gstatic.com` → should be empty |
| Admin key not in client bundle | FOUND-06 | Bundle content inspection | `grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/` must return nothing; verify `import 'server-only'` in `src/lib/supabase/admin.ts` |
| Footer visible on every page | FOUND-07 | Visual layout check | Load `/`, `/en/`, and each stub legal page — footer with 3 legal links must be visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
