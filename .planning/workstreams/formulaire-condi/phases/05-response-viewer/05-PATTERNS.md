# Phase 05: Response Viewer & Claude Injection — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/api/src/coach/clients/service.ts` | route/controller | request-response | Same file — existing `GET /:id/programs` handler | exact |
| `backend/api/src/context/user.ts` | service/context | CRUD + transform | Same file — existing `Promise.all` + return shape | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx` | server component | request-response | `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` | exact |
| `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/ClientFormsContent.tsx` | client component | request-response + event-driven (accordion) | `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` | role-match |
| `apps/web/src/components/coach/ClientTabStrip.tsx` | client component | event-driven | Same file — existing TABS array and Link map | exact |
| `apps/web/src/components/coach/FormStatusBadge.tsx` | client component | transform | Same file — existing STATUS_CONFIG record | exact |

---

## Pattern Assignments

### `backend/api/src/coach/clients/service.ts` — add GET /:clientId/forms

**Analog:** Same file, lines 449–462 (`GET /:id/programs` handler)

**Existing route pattern to copy** (lines 449–462):
```typescript
// GET /:id/programs — programs assigned to this client by the requesting coach (PROG-06)
clientsRouter.get('/:id/programs', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('id');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const result = await getProgramsForClient(jwt, coachId, clientId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/clients] GET /:id/programs error:', err.message);
    return c.json({ error: 'Not found' }, 404);
  }
});
```

**New route to add** (insert after the `GET /:id/programs` block, before the `PUT /:clientId/shared-note` block):
```typescript
// GET /:clientId/forms — form instances assigned to this client by requesting coach (FORMS-01)
clientsRouter.get('/:clientId/forms', async (c) => {
  const { userId: coachId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const clientId = c.req.param('clientId');
  if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
  try {
    const result = await getFormsForClient(jwt, coachId, clientId);
    return c.json(result);
  } catch (err: any) {
    console.error('[coach/clients] GET /:clientId/forms error:', err.message);
    return c.json({ error: err.message }, 500);
  }
});
```

**Import addition** (add `getFormsForClient` to the existing import from `'./db.js'` at lines 18–36):
```typescript
import {
  // ... existing imports ...
  getProgramsForClient,
  upsertSharedNote,
  getFormsForClient,    // ← add this
} from './db.js';
```

**DB function to add in `backend/api/src/coach/clients/db.ts`** — follow the `getProgramsForClient` signature pattern (line 731):
```typescript
export async function getFormsForClient(
  jwt: string,
  coachId: string,
  clientId: string,
): Promise<{ forms: FormInstanceResponse[] }> {
  const db = createUserClient(jwt);

  // Step 1: Fetch all form_instances for this athlete where coach owns the form
  const { data: instances, error: instErr } = await db
    .from('form_instances')
    .select(`
      id,
      form_id,
      status,
      submitted_at,
      coach_forms!inner(
        title,
        questions,
        coach_id
      )
    `)
    .eq('athlete_id', clientId);

  if (instErr) throw new Error(instErr.message);
  if (!instances || instances.length === 0) return { forms: [] };

  // Security: only return instances for forms owned by this coach
  const ownedInstances = (instances as any[]).filter(
    (i) => i.coach_forms?.coach_id === coachId,
  );

  // Step 2: Fetch responses for submitted instances
  const submittedIds = ownedInstances
    .filter((i) => i.status === 'submitted')
    .map((i) => i.id);

  const responsesMap = new Map<string, any[]>();
  if (submittedIds.length > 0) {
    const { data: responses } = await db
      .from('form_responses')
      .select('instance_id, answers')
      .in('instance_id', submittedIds);

    for (const r of responses ?? []) {
      responsesMap.set(r.instance_id, r.answers ?? []);
    }
  }

  // Step 3: Build response shape — pre-join questions into answers
  const forms: FormInstanceResponse[] = ownedInstances.map((i) => {
    const questions: any[] = i.coach_forms?.questions ?? [];
    const questionMap = new Map(questions.map((q: any) => [q.id, q]));
    const rawAnswers: any[] = responsesMap.get(i.id) ?? [];
    const answers: FormAnswer[] | null =
      i.status === 'submitted'
        ? rawAnswers.map((a: any) => {
            const q = questionMap.get(a.question_id);
            return {
              question_id: a.question_id,
              question_label: q?.label ?? a.question_id,
              question_type: q?.type ?? 'text',
              answer_value: a.value,
            };
          })
        : null;

    return {
      instance_id: i.id,
      form_id: i.form_id,
      form_title: i.coach_forms?.title ?? '',
      status: i.status as 'pending' | 'submitted',
      submitted_at: i.submitted_at ?? null,
      question_count: questions.length,
      answers,
    };
  });

  // Sort: submitted DESC first, then pending
  const sorted = [
    ...forms
      .filter((f) => f.status === 'submitted')
      .sort((a, b) =>
        new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime(),
      ),
    ...forms.filter((f) => f.status === 'pending'),
  ];

  return { forms: sorted };
}
```

**Auth pattern:** `adminClient` at file top (lines 40–44) uses `SUPABASE_PUBLISHABLE_KEY` (no JWT, no RLS). All other routes use `createUserClient(jwt)` from `db.ts`. The forms route must use `createUserClient(jwt)` and apply a manual coach ownership filter (`i.coach_forms?.coach_id === coachId`) since RLS won't fire with a service-level client. This matches the security pattern used by `getProgramsForClient` which uses `createUserClient(jwt)`.

---

### `backend/api/src/context/user.ts` — extend fetchUserContext()

**Analog:** Same file, lines 39–66 (Promise.all block) and lines 96–118 (return statement)

**Current Promise.all** (lines 39–66) — 6-tuple:
```typescript
const [profileRes, pluginsRes, workoutsRes, nutritionRes, habitsRes, logsRes] =
  await Promise.all([
    db.from('user_profiles')
      .select('name, age, weight_kg, height_cm, goal, units, settings')
      .eq('id', userId)
      .single(),
    db.from('user_plugins')
      .select('plugin_id')
      .eq('user_id', userId)
      .eq('is_enabled', true),
    db.from('workout_sessions')
      .select('name, started_at, total_volume_kg')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(5),
    db.from('nutrition_logs')
      .select('calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .eq('date', date),
    db.from('habits')
      .select('id, target')
      .eq('user_id', userId)
      .eq('is_active', true),
    db.from('habit_logs')
      .select('habit_id, value')
      .eq('user_id', userId)
      .eq('date', date),
  ]);
```

**Extended Promise.all — add 7th query** (extend to 7-tuple by appending the new query last):
```typescript
const [profileRes, pluginsRes, workoutsRes, nutritionRes, habitsRes, logsRes, formResponsesRes] =
  await Promise.all([
    // ... all 6 existing queries unchanged ...
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
      .limit(5),
  ]);
```

**Interface extension** — add to `UserContext` interface (lines 5–33), after `personaInstruction`:
```typescript
export interface UserContext {
  profile: { ... } | null;
  installedPlugins: string[];
  recentWorkouts: Array<{ ... }>;
  todayNutritionSummary: { ... };
  todayHabitsSummary: { total: number; completed: number };
  personaInstruction: string;
  recentFormResponses: Array<{     // ← add this
    form_title: string;
    submitted_at: string;
    questions: Array<{ id: string; type: string; label: string }>;
    answers: Array<{ question_id: string; value: string | number }>;
  }>;
}
```

**Return value extension** (lines 96–118) — add `recentFormResponses` at the end of the return object, following the same `.map()` + null-coalescing pattern as `recentWorkouts`:
```typescript
return {
  profile: profileRes.data ? { ... } : null,
  installedPlugins: (pluginsRes.data ?? []).map((p: any) => p.plugin_id),
  recentWorkouts: (workoutsRes.data ?? []).map((w: any) => ({
    name: w.name,
    started_at: w.started_at,
    total_volume_kg: w.total_volume_kg ? Number(w.total_volume_kg) : null,
  })),
  todayNutritionSummary,
  todayHabitsSummary: { total: habits.length, completed },
  personaInstruction,
  recentFormResponses: (formResponsesRes.data ?? []).map((r: any) => ({   // ← add
    form_title: r.form_instances?.coach_forms?.title ?? '',
    submitted_at: r.submitted_at,
    questions: r.form_instances?.coach_forms?.questions ?? [],
    answers: r.answers ?? [],
  })),
};
```

**System prompt injection** — in `backend/api/src/routes/ai.ts`, where `fetchUserContext` result is assembled into the system prompt, append the forms block:
```typescript
// After existing context sections:
const formBlock = (ctx.recentFormResponses ?? []).map((r) => {
  const questionMap = new Map(
    r.questions.map((q: any) => [q.id, q]),
  );
  const qaLines = r.answers.map((a: any) => {
    const q = questionMap.get(a.question_id);
    const label = q?.label ?? a.question_id;
    let value = String(a.value);
    if (q?.type === 'scale') value = `${a.value} / 10`;
    if (q?.type === 'yes_no') value = a.value === 'yes' ? 'Oui' : 'Non';
    return `  Q: ${label}\n  R: ${value}`;
  }).join('\n');
  return `### ${r.form_title} (${r.submitted_at?.slice(0, 10)})\n${qaLines}`;
}).join('\n\n');

const formsSection = formBlock
  ? `\n\n## Formulaires récents\n${formBlock}`
  : '';

// Append formsSection to the end of the system prompt string
```

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/page.tsx` (new file)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` (full file, 94 lines)

**Imports pattern** (lines 1–4 of programs/page.tsx):
```typescript
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ClientFormsContent } from './ClientFormsContent';
```

**Auth + JWT extraction pattern** (lines 42–49):
```typescript
const { id: clientId } = await params;
const [locale] = await Promise.all([getLocale(), getCachedCoachUser()]);
const supabase = await createServerSupabase();

const {
  data: { session },
} = await supabase.auth.getSession();
const jwt = session?.access_token ?? '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
```

**Fetch pattern with fallback** (lines 51–82):
```typescript
let formsData: FormInstancesResponse = { forms: [] };

if (jwt) {
  try {
    const res = await fetch(`${apiUrl}/coach/clients/${clientId}/forms`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      formsData = json ?? formsData;
    }
  } catch (err) {
    console.error('[clients/[id]/forms/page] fetch error:', err);
  }
}

return (
  <ClientFormsContent
    forms={formsData.forms}
    locale={locale}
  />
);
```

**Component signature** (line 36–40 pattern):
```typescript
export default async function ClientFormsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
```

**Key differences from programs/page.tsx:** Phase 05 forms page only needs one fetch (no second `clientRes` fetch needed). Props passed to `ClientFormsContent` are just `forms` and `locale` — no `accessToken` or `apiUrl` needed since the content is read-only (no mutations from the client component).

---

### `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/forms/ClientFormsContent.tsx` (new file)

**Analog:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` (full file, 323 lines)

**Header and 'use client' directive** (lines 1–2):
```typescript
'use client';
import { useState } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline, IoDocumentTextOutline } from 'react-icons/io5';
```

**Local interface definitions** — define locally, do NOT import from `FormStatusBadge.tsx` to avoid the `'yesno'` vs `'yes_no'` mismatch (RF-03):
```typescript
// Local types — aligned with DB 'yes_no' (not FormStatusBadge.tsx's 'yesno' alias)
type QuestionType = 'text' | 'scale' | 'yes_no' | 'choice';

interface FormAnswer {
  question_id: string;
  question_label: string;
  question_type: QuestionType;
  answer_value: string | number;
}

interface FormInstance {
  instance_id: string;
  form_id: string;
  form_title: string;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
  question_count: number;
  answers: FormAnswer[] | null;
}

interface ClientFormsContentProps {
  forms: FormInstance[];
  locale: string;
}
```

**Date formatting helper** — copy from `ClientProgramsContent.tsx` line 49–52:
```typescript
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
```

**Answer formatting helper** (new — no analog, use UI-SPEC contract):
```typescript
function formatAnswerValue(type: QuestionType, value: string | number): string {
  if (type === 'scale') return `${value} / 10`;
  if (type === 'yes_no') return value === 'yes' ? 'Oui' : 'Non';
  return String(value);
}

const TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Texte libre',
  scale: 'Échelle 1–10',
  yes_no: 'Oui / Non',
  choice: 'Choix unique',
};
```

**useState pattern** (line 185 from ClientProgramsContent.tsx):
```typescript
export function ClientFormsContent({ forms, locale }: ClientFormsContentProps) {
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
```

**Sorting pattern** (apply before rendering — UI-SPEC sorting contract):
```typescript
  const sorted = [
    ...forms
      .filter((f) => f.status === 'submitted')
      .sort((a, b) =>
        new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime(),
      ),
    ...forms.filter((f) => f.status === 'pending'),
  ];
```

**Empty state pattern** (from ClientProgramsContent.tsx lines 188–207 — adapt icon and copy):
```typescript
  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <IoDocumentTextOutline size={48} color="#E2E0DA" aria-hidden="true" />
        <h2 className="text-[22px] font-bold text-text mt-4">
          Aucun formulaire pour ce client
        </h2>
        <p className="text-sm text-muted mt-2">
          Les formulaires assignés et les réponses apparaîtront ici.
        </p>
      </div>
    );
  }
```

**Table container pattern** (matches Phase 03 CRM surface, `bg-white rounded-2xl border border-border overflow-hidden`):
```typescript
  return (
    <div className="mt-4">
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-background">
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">FORMULAIRE</th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">STATUT</th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">DATE</th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">RÉPONSES</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((form) => (
              <FormRow
                key={form.instance_id}
                form={form}
                isExpanded={expandedInstanceId === form.instance_id}
                onToggle={() =>
                  setExpandedInstanceId(
                    expandedInstanceId === form.instance_id ? null : form.instance_id,
                  )
                }
              />
            ))}
          </tbody>
        </table>
        {/* pending-only note */}
        {sorted.every((f) => f.status === 'pending') && (
          <p className="text-sm text-muted italic text-center py-4">
            L&apos;athlète n&apos;a pas encore soumis de réponses.
          </p>
        )}
      </div>
    </div>
  );
```

**Expand/collapse accordion state** — single `expandedInstanceId: string | null` (not an array). Click handler toggles: if already expanded → set to null; else → set to this row's instance_id. This is identical to the pattern `useState(programsData.active)` in `ClientProgramsContent.tsx` but for accordion state.

**CSS transition for expand panel** — match motion spec (CSS only, no GSAP):
```typescript
// On the expand panel container:
style={{
  maxHeight: isExpanded ? '600px' : '0',
  opacity: isExpanded ? 1 : 0,
  overflow: 'hidden',
  transition: isExpanded
    ? 'max-height 200ms ease-out, opacity 200ms ease-out'
    : 'max-height 150ms ease-in, opacity 150ms ease-in',
}}
```

**Badge usage pattern** — import `FormStatusBadge` from the shared component, but only for the status display; keep local `QuestionType` interface independent:
```typescript
import { FormStatusBadge } from '@/components/coach/FormStatusBadge';
// Use: <FormStatusBadge status={form.status} /> — works after FormStatusBadge is extended
```

---

### `apps/web/src/components/coach/ClientTabStrip.tsx` — add Formulaires tab

**Analog:** Same file, full content (53 lines)

**Current TABS array** (lines 5–17) — 11 entries ending with `videos`:
```typescript
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
  { key: 'videos', label: 'Vidéos' },
];
```

**Required change — add one line after `videos`:**
```typescript
  { key: 'videos', label: 'Vidéos' },
  { key: 'forms', label: 'Formulaires' },    // ← add this line
];
```

**Active detection pattern** (lines 30–32) — `forms` uses the default `endsWith` branch; no special case needed (unlike `videos` which uses `includes`):
```typescript
const isActive = tab.key === 'videos'
  ? pathname.includes('/videos')
  : pathname.endsWith(`/${tab.key}`);
// forms tab: pathname.endsWith('/forms') — handled by the else branch automatically
```

**Href generation** (line 29) — generated automatically by existing template `/${locale}/coach/clients/${id}/${tab.key}`, producing `/${locale}/coach/clients/${id}/forms`. No change needed.

**Layout note:** Tab strip already has `overflow-x-auto scrollbar-none flex-nowrap` + gradient overlay — 12 tabs scroll correctly without layout changes.

---

### `apps/web/src/components/coach/FormStatusBadge.tsx` — extend with submitted/pending

**Analog:** Same file, full content (67 lines)

**Current type union** (line 34):
```typescript
interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived';
}
```

**Extended type union — add two values:**
```typescript
interface FormStatusBadgeProps {
  status: 'draft' | 'active' | 'archived' | 'submitted' | 'pending';
}
```

**Current STATUS_CONFIG** (lines 37–56):
```typescript
const STATUS_CONFIG: Record<
  FormStatusBadgeProps['status'],
  { bg: string; text: string; label: string }
> = {
  draft:    { bg: 'bg-[#F0EFE9]', text: 'text-[#6B6963]', label: 'Brouillon' },
  active:   { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Actif' },
  archived: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'Archivé' },
};
```

**Extended STATUS_CONFIG — add two entries at the end of the record:**
```typescript
const STATUS_CONFIG: Record<
  FormStatusBadgeProps['status'],
  { bg: string; text: string; label: string }
> = {
  draft:     { bg: 'bg-[#F0EFE9]', text: 'text-[#6B6963]', label: 'Brouillon' },
  active:    { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Actif' },
  archived:  { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', label: 'Archivé' },
  submitted: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Soumis' },   // ← add
  pending:   { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', label: 'En attente' }, // ← add
};
```

**CRITICAL:** Lines 1–30 (type exports: `QuestionType`, `FormQuestion`, `TriggerType`, `TriggerConfig`, `CoachForm`) must NOT be changed. Only lines 33–56 are touched (the `FormStatusBadgeProps` interface and `STATUS_CONFIG`). The component function (lines 58–67) is unchanged.

**RF-03 note:** The exported `QuestionType` on line 5 uses `'yesno'` (no underscore). `ClientFormsContent.tsx` must NOT import this type. It must define its own local `QuestionType = 'text' | 'scale' | 'yes_no' | 'choice'` (with underscore) matching the DB schema.

---

## Shared Patterns

### Auth Guard (applies to: forms/page.tsx)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` lines 42–43
```typescript
const [locale] = await Promise.all([getLocale(), getCachedCoachUser()]);
```
`getCachedCoachUser()` throws/redirects if the user is not authenticated as a coach. Always call via `Promise.all` with `getLocale()` to avoid serial awaits.

### Bearer Token Fetch (applies to: forms/page.tsx)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/page.tsx` lines 44–49
```typescript
const supabase = await createServerSupabase();
const { data: { session } } = await supabase.auth.getSession();
const jwt = session?.access_token ?? '';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
```
Gate all `fetch()` calls behind `if (jwt) { ... }` to avoid unauthenticated requests.

### UUID Validation (applies to: new route in service.ts)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/service.ts` (clientsRouter pattern)
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ...
if (!UUID_REGEX.test(clientId)) return c.json({ error: 'Invalid client id' }, 400);
```
All `/:clientId` routes validate UUID format before DB calls.

### Hono Route Auth (applies to: new route in service.ts)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/service.ts` line 64
```typescript
clientsRouter.use('*', authMiddleware);
```
`authMiddleware` is already applied to all routes via the wildcard middleware — no per-route auth needed. `c.get('auth')` is always populated.

### Error Handling (applies to: new route in service.ts, ClientFormsContent.tsx)
**Source:** `backend/api/src/coach/clients/service.ts` lines 453–462
```typescript
try {
  const result = await getProgramsForClient(jwt, coachId, clientId);
  return c.json(result);
} catch (err: any) {
  console.error('[coach/clients] GET /:id/programs error:', err.message);
  return c.json({ error: 'Not found' }, 404);
}
```
Web component fallback: server page passes `forms = []` on any fetch error; `ClientFormsContent` shows empty state rather than crashing.

### No StyleSheet / Inline Tailwind (applies to: ClientFormsContent.tsx, FormStatusBadge.tsx)
**Source:** `apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/ClientProgramsContent.tsx` throughout
All styling uses Tailwind class strings directly on JSX elements. No `StyleSheet.create()`, no CSS modules. Design tokens use Tailwind aliases (`text-primary`, `text-muted`, `border-border`, `bg-background`) or raw hex values inside `bg-[#hex]` brackets for non-aliased colors.

---

## No Analog Found

All 6 files have exact or role-match analogs. No files require falling back to RESEARCH.md patterns as primary reference.

| File | Closest Analog | Why it's sufficient |
|------|----------------|---------------------|
| `getFormsForClient` DB function (in clients/db.ts) | `getProgramsForClient` (same file, line 731) | Same: user JWT client, manual coach ownership filter, multi-step query, shaped return |
| `formatAnswerValue` helper (in ClientFormsContent.tsx) | No direct analog — derived from UI-SPEC contract | Simple switch on type string; no precedent needed |

---

## Metadata

**Analog search scope:** `apps/web/src/app/[locale]/(coach)/coach/clients/`, `apps/web/src/components/coach/`, `backend/api/src/coach/clients/`, `backend/api/src/context/`
**Files scanned:** 6 source files read in full
**Pattern extraction date:** 2026-05-28
