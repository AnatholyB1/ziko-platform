---
milestone: v1.10
milestone_name: Custom Coach Exercises
workstream: custom-coach
status: active
phases: 3
requirements_total: 7
requirements_mapped: 7
created: "2026-05-25"
---

# Roadmap: v1.10 Custom Coach Exercises

## Phases

- [ ] **Phase 42: Audit Client Programs Visibility** — Verify coach sees athlete-created programs in client detail; fix if absent
- [ ] **Phase 43: Coach Exercise Library Backend + Web UI** — DB migration, Storage bucket, CRUD backend routes, and web exercise management form with video/photo upload
- [ ] **Phase 44: Program Editor + Athlete Media Integration** — ExerciseTypeahead merges custom exercises with global library; athlete sees demo video/photo in program view

---

## Phase Details

### Phase 42: Audit Client Programs Visibility
**Goal**: Coach can see all programs assigned to or created by an athlete in the client detail view
**Depends on**: Nothing (audit of existing Phase 26 deliverable)
**Requirements**: AUDIT-01
**Success Criteria** (what must be TRUE):
  1. Coach opens a client's detail page and sees a "Programs" tab or section that lists programs created by the athlete (not only coach-assigned ones)
  2. If athlete-created programs were missing, the coach now sees them alongside coach-assigned programs after the fix
  3. No regression on the 7 existing tabs (sessions, measurements, habits, nutrition, sleep, cardio, journal) — all still load correctly
**Plans**: TBD

### Phase 43: Coach Exercise Library Backend + Web UI
**Goal**: Coach can create, edit, delete, and attach video/photo demos to custom exercises from the web CRM
**Depends on**: Phase 42
**Requirements**: EXLIB-01, EXLIB-02, EXLIB-03, EXLIB-04
**Success Criteria** (what must be TRUE):
  1. Coach navigates to an "Exercises" section in the CRM and sees a list of their custom exercises (empty state on first visit)
  2. Coach creates a new exercise with name, description, target muscle groups, and category — exercise appears in the list immediately
  3. Coach uploads a demo video to an exercise — video is stored in the `coach-exercises` Supabase Storage bucket and a signed URL is returned
  4. Coach uploads a demo photo to an exercise — photo is stored in the same bucket alongside the video
  5. Coach edits an existing exercise's fields (name, description, muscles, category) — changes persist on refresh
  6. Coach deletes an exercise — exercise disappears from the list and associated Storage files are removed
**Plans**: TBD
**UI hint**: yes

### Phase 44: Program Editor + Athlete Media Integration
**Goal**: Custom exercises appear in the program editor alongside global ones, and athletes see demo media when reviewing their exercises
**Depends on**: Phase 43
**Requirements**: EXLIB-05, EXLIB-06
**Success Criteria** (what must be TRUE):
  1. Coach opens the program editor ExerciseTypeahead and typing an exercise name returns both global library exercises and the coach's custom exercises in a merged list
  2. Custom exercises are visually distinguished from global ones in the typeahead results (e.g., a badge or label such as "Custom")
  3. Athlete opens their assigned program on mobile and taps an exercise that has a demo video — the video plays or opens inline
  4. Athlete taps an exercise with only a demo photo — the photo is displayed in the exercise detail view
  5. Athlete taps an exercise with no media attached — detail view shows the standard text description without errors
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 42. Audit Client Programs Visibility | 0/? | Not started | — |
| 43. Coach Exercise Library Backend + Web UI | 0/? | Not started | — |
| 44. Program Editor + Athlete Media Integration | 0/? | Not started | — |
