---
gsd_state_version: 1.0
workstream: main
milestone: v1.5
milestone_name: Coach Platform & CRM
branch: main
status: executing
last_updated: "2026-05-22T12:30:00Z"
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 58
  completed_plans: 57
  percent: 84
---

# Project State — v1.5 Coach Platform & CRM

## Workstream Scope

This workstream tracks **main branch** work only (v1.5 Coach Platform & CRM).  
For mobile redesign (v1.7), see: `.planning/workstreams/milestone-mobile/STATE.md`

**Phase files:** `.planning/phases/<N>-*/`  
**Roadmap:** `.planning/ROADMAP.md`  
**Requirements:** `.planning/REQUIREMENTS.md`

---

## Current Position

Phase: **29 — AI Coach Orchestrator** (executing — plan 05/06 done)

Progress: [████████▓░] 84%

| Phase | Status | Plans |
|-------|--------|-------|
| 22. Schema Foundation & RLS Keystone | ✅ Complete | 4/4 |
| 23. Web Turborepo Onboarding & Auth Bootstrap | ✅ Complete | 8/8 |
| 24. Coach Identity & Onboarding | ✅ Complete | 6/6 |
| 25. Invitations & Mobile "Mon coach" Minimal | ✅ Complete | 9/9 |
| 26. CRM Client Management | ✅ Complete | 7/7 |
| 27. Coaching Programs & Mobile "Mon coach" Full | ✅ Complete (gaps 10/13) | 8/8 |
| 28. AI File Imports | ✅ Complete — approved 2026-05-21 | 8/8 |
| 29. AI Coach Orchestrator | 🔄 In Progress — 5/6 plans done | 5/6 |
| 30. Strava Integration | ⬜ Not started | — |
| 31. Public Marketing `/coachs` | ⬜ Not started | — |

---

## Accumulated Context

### Key Decisions

- `is_coach_of()` SECURITY DEFINER function is the RLS keystone — all coach reads go through it
- `apps/web/` lives in monorepo via git subtree (no --squash); coach-sdk as workspace package
- `@supabase/ssr` dual-store cookie pattern for server component auth
- Marketing pages isolated in `(marketing)` route group to keep coach layout clean
- All coach AI tool invocations must deduct credits via v1.4 credit system
- Phase 27 Track B (mobile Mon coach full) delivered with 10/13 must-haves; 3 gaps to close in Phase 41 of milestone-mobile
- Phase 28 upload flow uses signed URL pattern (bypasses Vercel 4.5 MB body limit)
- Phase 29 plan 05: @ziko/email uses tsx source exports (no build step); @types/react must NOT be in email package devDeps (React 18/19 type mismatch)
- Phase 29 plan 05: render() from @react-email/components is async (returns Promise<string>) — always await it

### Pending Todos

- [x] Phase 28 approved — workout import flow confirmed working 2026-05-21
- [x] Phase 29 plan 01 — coach_alerts + ai_tool_audit migration (050)
- [x] Phase 29 plan 02 — Coach AI backend service (chat/stream, monitor-cron, 3 tools)
- [x] Phase 29 plan 03 — Coach AI chat UI (/coach/ai page)
- [x] Phase 29 plan 04 — Dashboard alerts panel + CoachSidebar AI nav entry
- [x] Phase 29 plan 05 — @ziko/email package + WeeklyDigest + Resend wiring
- [ ] Phase 29 plan 06 — Credit gate deep-link + "Adapter avec l'IA" button (final plan)
- [ ] Add RESEND_API_KEY to Vercel env vars (resend.com dashboard)
- [ ] Verify ziko-app.com domain in Resend (or use sandbox)
- [ ] Phase 30 (Strava) + Phase 31 (Marketing) — parallel after Phase 29 ships

### Blockers/Concerns

None.

---

## Session Continuity

Last session: 2026-05-22
Stopped at: Phase 29 plan 05 complete — @ziko/email + WeeklyDigest + Resend wiring done
Resume: Execute Phase 29 plan 06 (final plan — credit gate + "Adapter avec l'IA" deep-link)
