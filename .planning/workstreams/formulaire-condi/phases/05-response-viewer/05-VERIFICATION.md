---
phase: 05-response-viewer
verified: 2026-05-28T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /[locale]/coach/clients/[id]/forms — confirm 'Formulaires' tab appears active in the tab strip and resolves without a 404"
    expected: "Tab strip shows 'Formulaires' as the 12th tab, active when on the forms route"
    why_human: "Tab active state relies on pathname.endsWith('/forms') — verified in code but render correctness requires a browser"
  - test: "Open the forms page for a client with at least one submitted form; click the row"
    expected: "Row expands with the Q&A transcript; scale answer shows '{N} / 10', yes_no shows 'Oui'/'Non'; second click collapses"
    why_human: "Accordion animation (CSS max-height transition 200ms ease-out) and expand/collapse interaction require a live browser"
  - test: "Open the forms page for a client with only pending forms"
    expected: "'En attente' amber badge on all rows; note 'L'athlète n'a pas encore soumis de réponses.' appears below the table; no chevron or click handler on pending rows"
    why_human: "Visual rendering of conditional note and absent chevron require a live browser"
  - test: "Send an AI chat message as an athlete who has at least one submitted form response"
    expected: "System prompt sent to Claude contains '## Formulaires récents' block with form title, YYYY-MM-DD date, and Q&A pairs"
    why_human: "System prompt contents are not observable without server-side log inspection or Claude API tracing"
  - test: "Send an AI chat message as an athlete with zero submitted form responses"
    expected: "System prompt does NOT contain '## Formulaires récents' — no section appended"
    why_human: "Empty-case system prompt contents require server-side log inspection to verify"
---

# Phase 05: Response Viewer & Claude Injection — Verification Report

**Phase Goal:** Coach reads athlete form submissions; Claude AI gets last 5 form responses as context
**Verified:** 2026-05-28
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /coach/clients/:clientId/forms returns 200 with a forms array sorted: submitted rows first (submitted_at DESC), pending rows at bottom | VERIFIED | `db.ts:934–939` implements the two-pass sort: `forms.filter(f => f.status === 'submitted').sort(...)` first, then `.filter(f => f.status === 'pending')` |
| 2 | Each submitted FormInstance in the response contains question_label and question_type already joined from coach_forms.questions — no client-side cross-reference needed | VERIFIED | `db.ts:911–918` maps `rawAnswers` through `questionMap` built from `coach_forms.questions` JSONB, resolving `question_label` and `question_type` server-side |
| 3 | Each pending FormInstance has answers: null and submitted_at: null | VERIFIED | `db.ts:908–919`: `if (i.status === 'submitted')` branch sets answers array; else branch leaves `answers = null`. `submitted_at: i.submitted_at ?? null` at line 927 |
| 4 | Only form instances for forms owned by the requesting coach are returned (security filter applied) | VERIFIED | `db.ts:877–879`: `ownedInstances.filter(i => i.coach_forms?.coach_id === coachId)` applied after fetch. UUID_REGEX guard in `service.ts:470` |
| 5 | A client with no form instances returns `{ forms: [] }` | VERIFIED | `db.ts:874`: `if (!instances || instances.length === 0) return { forms: [] }`. Also `db.ts:881`: second early-return when `ownedInstances.length === 0` |
| 6 | A 'Formulaires' tab appears in ClientTabStrip and navigates to /coach/clients/[id]/forms | VERIFIED | `ClientTabStrip.tsx:17`: `{ key: 'forms', label: 'Formulaires' }` is the 12th entry in TABS. href template at line 30 generates the correct route |
| 7 | Submitted form rows show submission date and a 'Soumis' green badge; clicking a row expands to reveal Q&A transcript | VERIFIED | `ClientFormsContent.tsx:109–204`: submitted rows render `<FormStatusBadge status={form.status} />` (resolves to 'Soumis' via STATUS_CONFIG), `formatDate(form.submitted_at)`, onClick sets `expandedInstanceId`; expand panel at lines 165–202 renders Q&A |
| 8 | Pending form rows show 'En attente' amber badge, no chevron, no click handler; note appears when ALL rows are pending | VERIFIED | `ClientFormsContent.tsx:209–223`: pending `<tr>` has no onClick, renders `<FormStatusBadge status="pending" />`. Line 228: `sorted.every(f => f.status === 'pending')` conditional renders the note |
| 9 | fetchUserContext() returns a recentFormResponses array and the AI system prompt contains '## Formulaires récents' block when athlete has at least one submission; empty when no submissions | VERIFIED | `user.ts:33–38`: `recentFormResponses` field in UserContext interface; `user.ts:138–143`: return mapping. `ai.ts:92–113`: `formBlock` computed from `userCtx.recentFormResponses`; `formsSection` is empty string when `formBlock` is falsy |
| 10 | The injected context block is formatted as: `### {form title} ({YYYY-MM-DD})` + `Q: {label} / R: {answer}` pairs; scale as '{N} / 10', yes_no as 'Oui'/'Non' | VERIFIED | `ai.ts:96–105`: `qaLines` built with `if (q?.type === 'scale') value = \`${a.value} / 10\`` and `if (q?.type === 'yes_no') value = a.value === 'yes' ? 'Oui' : 'Non'`. Header line: `### ${r.form_title} (${(r.submitted_at ?? '').slice(0, 10)})` |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/api/src/coach/clients/db.ts` | `getFormsForClient()` DB function | VERIFIED | Function at line 860, exported, TypeScript types `FormAnswer` and `FormInstanceResponse` declared at lines 843–858 |
| `backend/api/src/coach/clients/service.ts` | GET /:clientId/forms route on clientsRouter | VERIFIED | Route at line 466; `getFormsForClient` imported from `./db.js` at line 36 |
| `apps/web/src/components/coach/ClientTabStrip.tsx` | Formulaires tab entry in TABS array | VERIFIED | `{ key: 'forms', label: 'Formulaires' }` at line 17 — 12th TABS entry |
| `apps/web/src/components/coach/FormStatusBadge.tsx` | submitted and pending badge variants | VERIFIED | STATUS_CONFIG entries at lines 56–65; status union extended to include `'submitted' \| 'pending'` at line 34 |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx` | Server component — fetches API, passes data to ClientFormsContent | VERIFIED | `getCachedCoachUser()` auth guard at line 33; fetch at lines 46–56 with `Authorization: Bearer`; renders `<ClientFormsContent>` at line 59 |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/ClientFormsContent.tsx` | Client component with accordion expand/collapse | VERIFIED | `'use client'` at line 1; `useState<string | null>(null)` at line 59; all four render states implemented |
| `backend/api/src/context/user.ts` | Extended fetchUserContext with 7th Promise.all query and recentFormResponses | VERIFIED | 7-tuple destructure at line 45; 7th query at lines 72–86 targets `form_responses` with `.eq('athlete_id', userId).order('submitted_at', { ascending: false }).limit(5)`; return mapping at lines 138–143 |
| `backend/api/src/routes/ai.ts` | formsSection appended to system prompt via buildSystemPrompt() | VERIFIED | `buildSystemPrompt()` at lines 55–116; formBlock computed at lines 92–105; formsSection at lines 107–113; appended via `sections.push(formsSection)` at line 112 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `service.ts` | `db.ts` | `getFormsForClient` import | VERIFIED | `service.ts:36` imports `getFormsForClient` from `./db.js`; called at `service.ts:472` |
| GET /coach/clients/:clientId/forms | form_instances + coach_forms + form_responses | Supabase join in getFormsForClient | VERIFIED | `db.ts:869–870`: `.select('id, form_id, status, submitted_at, coach_forms!inner(title, questions, coach_id)')` on `form_instances`; `db.ts:888–891`: `form_responses` queried for submitted IDs |
| `forms/page.tsx` | GET /coach/clients/:clientId/forms | fetch with Authorization Bearer JWT | VERIFIED | `page.tsx:46–56`: `fetch(\`${apiUrl}/coach/clients/${clientId}/forms\`, { headers: { Authorization: \`Bearer ${jwt}\` }, cache: 'no-store' })` |
| `ClientFormsContent` | `FormStatusBadge` | import and status prop | VERIFIED | `ClientFormsContent.tsx:9`: `import { FormStatusBadge } from '@/components/coach/FormStatusBadge'`; used at lines 140 and 218 with `status={form.status}` and `status="pending"` |
| `ai.ts` | `user.ts` | fetchUserContext() and ctx.recentFormResponses access | VERIFIED | `ai.ts:7`: imports `fetchUserContext`; called at `ai.ts:202` and `ai.ts:298`; `userCtx.recentFormResponses` accessed at `ai.ts:92` inside `buildSystemPrompt()` |
| `user.ts` | form_responses + form_instances + coach_forms | Supabase nested join with athlete JWT | VERIFIED | `user.ts:72–86`: nested select `form_responses → form_instances!inner → coach_forms!inner(title, questions)` with `.eq('athlete_id', userId)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ClientFormsContent.tsx` | `forms` prop | `forms/page.tsx` server fetch → GET /coach/clients/:clientId/forms | Yes — DB queries `form_instances` + `form_responses` joined to `coach_forms`; no static fallback in the non-error path | FLOWING |
| `ai.ts` buildSystemPrompt | `userCtx.recentFormResponses` | `fetchUserContext()` 7th Promise.all query → `form_responses` table | Yes — DB query with `.eq('athlete_id', userId).limit(5)`; returns live rows or empty array | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — behavioral checks require a running Hono server and live Supabase connection. The route handler and DB function are structurally sound; integration testing requires a live environment.

---

### Probe Execution

Step 7c: No probe scripts declared in PLAN files or found at `scripts/*/tests/probe-*.sh`. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RESPONSES-01 | 05-01, 05-02 | "Formulaires" tab in client sheet with submission list | SATISFIED | ClientTabStrip TABS entry + forms/page.tsx fetching GET /coach/clients/:clientId/forms + table rendering in ClientFormsContent |
| RESPONSES-02 | 05-01, 05-02 | Expandable submission detail view | SATISFIED | ClientFormsContent accordion: expandedInstanceId state, expand panel with Q&A transcript, CSS transition |
| RESPONSES-03 | 05-01, 05-02 | "En attente" badge for pending forms in the tab | SATISFIED | FormStatusBadge STATUS_CONFIG `pending` entry (amber #FEF3C7/#D97706); ClientFormsContent renders `<FormStatusBadge status="pending" />` for pending rows |
| CLAUDE-01 | 05-03 | Last 5 responses injected into system prompt | SATISFIED | user.ts 7th query with `.limit(5)` + `.order('submitted_at', { ascending: false })`; recentFormResponses passed to buildSystemPrompt in ai.ts |
| CLAUDE-02 | 05-03 | Formatted context block (title + date + Q&A pairs) | SATISFIED | ai.ts buildSystemPrompt: `### {title} ({YYYY-MM-DD})` header + Q&A pairs with scale/yes_no formatting |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx` | 59 | `as any` cast on `formsData.forms` | Info | Type cast on data passed to ClientFormsContent; ClientFormsContent declares its own FormInstance interface — no runtime impact |
| `backend/api/src/coach/clients/db.ts` | 877, 895, 901, 911 | `as any[]` casts on Supabase join results | Info | Consistent with the established pattern across the entire db.ts file for Supabase nested join results; not a stub |

No TBD, FIXME, XXX, or placeholder markers found in any of the 8 modified files. No empty implementations or hardcoded empty data in the rendering path.

---

### Human Verification Required

#### 1. Formulaires Tab Navigation

**Test:** Navigate to `/[locale]/coach/clients/[id]/forms` in a browser
**Expected:** Tab strip shows "Formulaires" as the active 12th tab; page loads without 404
**Why human:** Tab active state depends on `pathname.endsWith('/forms')` — correct in code but rendering requires a live browser

#### 2. Submitted Row Expand/Collapse

**Test:** Open forms page for a client with at least one submitted form; click the row; click again
**Expected:** Row expands revealing Q&A pairs (scale as "{N} / 10", yes_no as "Oui"/"Non"); clicking a second row collapses the first; click same row again collapses it
**Why human:** Accordion interaction and CSS max-height transition (200ms ease-out expand, 150ms ease-in collapse) require a live browser

#### 3. Pending-Only State

**Test:** Open forms page for a client with only pending form instances
**Expected:** Amber "En attente" badges on all rows; no chevron icons; no click behavior; note "L'athlète n'a pas encore soumis de réponses." appears below the table
**Why human:** Visual rendering of conditional note and absent interaction elements require a live browser

#### 4. Claude AI Context Injection — Populated Case

**Test:** Send an AI chat message as an athlete who has at least one submitted form response (use a test account)
**Expected:** System prompt sent to Claude contains `## Formulaires récents` section with the form title, YYYY-MM-DD date, and Q&A pairs
**Why human:** System prompt contents require server-side log inspection or Claude API tracing — not observable from the client

#### 5. Claude AI Context Injection — Empty Case

**Test:** Send an AI chat message as an athlete with zero submitted form responses
**Expected:** System prompt does NOT contain `## Formulaires récents` — no section appended
**Why human:** Empty-case behavior requires server-side log inspection to verify

---

### Gaps Summary

No gaps found. All 10 must-have truths are VERIFIED against the actual codebase. All 5 requirement IDs (RESPONSES-01, RESPONSES-02, RESPONSES-03, CLAUDE-01, CLAUDE-02) are covered by substantive, wired implementations. No stubs, placeholder text, or unresolved debt markers found in any of the 8 files modified by this phase.

The `human_needed` status reflects 5 behavioral items that require a live browser or server-side log inspection — all automated checks passed.

---

_Verified: 2026-05-28_
_Verifier: Claude (gsd-verifier)_
