# Phase 2: Web Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 2-Web-Editor
**Areas discussed:** Page location, Color picker, Live preview card, Logo upload pattern

---

## Page location

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone /coach/branding | New route + "Direction artistique" nav item in CoachSidebar. ROADMAP explicitly references this path. | ✓ |
| Section inside /coach/settings | Third card below Profile and KYC. No new route or nav item. | |

**User's choice:** Standalone `/coach/branding` with new nav item
**Notes:** ROADMAP success criteria reference the `/coach/branding` path explicitly. Clean separation from profile/KYC settings.

---

## Color picker

**Q1: Input style**

| Option | Description | Selected |
|--------|-------------|----------|
| Hex text input + live swatch | Text field + colored square, no dependency | ✓ |
| Native `<input type="color">` | Browser native color picker popup | |
| react-colorful library | HSV wheel + hex input, ~5 KB dependency | |

**User's choice:** Hex text input + live swatch

**Q2: Validation timing**

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time validation | Swatch activates only when hex matches regex | ✓ |
| Validate on Save only | Free text; error shown on Submit | |

**User's choice:** Real-time validation
**Notes:** Swatch only activates when input matches `^#[0-9A-Fa-f]{6}$`. Prevents confusing previews with partial input.

---

## Live preview card

**Q1: What does it simulate?**

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile Mon Coach card | Web replica: logo, display name, primary color accent | ✓ |
| Simple swatch + logo thumbnail | Color box + logo only, no card frame | |

**User's choice:** Mobile Mon Coach card simulation

**Q2: Layout**

| Option | Description | Selected |
|--------|-------------|----------|
| 2-column layout | Form left / preview card right, stacks on mobile | ✓ |
| Stacked (preview below form) | Single-column always | |

**User's choice:** 2-column layout
**Notes:** Preview shows logo (with fallback avatar), display_name, primary color as accent. Updates live as coach edits.

---

## Logo upload pattern

**Q1: Upload mechanism**

| Option | Description | Selected |
|--------|-------------|----------|
| Direct Supabase client upload | `supabase.storage.from('coach-logos').upload()` — public bucket, no signed URL | ✓ |
| Via /api/storage/upload-url route | Signed URL pattern (from PhotoUpload.tsx) — unnecessary for public bucket | |

**User's choice:** Direct client-side upload to public bucket

**Q2: File types & size**

| Option | Description | Selected |
|--------|-------------|----------|
| PNG + SVG, max 2 MB | Matches ROADMAP WEB-02 | ✓ |
| PNG only, max 2 MB | Simpler, avoids SVG XSS concern | |

**User's choice:** PNG + SVG, max 2 MB

**Q3: What to store in DB**

| Option | Description | Selected |
|--------|-------------|----------|
| Bucket path only | `userId/logo.png` — consistent with photo_url pattern | ✓ |
| Full public URL | `https://xyz.supabase.co/...` — coupled to project URL | |

**User's choice:** Bucket path only
**Notes:** Mobile app and web preview both construct the public URL from the path using `getPublicUrl()`.

---

## Claude's Discretion

- Exact icon for "Direction artistique" nav item
- BrandingClient.tsx structure (monolithic client vs. sub-components)
- Toast/success message wording after Save
- Upgrade CTA behavior (modal vs. link to pricing page)

## Deferred Ideas

- Tone injection into Claude system prompt — post-v1.12
- Secondary color or gradient — out of scope v1.12
- Logo cropping/resize tool — future UX
- Dark mode preview — light sport theme only
