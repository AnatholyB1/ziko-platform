# Phase 3: Mobile Injection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 3-Mobile-Injection
**Areas discussed:** Cold-start persistence, Logo in the coach card, Bootstrap location

---

## Cold-start persistence

**Q1: Persistence approach**

| Option | Description | Selected |
|--------|-------------|----------|
| Install MMKV (Recommended) | react-native-mmkv v3 in tech stack but not set up. Synchronous read in Zustand store init = zero flash. Requires one EAS build. | ✓ |
| Hold the splash screen | expo-splash-screen already present. AsyncStorage async read, hide splash when done. ~100-200ms extra on every cold start. No new native dep. | |

**User's choice:** Install MMKV

---

**Q2: What to persist**

| Option | Description | Selected |
|--------|-------------|----------|
| Full branding object (Recommended) | Cache `{ primary_color, logo_url, tone }` — same shape as API. Single source of truth. | ✓ |
| Just the hex color | Only `primary_color`. Simpler but loses logo/tone for future use. | |

**User's choice:** Full branding object

---

**Q3: Where the MMKV read happens**

| Option | Description | Selected |
|--------|-------------|----------|
| In useThemeStore initializer (Recommended) | Read MMKV key `coach:branding` synchronously inside `create()`. Zero-latency, no React lifecycle needed. | ✓ |
| In root _layout.tsx useEffect | Async read in useEffect — still causes a one-frame flash before effect fires. | |

**User's choice:** In useThemeStore initializer

---

## Logo in the coach card

**Q1: Logo vs KYC photo coexistence in State C**

| Option | Description | Selected |
|--------|-------------|----------|
| Logo replaces avatar if set (Recommended) | Branding logo in the 72×72 circle if `branding.logo_url` set; fall back to KYC photo if not. State B unchanged. | ✓ |
| Logo as a separate element | Keep KYC photo as avatar + smaller logo badge/row. More complex, avoids cropping non-square logos. | |
| Logo only, drop KYC photo | Replace avatar entirely with branding logo. Placeholder (initials/icon) if no logo. | |

**User's choice:** Logo replaces avatar if set (with KYC fallback)

---

**Q2: State B behavior**

| Option | Description | Selected |
|--------|-------------|----------|
| KYC photo as-is (Recommended) | State B keeps existing `photo_signed_url` behavior. Branding only applies post-link (State C). | ✓ |
| Fetch branding for preview too | Augment `/links/preview` to return branding. Out of Phase 3 scope (backend change). | |

**User's choice:** KYC photo as-is for State B

---

## Bootstrap location

**Q1: Where the startup fetch lives**

| Option | Description | Selected |
|--------|-------------|----------|
| Hook in root (app)/_layout.tsx (Recommended) | `useBrandingBootstrap()` in authenticated root layout. Fires on mount, fetches `/links/me`, updates MMKV + theme. | ✓ |
| Dedicated Zustand bootstrap action | `bootstrapCoachBranding()` action in store or new store. Same result, more testable. | |

**User's choice:** Hook in root `(app)/_layout.tsx`

---

**Q2: Coordination with CoachScreen's existing query**

| Option | Description | Selected |
|--------|-------------|----------|
| Same query key, TanStack deduplicates (Recommended) | `useQuery({ queryKey: ['coach-link', userId] })` — same key as CoachScreen. Zero double-requests. | ✓ |
| Separate fetch in root, separate query in CoachScreen | Two network requests when visiting CoachScreen. | |

**User's choice:** Same query key

---

**Q3: Side-effect logic when query resolves**

| Option | Description | Selected |
|--------|-------------|----------|
| setCustomTheme + write MMKV if branding, clearCoachTheme + delete MMKV if null (Recommended) | Handles both states. Covers cross-device revocation automatically. | ✓ |
| Only apply when branding is set | Ignore null — risk: MMKV persists indefinitely after cross-device revocation. | |

**User's choice:** Full bidirectional sync (apply + clear)

---

## Claude's Discretion

- MMKV instance: dedicated `coachStorage` vs shared app-level instance
- `fetchLinksMe` queryFn location: inline vs extracted to shared file
- Silent failure handling for bootstrap fetch errors (don't block app render)

## Deferred Ideas

- State B branding preview (augmenting `/links/preview`) — out of Phase 3 scope
- Tone injection into Claude system prompt — post-v1.12
- Animated theme transition (fade from orange to coach color) — future UX
