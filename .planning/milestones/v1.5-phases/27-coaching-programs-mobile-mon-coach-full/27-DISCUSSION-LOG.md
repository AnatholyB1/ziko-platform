# Phase 27: Discussion Log

**Date:** 2026-05-20  
**Areas discussed:** weeks_data schema, Program editor model, Assignment + session execution, Shared note model

---

## Area 1: weeks_data schema

| Question | Options presented | Selection |
|---|---|---|
| Session positioning | Day of week (Mon=1…Sun=7) / Ordered slot / Both | **Day of week** |
| Exercise intensity | RPE+RIR both optional / RPE only / % 1RM | **RPE 1–10 OR RIR 0–5 (both nullable)** |
| Schema lock level | Full Zod shape now / Minimal + open / Let researcher design | **Full Zod shape now** |

**Decisions:** Full schema locked (D-01 through D-05). `ProgramWeekSchema → ProgramSessionSchema → ProgramExerciseSchema`. Sessions positioned by `day_of_week` (1–7). Both `target_rpe` and `target_rir` nullable on each exercise.

---

## Area 2: Program editor model

| Question | Options presented | Selection |
|---|---|---|
| Editor model | Week accordion + slide-over / Linear week tabs / Rich block editor | **Week accordion + inline session rows** |
| Exercise sourcing | Search typeahead + free-text fallback / Full modal browser / Free-text only | **Search typeahead + free-text fallback** |
| Folder management | Single-level folders / Tag on program / Skip folders | **Single-level folders** |
| Coach-created exercises | (User note: "coach can create new exercises") | Coach can create new exercises saved to shared `exercises` table (`is_user_defined = TRUE`) |
| Exercise persistence | Shared exercises table / Private coach_exercises / Inline free-text only | **Shared exercises table, visible to all** |

**Decisions:** Week accordion with slide-over panel (D-06). Exercise typeahead + create new (D-07). Single-level folders via new `coach_program_folders` table (D-08). Seed templates in `seed.sql` (D-09).

---

## Area 3: Assignment + session execution

| Question | Options presented | Selection |
|---|---|---|
| Program start | Immediately from today / Coach picks date / Athlete confirms + picks date | **Immediately from today (start_date = today)** |
| Session execution on mobile | Opens existing workout session screen / Read-only preview / New dedicated screen | **Opens existing workout session screen** |
| Programs tab on client detail | Fold into Phase 27 / Defer to Phase 28 | **Fold into Phase 27** |

**Decisions:** Immediate start (D-10). Multi-client batch assignment (D-11). "Commencer" deep-links to `/(app)/workout/session` with pre-loaded exercises (D-12). Prescribed badge on session screen (D-13). Weekly compliance widget based on sessions launched from the program (D-14). Programs tab lands in Phase 27 (D-17).

---

## Area 4: Shared note model

| Question | Options presented | Selection |
|---|---|---|
| Storage model | `shared_note` on coach_client_links / New shared_notes table / Flag on existing notes | **`shared_note TEXT NULL` on coach_client_links** |
| Coach writes from | Client detail page alongside private notes / Assignments panel / Client list row | **Client detail page, alongside private notes** |

**Decisions:** `shared_note` column on `coach_client_links` (D-15). Written from client detail "Message partagé" textarea (max 500 chars). Read via existing `/coach/clients/links/me` endpoint (D-16).

---

## Claude's Discretion Items

- Tailwind layout for week accordion (header height, chevron, indent)
- Slide-over panel width and animation
- Seed template visual treatment in the "Bibliothèque Ziko" section
- Compliance widget color thresholds (green ≥ 80%, orange 50–79%, red < 50%)
- Whether Programs sidebar nav entry already exists in CoachSidebar or needs to be added
