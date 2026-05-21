# Phase 28: AI File Imports - Research

**Researched:** 2026-05-21
**Domain:** File parsing, async upload pipeline, AI vision, credit middleware extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Credit Pricing (D-01/D-02/D-03):**
- Per-page pricing for PDFs: 1 credit/page, capped at 10 credits max
- Flat 1 credit for JPEG/PNG/DOCX/XLSX
- Failed parses (Zod failure / unreadable file) do NOT deduct credits

**Athlete Entry Point (D-04/D-05/D-06):**
- Mobile only for athletes — inside `plugins/ai-programs`
- `expo-document-picker` for file selection
- Signed URL upload flow same as Phase 14 pattern

**Coach Entry Point (D-07/D-08):**
- Dedicated `/coach/imports` section on web with CoachSidebar entry
- Drag-and-drop upload zone with fallback file picker

**File Parsing Strategy (D-09/D-10/D-11/D-12/D-13/D-14):**
- PDF: rasterize pages to PNG → batch Claude haiku vision
- Excel: `xlsx` (SheetJS) → CSV/JSON → Claude haiku text
- Word: `mammoth.js` → markdown → Claude haiku text
- Image: Claude haiku vision directly
- Model: `claude-haiku-4-5-20251001` (from `backend/api/src/config/models.ts`) — no Sonnet fallback
- `generateObject` with `ImportedProgramSchema` from `packages/coach-sdk/src/schemas/imported-program.ts`

**Preview & Edit UI (D-15/D-16/D-17/D-18):**
- Deep structural editing: all fields editable before commit
- Confidence highlighting: < 0.70 → yellow background
- Re-upload diff: green (new), red strikethrough (removed), strikethrough+new inline (changed)
- Commit: athlete mode → `is_template=FALSE`; coach mode → `is_template=TRUE`

**Backend Routes (D-19/D-20):**
- New bounded module `backend/api/src/coach/imports/` (service.ts / db.ts / types.ts)
- 6 routes mounted at `/coach/imports`
- Accessible by both athletes and coaches (RLS owner-only)

**Storage (D-21):**
- New `ai-imports` bucket (private)
- Path: `{user_id}/{import_id}/{original_filename}`

### Claude's Discretion

- Exact UI component structure for preview editor (accordion vs flat list)
- Mobile poll UI (spinner states, skeleton loader vs progress bar during parse)
- Error message copy for specific parse failures
- Whether coach imports list shows a preview thumbnail of the file

### Deferred Ideas (OUT OF SCOPE)

- Athlete import on web (mobile-only in Phase 28)
- Sonnet fallback on low confidence
- Lifecycle cron for ai-imports bucket cleanup
- Google Sheets import
- Garmin `.fit` file import

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Upload PDF/PNG/JPEG/XLSX/XLS/DOCX up to 25 MB via signed URL (bypasses Vercel 4.5 MB limit) | Signed URL pattern verified in `backend/api/src/routes/storage.ts`; `ai-imports` bucket needs creation |
| IMPORT-02 | Credit deduction per-page for PDFs (1/page max 10), flat 1 for others; deduct only on success | `creditGate.ts` pattern verified; requires variable-cost extension (creditCheck must receive page_count) |
| IMPORT-03 | Preview UI shows confidence scores per field; < 70% → yellow highlight; all fields editable before commit | `ImportedProgramSchema` has per-field `confidence` on `ExerciseSchema`; `overall_confidence` at top level |
| IMPORT-04 | Dual mode: athlete on mobile (ai-programs plugin), coach template on web at `/coach/imports` | ai-programs manifest/routes verified; CoachSidebar pattern verified |
| IMPORT-05 | Async pipeline: upload → parse → ready/failed → committed; client polls every 2s | 202 + polling pattern — Vercel `maxDuration = 60` established in Phase 23 |
| IMPORT-06 | Parse route returns 202 immediately; polling `GET /coach/imports/:id` shows live status | `ai_imports` table has status column with 6 valid states (pending/uploaded/parsing/ready/failed/committed) |
| IMPORT-07 | Multi-page PDFs up to 30 pages assembled into single `ImportedProgramSchema` | PDF rasterization: `pdfjs-dist` + `canvas` preferred over `pdf2pic` (see pitfall below) |
| IMPORT-08 | Batch all PDF pages in one Claude haiku vision call for coherent program assembly | AI SDK v6 multi-image blocks confirmed in existing code; base64 pattern used in ai.ts |
| IMPORT-09 | Re-upload diff: show inline +/- coloring vs previous import version | `re_upload_source_id` FK already in `ai_imports` schema (migration 036) |
| IMPORT-10 | Commit creates `workout_programs` row; `ai_imports.committed_program_id` set; status → committed | `workout_programs` extensions in migration 036 (is_template, created_by_coach_id, assigned_to_user_id, weeks_data JSONB) |

</phase_requirements>

---

## Summary

Phase 28 delivers an end-to-end AI file import pipeline: authenticated users upload workout files (PDF/image/Excel/Word), the backend parses them asynchronously with Claude Haiku, and users review a structured preview before committing as a workout program. Two entry points exist: a mobile athlete screen inside the `ai-programs` plugin, and a web coach section at `/coach/imports`.

The most technically complex part is the PDF rasterization path. `pdf2pic` depends on GraphicsMagick/ImageMagick system binaries that are NOT available in Vercel's serverless environment. The correct choice is `pdfjs-dist` (pure JavaScript PDF renderer) combined with the `canvas` npm package, which provides a Node.js Canvas API via native bindings — but these native bindings are pre-built for Linux x86_64 via `prebuild-install`, which matches Vercel's environment. On Windows local dev, they build from source via `node-gyp`, which requires Visual C++ build tools. This cross-platform difference must be documented so developers avoid "works in CI, breaks locally" confusion. For Excel and Word, `xlsx` (SheetJS) and `mammoth.js` are pure JS with no native dependencies — both trivial to deploy.

The credit middleware extension is the second key challenge. The existing `creditCheck(action: CreditAction)` takes a fixed-cost action. For PDFs, cost is `min(page_count, 10)` credits, computed AFTER file upload but BEFORE parse starts. The solution is to bypass `creditCheck` middleware and implement a direct `creditService.checkBalance(userId, cost)` call inside the import parse handler, after `page_count` is read from the `ai_imports` row. Credit deduction uses the existing `creditService.deductCredits()` call only on parse success.

**Primary recommendation:** Use `pdfjs-dist` + `canvas` for PDF rasterization (not `pdf2pic`), implement variable-cost credit check inline in the parse route handler, and follow the bounded module pattern from Phase 24 for the imports module.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload (bypass Vercel 4.5 MB limit) | Supabase Storage | Backend (signed URL generation) | Client uploads directly to Storage via signed URL; backend only generates the URL |
| PDF rasterization | Backend (Vercel serverless) | — | Node.js with pdfjs-dist + canvas; runs during parse step |
| Claude vision/text parsing | Backend (Vercel serverless) | — | AI SDK generateObject; maxDuration = 60 declared on parse route |
| Credit check + deduction | Backend (service layer) | Supabase (SECURITY DEFINER RPC) | Variable cost computed server-side; deduct_ai_credits RPC handles atomicity |
| Async status polling | Client (web + mobile) | — | GET /coach/imports/:id every 2s; server updates status field |
| Preview + structural editing | Client (web Coach / mobile Athlete) | — | Pure client-side state; no server round-trips until commit |
| Re-upload diff computation | Client | — | Computed from two `parsed_data` JSONB blobs client-side |
| Program commit | Backend | Supabase (RLS) | POST to commit route writes workout_programs row; RLS enforces ownership |
| Import list (coach web) | Frontend Server (SSR) | Client | Server Component fetches list; Client Component handles upload interaction |
| Upload UX (drag-drop, picker) | Browser / Client | — | HTML5 drag events on web; expo-document-picker on mobile |

---

## Standard Stack

### Core (Backend — new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdfjs-dist` | 5.7.284 [VERIFIED: npm registry] | PDF parsing + page rendering to canvas | Pure JS PDF renderer, no system binary dependency; works in Vercel serverless |
| `canvas` | 3.2.3 [VERIFIED: npm registry] | Node.js Canvas API for pdfjs-dist rendering | Pre-built Linux x86_64 binaries via prebuild-install; matches Vercel runtime |
| `xlsx` | 0.18.5 [VERIFIED: npm registry] | Excel (.xlsx/.xls) cell extraction | SheetJS — industry standard; pure JS, no native deps; used by millions of projects |
| `mammoth` | 1.12.0 [VERIFIED: npm registry] | Word (.docx) → markdown/HTML conversion | Purpose-built for .docx → readable text; buffer input API available |

### Core (Mobile — new install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-document-picker` | 55.0.13 [VERIFIED: npm registry] | File picker for PDF/image/Office on mobile | Managed Expo SDK 54 compatible; supports all target MIME types; no native rebuild |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai` (Vercel AI SDK) | 6.0.188 [VERIFIED: npm registry] | `generateObject` with Zod schema | PDF/image vision parse; Excel/Word text parse |
| `@ai-sdk/anthropic` | 3.0.78 [VERIFIED: npm registry] | `VISION_MODEL` constant (`claude-haiku-4-5-20251001`) | All parse paths use Haiku |
| `zod` | 4.3.6 [VERIFIED: npm registry] | `ImportedProgramSchema` validation | Already in backend + coach-sdk |
| `@ziko/coach-sdk` | workspace | `ImportedProgramSchema` + `ProgramWeekSchema` | Import parse schema lives here |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdfjs-dist` + `canvas` | `pdf2pic` | `pdf2pic` depends on GraphicsMagick system binary — NOT available on Vercel serverless |
| `pdfjs-dist` + `canvas` | `puppeteer` headless Chrome | 300 MB+ binary, cold start kills Vercel function |
| `mammoth` markdown output | `mammoth` HTML output | Markdown is cleaner for Claude text prompt; less noise from HTML tags |
| Client-side diff | `diff` npm library | Simple array comparison of weeks/sessions/exercises is sufficient; no need for text diff library |

**Installation (backend):**
```bash
cd backend/api && npm install pdfjs-dist canvas xlsx mammoth
```

**Installation (mobile):**
```bash
cd apps/mobile && npx expo install expo-document-picker
```

**Version verification:**
```
pdfjs-dist: 5.7.284 (confirmed npm view)
canvas: 3.2.3 (confirmed npm view)
xlsx: 0.18.5 (confirmed npm view)
mammoth: 1.12.0 (confirmed npm view)
expo-document-picker: 55.0.13 (confirmed npm view)
```

---

## Package Legitimacy Audit

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `pdfjs-dist` | npm | [OK] | Approved |
| `canvas` | npm | [OK] | Approved |
| `xlsx` | npm | [OK] | Approved |
| `mammoth` | npm | [OK] | Approved |
| `expo-document-picker` | npm | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Critical caveat on `canvas`:** The `canvas` package installs via `prebuild-install` (pre-built native binaries for Linux x86_64 — Vercel's runtime) OR falls back to `node-gyp rebuild` locally. On Windows dev machines, `node-gyp rebuild` requires Visual C++ Build Tools. This is a dev environment concern, not a production concern. Vercel will use the pre-built binaries. [VERIFIED: npm registry scripts field shows `install: "prebuild-install -r napi || node-gyp rebuild"`]

**Critical caveat on `pdf2pic`:** `pdf2pic` depends on the `gm` package (GraphicsMagick/ImageMagick for Node.js). GraphicsMagick is a system binary NOT installed in Vercel's serverless environment. `pdf2pic` is therefore incompatible with Vercel deployment. [VERIFIED: `npm view pdf2pic dependencies` shows `"gm": "^1.25.1"`]

---

## Architecture Patterns

### System Architecture Diagram

```
Mobile Athlete                         Coach Web (Next.js)
expo-document-picker                   Drag-drop zone / file picker
      |                                          |
      | 1. POST /coach/imports                   | 1. POST /coach/imports
      |    {filename, mime, size, mode}           |    {filename, mime, size, mode}
      v                                          v
Backend (Hono) /coach/imports/
      | Returns: { import_id, signed_upload_url }
      |
      | 2. Client PUTs file → Supabase Storage (ai-imports bucket)
      |    Path: {user_id}/{import_id}/{original_filename}
      |
      | 3. Client: PUT /coach/imports/:id/status → { status: 'uploaded' }
      |
      | 4. Client: POST /coach/imports/:id/parse  ← returns 202 immediately
      |                      |
      |                      | async (up to 60s, maxDuration=60)
      |                      v
      |              File downloaded from Storage
      |                      |
      |              ┌───────┴──────────────────┐
      |              │ mime_type dispatch        │
      |              ├──────────────────────────┤
      |              │ PDF      → pdfjs-dist     │
      |              │           + canvas        │
      |              │           → PNG pages[]   │
      |              │           → Claude vision │
      |              │ PNG/JPEG → Claude vision  │
      |              │ XLSX/XLS → xlsx → CSV     │
      |              │           → Claude text   │
      |              │ DOCX     → mammoth →      │
      |              │           markdown        │
      |              │           → Claude text   │
      |              └───────────────────────────┘
      |                      |
      |              generateObject(VISION_MODEL, ImportedProgramSchema)
      |                      |
      |              Zod validation
      |              ├── success → status='ready', parsed_data=..., credit deducted
      |              └── failure → status='failed', error_message=..., no credit
      |
      | 5. Client polls GET /coach/imports/:id every 2s
      |    → status: parsing | ready | failed
      |
      | 6. User edits preview (client-side only)
      |
      | 7. PUT /coach/imports/:id/commit
      |    → INSERT workout_programs (is_template per mode)
      |    → UPDATE ai_imports SET committed_program_id, status='committed'
```

### Recommended Project Structure

```
backend/api/src/coach/imports/
├── service.ts        # Public entry — Hono router, 6 routes
├── db.ts             # Supabase queries (internal)
├── types.ts          # TypeScript types (internal)
└── parse/
    ├── pdf.ts        # pdfjs-dist + canvas → base64 PNG pages
    ├── excel.ts      # xlsx → CSV string
    ├── word.ts       # mammoth → markdown string
    └── claude.ts     # generateObject wrapper for all parse paths

apps/web/src/app/[locale]/(coach)/coach/imports/
├── page.tsx                    # Server Component — import list
├── ImportsClient.tsx           # Client Component — upload + list
└── [id]/
    └── page.tsx                # Server Component → PreviewClient

plugins/ai-programs/src/screens/
└── ImportFileScreen.tsx        # Mobile athlete import UI (upload + poll)

apps/mobile/app/(app)/(plugins)/ai-programs/
└── import.tsx                  # Thin route wrapper (showInTabBar: false)
```

### Pattern 1: Variable-Cost Credit Check (Inline, Not Middleware)

**What:** The existing `creditCheck(action)` middleware uses a fixed `CREDIT_COSTS[action]`. For PDF imports, cost = `min(page_count, 10)`. The cost is only known after the file is uploaded and `page_count` is read from the `ai_imports` row.

**When to use:** Inside the `POST /coach/imports/:id/parse` handler, after reading the import row.

```typescript
// Source: pattern derived from backend/api/src/middleware/creditGate.ts + creditService.ts
// In backend/api/src/coach/imports/service.ts

import * as creditService from '../../services/creditService.js';

// Inside POST /:id/parse handler:
const importRow = await db.getImport(jwt, userId, importId);

// Compute variable cost
const creditCost = importRow.mime_type === 'application/pdf'
  ? Math.min(importRow.page_count ?? 1, 10)
  : 1;

// Manual credit check (replaces middleware for variable cost)
const quotaStatus = await creditService.getQuotaStatus(userId, 'import');
if (!quotaStatus.withinFreeQuota && quotaStatus.balance < creditCost) {
  return c.json({ error: 'insufficient_credits', required: creditCost, balance: quotaStatus.balance }, 402);
}

// ... run parse ...

// Deduct only on success (D-03)
if (parseSuccess) {
  const idempotencyKey = `import-${importId}`;
  await creditService.deductCredits(userId, 'import', idempotencyKey, creditCost);
}
```

**Note:** This requires adding `'import'` to `CreditAction` type in `backend/api/src/config/credits.ts` with cost = 0 (the actual cost is passed dynamically). Or, extend `creditService.deductCredits()` to accept an explicit cost override.

### Pattern 2: PDF Rasterization with pdfjs-dist + canvas

**What:** Load PDF from Buffer, render each page to an off-screen canvas, export as base64 PNG.

```typescript
// Source: pdfjs-dist Node.js usage pattern [ASSUMED — training knowledge, pattern consistent with pdfjs-dist docs]
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.js';
import { createCanvas } from 'canvas';

export async function rasterizePdf(buffer: Buffer, maxPages = 30): Promise<string[]> {
  const pdfData = new Uint8Array(buffer);
  const pdf = await getDocument({ data: pdfData }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const base64Pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 }); // 1.5x = good quality/size tradeoff
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d') as any;
    await page.render({ canvasContext: context, viewport }).promise;
    const base64 = canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
    base64Pages.push(base64);
  }
  return base64Pages;
}
```

### Pattern 3: generateObject with Vision for PDF/Image

**What:** Pass all rasterized pages as base64 image blocks in a single `generateObject` call.

```typescript
// Source: pattern from backend/api/src/routes/pantry-recipes.ts (generateObject usage)
// and backend/api/src/routes/ai.ts (base64 image block pattern)
import { generateObject, NoObjectGeneratedError } from 'ai';
import { VISION_MODEL } from '../../config/models.js';
import { ImportedProgramSchema } from '@ziko/coach-sdk';

export async function parseWithVision(base64Pages: string[]): Promise<typeof ImportedProgramSchema._type> {
  const imageBlocks = base64Pages.map((b64) => ({
    type: 'image' as const,
    image: b64,
    mediaType: 'image/png' as const,
  }));

  const { object } = await generateObject({
    model: VISION_MODEL,
    schema: ImportedProgramSchema,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        {
          type: 'text',
          text: `Extract the workout program from these ${base64Pages.length} pages into the required JSON structure.
For each exercise field (name, sets, reps, target_rpe, rest_seconds), set confidence 0.0-1.0 based on how clearly it appears in the document.
Set overall_confidence to the weighted average of all field confidences.
If a page shows Week N, map exercises to the correct week_number.`,
        },
      ],
    }],
  });
  return object;
}
```

### Pattern 4: Excel Parsing with xlsx

**What:** Parse `.xlsx` or `.xls` buffer to CSV string.

```typescript
// Source: SheetJS documentation pattern [ASSUMED — training knowledge]
import * as XLSX from 'xlsx';

export function parseExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  // Use first sheet with data
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}
```

### Pattern 5: Word Parsing with mammoth

**What:** Convert `.docx` buffer to markdown string.

```typescript
// Source: mammoth.js README [ASSUMED — training knowledge; confirmed buffer API exists]
import mammoth from 'mammoth';

export async function parseWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToMarkdown({ buffer });
  return result.value; // Clean markdown text
}
```

### Pattern 6: Re-upload Diff (Client-Side)

**What:** Compare two `ImportedProgramSchema` objects and produce annotated diff arrays.

```typescript
// Client-side utility — no library needed
type DiffStatus = 'new' | 'removed' | 'changed' | 'unchanged';
interface DiffedExercise {
  exercise: Exercise;
  status: DiffStatus;
  previousValue?: Partial<Exercise>;
}

function diffPrograms(prev: ImportedProgram, next: ImportedProgram): DiffedWeeks[] {
  // Match weeks by week_number, sessions by name, exercises by name
  // Return annotated structure with DiffStatus on each exercise row
}
```

### Pattern 7: Mobile Polling Loop

```typescript
// In ImportFileScreen.tsx — poll every 2s, cancel on unmount
useEffect(() => {
  if (importStatus !== 'parsing') return;
  const interval = setInterval(async () => {
    const res = await fetch(`${API_URL}/coach/imports/${importId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setImportStatus(data.import.status);
    if (data.import.status === 'ready' || data.import.status === 'failed') {
      clearInterval(interval);
    }
  }, 2000);
  return () => clearInterval(interval); // Cancel on unmount
}, [importStatus, importId]);
```

### Anti-Patterns to Avoid

- **Using `pdf2pic` for Vercel deployment:** Requires GraphicsMagick binary not available in serverless. Always use `pdfjs-dist` + `canvas`.
- **Passing all pages as separate Claude calls:** Loses cross-page context (e.g., Week 1 header on page 1, exercises on pages 2-3). Always batch all pages in ONE `generateObject` call.
- **Deducting credits before parse:** D-03 is explicit: credits deducted only on success. Never call `deductCredits` before `generateObject` resolves.
- **Using `generateText` instead of `generateObject`:** For structured data extraction, `generateObject` with Zod schema produces validated output. Use it exclusively.
- **Forgetting `force-dynamic` on web imports pages:** All `(coach)` routes require `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` per Phase 23 D-15.
- **Reading file through Vercel body:** Files over 4.5 MB will be truncated. Always use signed URL upload directly to Supabase Storage.
- **Using Alert.react-native in the mobile import screen:** Use `showAlert` from `@ziko/plugin-sdk` per CLAUDE.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF → image pages | Custom PDF rasterizer | `pdfjs-dist` + `canvas` | PDF spec is complex (fonts, embedded images, transforms, CJK); pdfjs-dist handles 99% of real documents |
| Excel → structured text | Custom XLSX parser | `xlsx` (SheetJS) | XLSX format is a ZIP of XML files with complex cell reference system; SheetJS handles formulas, merged cells, multiple sheets |
| Word → text | Custom DOCX parser | `mammoth.js` | DOCX is Office Open XML with complex schema; mammoth handles styles, tables, embedded content |
| Structured AI output | Text parsing | `generateObject` with Zod schema | Claude can hallucinate or skip fields; `generateObject` enforces schema and retries on validation failure |
| Credit atomicity | SQL UPDATE | `deduct_ai_credits` SECURITY DEFINER RPC | Atomic `SELECT FOR UPDATE` pattern already implemented; race conditions eliminated |
| File size validation | Client-only check | Server-side CHECK constraint + client pre-check | DB already has `CHECK (size_bytes <= 26214400)`; client pre-check improves UX only |

**Key insight:** The file parsing stack is a well-solved problem. Hand-rolling PDF/Excel/Word parsers would require months of engineering to match what these libraries cover out of the box.

---

## Common Pitfalls

### Pitfall 1: pdf2pic on Vercel
**What goes wrong:** `pdf2pic` install succeeds locally (if GraphicsMagick is installed) but silently fails on Vercel with "gm not found" or similar binary error.
**Why it happens:** `pdf2pic` depends on `gm` (GraphicsMagick for Node.js) which requires `gm` system binary. Vercel serverless has no system package manager.
**How to avoid:** Use `pdfjs-dist` + `canvas` exclusively. Never add `pdf2pic` as a dependency.
**Warning signs:** Any package that depends on `gm` or `imagemagick` in its dependency tree.

### Pitfall 2: canvas native binaries on Windows dev
**What goes wrong:** `canvas` fails to install on Windows dev machines with "node-gyp" errors because Visual C++ Build Tools are not installed.
**Why it happens:** `canvas` uses `prebuild-install` for pre-built binaries (Linux x86_64 = Vercel). On Windows, it falls back to `node-gyp rebuild` which requires build tools.
**How to avoid:** Document that Windows devs need Visual C++ Build Tools OR use WSL2 for backend development. CI/CD (Linux) and Vercel (Linux) are unaffected.
**Warning signs:** `node-gyp rebuild` errors mentioning "MSBUILD" or "cl.exe" during `npm install`.

### Pitfall 3: Exceeding Vercel 60s maxDuration on large PDFs
**What goes wrong:** A 30-page PDF with complex graphics takes > 60s to rasterize + Claude parse. The Vercel function times out, leaving `ai_imports.status = 'parsing'` stuck forever.
**Why it happens:** pdfjs-dist page rendering is synchronous per page; 30 pages × 1-2s each = 30-60s. Claude vision with 30 pages may add another 15-30s.
**How to avoid:** Cap at 30 pages (already in schema: `page_count <= 30` per D-09). Use `scale: 1.5` not `scale: 2.0` for canvas viewport (smaller PNG = faster Claude upload + parse). Set a 55s timeout guard in the parse function that updates status to `failed` before Vercel kills the process. Alternatively, consider sending pages in chunks of 10 if the single call regularly times out.
**Warning signs:** Parse duration logs approaching 50s for multi-page documents.

### Pitfall 4: Hono static routes vs `:id` param collision
**What goes wrong:** Routes `GET /imports/list` and `GET /imports/:id` — Hono matches `list` as `:id=list`.
**Why it happens:** Hono uses first-match routing; dynamic segments match anything.
**How to avoid:** Register all static paths BEFORE dynamic `:id` routes. Pattern established in `backend/api/src/coach/programs/service.ts` (see comment at top: "CRITICAL: static paths registered BEFORE /:id").
**Warning signs:** 404 or wrong handler called for static routes.

### Pitfall 5: pdfjs-dist Node.js import path
**What goes wrong:** `import { getDocument } from 'pdfjs-dist'` fails in Node.js with "canvas" not found or DOM API errors.
**Why it happens:** pdfjs-dist default export targets browsers; Node.js needs the legacy/node build.
**How to avoid:** Import from `pdfjs-dist/legacy/build/pdf.js` for Node.js serverless environments.
**Warning signs:** "ReferenceError: document is not defined" or "Cannot find module canvas".

### Pitfall 6: Credit action type extension
**What goes wrong:** Adding `'import'` to `CreditAction` without updating `CREDIT_COSTS` breaks TypeScript compilation across the credit middleware.
**Why it happens:** `CREDIT_COSTS` is typed as `Record<CreditAction, number>` — adding a new action requires a corresponding cost.
**How to avoid:** For variable-cost actions, add `import: 0` to `CREDIT_COSTS` as a sentinel, and pass the actual cost as an override parameter to `deductCredits()`. Extend the `deductCredits` signature to accept an optional `costOverride?: number`.
**Warning signs:** TypeScript errors in `creditGate.ts` after adding 'import' to CreditAction.

### Pitfall 7: expo-document-picker URI vs blob upload
**What goes wrong:** Attempting to upload `asset.uri` (a `file://` URI) directly as the body of a PUT request to Supabase fails or sends an empty body.
**Why it happens:** React Native `fetch()` doesn't automatically resolve `file://` URIs to binary data in all cases.
**How to avoid:** Always use the established Phase 14 D-20 pattern: `fetch(asset.uri)` → `.blob()` → PUT blob to signed URL. This is verified to work in the codebase (settings.tsx pattern).
**Warning signs:** Upload succeeds (HTTP 200) but downloaded file is 0 bytes.

### Pitfall 8: ImportedProgramSchema `confidence` field scope
**What goes wrong:** Confidence scores are placed on `ExerciseSchema` but the prompt asks Claude to add `overall_confidence` at the program level. `SessionSchema` and `WeekSchema` have no per-field confidence.
**Why it happens:** The schema in `packages/coach-sdk/src/schemas/imported-program.ts` has `confidence` only on `ExerciseSchema` and `overall_confidence` on `ImportedProgramSchema`. This is intentional.
**How to avoid:** Claude prompt must instruct: "Set `exercise.confidence` per exercise (0.0-1.0). Set `overall_confidence` as weighted average across all exercises."
**Warning signs:** Claude produces confidence scores on session names or week notes, which the schema strips via `.strict()`.

---

## Code Examples

### Existing generateObject Pattern (Phase 7 Reference)

```typescript
// Source: backend/api/src/routes/pantry-recipes.ts (verified)
import { generateObject, NoObjectGeneratedError } from 'ai';
import { AGENT_MODEL } from '../config/models.js';
import { z } from 'zod';

const { object } = await generateObject({
  model: AGENT_MODEL,          // Phase 28: use VISION_MODEL instead
  schema: ResponseSchema,       // Phase 28: use ImportedProgramSchema
  maxOutputTokens: 2000,
  system: '...',
  prompt: '...',               // Phase 28: use messages[] with image blocks instead
});

// Error handling pattern:
try {
  const { object } = await generateObject({ ... });
  // success path
} catch (err) {
  if (err instanceof NoObjectGeneratedError) {
    console.error('[Import Parse Error]', err.text);
    // status = 'failed'
  }
  throw err;
}
```

### Existing Signed URL Pattern (Phase 14 Reference)

```typescript
// Source: backend/api/src/routes/storage.ts (verified)
const { data, error } = await supabase.storage
  .from(bucket)                            // Phase 28: 'ai-imports'
  .createSignedUploadUrl(path);            // path = '{userId}/{importId}/{filename}'
// data: { signedUrl, path, token }

// Extend ALLOWED_BUCKETS to include 'ai-imports'
const ALLOWED_BUCKETS = ['profile-photos', 'scan-photos', 'exports', 'coach-kyc', 'ai-imports'];
```

### Mobile Upload Pattern (Phase 14 Reference)

```typescript
// Source: backend/api/src/routes/storage.ts + 14-CONTEXT.md D-20 (verified)
// Step 1: Get signed upload URL
const urlRes = await fetch(`${API_URL}/coach/imports`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ filename, mime_type: mimeType, size_bytes: size, mode: 'athlete' }),
});
const { import_id, signed_upload_url } = await urlRes.json();

// Step 2: Upload blob directly to Supabase
const blobRes = await fetch(asset.uri);
const blob = await blobRes.blob();
await fetch(signed_upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': mimeType },
  body: blob,
});

// Step 3: Notify backend upload complete
await fetch(`${API_URL}/coach/imports/${import_id}/status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ status: 'uploaded' }),
});
```

### expo-document-picker Usage

```typescript
// Source: expo-document-picker docs [ASSUMED — confirmed API from npm view]
import * as DocumentPicker from 'expo-document-picker';

const result = await DocumentPicker.getDocumentAsync({
  type: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // .xlsx
    'application/vnd.ms-excel',                                              // .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ],
  copyToCacheDirectory: true,  // Required to get a readable file:// URI
});

if (result.canceled) return;
const asset = result.assets[0];
// asset.uri, asset.mimeType, asset.size, asset.name
if (asset.size && asset.size > 25 * 1024 * 1024) {
  showAlert('Fichier trop grand', 'La taille maximale est 25 Mo.');
  return;
}
```

### CoachSidebar Extension Pattern

```typescript
// Source: apps/web/src/components/coach/CoachSidebar.tsx (verified)
// Add to NAV_ITEMS array — same pattern as Programmes entry:
import { IoCloudUploadOutline } from 'react-icons/io5';

{ label: 'Imports', href: '/fr/coach/imports', icon: IoCloudUploadOutline, disabled: false },
// Insert after 'Programmes', before 'IA'
```

### ai_imports Row States Flow

```
pending → uploaded → parsing → ready → committed
                   ↘ failed
```

```typescript
// Status machine in db.ts
type ImportStatus = 'pending' | 'uploaded' | 'parsing' | 'ready' | 'failed' | 'committed';
// Transitions:
// POST /coach/imports         → creates row with status='pending'
// PUT /coach/imports/:id/status  → pending → uploaded
// POST /coach/imports/:id/parse  → uploaded → parsing (sync), then → ready|failed (async)
// PUT /coach/imports/:id/commit  → ready → committed
```

---

## Integration Points

### 1. Migration ~048: Wire credit_transaction_id FK

Migration 036 left this comment:
```sql
credit_transaction_id UUID NULL,  -- FK wired in Phase 28 to ai_credit_transactions(id)
```

Migration 048 must add:
```sql
-- Phase 28: wire FK left as comment in migration 036
ALTER TABLE public.ai_imports
  ADD CONSTRAINT fk_ai_imports_credit_transaction
    FOREIGN KEY (credit_transaction_id)
    REFERENCES public.ai_credit_transactions(id)
    ON DELETE SET NULL;
```

**Note:** `ai_credit_transactions` table was created in migration 026. The constraint is `ON DELETE SET NULL` to preserve the import record if a transaction is ever purged.

### 2. New Supabase Storage Bucket: ai-imports

The `backend/api/src/routes/storage.ts` currently allowlists: `['profile-photos', 'scan-photos', 'exports', 'coach-kyc']`. Phase 28 must:
- Create the `ai-imports` bucket (private) via migration or Supabase dashboard
- Add RLS policy: owner-only (`(storage.foldername(name))[1] = auth.uid()::text`) for INSERT + SELECT
- Add `'ai-imports'` to `ALLOWED_BUCKETS` in `storage.ts`

### 3. Credits Config Extension

`backend/api/src/config/credits.ts` needs a new `'import'` CreditAction. The variable cost (1–10 credits) is passed as a runtime override to `deductCredits()`. Current `CREDIT_COSTS` type must accommodate this — either:
- Add `import: 0` to `CREDIT_COSTS` and add `costOverride?: number` parameter to `deductCredits()`
- Or bypass the middleware entirely and call service methods directly in the parse handler

### 4. app.ts Route Mount

```typescript
// Source: backend/api/src/app.ts (verified) — add after programs router:
import { importsRouter } from './coach/imports/service.js';
app.route('/coach/imports', importsRouter);
```

### 5. ai-programs Manifest: New Import Route

```typescript
// Source: plugins/ai-programs/src/manifest.ts (verified)
// Add to routes array:
{
  path: '/(plugins)/ai-programs/import',
  title: 'Importer un fichier',
  icon: 'cloud-upload-outline',
  showInTabBar: false,
}
```

### 6. New Thin Route Wrapper (Mobile)

```typescript
// apps/mobile/app/(app)/(plugins)/ai-programs/import.tsx
import ImportFileScreen from '@ziko/plugin-ai-programs/screens/ImportFileScreen';
import { supabase } from '../../../../src/lib/supabase';
export default function ImportFileRoute() {
  return <ImportFileScreen supabase={supabase} />;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vercel AI SDK v3 (`parameters`, `maxSteps`, `args`/`result`) | AI SDK v6 (`inputSchema`, `stopWhen: stepCountIs()`, `input`/`output`) | Phase 7 | Use v6 API exclusively |
| `generateText` for structured output | `generateObject` with Zod schema | Phase 7 | Enforced schema + retry on validation failure |
| Base64-in-request-body upload | Signed URL direct upload to Storage | Phase 14 | Bypasses Vercel 4.5 MB body limit |
| Fixed credit cost per action | Variable cost (page_count) | Phase 28 | New pattern: inline credit check + deduction in handler |

**Deprecated/outdated:**
- `pdf2pic`: Requires system binary (GraphicsMagick), incompatible with Vercel serverless
- `AGENT_MODEL` for file parsing: CONTEXT.md D-13 mandates `VISION_MODEL` (`claude-haiku-4-5-20251001`) for all Phase 28 parse paths

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Backend parsing | ✓ | 22.x (inferred from @types/node ^22) | — |
| Vercel Pro tier | `maxDuration = 60` on parse route | ✓ | Confirmed Phase 23 | None — Hobby 10s kills imports |
| Supabase Storage | ai-imports bucket | ✓ | Existing setup | — |
| `canvas` native binaries | pdfjs-dist rendering on Vercel | ✓ (Linux) | 3.2.3 | On Windows dev: requires Visual C++ Build Tools |
| `expo-document-picker` | Mobile file pick | Not yet installed | 55.0.13 | — |
| `pdfjs-dist` | PDF rasterization | Not yet installed | 5.7.284 | — |
| `canvas` npm | pdfjs-dist Node.js canvas | Not yet installed | 3.2.3 | — |
| `xlsx` | Excel parsing | Not yet installed | 0.18.5 | — |
| `mammoth` | Word parsing | Not yet installed | 1.12.0 | — |

**Missing dependencies with no fallback:**
- `pdfjs-dist`, `canvas`, `xlsx`, `mammoth` — must be installed in `backend/api` before PDF/Excel/Word parsing works
- `expo-document-picker` — must be installed in `apps/mobile` before mobile upload UI works

**Missing dependencies with fallback:**
- None — all dependencies have clear installation paths

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `backend/api/vitest.config.ts` (inferred from package.json) |
| Quick run command | `cd backend/api && npm test` |
| Full suite command | `cd backend/api && npm test -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPORT-01 | Signed URL returned for valid upload request | unit | `vitest run test/coach/imports.spec.ts -t "upload-url"` | ❌ Wave 0 |
| IMPORT-02 | Variable credit cost: PDF page_count → min(n,10) credits | unit | `vitest run test/coach/imports.spec.ts -t "credit-cost"` | ❌ Wave 0 |
| IMPORT-03 | ImportedProgramSchema Zod validation passes on valid Claude output | unit | `vitest run test/coach/imports.spec.ts -t "schema-validation"` | ❌ Wave 0 |
| IMPORT-04 | Import route accessible by both athlete JWT and coach JWT | integration | `vitest run test/coach/imports.spec.ts -t "dual-mode"` | ❌ Wave 0 |
| IMPORT-05 | Status transitions: pending→uploaded→parsing→ready | unit | `vitest run test/coach/imports.spec.ts -t "status-machine"` | ❌ Wave 0 |
| IMPORT-06 | Parse route returns 202 immediately | integration | `vitest run test/coach/imports.spec.ts -t "202-async"` | ❌ Wave 0 |
| IMPORT-07 | PDF rasterize: 30 pages → 30 base64 PNG strings | unit | `vitest run test/coach/parse/pdf.spec.ts` | ❌ Wave 0 |
| IMPORT-08 | Excel → CSV → Claude text produces valid schema | unit | `vitest run test/coach/parse/excel.spec.ts` | ❌ Wave 0 |
| IMPORT-09 | Diff algo: new/removed/changed rows identified correctly | unit | `vitest run test/coach/imports.spec.ts -t "diff-algo"` | ❌ Wave 0 |
| IMPORT-10 | Commit creates workout_programs row with correct is_template | integration | `vitest run test/coach/imports.spec.ts -t "commit"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend/api && npm test -- --reporter=dot`
- **Per wave merge:** `cd backend/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/api/test/coach/imports.spec.ts` — covers IMPORT-01 through IMPORT-06, IMPORT-09, IMPORT-10
- [ ] `backend/api/test/coach/parse/pdf.spec.ts` — covers IMPORT-07 (uses a small 2-page test PDF fixture)
- [ ] `backend/api/test/coach/parse/excel.spec.ts` — covers IMPORT-08 (uses a small test .xlsx fixture)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` (existing) — all import routes require JWT |
| V3 Session Management | no | — |
| V4 Access Control | yes | RLS `ai_imports_own` policy (owner-only); no `is_coach_of()` on imports (D-20) |
| V5 Input Validation | yes | MIME type CHECK constraint in DB; size CHECK `<= 26214400`; Zod on request body |
| V6 Cryptography | no | Storage uses Supabase-managed signed URLs (not hand-rolled) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in signed URL | Spoofing / Tampering | Enforce `path.startsWith(userId + '/')` before creating signed URL (existing pattern in storage.ts) |
| Oversized file bypass | Denial of Service | Server-side `size_bytes CHECK` in DB + client pre-check (25 MB) |
| MIME type spoofing | Tampering | DB CHECK constraint on `mime_type` column; server reads actual bytes for rasterization — format mismatch will fail parse |
| Credit bypass | Elevation of Privilege | Credit check runs server-side inside parse handler after reading page_count; client cannot manipulate |
| Cross-user import access | Information Disclosure | RLS `ai_imports_own` enforces owner-only; `GET /coach/imports/:id` uses user JWT client (not service key) |
| Claude prompt injection via file content | Tampering | File content processed as data (base64/CSV/markdown), not as system prompt; `generateObject` schema enforces output shape |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pdfjs-dist` legacy/build path works in Vercel serverless with canvas npm | Pitfall 1, Code Examples | Parse route fails for PDFs; fallback: test in Vercel preview before Phase gate |
| A2 | `mammoth.convertToMarkdown({ buffer })` API accepts Buffer directly | Pattern 5, Standard Stack | Word parse fails; fallback: write to temp file and use `{ path }` API |
| A3 | `xlsx.read(buffer, { type: 'buffer' })` works for both .xlsx and .xls | Pattern 4, Standard Stack | Excel parse fails for legacy .xls; SheetJS claims universal support — low risk |
| A4 | `expo-document-picker` v55.0.13 is compatible with Expo SDK 54 | Standard Stack | Mobile file picker not available; check Expo SDK compat table |
| A5 | Claude Haiku correctly handles 30 base64 PNG image blocks in one message | Architecture Patterns | Low confidence extractions on large documents; mitigation: confidence scores flag bad results for user review |
| A6 | `deductCredits()` in creditService.ts can be extended with a costOverride parameter without breaking existing callers | Integration Points | Credit system type errors; alternative: add separate `deductVariable()` method |
| A7 | Vercel Pro `maxDuration = 60` is sufficient for 30-page PDF rasterization + Claude parse | Common Pitfalls | Parse timeout → status stuck at 'parsing'; mitigation: internal 55s guard that sets status to 'failed' |

---

## Open Questions

1. **canvas build on Vercel**
   - What we know: `canvas` uses `prebuild-install` for Linux x86_64. Vercel runs Linux x86_64.
   - What's unclear: Whether Vercel's `npm ci` build step successfully finds the pre-built binary for Node 22 without hitting `node-gyp`.
   - Recommendation: Create a Vercel preview deployment with `canvas` installed and run a smoke test PDF rasterization endpoint before Phase 28 is marked complete.

2. **deductCredits variable cost API**
   - What we know: `creditService.deductCredits(userId, action, idempotencyKey)` uses `CREDIT_COSTS[action]` for the amount.
   - What's unclear: The cleanest way to pass a variable cost without breaking existing typed callers.
   - Recommendation: Add an optional 4th parameter `costOverride?: number` to `deductCredits()`. If provided, use it instead of `CREDIT_COSTS[action]`. This is backward-compatible.

3. **pdfjs-dist version compatibility with canvas**
   - What we know: pdfjs-dist 5.7.284 is the latest stable. canvas 3.2.3 is the latest.
   - What's unclear: Whether pdfjs-dist 5.x requires specific canvas API versions.
   - Recommendation: Test in a local Node.js environment before plan execution. If incompatible, pin pdfjs-dist to 4.x.

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/036_workout_programs_ai_imports.sql` — ai_imports table schema (16 columns, statuses, MIME CHECK, RLS) — read directly
- `backend/api/src/routes/storage.ts` — signed URL pattern, `ALLOWED_BUCKETS`, path prefix enforcement — read directly
- `backend/api/src/middleware/creditGate.ts` — `creditCheck(action)` / `creditDeduct(action)` implementation — read directly
- `backend/api/src/config/credits.ts` — `CreditAction` type, `CREDIT_COSTS`, `DAILY_QUOTAS` — read directly
- `backend/api/src/config/models.ts` — `VISION_MODEL = anthropic('claude-haiku-4-5-20251001')` — read directly
- `backend/api/src/routes/pantry-recipes.ts` — `generateObject` with Zod schema pattern (Phase 7) — read directly
- `packages/coach-sdk/src/schemas/imported-program.ts` — `ImportedProgramSchema` with per-field confidence on ExerciseSchema — read directly
- `backend/api/src/coach/programs/service.ts` — bounded module pattern, static-before-dynamic route ordering — read directly
- `apps/web/src/components/coach/CoachSidebar.tsx` — NAV_ITEMS pattern, Imports entry to add — read directly
- `plugins/ai-programs/src/manifest.ts` — current routes array, icon naming, showInTabBar pattern — read directly
- `backend/api/src/app.ts` — route mounting pattern for new importsRouter — read directly
- `backend/api/package.json` — confirmed no xlsx/mammoth/pdf parsing libs installed yet — read directly
- `apps/mobile/package.json` — confirmed no expo-document-picker installed yet — read directly
- npm registry: pdfjs-dist@5.7.284, canvas@3.2.3, xlsx@0.18.5, mammoth@1.12.0, expo-document-picker@55.0.13 — `npm view` verified
- slopcheck: all 6 packages passed [OK] — run 2026-05-21

### Secondary (MEDIUM confidence)
- Phase 14 `14-CONTEXT.md` — D-14/D-15/D-16/D-20 signed URL upload pattern; D-23/D-24/D-25 Claude vision with signed URL
- Phase 18 `18-CONTEXT.md` — D-06/D-07 creditService + creditGate architecture

### Tertiary (LOW confidence / ASSUMED)
- pdfjs-dist `legacy/build/pdf.js` import path for Node.js (A1) — confirmed as standard pattern but not verified against pdfjs-dist 5.x docs in this session
- mammoth `convertToMarkdown({ buffer })` buffer API (A2) — consistent with mammoth README pattern
- xlsx `read(buffer, { type: 'buffer' })` API (A3) — SheetJS standard API

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry + slopcheck
- Architecture: HIGH — derived from verified existing code patterns
- PDF rasterization choice: HIGH — `pdf2pic` incompatibility with Vercel verified via `npm view pdf2pic dependencies`
- Credit middleware extension: HIGH — existing code fully read
- Pitfalls: MEDIUM — canvas/Windows pitfall is ASSUMED (not reproduced), others derived from code

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (packages stable; Vercel runtime stable)
