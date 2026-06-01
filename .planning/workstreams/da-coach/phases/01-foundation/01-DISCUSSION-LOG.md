# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 1-Foundation
**Areas discussed:** Pro gate source, setCustomTheme API shape, Branding in /links/me response

---

## Pro Gate Source

| Option | Description | Selected |
|--------|-------------|----------|
| tier='premium' | Reuse existing tier column as-is. No schema change needed. | ✓ |
| New tier value 'coach_pro' | Add to CHECK constraint. Cleaner separation but requires migration ALTER. | |
| Separate is_pro flag on coach_profiles | Boolean column on coach_profiles. Most explicit, extra column to maintain. | |

**User's choice:** `tier='premium'`
**Notes:** No schema change needed. Confirms STATE.md pending concern resolved.

---

| Option | Description | Selected |
|--------|-------------|----------|
| { primary_color, logo_url, tone } | Exact match to DB columns. Simple validation. | ✓ |
| { primary_color, tone } only | Logo handled separately via storage endpoint. | |
| Full ThemePalette override | Any ThemePalette subset. Flexible but inconsistent with DB schema. | |

**User's choice:** `{ primary_color, logo_url, tone }` — body maps 1:1 to DB columns.

---

## setCustomTheme API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| setCustomTheme(overrides: Partial<ThemePalette>) | Merges over DEFAULT_THEME. Future-proof. | ✓ |
| setCustomTheme(branding: CoachBranding) | Typed to DB columns. Requires mapping before applying to ThemePalette. | |
| setCoachPrimary(hex: string) | Minimal, single-purpose. Asymmetric API for clearCoachTheme. | |

**User's choice:** `Partial<ThemePalette>` merge approach.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-derive from primary | tabBarActive = primary, primaryLight = primary + '15'. Consistent theming. | ✓ |
| Override only what's passed | Only primary changes. tabBarActive stays orange. Inconsistent result. | |

**User's choice:** Auto-derive `tabBarActive` and `primaryLight` from `primary`.

---

## Branding in /links/me Response

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level branding field | { link, preview, branding: {...} \| null }. Matches ROADMAP. Phase 3 reads independently. | ✓ |
| Nested inside preview | preview gains branding sub-object. Blurs coach identity vs DA config. | |
| Merged flat into preview | preview gains flat primary_color, logo_url, tone fields. Hard to null-check. | |

**User's choice:** Top-level `branding` field.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Return object with logo_url: null | { primary_color, logo_url: null, tone }. Phase 3 applies color even without logo. | ✓ |
| Omit logo_url when null | Smaller payload but inconsistent key presence for Phase 3. | |

**User's choice:** Always include `logo_url` in the object — `null` when no logo uploaded.

---

## Claude's Discretion

- Hex CHECK constraint syntax in migration (regex operator choice)
- Whether `clearCoachTheme` is a standalone action or a thin `resetTheme` alias

## Deferred Ideas

None emerged beyond what is already in REQUIREMENTS.md deferred list (tone→system prompt injection, secondary color, push notifications on DA update, MMKV persistence → Phase 3).
