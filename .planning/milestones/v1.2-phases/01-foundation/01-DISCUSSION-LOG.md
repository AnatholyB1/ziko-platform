# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 01-foundation
**Areas discussed:** Repo location, Vercel setup timing, Design token scope, Locale URL strategy

---

## Repo Location

| Option | Description | Selected |
|--------|-------------|----------|
| Separate repo | New GitHub repo, independent of the mobile monorepo | ✓ |
| apps/web/ in this repo | Add as workspace inside Turborepo | |

**User's choice:** Separate repo
**Notes:** Cleaner CI, independent Vercel project. NativeWind v3 / Tailwind v4 version conflict also makes colocation impractical.

---

## Vercel Setup Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Start of Phase 1 | Create Vercel project early, env vars set before development | ✓ |
| End of Phase 1 | Deploy as final Phase 1 step | |

**User's choice:** Start of Phase 1
**Notes:** Allows verifying static rendering (○ routes) against production throughout the phase.

---

## Design Token Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core 4 colors only | primary, background, text, border + muted | ✓ |
| Colors + typography scale | Also font sizes, weights, line heights | |
| Full system | Colors + typography + spacing + border-radius | |

**User's choice:** Core 4 colors only (plus muted = 5 total)
**Notes:** Minimal and clean. Typography and spacing can be added in Phase 3 if needed for marketing sections.

---

## Locale URL Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| as-needed | FR = clean URLs, EN = /en/ prefix | ✓ |
| always-prefixed | Both locales prefixed (/fr/ and /en/) | |

**User's choice:** as-needed
**Notes:** French audience is primary target. Clean French URLs are better UX and SEO.

---

## Claude's Discretion

- Font choice (Inter)
- Exact middleware matcher pattern
- Whether to use `src/` directory
- Internal folder structure

## Deferred Ideas

None.
