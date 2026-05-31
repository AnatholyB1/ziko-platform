---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Sport Dashboards
status: ✅ ARCHIVED 2026-05-30
last_updated: "2026-05-30T20:19:08.254Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State — v1.8 Sport Dashboards (ARCHIVED)

## Workstream Scope

This workstream tracked **main branch** work only (v1.8 Sport Dashboards).  
**Status:** ✅ ARCHIVED 2026-05-30

**Archive:**

- `.planning/milestones/v1.8-ROADMAP.md`
- `.planning/milestones/v1.8-REQUIREMENTS.md`
- `.planning/milestones/v1.8-MILESTONE-AUDIT.md`

---

## Final Position

Phase: 41.1 (complete)  
Status: Milestone archived  
All 20 plans complete across 6 phases.

---

## What Shipped

1. Dashboard tab in coach client detail view with sport selector + date range filter
2. Powerlifting dashboard — 4 Recharts charts (1RM SBD, RPE fatigue, weekly tonnage, intensity %)
3. Four additional sport dashboards: Hyrox, Running/Cardio, Bodybuilding, Weight Loss/Injury Return
4. Side-by-side compare mode + PDF export (html2canvas + jsPDF)
5. AI context injection: chat aware of active dashboard; insight chips per chart; narrative summary card; threshold alerts + ChartCard badge

---

## Decisions (archived)

- Onglet "Dashboard" dans la vue client detail — sélecteur sport type en haut, courbes en dessous
- Powerlifting livré en phase 38 (4 courbes : 1RM SBD, Fatigue RPE, Volume/Tonnage, Intensité %)
- 4 autres dashboards en parallèle en phase 39 : Hyrox, Running/Cardio, Bodybuilding/Hypertrophie, Perte de poids/Retour de blessure
- Data sources existantes : workout_sessions, session_sets, cardio_sessions, body_measurements, nutrition_logs via is_coach_of() RLS
- Dashboard injecte son contexte dans l'AI chat coach (anti-blank-page)
- UI design contract obligatoire en Phase 37 avant tout code
- Inline type utilisé pour crossedThresholds prop (pas d'import ThresholdAlert)

---

## Previous Milestone

**v1.5 Coach Platform & CRM — archived 2026-05-24**  
See: `.planning/milestones/v1.5-ROADMAP.md` | `.planning/milestones/v1.5-REQUIREMENTS.md`
