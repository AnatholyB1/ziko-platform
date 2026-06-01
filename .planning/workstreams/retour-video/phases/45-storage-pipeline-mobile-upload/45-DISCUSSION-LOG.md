# Phase 45: Storage Pipeline & Mobile Upload — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 45 — Storage Pipeline & Mobile Upload
**Areas discussed:** Hono endpoint design, Push notification scope, Upload screen placement, Title input UX

---

## Hono Endpoint Design

**Q1: One endpoint or two?**

| Option | Description | Selected |
|--------|-------------|----------|
| Two endpoints | POST /upload-url → signed URL + videoId. XHR PUT. POST /complete with metadata. | ✓ |
| Single endpoint | POST /coach/videos pre-creates DB row, returns signed URL. Hono polls or Supabase webhook flips status. | |
| You decide | Leave to researcher and planner. | |

**User's choice:** Two endpoints (Recommended)

---

**Q2: Service role or publishable key for signed URL generation?**

| Option | Description | Selected |
|--------|-------------|----------|
| Service role | Backend generates signed URL with admin privileges. Safe — URL scoped to one path, expires in 15 min. | ✓ |
| Publishable key + RLS | Simpler, but Supabase signed upload URLs require storage.admin access. | |
| You decide | Leave to researcher. | |

**User's choice:** Service role (Recommended)

---

**Q3: Signed URL expiry window?**

| Option | Description | Selected |
|--------|-------------|----------|
| 15 minutes | Enough for 500 MB on a decent connection. Standard presigned URL window. | ✓ |
| 60 minutes | Safer for slow connections; longer exposure window. | |
| You decide | Leave to researcher. | |

**User's choice:** 15 minutes (Recommended)

---

## Push Notification Scope

**Q1: Approach for UPLOAD-04 given v1.11 not shipped?**

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Expo push here | Store coach token in user_profiles; Hono sends via Expo Push API. v1.11 extends later. | ✓ |
| Wire trigger, no token infra | Push logic present but token storage stubbed — won't actually arrive until v1.11. | |
| Skip for now | Defer UPLOAD-04 entirely to after v1.11. | |

**User's choice:** Minimal Expo push here (Recommended)

---

**Q2: Where to store coach's Expo push token?**

| Option | Description | Selected |
|--------|-------------|----------|
| New column on user_profiles | Add expo_push_token TEXT. Simple, RLS-protected. v1.11 can migrate later. | ✓ |
| New notification_tokens table | Future-proof, matches v1.11 design. Adds schema complexity now. | |
| You decide | Leave to researcher/planner. | |

**User's choice:** New column on user_profiles (Recommended)

---

## Upload Screen Placement

**Q1: Where does the athlete access video upload?**

| Option | Description | Selected |
|--------|-------------|----------|
| New tab in Mon coach plugin | "Vidéos" tab in State C. Route: (plugins)/mon-coach/videos. | ✓ |
| Standalone route under (app) | New top-level screen, accessible via Mon coach button. | |
| You decide | Leave to researcher/planner. | |

**User's choice:** New tab in 'Mon coach' plugin (Recommended)

---

**Q2: What does the Videos tab show?**

| Option | Description | Selected |
|--------|-------------|----------|
| List + upload button | All uploaded videos (title, date, status) + floating upload CTA. | ✓ |
| Upload button only | Minimal CTA only. List view deferred to Phase 46. | |

**User's choice:** List + upload button (Recommended)

---

## Title Input UX

**Q1: When does the athlete enter the title?**

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation sheet after picking | Bottom sheet with title + duration preview + Upload button. Clear two-step flow. | ✓ |
| Before picking | Type title first, then pick video. Less natural. | |
| Editable after upload | Auto-generated title, rename later. Simpler but needs rename feature. | |

**User's choice:** Confirmation sheet after picking (Recommended)

---

**Q2: Auto-suggested title format?**

| Option | Description | Selected |
|--------|-------------|----------|
| 'Exercice YYYY-MM-DD' | Generic fallback, always works. Athlete overwrites with specific name. | ✓ |
| Empty field | Required, no suggestion. Adds friction. | |
| You decide | Leave to planner. | |

**User's choice:** 'Exercice YYYY-MM-DD' (Recommended)

---

**Q3: Title required or optional?**

| Option | Description | Selected |
|--------|-------------|----------|
| Required with auto-suggestion | Pre-filled, editable, Upload disabled if blank. Every video has a label. | ✓ |
| Optional | Auto-title if left blank. Lower friction. | |

**User's choice:** Required with auto-suggestion (Recommended)

---

## Claude's Discretion

None — user selected the recommended option on every question.

## Deferred Ideas

- Video duration / size cap at picker time — no hard limit in Phase 45
- Upload resumable TUS — post-v1.13
- Thumbnail generation (FFmpeg WASM) — post-v1.13
- Push token migration to `notification_tokens` table — deferred to v1.11 workstream
