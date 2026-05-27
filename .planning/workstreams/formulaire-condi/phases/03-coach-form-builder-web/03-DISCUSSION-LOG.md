# Phase 03: Coach Form Builder (Web) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 03 — Coach Form Builder (Web)
**Areas discussed:** CRM navigation, Question editor UX, Reorder mechanic, Trigger & publish flow

---

## CRM Navigation

**Q: Where does the 'Formulaires' section live in the coach CRM?**

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level section | /coach/forms — own sidebar entry alongside Programs, Clients, Exercises | ✓ |
| Client-scoped only | Forms accessible only from /coach/clients/[id]/forms — coach picks client first | |

**User's choice:** Top-level section (Recommended)

---

**Q: What info appears on each form row in the list?**

| Option | Description | Selected |
|--------|-------------|----------|
| Title + status badge + trigger type | Matches FORM-06; minimal join query | ✓ |
| Title + status + sent count | More data but requires join query | |
| Title + status only | Minimal but loses trigger context | |

**User's choice:** Title + status badge + trigger type (Recommended)

---

**Q: How does the coach navigate to the builder?**

| Option | Description | Selected |
|--------|-------------|----------|
| New page route | /coach/forms/new + /coach/forms/[id] — same pattern as programs | ✓ |
| Slide-over panel | Builder as right-side panel over list; no URL change on new | |

**User's choice:** New page route (Recommended)

---

## Question Editor UX

**Q: How is the question list displayed in the builder?**

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked question cards | Cards with type chip + label + actions; click to expand inline editor | ✓ |
| Two-column (list + editor panel) | Left: question list. Right: active editor panel | |

**User's choice:** Stacked question cards (Recommended)

---

**Q: When the coach clicks a card to edit it, what expands inline?**

| Option | Description | Selected |
|--------|-------------|----------|
| Type selector + label field only | Dropdown for type + text field for label; Save/Cancel buttons | ✓ |
| Inline edit with live preview | Fields update card preview in real-time; no explicit save | |

**User's choice:** Type selector + label field only (Recommended)

---

**Q: For 'choix unique' questions, how does the coach add/edit choices?**

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic list with add/remove rows | Text inputs per choice, + button, trash icon, min 2 enforced | ✓ |
| Comma-separated text field | One textarea, parsed on save — simpler but error-prone | |

**User's choice:** Dynamic list with add/remove rows (Recommended)

---

## Reorder Mechanic

**Q: How does the coach reorder questions?**

| Option | Description | Selected |
|--------|-------------|----------|
| Up/Down arrow buttons | ↑↓ icon buttons on each card; zero new dependencies | ✓ |
| Drag & drop (dnd-kit) | @dnd-kit/core + @dnd-kit/sortable; drag handles; ~25KB bundle | |

**User's choice:** Up/Down arrow buttons (Recommended)

**Notes:** No drag-and-drop library exists in the project; avoiding new dependency.

---

## Trigger & Publish Flow

**Q: Where is trigger configuration placed in the builder?**

| Option | Description | Selected |
|--------|-------------|----------|
| Section below questions | Trigger section on same page; single scrollable builder | ✓ |
| Separate 'Settings' tab | Trigger + publish on a second tab | |

**User's choice:** Section below questions (Recommended)

---

**Q: How does the coach configure trigger parameters?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline conditional fields | Fields appear conditionally based on selected trigger type | ✓ |
| Static form with all fields shown | All fields always visible, disabled unless matching type selected | |

**User's choice:** Inline conditional fields (Recommended)

---

**Q: When the coach clicks 'Publier', what happens?**

| Option | Description | Selected |
|--------|-------------|----------|
| Modal to pick target | Dialog: "Un client" (search) or "Tous mes clients"; confirm publishes | ✓ |
| Inline target selector | Target radio + client search visible before hitting Publish; no modal | |

**User's choice:** Modal to pick target (Recommended)

---

**Q: After a form is published (active), what can the coach do from the builder?**

| Option | Description | Selected |
|--------|-------------|----------|
| Archive only — no edit | Active form is read-only; only "Archiver" action available | ✓ |
| Full edit + re-publish | Can edit; changes apply to new instances only | |
| Archive + manual send only | Read-only but manual send still available | |

**User's choice:** Archive only — no edit (Recommended)

---

## Claude's Discretion

- Visual styling of status badges (draft/active/archived) — color convention open to Claude
- Client search implementation in publish modal — typeahead against linked clients
- Auto-save behavior for drafts (optional)

## Deferred Ideas

- "Formulaires" tab in client detail sheet → Phase 05 (Response Viewer)
- Manual send UI post-publish → Phase 05 or follow-on
- Form duplication / templates → future phase
- Conditional branching inside forms → explicitly out of scope v1.14
