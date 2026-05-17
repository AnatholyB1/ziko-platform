# Phase 25: Invitations & Mobile "Mon coach" Minimal — Research

**Researched:** 2026-05-17
**Domain:** Cross-user link primitive (invitation codes + redemption + revocation) — bounded backend modules + Next.js web UI
**Confidence:** HIGH

## Summary

Phase 25 ships the first cross-user link primitive on top of the Phase 22 RLS keystone. The DB schema (`coach_invitations`, `coach_client_links`), the `is_coach_of()` predicate, and the constant-time `redeem_invitation_code(code_input TEXT)` RPC already exist in migration 035. Phase 25 wraps them with two bounded backend modules (`coach/invitations` and `coach/clients`) and three web surfaces (`/coach/invitations`, `/r/[code]`, `/redeem`). **Mobile work is entirely deferred to a v1.6 seed (CONTEXT D-01).**

All major patterns the executor will need are already present in the codebase:

- Bounded-module shape (`service.ts` / `db.ts` / `types.ts`) — clone from `backend/api/src/coach/identity/`.
- Per-request JWT factory + RLS — `createUserClient(jwt)` in `coach/identity/db.ts`.
- Upstash sliding-window rate-limiting — `backend/api/src/middleware/rateLimiter.ts` already has the exact factory pattern needed and a shared Redis singleton in `backend/api/src/lib/redis.ts`.
- Hono router mount point — `backend/api/src/app.ts` line 54 (`app.route('/coach/identity', identityRouter)`) is the precedent.
- next-intl namespacing — flat top-level keys per surface in `apps/web/messages/{fr,en}.json` (e.g. `Login`, `Onboarding`, `Dashboard`, `Settings`).
- safeNext allowlist — `apps/web/src/actions/login.ts` lines 13-24, a const `NEXT_PARAM_ALLOWLIST` array of literal strings (NOT a regex).
- Coach photo signed URL proxy — `apps/web/src/app/api/photo/route.ts` already proxies `coach-kyc` bucket bytes via a 5-minute signed URL.

**Primary recommendation:** Mirror Phase 24's exact patterns. Add a thin SQL companion function `peek_invitation(code TEXT)` (one new migration after 037) to satisfy D-06 `links/preview` without touching the keystone RPC. Compose the two rate-limiters serially using the existing `createUserRateLimiter` factory pattern + a new IP-keyed counterpart, but normalize their 429 responses to a shared constant-time envelope. Pin nanoid to `^3.3.11` (the only dual ESM/CJS line — see §Q3 below for the v4/v5 reality check).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 6-char code generation | API (Hono) | DB UNIQUE constraint | Code generation needs server-side entropy + retry-on-collision via Postgres unique-violation catch (cannot run in browser; UNIQUE is the safety net) |
| Invitation lifecycle (issue, list, revoke) | API + DB | Web UI (CTA + mutations via Server Action) | RLS gates `coach_invitations` to owning coach (`auth.uid() = coach_id`); UI calls backend; backend uses per-request JWT |
| Code redemption (preview + commit) | DB (`redeem_invitation_code` RPC) | API thin wrapper | Constant-time guarantee LIVES in SQL (single SELECT + CASE chain, migration 035 lines 108–174). Backend cannot reproduce it in TypeScript — must remain in plpgsql |
| Rate limiting | API middleware (Upstash) | — | Composed at route level (IP + user buckets) before the RPC runs; ensures DB is never the throttle |
| Coach preview payload (photo, bio, specialties) | API + Storage (signed URL) | Web Server Component | `coach-kyc` bucket photos require signed URL; reuse `apps/web/src/app/api/photo/route.ts` proxy pattern, or generate signed URL server-side in Server Action |
| Auth gate before preview | Web Server Component | next-intl middleware | `supabase.auth.getUser()` in the Server Component; unauth → redirect to `/{locale}/login?next=<currentPath>` |
| `/r/[code]` deep-link auto-preview | Web Server Component | — | One Server Component reads `params.code` and runs preview; same tree services `/redeem?code=`; state machine in client component child |
| State machine (A → B → C) | Web Client Component | Server Actions for mutations | Mirrors Phase 24's `useActionState` pattern; server-side data fetch on initial render, client-side state for transitions |
| Link revocation | DB (UPDATE policy on `coach_client_links`) | API + Web UI | RLS already allows `auth.uid() = client_id` to UPDATE (migration 035 line 76) — set `revoked_at = now()` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | `^4.7.0` (already installed) | Backend router for new modules | [VERIFIED: backend/api/package.json] Already mounting identity, ai, plugins, etc. via `app.route()` |
| `@upstash/ratelimit` | `^2.0.8` (already installed, latest verified) | Sliding-window rate-limit primitives | [VERIFIED: npm view @upstash/ratelimit version → 2.0.8] Same major version we already use |
| `@upstash/redis` | `^1.37.0` (installed); latest 1.38.0 | Redis REST client (Vercel edge-safe) | [VERIFIED: npm view @upstash/redis version → 1.38.0; backend uses 1.37.0 currently — fine, no upgrade needed for Phase 25] |
| `@supabase/supabase-js` | `^2.50.0` (already installed) | Per-request JWT client in `db.ts` | Pattern already in `coach/identity/db.ts` |
| `@supabase/ssr` | (in apps/web) | Server Component / Server Action client | `apps/web/src/lib/supabase/server.ts` already factored |
| `zod` | `^4.3.6` (already installed) | Schema validation in `coach-sdk` + backend route bodies | Existing schemas in `packages/coach-sdk/src/schemas/` |
| `next-intl` | (in apps/web, version not pinned in this read) | i18n on web | Routing config in `apps/web/src/i18n/routing.ts`; flat-namespace messages in `apps/web/messages/{fr,en}.json` |
| `react-icons/io5` | (in apps/web) | Ionicons for sidebar / states | Phase 24 precedent: `CoachSidebar.tsx` imports from `react-icons/io5` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `nanoid` | `^3.3.11` (recommended, see §Q3) | 6-char code generator with custom alphabet | [VERIFIED: npm view nanoid@3 versions → up to 3.3.12; v3 has `index.cjs` + ESM exports; v4 & v5 are ESM-only with `"type": "module"`] |
| `@hono/zod-validator` | `^0.7.6` (already installed) | Optional: Hono middleware for request body validation | Not currently used elsewhere in coach/; staying with manual `c.req.json()` matches `coach/identity/service.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `nanoid` | `crypto.randomBytes` + manual alphabet mapping | Hand-rolled CSPRNG to alphabet mapping is error-prone (bias if naive); nanoid v3 is 130 LOC, well-audited |
| New SQL `peek_invitation` | `dry_run BOOLEAN` param on existing RPC | Altering the keystone is risky (Phase 22 D-08 was a hard-won design); a separate function is reversible and isolated |
| Compose IP + user buckets in parallel (Promise.all) | Serial: IP first, fail-fast | Serial is simpler, doesn't waste a Redis call when IP is already blown, and the response is the same constant-time shape either way |

**Installation:**

```bash
# In backend/api/
npm install nanoid@^3.3.11
# (@upstash/ratelimit + @upstash/redis already installed)
```

**Version verification (run before planning approves the stack):**

```bash
npm view nanoid@3 version   # confirms latest v3 line (was 3.3.12 on 2026-05-17)
npm view @upstash/ratelimit version   # 2.0.8 verified
npm view @upstash/redis version   # 1.38.0 verified (we're on 1.37.0; both fine)
```

## Architecture Patterns

### System Architecture Diagram (data flow)

```
COACH SIDE
──────────
Coach browser
  │
  ▼  (Server Action via apps/web/src/app/[locale]/(coach)/coach/invitations/page.tsx)
createServerSupabase().auth.getUser() ──► RLS-scoped fetch from /coach/invitations
  │
  ▼  (fetch with Bearer JWT)
Hono backend  /coach/invitations  (POST | GET | DELETE)
  │                authMiddleware (sets c.get('auth'))
  ▼
service.ts ──► db.ts (createUserClient(jwt))
  │                   │
  │                   ▼
  │             generateCode() [nanoid customAlphabet, 3-retry on 23505]
  │                   │
  │                   ▼
  │             INSERT INTO coach_invitations (RLS: auth.uid() = coach_id ✓)
  ▼
JSON response → Web → re-render table

ATHLETE SIDE
────────────
Athlete browser  /r/[code]  OR  /redeem
  │
  ▼  Server Component
createServerSupabase().auth.getUser()
  │
  ├─ Unauthenticated → redirect(`/${locale}/login?next=<currentPath>`)
  │                    (loginAction safeNext allowlist must accept /r/* and /redeem)
  │
  ▼  GET /coach/clients/links/me   (determine State A vs C)
Hono backend ──► db.ts ──► SELECT FROM coach_client_links WHERE client_id = auth.uid()
                                     (filtered to active via isLinkActive timestamp predicate)
  │
  ▼  Initial render with state from server
React tree (State A | B | C)
  │
  ├─ State A: code input
  │     │ submit
  │     ▼  POST /coach/clients/links/preview  { code }
  │  rateLimit middleware (IP bucket → user bucket → continue)
  │  service.ts ──► db.ts.rpc('peek_invitation', { code_input })
  │     │
  │     ├─ ok=true  → returns coach preview payload (display_name, bio,
  │     │             specialties, photo_signed_url, kyc_status)
  │     ▼  Constant-time envelope { ok, link, error_code }
  │
  ├─ State B: preview card + "Lier mon compte"
  │     │ submit
  │     ▼  POST /coach/clients/links/redeem  { code }
  │  rateLimit middleware (same buckets, same key)
  │  service.ts ──► db.ts.rpc('redeem_invitation_code', { code_input })
  │     │  (SECURITY DEFINER, inserts link + increments use_count atomically)
  │     ▼  Same envelope on failure; success returns { link, preview }
  │
  └─ State C: linked banner + revoke
        │ submit (typed-confirm "COACH")
        ▼  DELETE /coach/clients/links/:id
     service.ts ──► db.ts UPDATE coach_client_links SET revoked_at = now()
                          WHERE id = :id AND client_id = auth.uid()
                          (RLS: coach_client_links_participant_revoke ✓)
     Coach loses read access on next request (is_coach_of() returns FALSE)
```

### Recommended Project Structure

```
backend/api/src/
├── coach/
│   ├── identity/          # existing (Phase 24)
│   ├── invitations/       # NEW (Phase 25, coach-owned)
│   │   ├── service.ts     # Hono sub-router + route handlers (public entry)
│   │   ├── db.ts          # createUserClient + generateCode + 3-retry logic (module-internal)
│   │   └── types.ts       # InvitationListItem, GenerateCodePayload (module-internal)
│   └── clients/           # NEW (Phase 25, link primitives)
│       ├── service.ts     # /links/me, /links/preview, /links/redeem, DELETE /links/:id
│       ├── db.ts          # createUserClient + peek/redeem RPC wrappers + link mutations
│       └── types.ts       # LinkPreviewPayload, RedemptionResult, ErrorCode union
├── middleware/
│   ├── rateLimiter.ts     # existing (200/60s IP global + createUserRateLimiter factory)
│   └── (Phase 25 uses the existing factory; no new middleware file unless we factor a route-level
│        composer — see §Pattern 1)
└── app.ts                 # extend with two app.route() calls

apps/web/src/
├── app/[locale]/
│   ├── (coach)/coach/invitations/
│   │   ├── page.tsx                          # Server Component, force-dynamic
│   │   ├── InvitationsClient.tsx             # Client wrapper
│   │   └── actions.ts                        # Server Actions for generate/revoke
│   ├── r/[code]/page.tsx                     # Deep-link entry
│   └── redeem/page.tsx                       # Manual entry + state-machine host
├── components/coach/
│   ├── (existing: WelcomeCard, KycStatusChip, etc.)
│   ├── InvitationCodeCard.tsx                # NEW
│   ├── GeneratePanel.tsx                     # NEW
│   ├── InvitationsTable.tsx                  # NEW
│   ├── ExpirationChipGroup.tsx               # NEW
│   ├── FilterChipGroup.tsx                   # NEW
│   ├── CoachPreviewCard.tsx                  # NEW (shared State B + C)
│   ├── CodeInput.tsx                         # NEW
│   ├── RedeemStateMachine.tsx                # NEW
│   ├── RevokeConfirmModal.tsx                # NEW (shared coach + athlete)
│   └── CoachSidebar.tsx                      # EXTEND (flip Invitations disabled, add IoMailOutline)
└── actions/
    └── login.ts                              # EXTEND NEXT_PARAM_ALLOWLIST

supabase/migrations/
└── 038_peek_invitation_function.sql          # NEW (peek_invitation companion to keystone RPC)

packages/coach-sdk/src/schemas/
├── coach-invitation.ts                       # NEW (CoachInvitationSchema, ComputedStatus enum)
├── coach-link-preview.ts                     # NEW (CoachLinkPreviewSchema)
└── index.ts                                  # EXTEND barrel
```

### Pattern 1: Bounded module (`service.ts` / `db.ts` / `types.ts`)

**What:** ARCH-01/02/03 — only `service.ts` is imported by `app.ts`; `db.ts` and `types.ts` are module-internal; `db.ts` uses per-request JWT (`createUserClient`), never `SUPABASE_SERVICE_KEY`.

**When to use:** Every new backend bounded context under `coach/`.

**Example:** Identity service.ts is the canonical shape. The CI grep ARCH-02 enforces no `SERVICE_KEY` under `coach/`. Tag: [VERIFIED: backend/api/src/coach/identity/service.ts + Phase 24 D-08 + Phase 23 D-12]

### Pattern 2: Per-request Supabase client with JWT

```ts
// db.ts — already proven in coach/identity/db.ts
import { createClient } from '@supabase/supabase-js';
export function createUserClient(jwt: string) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    }
  );
}
```

Route handler grabs jwt with `c.req.header('Authorization')!.slice(7)` after `authMiddleware`. [VERIFIED: coach/identity/db.ts]

### Pattern 3: Composed rate-limit middleware (route-scoped)

**What:** Compose IP bucket + user bucket in serial order with a normalized constant-time error envelope. Reuse the existing `redis` singleton.

**When to use:** Apply only to `/coach/clients/links/preview` and `/coach/clients/links/redeem`. Coach routes (`/coach/invitations/*`) inherit the global 200/60s IP limiter only.

**Example shape** (sketch — planner can adapt to the bounded module's `service.ts`):

```ts
// In backend/api/src/coach/clients/service.ts (or a small local helper)
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../../lib/redis.js';
import type { Context, Next } from 'hono';

const ipBucket   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '15 m'), prefix: 'rl:redeem:ip' });
const userBucket = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 m'), prefix: 'rl:redeem:user' });

const CONSTANT_TIME_ENVELOPE = { ok: false, link: null, error_code: 'INVALID_OR_EXPIRED' as const };

async function redemptionRateLimit(c: Context, next: Next) {
  const ip = c.req.header('x-real-ip')
    ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
  // IP first (fail-fast: doesn't burn a user-bucket call if IP is already blown)
  const ipResult = await ipBucket.limit(ip);
  if (!ipResult.success) {
    c.header('Retry-After', String(Math.ceil((ipResult.reset - Date.now()) / 1000)));
    return c.json(CONSTANT_TIME_ENVELOPE, 429);
  }
  const userId = c.get('auth')?.userId;
  if (userId) {
    const userResult = await userBucket.limit(userId);
    if (!userResult.success) {
      c.header('Retry-After', String(Math.ceil((userResult.reset - Date.now()) / 1000)));
      return c.json(CONSTANT_TIME_ENVELOPE, 429);
    }
  }
  return next();
}

router.post('/links/preview', authMiddleware, redemptionRateLimit, async (c) => { /* ... */ });
router.post('/links/redeem',  authMiddleware, redemptionRateLimit, async (c) => { /* ... */ });
```

Notes:
- Apply `authMiddleware` BEFORE the limiter (we need `c.get('auth').userId` to key the user bucket).
- The 429 body is **byte-for-byte identical** to the 200 error body (same `error_code`, same shape). Only HTTP status differs. See §Q4 below for the wire-format decision.
- Source: existing `backend/api/src/middleware/rateLimiter.ts` lines 6-10 (sliding window pattern) + lines 60-83 (per-user factory). [VERIFIED: codebase]

### Pattern 4: Constant-time error envelope (HTTP 200 with `ok: false`)

**Recommended wire format** for `/links/preview` and `/links/redeem`:

```
HTTP 200 (always, except 429 / 401)
Content-Type: application/json
{ "ok": false, "link": null, "error_code": "INVALID_OR_EXPIRED" }
```

The RPC `redeem_invitation_code` already returns `jsonb_build_object('ok', false, 'link_id', NULL, 'error_code', v_error)` (migration 035 line 158). The backend wrapper should:

1. **Collapse all DB error codes to `INVALID_OR_EXPIRED`** before returning to the client. The DB returns 6 distinct codes (`INVALID_CODE`, `EXPIRED`, `REVOKED`, `ALREADY_USED`, `SELF_INVITATION`, `LINK_EXISTS`) for internal logging/observability, but the public envelope must collapse them. Log the original code to `console.warn` for ops, but ship only `INVALID_OR_EXPIRED` to the wire. (Constant-time principle: a successful preview also reveals "coach exists with this code"; the only way to keep enumeration costs flat is to expose no per-cause distinction.)
2. **Return HTTP 200, not 4xx.** Rationale: 4xx + body differs in headers / status from 200 + body, which leaks information through CDN logs and curl-able timing. 200 + `{ ok: false }` keeps the response *exactly* the same shape on all paths. The exception is 429 (which is already covered by the rate-limit envelope above — and we ensure THAT envelope is identical-shape too).
3. **401 is fine to differ** — the auth gate is server-side at the Server Component layer (D-15), so unauthenticated requests never reach the backend.

Why 200 over 4xx: Phase 22 D-08 explicitly chose RPC return-shape over RAISE to avoid HTTP-status-based discrimination. The wrapper must preserve that property.

### Pattern 5: nanoid + 3-retry on Postgres UNIQUE violation

```ts
// db.ts
import { customAlphabet } from 'nanoid';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'; // matches DB CHECK '^[A-Z2-9]{6}$'
const generate = customAlphabet(ALPHABET, 6);

export async function insertInvitation(jwt: string, coachId: string, expiresAt: string | null) {
  const db = createUserClient(jwt);
  const MAX_RETRIES = 3;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generate();
    const { data, error } = await db
      .from('coach_invitations')
      .insert({ coach_id: coachId, code, expires_at: expiresAt })
      .select()
      .single();
    if (!error) return data;
    // 23505 = unique_violation in Postgres; surfaced as PGRST code or pgError.code
    if ((error as { code?: string }).code === '23505') {
      lastError = error;
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error(`Failed to generate unique code after ${MAX_RETRIES} attempts: ${String(lastError)}`);
}
```

**Birthday collision math:** With a 6-char alphabet of 34 symbols, the namespace is 34⁶ ≈ 1.54 billion. At 10 000 active codes per coach population, collision probability per insert ≈ 10⁴ / 1.54×10⁹ ≈ 6.5×10⁻⁶. 3 retries handle this with margin of safety > 10 orders of magnitude. [VERIFIED: pigeonhole calculation]

### Pattern 6: next-intl namespace structure

**Confirmed shape** (from `apps/web/messages/fr.json`): each top-level key is a flat namespace (`Login`, `Onboarding`, `Dashboard`, `Settings`, `KycStatus`, `Upload`, `Plugins`, etc.). Components consume via `useTranslations('Login')` (client) or `getTranslations({ locale, namespace: 'Metadata' })` (server). [VERIFIED: apps/web/src/components/layout/Footer.tsx, apps/web/src/components/layout/Header.tsx, marketing pages]

**Phase 25 namespace additions** (matches D-19):

```json
// apps/web/messages/fr.json — append top-level keys
{
  "CoachInvitations": {
    "title": "Invitations",
    "generateCta": "Générer un code",
    "panelSubmit": "Générer",
    "copyCode": "Copier le code",
    "copyLink": "Copier le lien",
    "expiration": { "7d": "7j", "14d": "14j", "30d": "30j", "never": "Sans expiration" },
    "expiresOn": "Expire le {date}",
    "noExpiry": "Sans expiration",
    "filter": { "active": "Actives", "all": "Toutes" },
    "table": { "code": "Code", "createdAt": "Créé le", "expiresAt": "Expire le", "status": "Statut", "actions": "Actions" },
    "status": { "active": "Actif", "used": "Utilisé", "expired": "Expiré", "revoked": "Révoqué" },
    "revokeCta": "Révoquer",
    "revokeModal": { "title": "Révoquer cette invitation ?", "body": "Ce code sera immédiatement désactivé et ne pourra plus être utilisé par aucun athlète.", "confirmLabel": "Tapez \"COACH\" pour confirmer", "confirmCta": "Révoquer" },
    "emptyHeading": "Aucun code généré",
    "emptyBody": "Générez votre premier code d'invitation et partagez-le avec un athlète."
  },
  "CoachRedeem": {
    "stateA": { "heading": "Rejoignez votre coach", "body": "Entrez le code de 6 caractères fourni par votre coach.", "submit": "Valider" },
    "stateB": { "back": "← Entrer un autre code", "link": "Lier mon compte", "cancel": "Annuler" },
    "stateC": { "banner": "Vous êtes lié à {displayName} depuis le {date}", "revoke": "Retirer ce coach" },
    "kyc": { "verified": "Vérifié", "pending": "En attente" },
    "bioMore": "Voir plus",
    "bioLess": "Voir moins",
    "successToast": "Vous êtes maintenant lié à {displayName}.",
    "revokeModal": { "title": "Retirer ce coach ?", "body": "{displayName} perdra immédiatement l'accès en lecture à vos données.", "confirmLabel": "Tapez \"COACH\" pour confirmer", "confirmCta": "Retirer" },
    "errors": { "invalidOrExpired": "Ce code n'est pas valide ou a expiré.", "rateLimited": "Trop de tentatives. Réessayez dans quelques minutes." }
  },
  "Sidebar": {
    "invitations": "Invitations"
  }
}
```

**Important:** All error causes collapse to a single key `CoachRedeem.errors.invalidOrExpired` (D-19 constant-time guarantee survives translation). Only `rateLimited` gets a distinct key because 429 is observable from the HTTP layer regardless.

Mirror the same structure in `apps/web/messages/en.json` with English copy.

### Pattern 7: safeNext allowlist extension (D-15)

**Current state** (`apps/web/src/actions/login.ts` lines 13-24):

```ts
const NEXT_PARAM_ALLOWLIST = [
  '/coach/onboarding',
  '/coach/dashboard',
  '/coach/settings',
] as const;

function safeNext(next: string | null): string {
  if (next && NEXT_PARAM_ALLOWLIST.includes(next as typeof NEXT_PARAM_ALLOWLIST[number])) {
    return next;
  }
  return '/coach/dashboard';
}
```

**Problem for Phase 25:** The allowlist uses **exact string equality** on a `readonly` literal-tuple. Adding `/redeem` is trivial (one new literal). Adding `/r/[code]` is harder because the URL contains a dynamic segment — the actual incoming `next` value is `/r/ZK4F2A` (concrete code), not `/r/[code]`.

**Recommended patch shape** (planner specifies the exact diff):

```ts
const NEXT_PARAM_ALLOWLIST = [
  '/coach/onboarding',
  '/coach/dashboard',
  '/coach/settings',
  '/redeem',
] as const;

// Regex for dynamic short deep-links: /r/<6 chars from [A-Z2-9]>
const REDEEM_DEEPLINK_RE = /^\/r\/[A-Z2-9]{6}$/;

function safeNext(next: string | null): string {
  if (!next) return '/coach/dashboard';
  if (NEXT_PARAM_ALLOWLIST.includes(next as typeof NEXT_PARAM_ALLOWLIST[number])) return next;
  if (REDEEM_DEEPLINK_RE.test(next)) return next;
  return '/coach/dashboard';
}
```

The regex anchors `^` and `$` and matches the exact DB CHECK alphabet `[A-Z2-9]{6}` — prevents `https://evil.com/r/AAAAAA` (no leading `/`), `/r/aaaaaa` (lowercase), `/r/ABCDEF7` (7 chars), `/r/../admin` (path traversal). The same redirect behavior in `loginAction` returns `redirectTo` to the client; the client prepends the locale prefix. Note that the loginAction's role-aware fallback at line 65 also needs reconsidering — currently coaches who land via `?next=/r/CODE` would get redirected to `/coach/dashboard` by the `redirectTo === '/coach/onboarding'` check. For Phase 25, `/r/*` and `/redeem` are *athlete* surfaces, so a coach landing there is unusual but not wrong — they're potentially also a `role='both'` user. Keep the existing role-aware logic, just let safeNext pass these new shapes through.

### Pattern 8: CoachSidebar nav extension (D-10)

**Current state** (`apps/web/src/components/coach/CoachSidebar.tsx` lines 11-17):

```ts
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/fr/coach/dashboard', icon: IoGridOutline, disabled: false },
  { label: 'Clients', href: '/fr/coach/clients', icon: IoPeopleOutline, disabled: true },
  { label: 'Programmes', href: '/fr/coach/programs', icon: IoBarChartOutline, disabled: true },
  { label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: true },
  { label: 'Paramètres', href: '/fr/coach/settings', icon: IoSettingsOutline, disabled: false },
];
```

**Phase 25 patch:** insert a new entry after `Clients` (index 2) — the UI-SPEC §Sidebar nav specifies position-after-Clients with `IoMailOutline`. There's no pre-existing "Invitations" placeholder (CONTEXT mentions one from Phase 24 D-09, but the actual `CoachSidebar.tsx` I read does not contain it — researcher flags this as a CONTEXT/codebase discrepancy; planner should verify with `git log -p` whether the placeholder was removed during Phase 24 GAP fixes).

```ts
import { IoMailOutline /* ...existing */ } from 'react-icons/io5';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/fr/coach/dashboard', icon: IoGridOutline, disabled: false },
  { label: 'Clients', href: '/fr/coach/clients', icon: IoPeopleOutline, disabled: true },
  { label: 'Invitations', href: '/fr/coach/invitations', icon: IoMailOutline, disabled: false }, // NEW
  { label: 'Programmes', href: '/fr/coach/programs', icon: IoBarChartOutline, disabled: true },
  { label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: true },
  { label: 'Paramètres', href: '/fr/coach/settings', icon: IoSettingsOutline, disabled: false },
];
```

The hardcoded `/fr/` prefix is a Phase 24 limitation (i18n locale-aware nav not yet implemented). Keep matching the existing pattern; Phase 26+ may refactor to use next-intl's `Link` component.

### Pattern 9: Hono router mounting (D-04)

**Confirmed mount point:** `backend/api/src/app.ts` line 54.

```ts
// Existing line 54:
app.route('/coach/identity', identityRouter);

// Add (Phase 25):
import { invitationsRouter } from './coach/invitations/service.js';
import { clientsRouter } from './coach/clients/service.js';
app.route('/coach/invitations', invitationsRouter);
app.route('/coach/clients', clientsRouter);
```

Note the `.js` suffix: NodeNext module resolution requires it even when importing `.ts` source. Pattern matches `coach/identity` (`./coach/identity/service.js` at line 13). [VERIFIED: backend/api/src/app.ts]

### Anti-Patterns to Avoid

- **Don't add SERVICE_KEY to coach/ modules.** ARCH-02 CI guard fails the build. Use `createUserClient(jwt)` per-request. [VERIFIED: Phase 23 D-12]
- **Don't bypass the keystone RPC.** Implementing the redemption state checks in TypeScript reads `coach_invitations` directly and breaks the constant-time guarantee (TS branches have wildly different timings). [VERIFIED: Phase 22 D-08]
- **Don't return distinct HTTP statuses for the 6 RPC error codes.** Even `404 INVALID_CODE` vs `409 LINK_EXISTS` leaks enumeration signal. Stay HTTP 200 + envelope.
- **Don't compose rate limits via `Promise.all`.** Burns user-bucket quota when IP is already blown; serial fail-fast is correct.
- **Don't use `setTimeout` / fixed-delay padding to "make things constant-time".** The DB RPC is already constant-time; piling on artificial delay adds attack surface (variable-rate adversary can still differentiate).
- **Don't proxy the photo URL through the client.** Use the existing `/api/photo?path=<path>` proxy (`apps/web/src/app/api/photo/route.ts`) or generate a signed URL server-side and pass it to the Server Component. Both keep the bucket private.
- **Don't fork `redeem_invitation_code` to add `dry_run`.** Creating a tiny companion `peek_invitation(code)` keeps the keystone untouched and reversible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 6-char unique-ish code | Custom `Math.random()` + alphabet loop | `nanoid` `customAlphabet(ALPHABET, 6)` | `Math.random()` is not cryptographic; biased mapping `% alphabet.length` skews distribution |
| Sliding-window rate limit | Custom Redis sorted-set with TTL | `@upstash/ratelimit` `Ratelimit.slidingWindow()` | Already installed, identical to `rateLimiter.ts` precedent; sliding-window math is subtle |
| Constant-time invitation lookup | TypeScript switch over invitation states | `redeem_invitation_code()` + `peek_invitation()` plpgsql | Single SELECT + CASE chain in SQL is the only way to keep CPU work flat; TS adds branch-prediction variance |
| Signed URL for coach photo | Storing a `photoUrl` directly + hoping it's signed | `supabase.storage.from('coach-kyc').createSignedUrl(path, 300)` or proxy via `/api/photo` | Bucket is private; direct URLs leak / expire |
| Modal focus trap | Custom keydown handler | Build small bespoke trap (no library available in apps/web today) — OR import `react-focus-lock` | UI-SPEC line 165 declares "max-w-md w-full" modal; current codebase doesn't ship a focus-trap library yet — planner decision |
| i18n key registration | Per-component hardcoded strings | `next-intl` namespaces in `apps/web/messages/{fr,en}.json` | Pattern established Phase 23; "Login" / "Onboarding" / "Settings" are all top-level namespaces |
| Code-uniqueness retry loop | Try / hope; or retry without bound | bounded 3-retry on PG `code === '23505'` | Birthday math says > 10⁻⁶ per insert; 3 retries handle 10⁻¹⁸ failure rate |

**Key insight:** Phase 25 is almost entirely *plumbing* on top of existing primitives. Every non-trivial concern (RLS, constant-time RPC, rate-limit math, signed URLs, i18n, bounded modules) already has codebase precedent. The temptation to reinvent any of these should be aggressively resisted.

## Runtime State Inventory

> Phase 25 is an additive feature, not a rename/refactor/migration. Skipped per Step 2.5 condition.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`tsx` dev) | Backend dev server | ✓ (existing) | as per project | — |
| `@upstash/ratelimit` | Rate limiting | ✓ | 2.0.8 (installed) | — |
| `@upstash/redis` | Rate-limit storage | ✓ | 1.37.0 (installed) | — |
| Upstash Redis instance | Live rate limiting | Assumed yes (Phase 24 already uses it) | — | Local: `ratelimit.ts` web fallback shows no-op pattern. Backend `lib/redis.ts` does NOT have a fallback — env vars MUST be present in Vercel & local |
| `UPSTASH_REDIS_REST_URL` env var | Redis client | Documented in `.env.example` line 7 | — | None — module load throws if absent (verified: `redis.ts` uses `process.env.X!`) |
| `UPSTASH_REDIS_REST_TOKEN` env var | Redis client | Documented in `.env.example` line 8 | — | Same as above |
| `nanoid` | Code generation | ✗ NOT INSTALLED | needs `^3.3.11` | None — must install |
| `SUPABASE_PUBLISHABLE_KEY` | Per-request JWT client | ✓ env documented | — | — |
| `coach-kyc` storage bucket | Coach preview photo | ✓ (Phase 24 migration 037) | — | — |
| `@supabase/ssr` | Web Server Component auth | ✓ (Phase 23) | — | — |

**Missing dependencies with no fallback:**
- `nanoid` — must be installed; pin `^3.3.11`.

**Missing dependencies with fallback:**
- None.

**Vercel env var check (D-07 follow-up):** `backend/api/vercel.json` does NOT declare env vars (they live in the Vercel project dashboard). Planner should add a verification task: confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in the Vercel project for the `ziko-api-lilac` deployment (Phase 24 already uses Upstash, so they should be present — verify before relying).

## Common Pitfalls

### Pitfall 1: Leaking error-cause through 4xx status codes
**What goes wrong:** Returning 404 for `INVALID_CODE` and 409 for `LINK_EXISTS` lets an attacker enumerate valid codes by status alone, even with constant-time RPC.
**Why it happens:** Default HTTP-status-conscious API design.
**How to avoid:** All RPC failure paths return HTTP 200 + `{ ok: false, error_code: 'INVALID_OR_EXPIRED' }`. Only 429 (rate limit) and 401 (no JWT) differ.
**Warning signs:** Distinct status codes per error in route handler; distinct response bodies per error code.

### Pitfall 2: Forgetting to apply `authMiddleware` before the rate-limit middleware
**What goes wrong:** User-bucket key needs `c.get('auth').userId`; without auth-first, the key is `undefined` and all anonymous requests share one bucket (or throw).
**Why it happens:** Middleware order in Hono is execution order; easy to put rate-limit first "for performance".
**How to avoid:** Always: `router.post('/path', authMiddleware, redemptionRateLimit, handler)`.
**Warning signs:** Tests pass for unauthenticated callers; failing tests for valid users sharing a bucket.

### Pitfall 3: `useActionState` + `redirect()` swallow navigation
**What goes wrong:** Server Actions used with `useActionState` catch the internal redirect throw and never navigate.
**Why it happens:** React 19 useActionState wraps the action in a try/catch.
**How to avoid:** Return `{ status: 'success', redirectTo }` and let a client `useEffect` call `router.push`. Pattern already in `apps/web/src/app/[locale]/login/LoginForm.tsx` lines 21-25.
**Warning signs:** "Successful" form submission with no navigation; CONTEXT.md and existing login.ts mention this as "RESEARCH Pitfall 6" of Phase 23.

### Pitfall 4: Module-load-time Redis crash when env vars missing
**What goes wrong:** `backend/api/src/lib/redis.ts` uses `process.env.X!` at module top-level. If env var is missing, every route 500s.
**Why it happens:** Eager singleton initialization; non-null assertion.
**How to avoid:** Either keep the eager pattern (and verify env in CI/deploy) or mirror the lazy pattern from `apps/web/src/lib/ratelimit.ts` (lazy singleton + no-op fallback).
**Warning signs:** API health check 500s in staging; "Failed to parse URL from /pipeline" in logs (see `apps/web/src/lib/ratelimit.ts` comment, lines 4-7).

### Pitfall 5: Treating `coach_client_links` link "status" as a stored column
**What goes wrong:** Adding a `status` enum column or filtering on `WHERE status = 'active'`.
**Why it happens:** Common DB modeling instinct.
**How to avoid:** Phase 22 D-01 explicitly chose **timestamp predicate**: `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`. The helper `isLinkActive(link, now)` in `packages/coach-sdk/src/schemas/coach-client-link.ts` is the canonical client predicate. Compute status from timestamps everywhere.
**Warning signs:** Migration adding `status TEXT` to `coach_client_links` or `coach_invitations`.

### Pitfall 6: One-shot generated-code card persisting across navigations
**What goes wrong:** Storing the freshly-generated code in client state survives route changes and keeps showing the "new code" banner.
**Why it happens:** Persistent client store (Zustand-like) or URL state.
**How to avoid:** Per UI-SPEC line 123, the card lives only in the immediate response render. Use React state local to the page; do NOT store in URL or in any global store. Re-navigating naturally drops the state.
**Warning signs:** Code card visible after user clicks away to another sidebar item and back.

### Pitfall 7: Coach preview signed URL expiring mid-render
**What goes wrong:** Signed URL is generated server-side at request time (5-min window), but a slow client render past expiration shows broken image.
**Why it happens:** 5 minutes is short; image lazy-loading can delay request.
**How to avoid:** Prefer the existing proxy approach (`/api/photo?path=<path>`) which re-signs per request. The Server Component passes the bucket path (not the signed URL) to the client, and `<img src="/api/photo?path=..." />` resigns each load.
**Warning signs:** Intermittent broken coach avatars on State B / C.

### Pitfall 8: Birthday collision attack on small alphabet
**What goes wrong:** 34⁶ ≈ 1.54B is large but not gigantic. At hyper-scale (millions of active codes), retries grow.
**Why it happens:** Conservative alphabet choice (avoiding `0/O/1/I/L`).
**How to avoid:** 3-retry bound is correct for current scale. Add an alert / monitoring task if `lastError` after 3 retries ever happens in production (means alphabet exhausted — Phase 26+ would switch to 7 or 8 chars).
**Warning signs:** Server logs showing "Failed to generate unique code after 3 attempts" — at v1.5 traffic this should be zero.

### Pitfall 9: ESM/CJS interop confusion with nanoid
**What goes wrong:** Installing `nanoid` (defaults to v5, ESM-only) and getting `ERR_REQUIRE_ESM` from production build.
**Why it happens:** `npm install nanoid` ships v5; backend tsconfig is NodeNext (technically supports ESM) but package.json has no `"type": "module"` → ambiguous.
**How to avoid:** Pin explicitly: `npm install nanoid@^3.3.11`. v3.3.x ships dual `index.cjs` + ESM exports field. (See §Q3 for the full reasoning — CONTEXT.md says v4, but v4 is also pure-ESM; v3.3.x is the truly dual-mode line.)
**Warning signs:** `Error [ERR_REQUIRE_ESM]: require() of ES Module ...nanoid/index.js` at boot.

### Pitfall 10: `next-intl` lazy import of messages
**What goes wrong:** `i18n/request.ts` uses `import('../../messages/${locale}.json')` — if new namespaces are added but the JSON files are not, the imports succeed but `useTranslations('CoachInvitations')` throws "MISSING_MESSAGE".
**Why it happens:** Adding keys to one locale and forgetting the other.
**How to avoid:** Always add to both `fr.json` AND `en.json` in the same commit. Consider a JSON-schema-validation task in Wave 0 of the plan.
**Warning signs:** EN locale shows "MISSING_MESSAGE: CoachInvitations.title" while FR works.

## Code Examples

### Example: `peek_invitation` companion function (new migration 038)

```sql
-- Source: pattern derived from supabase/migrations/035_coach_invitations_links_rls.sql lines 108-174
-- Same constant-time semantics; same error code set; does NOT mutate state.
CREATE OR REPLACE FUNCTION public.peek_invitation(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv       RECORD;
  v_error     TEXT := NULL;
BEGIN
  SELECT
    inv.id            AS id,
    inv.coach_id      AS coach_id,
    inv.expires_at    AS expires_at,
    inv.revoked_at    AS revoked_at,
    inv.use_count     AS use_count,
    inv.max_uses      AS max_uses,
    EXISTS (
      SELECT 1 FROM public.coach_client_links l
      WHERE l.coach_id = inv.coach_id
        AND l.client_id = v_caller_id
        AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > now())
    )                  AS link_exists,
    cp.display_name   AS display_name,
    cp.bio            AS bio,
    cp.specialties    AS specialties,
    cp.photo_url      AS photo_url,
    cp.kyc_status     AS kyc_status
  INTO v_inv
  FROM public.coach_invitations inv
  LEFT JOIN public.coach_profiles cp ON cp.user_id = inv.coach_id
  WHERE inv.code = code_input
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    v_error := 'INVALID_CODE';
  ELSIF v_inv.coach_id = v_caller_id THEN
    v_error := 'SELF_INVITATION';
  ELSIF v_inv.revoked_at IS NOT NULL THEN
    v_error := 'REVOKED';
  ELSIF v_inv.expires_at <= now() THEN
    v_error := 'EXPIRED';
  ELSIF v_inv.use_count >= v_inv.max_uses THEN
    v_error := 'ALREADY_USED';
  ELSIF v_inv.link_exists THEN
    v_error := 'LINK_EXISTS';
  END IF;

  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'preview', NULL, 'error_code', v_error);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'error_code', NULL,
    'preview', jsonb_build_object(
      'coach_id', v_inv.coach_id,
      'display_name', v_inv.display_name,
      'bio', v_inv.bio,
      'specialties', v_inv.specialties,
      'photo_url', v_inv.photo_url,  -- bucket path; backend signs before responding
      'kyc_status', v_inv.kyc_status
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peek_invitation(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.peek_invitation(TEXT) TO authenticated;
```

Notes:
- Mirrors the keystone RPC's structure (single SELECT, single CASE chain) to inherit its constant-time properties.
- Includes the `coach_profiles` LEFT JOIN so the happy path returns the preview payload in one round-trip.
- Returns the **bucket path** in `photo_url`, not a signed URL — backend signs (or uses `/api/photo` proxy) before shipping to the client.
- Same error-code enum as the keystone — backend wrapper collapses to `INVALID_OR_EXPIRED` regardless of which fired.

### Example: invitations service.ts skeleton

```ts
// backend/api/src/coach/invitations/service.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import * as inv from './db.js';
import type { ComputedStatus } from './types.js';

export const invitationsRouter = new Hono();
invitationsRouter.use('*', authMiddleware);

// POST /coach/invitations — body { expires_at: ISOString | null }
invitationsRouter.post('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  let body: { expires_at: string | null };
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  try {
    const row = await inv.insertInvitation(jwt, userId, body.expires_at);
    return c.json(row, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /coach/invitations?status=active|used|expired|revoked|all
invitationsRouter.get('/', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const status = (c.req.query('status') ?? 'active') as ComputedStatus | 'all';
  try {
    const rows = await inv.listInvitations(jwt, userId, status);
    return c.json(rows);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// DELETE /coach/invitations/:id — idempotent (re-revoke = no-op)
invitationsRouter.delete('/:id', async (c) => {
  const { userId } = c.get('auth');
  const jwt = c.req.header('Authorization')!.slice(7);
  const id = c.req.param('id');
  try {
    await inv.revokeInvitation(jwt, userId, id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
```

### Example: computed status helper

```ts
// backend/api/src/coach/invitations/types.ts
export type ComputedStatus = 'active' | 'used' | 'expired' | 'revoked';

export function computeStatus(row: {
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  use_count: number;
  max_uses: number;
}, now: Date = new Date()): ComputedStatus {
  if (row.revoked_at !== null) return 'revoked';
  if (row.use_count >= row.max_uses) return 'used';
  if (new Date(row.expires_at) <= now) return 'expired';
  return 'active';
}
```

Mirror `isLinkActive(link)` from `packages/coach-sdk/src/schemas/coach-client-link.ts`. [VERIFIED: codebase]

### Example: web Server Component for `/r/[code]` (state-machine host)

```tsx
// apps/web/src/app/[locale]/r/[code]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { RedeemStateMachine } from '@/components/coach/RedeemStateMachine';

export default async function RedeemDeepLink({ params }: { params: { code: string } }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const locale = await getLocale();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/r/${params.code}`)}`);
  }
  // Server-side: fetch current active link (drives State C vs A/B initial render)
  // Match the existing pattern: fetch via Server Action OR direct call to backend /coach/clients/links/me
  // (Server-side fetch with the user's cookie, NOT a hardcoded server-to-server JWT.)
  return <RedeemStateMachine initialCode={params.code.toUpperCase()} />;
}
```

The `/redeem` page is the same skeleton without `params.code` (it starts in State A or C).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nanoid v3 (dual) | nanoid v4 (ESM) → v5 (ESM) | v4 published 2023, v5 latest 2025+ | For CJS / NodeNext-without-`type:module` codebases, **stick with v3.3.x** |
| 4xx-per-cause error codes | HTTP 200 + `{ ok, error_code }` envelope | Phase 22 D-08 (constant-time RPC requirement) | Required for enumeration-resistant invitation flow |
| Status enum column | Timestamp-predicate computation | Phase 22 D-01 | Eliminates "stale status row" class of bugs; `isLinkActive()` is canonical |
| Direct `@supabase/supabase-js` in app code | `@supabase/ssr` factories | Phase 23 D-11 | ESLint ban enforces it |
| Hand-rolled rate limit Redis logic | `@upstash/ratelimit` sliding window | Phase 12 + Phase 18 reuse | Already proven in existing `rateLimiter.ts` |

**Deprecated/outdated:**
- nanoid v2: requires `crypto-secure` polyfill; replaced by v3.
- `findLast` polyfill: per existing CLAUDE.md "Known Bugs Fixed", project is on ES2016 target for mobile — but backend tsconfig is ES2022, so `findLast` is available in `backend/api/src/`. Phase 25 backend can use modern array methods freely.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UPSTASH env vars are present in production Vercel project | Environment Availability | Backend boots 500s on Phase 25 deploy until env is fixed (high impact, easy to verify; planner should add a verify task) |
| A2 | "Bientôt" Invitations placeholder no longer exists in CoachSidebar.tsx (file I read does not contain it) | Pattern 8 / Sidebar nav | Planner inserts new entry at index 2 — if placeholder exists in another commit / branch, the patch becomes a flip-not-insert. Low risk; planner verifies. |
| A3 | `apps/web` has no focus-trap library installed | Don't Hand-Roll table | Modal accessibility (UI-SPEC §Accessibility) needs focus-trap — if no library, planner must choose (bespoke vs. install `react-focus-lock`) |
| A4 | Birthday-collision math at v1.5 scale supports 3-retry bound | Pattern 5 + Pitfall 8 | At 10× expected scale, 3 retries still suffice; only Phase 26+ adversarial fill could exhaust |
| A5 | Constant-time is preserved by collapsing 6 RPC error codes to one wire-level code | Pattern 4 + Q4 | If observability needs distinct codes, plan a server-side log emit alongside the collapsed wire envelope |
| A6 | `redeem_invitation_code` correctly handles `auth.uid()` being NULL (unauth caller) | Q2 + Q4 | Backend always runs `authMiddleware` first, so `auth.uid()` is set in DB session via the JWT — but the RPC's SELF_INVITATION check (`v_inv.coach_id = v_caller_id`) silently treats NULL as "not equal" and would skip to the next branch. Confirmed by Phase 22 tests presumably; researcher hasn't re-run the test suite. Low risk; tests in `backend/api/test/rls/redeem-rpc.spec.ts` exist and presumably cover this. |
| A7 | `peek_invitation` SQL function (proposed in Pattern §peek_invitation) inherits the keystone's constant-time properties | Q2 + Code Examples | Needs validation: planner should add a timing test analogous to whatever exists for `redeem_invitation_code` in `test/rls/redeem-rpc.spec.ts` |
| A8 | next-intl `messages/{fr,en}.json` files won't hit a build limit when new namespaces are added | Pattern 6 | Both files are 163 lines today; adding ~100 lines is trivial. No risk. |

## Open Questions

### Q1 — UPSTASH composition: serial vs parallel; single Redis client reuse?

**Answer:** Serial, fail-fast on IP first, then user bucket. Reuse the existing `redis` singleton from `backend/api/src/lib/redis.ts` (do NOT instantiate a new `Redis()`). The two `Ratelimit` instances live as module-level constants in the limiter middleware closure (cheap to construct, identifies-as-singleton in practice).

Production-ready snippet shown in §Pattern 3 above. Confidence: HIGH (mirrors existing pattern in `backend/api/src/middleware/rateLimiter.ts` lines 59-83 + 1-10).

### Q2 — Peek vs dry-run for `/coach/clients/links/preview`?

**Recommendation: Option A — new `peek_invitation(code TEXT)` SQL function in migration 038.**

Why:
- **Option A (new function)** keeps the Phase 22 keystone RPC untouched. Per Phase 22 D-08 commentary in CONTEXT.md, the RPC was hard-won and represents the constant-time security boundary. Adding a separate SECURITY DEFINER function mirroring its CASE chain is safer than mutating the original. The new function is purely additive and reversible.
- **Option B (`dry_run` param)** requires altering the existing RPC. Even with a default `FALSE`, parameter changes to SECURITY DEFINER functions are deploy-sensitive (existing GRANTs may need re-application; clients calling with positional args would break — though `code_input` is named). Higher risk for marginal benefit.
- **Option C (TypeScript validation)** is out — direct reads from `coach_invitations` happen under RLS that scopes to `auth.uid() = coach_id`, so an athlete cannot SELECT invitations from other coaches at all. Even if RLS were loosened, the TypeScript branch differential breaks constant-time.

Implementation in Code Examples §`peek_invitation` above. Confidence: HIGH.

### Q3 — nanoid CJS retry pattern?

**Reality check:** CONTEXT.md D-08 says "use nanoid v4 (CJS-compatible) if needed". This is **incorrect** — nanoid v4 is *also* ESM-only (latest 4.0.2, all releases tagged `"type": "module"`). The only nanoid version line that ships dual CJS+ESM is **v3.3.x** (latest 3.3.12; ships `index.cjs` alongside an ESM `exports` field).

The backend's `backend/api/package.json` has no `"type": "module"`. Its tsconfig is `module: NodeNext`. This means:
- Compiled `.js` output is treated as CommonJS by Node (no `"type"` → default CJS).
- Source `.ts` uses ESM-style `import` statements (NodeNext + esModuleInterop).
- The build (`tsc`) emits `require()`-style CJS to `dist/`.
- ESM-only deps like `hono@4` and `@upstash/ratelimit` work because they ship CJS-compatible builds too (verified: `npm view @upstash/ratelimit@2.0.8 main` returns `./dist/index.js`, and hono v4 actually ships dual).

So the **safest** choice for nanoid is v3.3.11 (latest v3 with no known bugs). v4 and v5 would force `require()` of an ESM-only package and break production builds.

**Decision:** Pin `nanoid@^3.3.11`. Snippet:

```ts
// backend/api/src/coach/invitations/db.ts
import { customAlphabet } from 'nanoid';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
const generate = customAlphabet(ALPHABET, 6);
// 3-retry loop on PG error code '23505' — see Pattern 5 above
```

Confidence: HIGH (verified against npm registry, 2026-05-17). Planner should record this as a correction-of-CONTEXT note.

### Q4 — Constant-time error envelope wire format?

**Decision: HTTP 200 + `{ ok: false, error_code: 'INVALID_OR_EXPIRED' }`** for all redemption failures. 429 + same body shape (Retry-After header allowed) for rate-limit failures. 401 only for missing JWT.

Wire-format spec:

```
POST /coach/clients/links/preview
Authorization: Bearer <jwt>
Content-Type: application/json
{ "code": "ZK4F2A" }

→ 200 OK
{ "ok": true,  "error_code": null,                       "preview": { display_name, bio, specialties, photo_signed_url, kyc_status } }
   200 OK (any failure)
{ "ok": false, "error_code": "INVALID_OR_EXPIRED",       "preview": null }
   429 Too Many Requests
   Retry-After: <seconds>
{ "ok": false, "error_code": "INVALID_OR_EXPIRED",       "preview": null }
   401 Unauthorized (no JWT only — auth gated at Server Component layer first)
{ "error": "..." }

POST /coach/clients/links/redeem
{ "code": "ZK4F2A" }

→ 200 OK
{ "ok": true,  "error_code": null, "link": { id, coach_id, client_id, created_at }, "preview": { ... } }
   200 OK (any failure)
{ "ok": false, "error_code": "INVALID_OR_EXPIRED", "link": null, "preview": null }
   (429 / 401 same as above)
```

Why 200 + envelope instead of 4xx + body:
- Phase 22 D-08 chose RPC-return-shape over RAISE specifically to avoid HTTP-status differentiation.
- 4xx responses cache differently on intermediaries / CDNs, leak in browser DevTools timing.
- The DB RPC already returns the JSON envelope (migration 035 line 158: `RETURN jsonb_build_object('ok', false, ...)`); the backend wrapper just collapses 6 internal error codes to one wire code (`INVALID_OR_EXPIRED`) and adds the preview payload on success.

Confidence: HIGH.

### Q5 — next-intl namespace pattern (where to register)?

**Answer:** Add new top-level keys directly to `apps/web/messages/fr.json` and `apps/web/messages/en.json`. No additional registration required — `apps/web/src/i18n/request.ts` lazy-imports the entire locale file. Recommended namespaces: `CoachInvitations`, `CoachRedeem`, plus a `Sidebar` namespace for the new "Invitations" nav label (or extend an existing one if Phase 24 introduced it — researcher did not find a `Sidebar` namespace in current `fr.json`, so it's new).

Full namespace tree shown in §Pattern 6 above. Confidence: HIGH (verified pattern via Footer/Header/marketing pages).

### Q6 — safeNext allowlist extension?

**Answer:** Current allowlist is an `as const` literal-tuple of exact strings (NOT a regex). Add `/redeem` to the tuple; for `/r/[code]` add a single anchored regex check. See §Pattern 7 above for the exact patch. Confidence: HIGH (file read & analyzed).

### Q7 — Hono router mount point?

**Answer:** `backend/api/src/app.ts` line 54. The pattern is `app.route('/coach/identity', identityRouter);` — extend with two new lines for `invitationsRouter` and `clientsRouter`. Imports go at the top alongside line 13. See §Pattern 9. Confidence: HIGH.

### Q8 — Sidebar nav structure?

**Answer:** `apps/web/src/components/coach/CoachSidebar.tsx` exports `NAV_ITEMS: { label, href, icon, disabled }[]`. Insert a new entry at index 2 (after `Clients`). Researcher's file read did NOT find a pre-existing disabled "Invitations" placeholder (CONTEXT.md hints at one from Phase 24 D-09 — discrepancy flagged). See §Pattern 8 for exact patch. Confidence: HIGH for file shape; MEDIUM for placeholder-vs-insert (planner verify).

### Q9 — Validation Architecture (highest-value validation points)?

See dedicated section below.

### Q10 — Project skill / convention checks?

**Answer:** Read CLAUDE.md fully. Relevant rules for Phase 25:
- **Light sport theme, no dark mode** — UI-SPEC already encodes this; CTA orange `#FF5C1A`, background `#F7F6F3`. ✓
- **Mockup-first / exact-match** (user MEMORY rule) — UI-SPEC.md serves as the mockup contract; the executor must match it pixel-for-pixel.
- **`showAlert` from `@ziko/plugin-sdk` instead of `Alert.alert`** — IRRELEVANT for Phase 25 (web only; React Native `Alert` is mobile-only).
- **`paddingBottom: 100` for tab bar clearance** — IRRELEVANT (web).
- **`export default` for plugin manifests** — IRRELEVANT (no plugin manifest in Phase 25; mobile plugin is v1.6 seed).
- **No `name_fr` in Supabase queries** — Phase 25 queries `coach_profiles` (no `name_fr` column); ✓.
- **`force-dynamic` + `revalidate=0` + `cache:'no-store'`** on all (coach) routes — applies to `/coach/invitations`. Also apply to `/redeem` and `/r/[code]` since they read auth + live data; do NOT add to `(marketing)` routes.
- **ESLint ban on direct `@supabase/supabase-js` in web** (Phase 23 D-11) — Phase 25 web code uses `createServerSupabase()` only. ✓
- **CI grep no `SERVICE_KEY` under `coach/`** (Phase 23 D-12) — Phase 25 backend modules use `createUserClient(jwt)` only. ✓

No `.claude/skills/` or `.agents/skills/` directories observed in the project root (skipped — confirmed by `ls .planning/` output: no such directories exist).

Confidence: HIGH.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + @vitest/coverage-v8 3.2.4 (backend) [VERIFIED: backend/api/package.json] |
| Config file | (vitest reads `vitest.config.ts` if present; backend uses `test/setup.ts` for shared bootstrap) |
| Quick run command | `cd backend/api && npm run test` (vitest run --passWithNoTests) |
| Full suite command | `cd backend/api && npm run test && npm run test:rls` |
| Web test framework | Not surveyed in this research pass — researcher recommends Playwright (e2e for state machine) + Vitest (component unit) if not present; planner verifies |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INVITE-01 | Coach generates 6-char `[A-Z2-9]` code with 14d default expiration; persists to `coach_invitations` | unit (backend) + RLS | `npm run test -- coach/invitations` | ❌ Wave 0 |
| INVITE-02 | Coach lists own invitations with computed status; revokes active code (sets `revoked_at`) | unit + RLS | `npm run test -- coach/invitations` | ❌ Wave 0 |
| INVITE-03 (deferred mobile) | DB redeem RPC creates `coach_client_links` row | RLS (already exists) | `npm run test:rls -- redeem-rpc.spec.ts` | ✅ `backend/api/test/rls/redeem-rpc.spec.ts` |
| INVITE-04 | Rate limit: 6th IP attempt in 15min returns 429; 11th user attempt in 1h returns 429; both return constant-time envelope shape | integration (synthetic burst) | `npm run test -- coach/clients/ratelimit` | ❌ Wave 0 |
| INVITE-05 | `links/preview` returns coach preview payload (display_name, bio, specialties, photo_signed_url, kyc_status) on valid code | unit + integration | `npm run test -- coach/clients/preview` | ❌ Wave 0 |
| INVITE-06 (web revoke part only; mobile deferred) | Athlete DELETE `/coach/clients/links/:id` sets `revoked_at`; subsequent `is_coach_of()` returns FALSE | RLS + integration | `npm run test -- coach/clients/revoke` + `npm run test:rls -- coach-rls.spec.ts` | Partial (`coach-rls.spec.ts` exists) |
| INVITE-07 | Expired / used / revoked code returns `{ ok: false, error_code: 'INVALID_OR_EXPIRED' }` (HTTP 200) with same response shape as success-failed | unit (table-driven) | `npm run test -- coach/clients/preview-errors` | ❌ Wave 0 |
| INVITE-04 (constant-time) | Timing test: max delta of redeem RPC response times < threshold across 6 input shapes (valid code, missing, expired, revoked, used, self-invitation) | integration / timing | Custom Vitest benchmark | ❌ Wave 0 |
| Cross-cutting | safeNext rejects open redirects (`https://evil.com`); accepts `/r/[A-Z2-9]{6}` and `/redeem` | unit (table-driven) | `cd apps/web && npm run test -- actions/login` (if test infra exists) | ❌ Wave 0 |
| Cross-cutting | Constraint catch on nanoid collision: mock `customAlphabet` to return duplicate; assert 3-retry then success on third unique value | unit | `npm run test -- coach/invitations/generate-retry` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend/api && npm run test -- coach/invitations` (subset run)
- **Per wave merge:** `cd backend/api && npm run test && npm run test:rls`
- **Phase gate:** Full suite green + RLS regression suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/api/test/coach/invitations.spec.ts` — covers INVITE-01, INVITE-02, generate-retry
- [ ] `backend/api/test/coach/clients-preview.spec.ts` — covers INVITE-05, INVITE-07 (table-driven across all 6 error causes)
- [ ] `backend/api/test/coach/clients-redeem.spec.ts` — happy-path INVITE-03 wrapper test (the SQL-level test already exists)
- [ ] `backend/api/test/coach/clients-revoke.spec.ts` — INVITE-06 web-revoke half (DELETE endpoint + is_coach_of follow-up read)
- [ ] `backend/api/test/coach/ratelimit.spec.ts` — INVITE-04 synthetic-burst test using mock Upstash or actual Upstash with a unique key prefix
- [ ] `backend/api/test/coach/timing.spec.ts` — constant-time benchmark (gather N samples per error class; assert max(p99) - min(p1) < threshold). Threshold tunable; suggest start at 50ms after warmup.
- [ ] `apps/web/test/safe-next.spec.ts` (if web test infra exists) — table-driven test of `safeNext()` allowlist + new regex
- [ ] Wave 0 task: install nanoid (`cd backend/api && npm install nanoid@^3.3.11`)
- [ ] Wave 0 task: create new migration `supabase/migrations/038_peek_invitation_function.sql` and apply

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth JWT + `authMiddleware` (Hono) + `supabase.auth.getUser()` (Server Component) — both already in use |
| V3 Session Management | yes (indirect) | `@supabase/ssr` dual-store cookies — Phase 23 |
| V4 Access Control | yes | RLS policies on `coach_invitations` (`coach_invitations_own` FOR ALL) and `coach_client_links` (participant_read FOR SELECT + participant_revoke FOR UPDATE); `is_coach_of()` predicate for downstream tables |
| V5 Input Validation | yes | Zod schemas in `packages/coach-sdk/` + manual `c.req.json()` in service.ts; DB CHECK `^[A-Z2-9]{6}$` enforces code format |
| V6 Cryptography | yes (limited) | nanoid (CSPRNG via `crypto.getRandomValues`); signed URLs via Supabase Storage; **never hand-roll** |
| V7 Error Handling | yes | Constant-time envelope; collapse 6 RPC errors to 1 wire code; log distinct codes server-side only |
| V8 Data Protection | yes | Coach photos: signed URLs (5-min TTL) or proxy via `/api/photo`; never expose bucket path directly |
| V11 Business Logic | yes | Rate limits (IP 5/15min, user 10/hour); single active link per (coach, client) enforced by partial UNIQUE index `coach_client_links_active_uq` |
| V13 API | yes | Hono routes + auth middleware + per-request JWT; CORS allowlist already in `app.ts` |

### Known Threat Patterns for Hono + Supabase + Next.js stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Code enumeration via response-shape differences | Information Disclosure | Constant-time RPC + 200 + single envelope (`INVALID_OR_EXPIRED`) |
| Code enumeration via timing | Information Disclosure | Single SELECT + CASE in plpgsql (already in migration 035); peek_invitation mirrors it |
| Code brute-force | Spoofing / Elevation | Rate limit IP 5/15min + user 10/hour via Upstash sliding window |
| Open redirect via login `?next=` | Spoofing | safeNext allowlist + anchored regex for `/r/[A-Z2-9]{6}` |
| RLS bypass via SERVICE_KEY misuse | Elevation | ARCH-02 CI grep blocks `SERVICE_KEY` under `coach/`; `db.ts` uses `createUserClient(jwt)` only |
| Photo URL leak from private bucket | Information Disclosure | Server-side signed URL (5-min) OR `/api/photo?path=` proxy with caller-scope check (`path.startsWith(user.id + '/')` in `apps/web/src/app/api/photo/route.ts` line 20) |
| Self-invitation (coach generating + redeeming own code) | Tampering / Logic | `SELF_INVITATION` branch in keystone RPC (migration 035 line 145) |
| Double-link (same coach × client linked twice) | Tampering | Partial UNIQUE index `coach_client_links_active_uq` + LINK_EXISTS branch in RPC |
| CSRF on Server Action | Tampering | Next.js Server Actions ship CSRF tokens by default; no extra work |
| Token-passing across `next` param | Spoofing | `next` param only used in safeNext; never passes auth tokens |

## Project Constraints (from CLAUDE.md)

Hard constraints applicable to Phase 25:
- Light sport theme (Background `#F7F6F3`, Surface `#FFFFFF`, Primary `#FF5C1A`, Text `#1C1A17`, Muted `#6B6963`, Border `#E2E0DA`).
- No dark mode.
- Web Server Components / Server Actions: use `@supabase/ssr` factory (`createServerSupabase()`); ESLint bans direct `@supabase/supabase-js` import in web (Phase 23 D-11).
- Backend coach/ modules: no `SUPABASE_SERVICE_KEY`; per-request JWT only (Phase 23 D-12, enforced by CI grep).
- `(coach)` route group: `force-dynamic` + `revalidate = 0` + `cache: 'no-store'` (Phase 23 D-15). Apply same to `/redeem` and `/r/[code]` (live auth + live data).
- next-intl namespaces in flat top-level JSON keys; both `fr.json` and `en.json` must be updated together.
- File path conventions: bounded modules under `backend/api/src/coach/<module>/{service.ts,db.ts,types.ts}`; web routes under `apps/web/src/app/[locale]/`.
- nanoid: install v3.3.x line for CJS compatibility (researcher's correction to CONTEXT.md D-08 — see §Q3).

Project skills directories (`.claude/skills/`, `.agents/skills/`) not present in this repo — no additional skill rules to load.

## Sources

### Primary (HIGH confidence)
- `backend/api/package.json` — confirmed installed deps & versions [VERIFIED: file read]
- `backend/api/src/coach/identity/{service.ts,db.ts,types.ts}` — bounded module shape [VERIFIED: file read]
- `backend/api/src/middleware/rateLimiter.ts` — sliding-window factory pattern [VERIFIED: file read]
- `backend/api/src/lib/redis.ts` — singleton Redis client [VERIFIED: file read]
- `backend/api/src/app.ts` — Hono mount point precedent [VERIFIED: file read line 54]
- `supabase/migrations/035_coach_invitations_links_rls.sql` — RPC shape, error codes, return envelope [VERIFIED: file read lines 108-174]
- `supabase/migrations/034_coach_role_profiles.sql` — `coach_profiles` columns for preview JOIN [VERIFIED: file read]
- `apps/web/src/lib/supabase/server.ts` — Server Component factory [VERIFIED: file read]
- `apps/web/src/app/[locale]/login/LoginForm.tsx` — useActionState + redirect pattern [VERIFIED: file read]
- `apps/web/src/actions/login.ts` — safeNext current shape [VERIFIED: file read lines 13-24]
- `apps/web/src/components/coach/CoachSidebar.tsx` — NAV_ITEMS shape [VERIFIED: file read]
- `apps/web/src/i18n/{request,routing}.ts` — next-intl config [VERIFIED: file read]
- `apps/web/messages/{fr,en}.json` — top-level namespace pattern [VERIFIED: file read; counts 163 lines each]
- `apps/web/src/app/api/photo/route.ts` — signed URL proxy pattern for coach-kyc bucket [VERIFIED: file read]
- `packages/coach-sdk/src/schemas/{coach-client-link,coach-profile,index}.ts` — schema barrel + isLinkActive helper [VERIFIED: file read]
- `npm view nanoid versions/dist-tags/type` — v3.3.x is dual ESM/CJS; v4 & v5 are pure ESM [VERIFIED: npm registry, 2026-05-17]
- `npm view @upstash/ratelimit` (2.0.8) and `@upstash/redis` (1.38.0 latest, 1.37.0 installed) [VERIFIED: npm registry]
- `.planning/REQUIREMENTS.md` lines 21-29 (INVITE-01..07) — phase requirement IDs [VERIFIED: file read]
- `.planning/config.json` — `workflow.nyquist_validation: true` confirmed [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- Upstash Ratelimit sliding-window semantics (inferred from existing `rateLimiter.ts` working behavior + npm description; not re-read from docs in this research pass — but pattern is identical to one already in production)
- Birthday-collision math at v1.5 scale (calculated by researcher, standard pigeonhole reasoning)

### Tertiary (LOW confidence)
- No third-party docs were fetched during this research — codebase precedent was sufficient for all major decisions.
- Constant-time literature beyond the existing migration 035 commentary was not surveyed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is either already installed or has been version-verified against the npm registry today.
- Architecture: HIGH — every pattern has explicit codebase precedent (Phase 22, 23, 24).
- Pitfalls: HIGH — most are codified in the project's existing files (login.ts useActionState pitfall, ratelimit.ts lazy-init pitfall, etc.).
- Validation Architecture: MEDIUM — backend tests are well-mapped; web test infrastructure was not deeply surveyed in this pass.

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stack is stable; npm-verified versions could shift, especially nanoid line)

## RESEARCH COMPLETE
