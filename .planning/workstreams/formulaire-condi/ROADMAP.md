# Roadmap: v1.14 Formulaires Conditionnels

**Workstream:** `formulaire-condi`
**Milestone:** v1.14
**Granularity:** Standard
**Coverage:** 17/17 requirements mapped

---

## Phases

- [ ] **Phase 01: DB Schema & Backend API** - Forms, instances, and responses tables live in Supabase; Hono CRUD routes serve form data to all consumers
- [ ] **Phase 02: Trigger Engine** - All 4 trigger types create pending form instances automatically; duplicate guard prevents double-send
- [ ] **Phase 03: Coach Form Builder (Web)** - Coach can create, edit, publish, and list forms with 4 question types and trigger conditions set
- [ ] **Phase 04: Athlete Blocking Overlay (Mobile)** - Athlete with pending forms cannot use the app until all forms are submitted sequentially
- [ ] **Phase 05: Response Viewer & Claude Injection** - Coach reads all submissions per client; Claude receives last 5 form responses as structured context on every call

---

## Phase Details

### Phase 01: DB Schema & Backend API
**Goal**: All data structures for forms, triggers, instances, and responses exist in the DB and are accessible via authenticated Hono routes
**Depends on**: Nothing (first phase)
**Requirements**: FORM-01, FORM-02, FORM-04, FORM-05, FORM-06, TRIGGER-05
**Success Criteria** (what must be TRUE):
  1. A form record can be created with title, question array (4 types), trigger config, and status (draft/active/archived) — persists after page reload
  2. A form instance record links a form to a specific athlete with a `pending` or `submitted` status and creation timestamp
  3. A response record stores one athlete's full answers (question ID + answer value) linked to a form instance
  4. `GET /coach/forms` returns the coach's form list; `POST /coach/forms` creates a form; `PATCH /coach/forms/:id` updates it; `POST /coach/forms/:id/publish` changes status to active
  5. RLS policies ensure a coach only reads forms they created, and an athlete only reads instances assigned to them
**Plans**: TBD

### Phase 02: Trigger Engine
**Goal**: Pending form instances are created automatically when trigger conditions fire, with no duplicate instances for the same pending form
**Depends on**: Phase 01
**Requirements**: TRIGGER-01, TRIGGER-02, TRIGGER-03, TRIGGER-04, TRIGGER-05
**Success Criteria** (what must be TRUE):
  1. When an athlete redeems an invitation code (State B→C), any "first contact" form published by that coach is automatically instantiated as a pending instance for that athlete
  2. When an athlete's session count in an active program reaches the configured N, any matching "after N sessions" form creates a new pending instance — and no second instance is created if one is already pending
  3. A Vercel cron job (daily) scans active forms with a "fixed date" trigger and creates pending instances for all assigned athletes when the date is reached
  4. Coach can call `POST /coach/forms/:id/send` with a list of client IDs to immediately create pending instances — only athletes without an existing pending instance receive a new one
  5. The duplicate guard (`UNIQUE` on `(form_id, athlete_id, status='pending')` or equivalent check) prevents a second pending instance when one already exists
**Plans**: TBD

### Phase 03: Coach Form Builder (Web)
**Goal**: Coach can build and manage forms entirely from the web CRM without touching the DB directly
**Depends on**: Phase 01
**Requirements**: FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, FORM-06
**Success Criteria** (what must be TRUE):
  1. Coach can open a form builder, type a title, add questions sequentially, and choose a type for each question (free text, 1-10 scale, yes/no, single choice with editable options)
  2. Coach can drag to reorder questions and delete any question — changes are reflected immediately before publishing
  3. Coach can select a trigger type (first contact, after N sessions, fixed date, manual send) and configure its parameter (N, date) before publishing
  4. Coach can publish the form to one specific client or to all linked clients in a single action
  5. Coach sees a "Formulaires" list in the web CRM showing each form with its status badge (draft / active / archived)
**Plans**: TBD
**UI hint**: yes

### Phase 04: Athlete Blocking Overlay (Mobile)
**Goal**: An athlete with at least one pending form cannot access any part of the app until all pending forms are submitted
**Depends on**: Phase 01, Phase 02
**Requirements**: MOBILE-01, MOBILE-02, MOBILE-03, MOBILE-04, MOBILE-05
**Success Criteria** (what must be TRUE):
  1. On app launch or resume, if the athlete has ≥1 pending form, a full-screen overlay appears immediately — no app content is reachable behind it
  2. The overlay shows the form title, total question count, and a "Remplir le formulaire" CTA; if multiple forms are pending, it shows "Formulaire 1 / N" and advances after each submission
  3. Athlete can answer all 4 question types natively: free-text keyboard input, 1-10 slider, yes/no toggle, and single-choice radio buttons
  4. After answering all questions and tapping submit, the response is persisted, the form instance status changes to `submitted`, and the overlay dismisses — normal app navigation is immediately restored
  5. If 3 forms are pending, the athlete completes them one at a time in sequence; the overlay only clears after the last form is submitted
**Plans**: TBD
**UI hint**: yes

### Phase 05: Response Viewer & Claude Injection
**Goal**: Coach can read every athlete's submitted form responses from the client sheet, and Claude receives form context automatically on every coaching call
**Depends on**: Phase 03, Phase 04
**Requirements**: RESPONSES-01, RESPONSES-02, RESPONSES-03, CLAUDE-01, CLAUDE-02
**Success Criteria** (what must be TRUE):
  1. The client detail sheet in the coach CRM has a "Formulaires" tab listing all submitted forms for that athlete with submission date, and all pending forms with an "En attente" badge
  2. Coach can expand any submitted form to read each question and the athlete's exact answer in a readable layout
  3. When the AI coach orchestrator processes a chat request for an athlete, it automatically receives the last 5 submitted form responses injected into the system prompt — no manual action needed
  4. The injected context block is formatted as readable text: form title, submission date, and each question paired with its answer
  5. A new pending form in the "Formulaires" tab does not appear as submitted — it shows the "En attente" badge until the athlete fills it
**Plans**: TBD
**UI hint**: yes

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. DB Schema & Backend API | 0/? | Not started | - |
| 02. Trigger Engine | 0/? | Not started | - |
| 03. Coach Form Builder (Web) | 0/? | Not started | - |
| 04. Athlete Blocking Overlay (Mobile) | 0/? | Not started | - |
| 05. Response Viewer & Claude Injection | 0/? | Not started | - |

---

## Coverage Validation

| REQ-ID | Phase | Rationale |
|--------|-------|-----------|
| FORM-01 | Phase 01 + Phase 03 | DB stores question sequence; web UI creates it |
| FORM-02 | Phase 01 + Phase 03 | DB stores 4 question types; web UI exposes them |
| FORM-03 | Phase 03 | Reorder/delete is a form builder UI concern |
| FORM-04 | Phase 01 + Phase 03 | DB stores trigger config; UI lets coach configure it |
| FORM-05 | Phase 01 + Phase 03 | DB supports target (one/all); UI send action |
| FORM-06 | Phase 03 | Form list with status badges is a web UI screen |
| TRIGGER-01 | Phase 02 | First-contact hook on invitation redemption |
| TRIGGER-02 | Phase 02 | Session-count hook on workout completion |
| TRIGGER-03 | Phase 02 | Cron-based fixed-date trigger |
| TRIGGER-04 | Phase 02 | Manual send route + immediate instance creation |
| TRIGGER-05 | Phase 02 | Duplicate guard on pending instances |
| MOBILE-01 | Phase 04 | Full-screen blocking overlay on launch/resume |
| MOBILE-02 | Phase 04 | Overlay displays form metadata + CTA |
| MOBILE-03 | Phase 04 | All 4 question types rendered natively |
| MOBILE-04 | Phase 04 | Submit flow — persist + dismiss overlay |
| MOBILE-05 | Phase 04 | Sequential multi-form flow with counter |
| RESPONSES-01 | Phase 05 | "Formulaires" tab in client sheet with submission list |
| RESPONSES-02 | Phase 05 | Expandable submission detail view |
| RESPONSES-03 | Phase 05 | "En attente" badge for pending forms in the tab |
| CLAUDE-01 | Phase 05 | Last 5 responses injected into system prompt |
| CLAUDE-02 | Phase 05 | Formatted context block (title + date + Q&A pairs) |

Coverage: 17/17 v1 requirements mapped. No orphans.

> Note: FORM-01, FORM-02, FORM-04, FORM-05 appear in both Phase 01 (DB/API layer) and Phase 03 (web UI). Each requirement is assigned to the phase where it becomes observable to a user — Phase 03 for the FORM category. Phase 01 only lists them to signal the API contract must be in place first.
