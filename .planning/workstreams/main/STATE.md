---
gsd_state_version: 1.0
workstream: main
milestone: v1.8
milestone_name: Sport Dashboards
branch: main
status: planning
last_updated: "2026-05-25T00:00:00Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State — v1.8 Sport Dashboards

## Workstream Scope

This workstream tracks **main branch** work only (v1.8 Sport Dashboards).  
For mobile redesign (v1.7), see: `.planning/workstreams/milestone-mobile/STATE.md`

**Phase files:** `.planning/phases/<N>-*/`  
**Roadmap:** `.planning/workstreams/main/ROADMAP.md`

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-25 — Milestone v1.8 started

---

## Accumulated Context

### Decisions

- Onglet "Dashboard" dans la vue client detail — sélecteur sport type en haut, courbes en dessous
- Powerlifting livré en semaine 1 (4 courbes : 1RM SBD, Fatigue RPE, Volume/Tonnage, Intensité %)
- 4 autres dashboards en parallèle semaine 2 : Hyrox, Running/Cardio, Bodybuilding/Hypertrophie, Perte de poids/Retour de blessure
- Data sources existantes : workout_sessions, session_sets, cardio_sessions, sleep_logs via is_coach_of() RLS
- Critère fini : Guillaume ouvre "powerlifting → Joaquim" → voit les 4 courbes sans rien configurer
- Dashboard injecte son contexte dans l'AI chat coach (point de départ customisation, anti-blank-page)

### Pending Todos

None yet.

### Blockers/Concerns

None.

---

## Previous Milestone

**v1.5 Coach Platform & CRM — archived 2026-05-24**  
See: `.planning/milestones/v1.5-ROADMAP.md` | `.planning/milestones/v1.5-REQUIREMENTS.md`
