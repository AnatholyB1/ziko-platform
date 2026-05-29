---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Sport Dashboards
status: executing
last_updated: "2026-05-30T00:00:00.000Z"
last_activity: 2026-05-30 -- Phase 41.1 plan 01 executed — ChartCard threshold badge prop threading
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State — v1.8 Sport Dashboards

## Workstream Scope

This workstream tracks **main branch** work only (v1.8 Sport Dashboards).  
For mobile redesign (v1.7), see: `.planning/workstreams/milestone-mobile/STATE.md`

**Phase files:** `.planning/phases/<N>-*/`  
**Roadmap:** `.planning/workstreams/main/ROADMAP.md`

---

## Current Position

Phase: 41.1
Plan: 01 (complete)
Status: Phase complete
Last activity: 2026-05-30 -- Phase 41.1 plan 01 executed — ChartCard threshold badge prop threading

---

## Progress Bar

```
Phase 37 [✅] → Phase 38 [✅] → Phase 39 [✅] → Phase 40 [✅] → Phase 41 [✅] → Phase 41.1 [✅]
100% complete
```

---

## Accumulated Context

### Roadmap Evolution

- Phase 41.1 inserted after Phase 41: Close gap: AI-04 — ChartCard threshold badge prop threading (URGENT)

### Decisions

- Onglet "Dashboard" dans la vue client detail — sélecteur sport type en haut, courbes en dessous
- Powerlifting livré en phase 38 (4 courbes : 1RM SBD, Fatigue RPE, Volume/Tonnage, Intensité %)
- 4 autres dashboards en parallèle en phase 39 : Hyrox, Running/Cardio, Bodybuilding/Hypertrophie, Perte de poids/Retour de blessure
- Data sources existantes : workout_sessions, session_sets, cardio_sessions, body_measurements, nutrition_logs via is_coach_of() RLS
- Critère fini : Guillaume ouvre "powerlifting → Joaquim" → voit les 4 courbes sans rien configurer
- Dashboard injecte son contexte dans l'AI chat coach (point de départ customisation, anti-blank-page)
- UI design contract obligatoire en Phase 37 avant tout code (ui_safety_gate: true dans config.json)
- Phases 37–41 : phase numbering continue depuis v1.5 (last used = 36)
- Inline type utilisé pour crossedThresholds prop (pas d'import ThresholdAlert) pour correspondre au pattern existant de ChartCard.tsx

### Phase Map

| Phase | Name | Requirements |
|-------|------|--------------|
| 37 | UI Design Contract | DASH-01–05, PL-01–04, HYR-01, RUN-01, BB-01, WL-01, AI-02, AI-03 (design surfaces) |
| 38 | Dashboard Foundation + Powerlifting | DASH-01, DASH-02, DASH-03, PL-01, PL-02, PL-03, PL-04 |
| 39 | Four Sport Dashboards | HYR-01, RUN-01, BB-01, WL-01 |
| 40 | Advanced Dashboard Features | DASH-04, DASH-05 |
| 41 | AI Context Injection | AI-01, AI-02, AI-03, AI-04 |

### Pending Todos

None yet.

### Blockers/Concerns

None.

---

## Previous Milestone

**v1.5 Coach Platform & CRM — archived 2026-05-24**  
See: `.planning/milestones/v1.5-ROADMAP.md` | `.planning/milestones/v1.5-REQUIREMENTS.md`
