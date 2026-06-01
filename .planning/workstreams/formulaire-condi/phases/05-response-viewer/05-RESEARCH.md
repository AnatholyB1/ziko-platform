# Phase 05: Response Viewer & Claude Injection — Research

**Researched:** 2026-05-28
**Domain:** Next.js server/client component split, Hono API route addition, Supabase JSONB query, Claude context injection
**Confidence:** HIGH — all findings verified directly from codebase source files

---

## Summary

Phase 05 is the final phase of the formulaire-condi workstream. It has two independent tracks:

**Track A — Web UI (RESPONSES-01, -02, -03):** Add a "Formulaires" tab to the client detail sheet. The tab lists all form instances for the athlete — submitted rows are expandable to show Q&A transcripts, pending rows show an "En attente" badge. The pattern is identical to existing tabs (journal, programs). Two new files: a server page and a `ClientFormsContent` client component. Two existing components need small extensions: `ClientTabStrip` (add one TABS entry), `FormStatusBadge` (add two new status values).

**Track B — Backend context injection (CLAUDE-01, -02):** Extend `fetchUserContext()` in `backend/api/src/context/user.ts` to query the last 5 submitted form responses and inject them as a formatted text block in the system prompt. No new API routes needed for this track — it's a direct Supabase query addition to the existing Promise.all.

**Track C — New Hono route (prerequisite for Track A):** `GET /coach/clients/:clientId/forms` must be added to `backend/api/src/routes/forms.ts` and re-exported at the existing `/forms` mount point. The route fetches `form_instances` joined with `coach_forms` (for title) and `form_responses` (for answers), filtered by `athlete_id = clientId` where the coach owns the form.

**Primary recommendation:** Implement in 3 plans — (1) new Hono route, (2) web UI components (TabStrip + Badge extension + server page + ClientFormsContent), (3) fetchUserContext extension. Plans are independently executable within Track A vs Track B.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESPONSES-01 | Coach sees "Formulaires" tab in client detail sheet listing all submitted forms with date | Tab strip extension + server page + ClientFormsContent table with submitted rows |
| RESPONSES-02 | Coach can expand a submission to read all questions and answers | expand/collapse state in ClientFormsContent; Q&A transcript from `form_responses.answers` joined with `coach_forms.questions` |
| RESPONSES-03 | Pending forms visible with "En attente" badge | pending rows in same table; FormStatusBadge extended with 'pending' status; not expandable |
| CLAUDE-01 | Last 5 submitted form responses injected into system prompt on every AI call | fetchUserContext() extension — add form_responses query to Promise.all |
| CLAUDE-02 | Injected context: form title, date, Q&A pairs as readable text | Format as `## Formulaires récents` text block inside system prompt string |
</phase_requirements>

---

## 1. Existing Tab Page Pattern (journal/page.tsx)

**File:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/page.tsx`

The journal page is the canonical reference for all simple read-only tabs. Key observations:

```ts
// Pattern: server component, no Hono API call — fetches Supabase directly via server SDK
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';

export default async function ClientJournalPage({ params }) {
  const { id: clientId } = await params;
  await getCachedCoachUser();          // auth guard — throws/redirects if not coach
  const supabase = await createServerSupabase();  // server-side Supabase with coach JWT cookie

  const { data: rows } = await supabase
    .from('journal_entries')
    .select('...')
    .eq('user_id', clientId)           // CRITICAL: clientId from URL, NOT coach's own user.id
    .order('created_at', { ascending: false })
    .limit(30);

  return <div>...</div>;               // renders table directly — no ClientXxxContent wrapper
}
```

**Key difference for Phase 05:** The journal page renders the table server-side (no interactivity needed). Phase 05 needs client-side expand/collapse state (`useState`), so it MUST use the server-page + client-component split pattern from `programs/page.tsx`, not the pure server pattern from `journal/page.tsx`. The programs page is the correct reference for Phase 05.

**Programs pattern (correct reference for Phase 05):**

```ts
// programs/page.tsx — server component fetches data via Hono API with Bearer token
const { data: { session } } = await supabase.auth.getSession();
const jwt = session?.access_token ?? '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

const res = await fetch(`${apiUrl}/coach/clients/${clientId}/programs`, {
  headers: { Authorization: `Bearer ${jwt}` },
  cache: 'no-store',
});
const data = await res.json();

return <ClientProgramsContent clientId={clientId} programsData={data} ... />;
```

**Phase 05 server page signature:**
```ts
// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx
export default async function ClientFormsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let forms: FormInstance[] = [];
  if (jwt) {
    try {
      const res = await fetch(`${apiUrl}/forms/coach/clients/${clientId}/forms`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        forms = json.forms ?? [];
      }
    } catch (err) {
      console.error('[clients/[id]/forms/page] fetch error:', err);
    }
  }

  return <ClientFormsContent forms={forms} />;
}
```

**Layout context:** The client detail `layout.tsx` already wraps children in `<QueryProvider>`, so `ClientFormsContent` does NOT need its own QueryProvider — data is passed as props from the server page.

---

## 2. ClientTabStrip Current State

**File:** `apps/web/src/components/coach/ClientTabStrip.tsx`

**Current TABS array (11 tabs):**
```ts
const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sessions', label: 'Séances' },
  { key: 'measurements', label: 'Mesures' },
  { key: 'habits', label: 'Habitudes' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sommeil' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'journal', label: 'Journal' },
  { key: 'programs', label: 'Programmes' },
  { key: 'vocal', label: 'Retour vocal' },
  { key: 'videos', label: 'Vidéos' },   // ← insert after this
];
```

**Active detection logic:**
```ts
const isActive = tab.key === 'videos'
  ? pathname.includes('/videos')          // videos has a special case (includes, not endsWith)
  : pathname.endsWith(`/${tab.key}`);     // all others use endsWith
```

**Required change:** Add `{ key: 'forms', label: 'Formulaires' }` after `{ key: 'videos', ... }`. The `forms` tab uses the default `endsWith('/forms')` logic — no special case needed.

**Tabs will overflow:** 12 tabs on a single row. The strip already has `overflow-x-auto scrollbar-none flex-nowrap` — scrolling works. A gradient fade overlay exists (`pointer-events-none absolute right-0 ... bg-gradient-to-l`). No layout change needed.

**Href pattern:** `/${locale}/coach/clients/${id}/forms` — generated by existing `href` template in the map.

---

## 3. FormStatusBadge Current Implementation

**File:** `apps/web/src/components/coach/FormStatusBadge.tsx`

**Current state:** Accepts only `'draft' | 'active' | 'archived'` (form lifecycle statuses).

```ts
interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived';
}

const STATUS_CONFIG: Record<FormStatusBadgeProps['status'], ...> = {
  draft:    { bg: 'bg-[#F0EFE9]', text: 'text-[#6B6963]', label: 'Brouillon' },
  active:   { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Actif' },
  archived: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'Archivé' },
};
```

**Required extension:** Add `'submitted'` and `'pending'` to the union type and STATUS_CONFIG:

```ts
// New entries to add:
submitted: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Soumis' },
pending:   { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', label: 'En attente' },
```

**Important:** The file also exports `QuestionType`, `FormQuestion`, `TriggerType`, `TriggerConfig`, and `CoachForm` interfaces. These are shared type exports used by Phase 03 components. Do not disturb them when extending the badge.

**Type union update:**
```ts
// Before:
interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived';
}

// After:
interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived' | 'submitted' | 'pending';
}
```

---

## 4. fetchUserContext Extension Point

**File:** `backend/api/src/context/user.ts`

**Current Promise.all structure:**
```ts
const [profileRes, pluginsRes, workoutsRes, nutritionRes, habitsRes, logsRes] =
  await Promise.all([
    db.from('user_profiles').select(...).eq('id', userId).single(),
    db.from('user_plugins').select(...).eq('user_id', userId).eq('is_enabled', true),
    db.from('workout_sessions').select(...).eq('user_id', userId)...,
    db.from('nutrition_logs').select(...).eq('user_id', userId)...,
    db.from('habits').select(...).eq('user_id', userId)...,
    db.from('habit_logs').select(...).eq('user_id', userId)...,
  ]);
```

**How to extend:** Add a 7th query to the same Promise.all. The query must join `form_responses` (to get `answers` and `submitted_at`) with `form_instances` (to get `form_id`) with `coach_forms` (to get `title` and `questions`). All filtered by `athlete_id = userId`, `status = 'submitted'`, ordered by `submitted_at DESC`, limited to 5.

**Supabase JS SDK join syntax:**
```ts
db.from('form_responses')
  .select(`
    answers,
    submitted_at,
    form_instances!inner(
      form_id,
      coach_forms!inner(
        title,
        questions
      )
    )
  `)
  .eq('athlete_id', userId)
  .order('submitted_at', { ascending: false })
  .limit(5)
```

**Note on RLS:** The `form_responses` table has policy `form_responses_athlete`: athlete has full access to own responses via `auth.uid() = athlete_id`. Since `fetchUserContext` uses `clientForUser(userToken)` — i.e., the athlete's own JWT — the RLS check passes when the athlete calls the AI chat endpoint. No service role needed.

**Return value extension:** Add `recentFormResponses` to the `UserContext` interface and return value, then serialize to text in the system prompt.

**System prompt injection pattern (CLAUDE-02):**

```ts
// In the route that calls fetchUserContext and builds the system prompt:
const formBlock = (ctx.recentFormResponses ?? []).map((r) => {
  const questionMap = new Map(
    (r.questions as FormQuestion[]).map((q) => [q.id, q])
  );
  const qaLines = (r.answers as FormAnswer[]).map((a) => {
    const q = questionMap.get(a.question_id);
    const label = q?.label ?? a.question_id;
    const value = formatAnswerForClaude(q?.type, a.value);
    return `  Q: ${label}\n  R: ${value}`;
  }).join('\n');
  return `### ${r.form_title} (${r.submitted_at?.slice(0, 10)})\n${qaLines}`;
}).join('\n\n');

const formsSection = formBlock
  ? `\n\n## Formulaires récents\n${formBlock}`
  : '';
```

**Where to locate the system prompt:** The system prompt is assembled in `backend/api/src/routes/ai.ts` (the AI chat routes). The `fetchUserContext()` result is passed to a system prompt builder. Check `ai.ts` for the exact injection point — the `formsSection` string appended at the end of the prompt.

---

## 5. Forms Router — Adding the New Route

**File:** `backend/api/src/routes/forms.ts`
**Mount point in app.ts:** `app.route('/forms', formsRouter)` — line 86

**Implication for route URL:** The `formsRouter` is mounted at `/forms`. All routes inside use `router.get('/coach/forms', ...)` etc. So the new route registered as `router.get('/coach/clients/:clientId/forms', ...)` becomes accessible at `/forms/coach/clients/:clientId/forms`.

**But the UI-SPEC API reference says:** `${process.env.NEXT_PUBLIC_API_URL}/coach/clients/:clientId/forms`

**CRITICAL DISCREPANCY:** The UI-SPEC assumes the route lives at `/coach/clients/:clientId/forms` (i.e., mounted under `clientsRouter`), but adding it to `formsRouter` would place it at `/forms/coach/clients/:clientId/forms`. There are two options:

- **Option A (recommended):** Add the route to `formsRouter` but use the path `/coach/clients/:clientId/forms` — the final URL becomes `/forms/coach/clients/:clientId/forms`. Update the server page fetch URL accordingly.
- **Option B:** Add the route to `clientsRouter` in `backend/api/src/coach/clients/service.ts` at path `/:clientId/forms`. The final URL becomes `/coach/clients/:clientId/forms` (matching UI-SPEC exactly).

**Option B is cleaner and aligns with the UI-SPEC.** The `clientsRouter` is mounted at `app.route('/coach/clients', clientsRouter)` (line 77 of app.ts). Adding `router.get('/:clientId/forms', ...)` there produces the URL `/coach/clients/:clientId/forms`.

**Required SQL for the new route — join strategy:**

```ts
// In clientsRouter handler for GET /:clientId/forms:
const { userId } = c.get('auth');  // coach's userId
const { clientId } = c.req.param();

// Step 1: Verify coach-client relationship (security gate)
// The form_instances RLS `form_instances_coach` allows reads for is_coach_of(auth.uid(), athlete_id)
// but we're using the service-level supabase client (not user JWT) — need explicit check.

// Step 2: Fetch instances + form titles
const { data: instances } = await supabase
  .from('form_instances')
  .select(`
    id,
    form_id,
    status,
    submitted_at,
    coach_forms!inner( title, questions )
  `)
  .eq('athlete_id', clientId)
  .in('coach_forms.coach_id', [userId]);  // security: only own forms

// Step 3: Fetch responses for submitted instances
const submittedIds = instances
  .filter(i => i.status === 'submitted')
  .map(i => i.id);

const { data: responses } = await supabase
  .from('form_responses')
  .select('instance_id, answers')
  .in('instance_id', submittedIds);
```

**Note on Supabase join filter:** Filtering on a joined table column using `.in('coach_forms.coach_id', [userId])` may not work with all Supabase JS SDK versions. An alternative is to verify via the `coach_client_links` table first, then query without the join filter. The exact approach depends on how existing similar routes in `clientsRouter` are structured.

**Response shape (per UI-SPEC contract):**
```ts
{
  forms: [
    {
      instance_id: string,
      form_id: string,
      form_title: string,
      status: 'pending' | 'submitted',
      submitted_at: string | null,
      question_count: number,
      answers: FormAnswer[] | null,   // null for pending
    }
  ]
}
```

**Sorting:** Submitted rows first by `submitted_at DESC`, then pending rows at bottom. Apply sort server-side in the route handler before returning.

---

## 6. DB Schema — form_instances + form_responses

**Migration:** `supabase/migrations/055_forms_schema.sql`

### coach_forms table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| coach_id | UUID FK | references auth.users |
| title | TEXT | max 200 chars |
| questions | JSONB | array of question objects |
| trigger_config | JSONB | `{type, ...}` |
| status | TEXT | 'draft' / 'active' / 'archived' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**questions JSONB item shape** (confirmed from `FormStatusBadge.tsx` types + mobile `types.ts`):
```ts
{ id: string, type: 'text' | 'scale' | 'yes_no' | 'choice', label: string, choices?: string[] }
```

Note: `FormStatusBadge.tsx` uses type `'yesno'` (no underscore) in its `QuestionType` export, but the mobile `types.ts` and the UI-SPEC use `'yes_no'` (with underscore). **The DB canonical type is `'yes_no'`** — the `FormStatusBadge.tsx` export uses `'yesno'` as a TypeScript alias only for the web form builder. The new `ClientFormsContent` must use `'yes_no'` (with underscore) since it reads directly from DB data.

### form_instances table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | — |
| form_id | UUID FK | references coach_forms(id) CASCADE |
| athlete_id | UUID FK | references auth.users(id) CASCADE |
| status | TEXT | 'pending' / 'submitted' |
| created_at | TIMESTAMPTZ | |
| submitted_at | TIMESTAMPTZ NULL | NULL until submitted |

### form_responses table
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | — |
| instance_id | UUID FK | references form_instances(id) CASCADE |
| athlete_id | UUID FK | denormalized — for efficient RLS check |
| answers | JSONB | array: `[{question_id: string, value: string | number}]` |
| submitted_at | TIMESTAMPTZ | set at insert time |

**answers JSONB item shape** (confirmed from mobile `types.ts` and submit route):
```ts
{ question_id: string, value: string | number }
```

To build the Q&A transcript in `ClientFormsContent`, the executor must cross-reference `answers[].question_id` with `coach_forms.questions[].id` to find the `label` and `type`. The Hono route must return both the answers array AND the question metadata (label + type) in the response — the route should build `FormAnswer` objects with `question_label` and `question_type` populated from the join.

### RLS Policies

| Table | Policy | Who can read |
|-------|--------|-------------|
| coach_forms | coach_forms_own | coach reads own forms (auth.uid() = coach_id) |
| form_instances | form_instances_coach | coach reads if `is_coach_of(auth.uid(), athlete_id)` OR coach owns the form |
| form_instances | form_instances_athlete | athlete reads own instances |
| form_responses | form_responses_coach_read | coach reads if `is_coach_of(auth.uid(), athlete_id)` |
| form_responses | form_responses_athlete | athlete reads own responses |

**For the Hono API route:** The `formsRouter` and `clientsRouter` use a global `supabase` client (service/publishable key — NOT user JWT). This means RLS policies using `auth.uid()` will NOT apply. The route must enforce security manually by checking `coach_id = userId` in the query. The existing routes in `forms.ts` already do this: `.eq('coach_id', userId)`.

**For `fetchUserContext`:** Uses `clientForUser(userToken)` with the athlete's JWT. RLS `form_responses_athlete` (`auth.uid() = athlete_id`) passes automatically. No manual security filter needed in the query.

---

## 7. Validation Architecture

### Test Framework
The project has no automated test suite. All validation is manual/smoke testing per the existing pattern across all formulaire-condi phases.

| REQ-ID | Behavior to Test | Test Type | Automated? |
|--------|-----------------|-----------|------------|
| RESPONSES-01 | "Formulaires" tab appears in client detail for a client who has form instances | Manual smoke | No |
| RESPONSES-01 | Tab shows submitted forms with correct date formatting | Manual smoke | No |
| RESPONSES-02 | Clicking a submitted row expands to reveal Q&A; clicking again collapses | Manual smoke | No |
| RESPONSES-02 | Only one row expanded at a time (accordion) | Manual smoke | No |
| RESPONSES-02 | Scale answers display as "{value} / 10"; yes_no localizes to "Oui"/"Non" | Manual smoke | No |
| RESPONSES-03 | Pending form rows show "En attente" badge and no expand chevron | Manual smoke | No |
| RESPONSES-03 | Empty state shows correct message when client has zero form instances | Manual smoke | No |
| RESPONSES-03 | Pending-only state shows bottom note "L'athlète n'a pas encore soumis..." | Manual smoke | No |
| CLAUDE-01 | Submitting an AI coach chat message for an athlete with form responses injects the forms block | Manual smoke | No |
| CLAUDE-02 | Injected block contains: form title, date, each question label paired with answer | Manual smoke | No |

### Edge Cases to Verify

1. **Client with no form instances** — empty state (`forms = []`) renders `IoDocumentTextOutline` icon + heading, no table
2. **Client with only pending forms** — table renders with header row + pending rows + bottom note "L'athlète n'a pas encore soumis de réponses."
3. **Client with only submitted forms** — table renders normally; no pending-only note
4. **Mixed state** — submitted rows first (sorted by `submitted_at DESC`), pending rows at bottom
5. **Form with many questions** — expanded panel scrolls within 600px max-height (CSS `max-height: 600px; overflow: hidden` → may need `overflow-y: auto` inside the expanded panel if Q&A list is long)
6. **Yes/No value stored as `'yes'`/`'no'`** — must be localized to "Oui"/"Non" in `formatAnswerValue`
7. **Scale value stored as number** — must be displayed as `"${value} / 10"`
8. **API fetch failure** — server page passes `forms = []` (empty fallback); `ClientFormsContent` shows empty state (not a crash). Consider adding an `error` prop to distinguish "empty" from "fetch failed" if the error state copy ("Impossible de charger les formulaires.") needs to appear.
9. **Athlete with no AI conversation yet** — `fetchUserContext` returns `recentFormResponses: []`; system prompt gets no forms section (empty `formBlock` → `formsSection = ''`)
10. **Form deleted after submission** — `coach_forms` CASCADE DELETE propagates to `form_instances` → `form_responses`. The join in the API route may return zero rows for that athlete. Handle gracefully.

---

## 8. Risk Flags

### RF-01: Route URL Discrepancy (HIGH)
The UI-SPEC says fetch from `/coach/clients/:clientId/forms`. If the executor adds the route to `formsRouter` (mounted at `/forms`), the actual URL becomes `/forms/coach/clients/:clientId/forms`. This will cause a 404. **Resolution:** Add the new route to `clientsRouter` (`backend/api/src/coach/clients/service.ts`), not to `formsRouter`. URL becomes `/coach/clients/:clientId/forms` exactly as UI-SPEC specifies.

### RF-02: Supabase Client Has No User JWT in Hono (MEDIUM)
The `supabase` client in `forms.ts` and `clientsRouter` is initialized with the publishable key (`SUPABASE_PUBLISHABLE_KEY`), not a user JWT. RLS policies using `auth.uid()` will not fire. This is by design — all existing routes enforce ownership manually via `.eq('coach_id', userId)`. The new route must do the same: verify the coach owns the form via an explicit filter, not by relying on RLS.

### RF-03: QuestionType Mismatch — 'yesno' vs 'yes_no' (HIGH)
`FormStatusBadge.tsx` exports `QuestionType = 'text' | 'scale' | 'yesno' | 'choice'` (no underscore). The mobile types, the UI-SPEC, and the DB store use `'yes_no'` (with underscore). `ClientFormsContent` must use `'yes_no'` because it reads DB data directly. When importing `QuestionType` from `FormStatusBadge`, the type will be wrong. **Resolution:** `ClientFormsContent` should define its own local `QuestionType` or `FormAnswer` interface matching the DB shape (`'yes_no'`), independent of the `FormStatusBadge` export.

### RF-04: Answer Q&A Cross-Reference Requires Questions Array in API Response (MEDIUM)
`form_responses.answers` stores `[{question_id, value}]` — no label or type. To render the Q&A transcript, `ClientFormsContent` needs the question label and type for each answer. The Hono route must include the `coach_forms.questions` array in the response and either (a) return raw questions + answers and let the client component cross-reference, or (b) pre-join server-side into `FormAnswer[]` with `question_label` and `question_type` populated. **Option B (server-side join) is strongly preferred** — it keeps `ClientFormsContent` simple and avoids complex client-side data assembly. The UI-SPEC `FormAnswer` interface already includes `question_label` and `question_type`, confirming Option B is the intended approach.

### RF-05: fetchUserContext Uses Athlete JWT — form_responses RLS Passes (INFORMATIONAL)
The `form_responses_coach_read` policy requires `is_coach_of(auth.uid(), athlete_id)`. When `fetchUserContext` queries `form_responses` with the athlete's JWT, it uses `form_responses_athlete` policy (`auth.uid() = athlete_id`). This is correct. No issue.

### RF-06: Expanded Panel max-height May Clip Long Q&A Lists (LOW)
The UI-SPEC sets `max-height: 600px` for the expanded panel. A form with 10+ long free-text answers could exceed this. Add `overflow-y: auto` inside the expanded panel div, not on the outer transition container. The outer transition container needs `overflow: hidden` for the collapse animation — these are two different elements.

### RF-07: 'forms' Directory Must Be Created (INFORMATIONAL)
`apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/` does not exist yet (confirmed: only dashboard, sessions, measurements, habits, nutrition, sleep, cardio, journal, programs, vocal, videos exist). The executor must create the directory and both files: `page.tsx` and `ClientFormsContent.tsx`.

---

## Sources

All findings are sourced directly from codebase files read in this session.

| File | Findings |
|------|---------|
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/page.tsx` | Server component pattern, Supabase direct query, auth guard pattern |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` | Server + client component split pattern with Hono API fetch + Bearer token |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/layout.tsx` | QueryProvider wraps children; tab strip placement |
| `apps/web/src/components/coach/ClientTabStrip.tsx` | Current 11 tabs, active detection logic, href template |
| `apps/web/src/components/coach/FormStatusBadge.tsx` | Current 3 statuses, exported types, badge anatomy |
| `backend/api/src/context/user.ts` | Full `fetchUserContext()` implementation, Promise.all structure, clientForUser pattern |
| `backend/api/src/routes/forms.ts` | All existing routes, Supabase client initialization, auth pattern |
| `backend/api/src/app.ts` | Mount points: `/forms` for formsRouter, `/coach/clients` for clientsRouter |
| `supabase/migrations/055_forms_schema.sql` | Column definitions, JSONB shapes, RLS policies, indexes |
| `supabase/migrations/058_form_trigger_engine.sql` | Trigger function, security model reference |
| `apps/mobile/src/components/forms/types.ts` | Canonical `FormAnswer` and `FormQuestion` interface shapes (DB-aligned) |
| `.planning/workstreams/formulaire-condi/phases/05-response-viewer/05-UI-SPEC.md` | Full component spec, API response shape, interaction contracts, motion spec |

**Confidence breakdown:**
- Tab pattern and ClientTabStrip: HIGH — read source directly
- FormStatusBadge extension: HIGH — read source directly, types verified
- fetchUserContext extension point: HIGH — read full implementation
- DB schema and JSONB shapes: HIGH — read migration SQL
- RLS policies: HIGH — read migration SQL
- Route URL resolution (RF-01): HIGH — read app.ts mount points
- QuestionType mismatch (RF-03): HIGH — cross-referenced two source files
- Answer/question cross-reference join (RF-04): HIGH — confirmed from mobile types + UI-SPEC

**Research date:** 2026-05-28
**Valid until:** 60 days (stable codebase — no fast-moving dependencies)
