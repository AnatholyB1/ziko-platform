---
phase: 28-ui-design-mon-coach
plan: "02"
subsystem: figma-mockup
tags: [figma, design, higgsfield, mockup]
dependency_graph:
  requires: [28-01]
  provides: [figma-cloud-file, design-visual-reference]
  affects: []
tech_stack:
  added: []
  patterns: [figma-mcp, higgsfield-gpt-image-2]
key_files:
  created: []
  modified:
    - .planning/workstreams/milestone-mobile/phases/28-ui-design-mon-coach/28-CONTEXT.md
decisions:
  - "coach.jsx Claude Design mockup is primary canonical reference (2026-05-18 discuss)"
  - "Figma cloud file created as bonus artifact — same 5 frames, real Higgsfield coach portrait"
  - "Higgsfield GPT Image 2 used to generate realistic coach portrait (1024x1024)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-19"
  tasks_completed: 3
  files_created: 0
  files_modified: 1
---

# Phase 28 Plan 02: Figma Mockup Generation — Summary

**One-liner:** Figma cloud file "Ziko — Mon coach Plugin (Phase 28)" created with 5 frames matching the approved UI-SPEC; a Higgsfield GPT Image 2 coach portrait is used as the avatar fill across States B/C and Settings Row.

## Tasks Completed

| # | Task | Result |
|---|------|--------|
| 1 | Generate coach portrait (Higgsfield GPT Image 2, 1:1 1024px) | ✅ `imageHash: 9b754b48b61e9acc9404ba3002482fff2137b499` |
| 2 | Create Figma file + upload coach photo | ✅ `fileKey: iFPAXWrRLsl3OkUtYUifqW` |
| 3 | Generate all 5 frames via Figma Plugin API | ✅ State A (14 nodes), State B (17 nodes), State C, Modal, Settings Row |

## Frames Created

| Frame | Size | Key Elements |
|-------|------|--------------|
| State A — Code Entry | 375×812 | Input field h:56, disabled+enabled CTA, error container, tab clearance band |
| State B — Coach Preview | 375×812 | Card (shadow 0.08/12), Higgsfield avatar, chips, bio, "Lier mon compte" CTA |
| State C — Linked Coach | 375×812 | Card, avatar, "Lié depuis" row, destructive "Retirer" outlined button |
| Confirm Revocation Modal | 375×812 | Semi-transparent overlay, modal card, typed input, disabled/enabled confirm state annotation |
| Settings Row — Mon coach | 375×120 | Section header, avatar thumb, coach name, chevron |

## Figma File

**URL:** https://www.figma.com/design/iFPAXWrRLsl3OkUtYUifqW  
**File name:** Ziko — Mon coach Plugin (Phase 28)  
**Team:** les pompiers (team::1025405057519216179)

## Design Tokens Applied

All tokens match `028-UI-SPEC.md`:
- Background `#F7F6F3`, Surface `#FFFFFF`, Border `#E2E0DA`
- Primary `#FF5C1A` (CTA, enabled state, cancel link)
- Destructive `#DC2626` (revoke button border + text)
- Shadow: `shadowOpacity: 0.08`, `shadowRadius: 12`, `elevation: 3`
- Typography: Inter Bold/Regular (stand-in for SF Pro/Roboto), sizes 28/20/16/14/13/10

## Note on Primary vs Bonus

Per 2026-05-18 discuss-phase decision, `coach.jsx` remains the PRIMARY canonical design reference. This Figma file is a bonus artifact providing an interactive cloud view of the same contract.

## Self-Check: PASSED
All 5 frames present in Figma file. Design tokens match UI-SPEC. Human review (Task 3 of plan) still required per standard gate.
