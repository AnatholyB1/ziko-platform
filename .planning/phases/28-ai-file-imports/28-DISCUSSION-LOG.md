# Phase 28: AI File Imports — Discussion Log

**Date:** 2026-05-21
**Areas discussed:** Credit pricing model, Athlete entry point, Parsing strategy per file type, Preview & edit UI scope

---

## Area 1: Credit pricing model

| Question | Options presented | Selected |
|----------|------------------|----------|
| How should AI imports be priced? | Flat per-file (Recommended) / Per-page pricing / Flat with 5-page cap | Per-page pricing |
| Credit tiers for PDFs? | 1 credit for 1–5 pages +1/5 pages (Recommended) / 1 credit per page max 10 / You decide | 1 credit per page, max 10 credits |
| Non-paged files (image/DOCX)? | Always 1 credit (Recommended) / Estimate from file size / Always 2 credits | Always 1 credit |

**Decision:** PDF = 1 credit/page capped at 10. Image/DOCX/XLSX = flat 1 credit. Deduction only on success.

---

## Area 2: Athlete entry point

| Question | Options presented | Selected |
|----------|------------------|----------|
| Where does athlete access import? | Web /import route (Recommended) / Mobile screen / Defer athlete import | Mobile screen only |
| Which mobile screen? | ai-programs plugin (Recommended) / mon-coach plugin / New global screen | ai-programs plugin |
| File picker library? | expo-document-picker (Recommended) / react-native-document-picker | expo-document-picker |

**Decision:** Athlete import = mobile screen in `plugins/ai-programs`. `expo-document-picker`. Coach import = `/coach/imports` web section.

---

## Area 3: Parsing strategy per file type

| Question | Options presented | Selected |
|----------|------------------|----------|
| PDF parsing? | Rasterize → batch Claude vision (Recommended) / Extract text / Claude Files API | Rasterize → batch Claude vision |
| Excel/Word parsing? | Library → text → Claude text model (Recommended) / Convert to images / Try text, fallback vision | Library → text → Claude text model |
| Which Claude model? | claude-haiku for all (Recommended) / claude-sonnet for all / Haiku first, Sonnet fallback | claude-haiku for all |

**Decision:** PDF → pdf2pic/pdfjs → haiku vision. Excel → xlsx → haiku text. Word → mammoth.js → haiku text. Images → haiku vision. All use `generateObject(ImportedProgramSchema)`.

---

## Area 4: Preview & edit UI scope

| Question | Options presented | Selected |
|----------|------------------|----------|
| Edit depth in preview? | Light editing only (Recommended) / Deep editing (structural) / No editing | Deep editing (structural) |
| Re-upload diff display? | Inline +/- coloring (Recommended) / Side-by-side / Summary only | Inline +/- coloring |
| Coach web entry point? | /coach/imports dedicated section (Recommended) / Embedded in /coach/programs | /coach/imports dedicated section |

**Decision:** Full structural editing (add/remove weeks/sessions/exercises). Inline green/red diff for re-uploads. New CoachSidebar "Imports" entry.

---

## Claude's Discretion

- UI component structure for preview editor (accordion vs flat list)
- Mobile poll UI (spinner/skeleton/progress bar)
- Error message copy for parse failures
- Whether coach imports list shows a file preview thumbnail
