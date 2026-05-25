# Requirements: v1.14 Formulaires Conditionnels

**Workstream:** `formulaire-condi`
**Milestone:** v1.14
**Status:** Active
**Last updated:** 2026-05-25

---

## Milestone Goal

Le coach crée des formulaires déclenchés par des conditions (premier contact, fin de cycle, date fixe, envoi manuel) ; les athletes voient un écran bloquant global tant que le formulaire n'est pas rempli ; les réponses sont stockées pour lecture coach et injectées dans le contexte Claude.

**Done criterion:** Guillaume définit "fin cycle 4 semaines → questionnaire retour" et Joaquim ne peut pas ouvrir son app avant de remplir.

---

## Active Requirements

### FORM — Form Builder (Coach Web)

- [ ] **FORM-01**: Coach can create a form with a title and add questions sequentially
- [ ] **FORM-02**: Coach can use 4 question types: free text, 1-10 scale, yes/no, single choice (with options)
- [ ] **FORM-03**: Coach can reorder and delete questions before publishing
- [ ] **FORM-04**: Coach can set a trigger condition on a form (from 4 types: first contact, after N sessions, fixed date, manual send)
- [ ] **FORM-05**: Coach can publish a form to one client or all clients (global)
- [ ] **FORM-06**: Coach can view the list of all forms they have created with status (draft / active / archived)

### TRIGGER — Trigger Engine (Backend)

- [ ] **TRIGGER-01**: When an athlete links their coach (State B→C), any "first contact" form is automatically created as a pending instance for that athlete
- [ ] **TRIGGER-02**: After an athlete completes N sessions in a program, any matching "after N sessions" trigger creates a pending form instance
- [ ] **TRIGGER-03**: On a fixed date/periodic basis (cron), any matching "date" trigger creates pending form instances for all assigned athletes
- [ ] **TRIGGER-04**: Coach can manually send a form to one or more clients (creates pending instance immediately)
- [ ] **TRIGGER-05**: A form instance has a status: pending / submitted; duplicate instances are not created if one is already pending

### MOBILE — Blocking Screen (Athlete Mobile)

- [ ] **MOBILE-01**: When the athlete has ≥1 pending form, the app shows a full-screen blocking overlay on launch/resume
- [ ] **MOBILE-02**: The blocking overlay displays the form title, question count, and a CTA to fill it
- [ ] **MOBILE-03**: Athlete can answer all question types natively on mobile (text input, scale slider, yes/no toggle, radio buttons)
- [ ] **MOBILE-04**: Athlete can submit the form; the overlay dismisses and normal app access is restored
- [ ] **MOBILE-05**: If multiple forms are pending, the overlay shows them sequentially (one at a time, count shown)

### RESPONSES — Coach Response Viewer (Web)

- [ ] **RESPONSES-01**: Coach sees a "Formulaires" tab in the client detail sheet listing all submitted forms with date
- [ ] **RESPONSES-02**: Coach can expand a submission to read all questions and answers
- [ ] **RESPONSES-03**: Pending forms for a client are visible in the "Formulaires" tab with a "En attente" badge

### CLAUDE — AI Context Injection

- [ ] **CLAUDE-01**: When the AI coach orchestrator is called, the last 5 submitted form responses for the athlete are injected into the system prompt context
- [ ] **CLAUDE-02**: The injected context includes: form title, date, and question+answer pairs formatted as readable text

---

## Future Requirements (post-v1.14)

- Conditional logic inside forms (question branching based on answers)
- Coach notification (email/push) when an athlete submits a form
- Form analytics — aggregated response stats across multiple athletes
- Form templates library (pre-built assessment, weekly retro, end-of-cycle)
- Coach edits a submitted response (correction flow)

---

## Out of Scope (v1.14)

- Conditional branching inside the form itself — form builder is linear only in v1.14
- Email notifications when a form is submitted — v1.15+
- Response analytics or aggregation — v1.15+
- Athlete can skip/dismiss a pending form — blocking is absolute by design

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FORM-01 | Phase 03 | Pending |
| FORM-02 | Phase 03 | Pending |
| FORM-03 | Phase 03 | Pending |
| FORM-04 | Phase 03 | Pending |
| FORM-05 | Phase 03 | Pending |
| FORM-06 | Phase 03 | Pending |
| TRIGGER-01 | Phase 02 | Pending |
| TRIGGER-02 | Phase 02 | Pending |
| TRIGGER-03 | Phase 02 | Pending |
| TRIGGER-04 | Phase 02 | Pending |
| TRIGGER-05 | Phase 01 + Phase 02 | Pending |
| MOBILE-01 | Phase 04 | Pending |
| MOBILE-02 | Phase 04 | Pending |
| MOBILE-03 | Phase 04 | Pending |
| MOBILE-04 | Phase 04 | Pending |
| MOBILE-05 | Phase 04 | Pending |
| RESPONSES-01 | Phase 05 | Pending |
| RESPONSES-02 | Phase 05 | Pending |
| RESPONSES-03 | Phase 05 | Pending |
| CLAUDE-01 | Phase 05 | Pending |
| CLAUDE-02 | Phase 05 | Pending |
