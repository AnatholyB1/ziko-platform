# Phase 24: Coach Identity & Onboarding — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 24 — Coach Identity & Onboarding
**Areas discussed:** Login & auth entry point, Onboarding journey shape, Coach dashboard shell, KYC & photo uploads

---

## Login & Auth Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Email + password | Standard Supabase email/password form. Existing athletes already have password accounts. Simple, consistent with mobile auth. Login + 'Create account' on same page. | ✓ |
| Magic link (email OTP) | Supabase passwordless — user enters email, gets a link. Better UX but adds email step to onboarding friction. | |
| Google OAuth only | One-click Google sign-in. Requires Google Cloud Console setup + mobile/web token alignment. Adds a dependency. | |
| Supabase Auth UI component | Drop-in `<Auth>` component. Zero custom form code but locked to Supabase's styling — harder to match Ziko sport theme. | |

**User's choice:** Email + password
**Notes:** Consistent with existing mobile auth pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Shared — all users login here | One /fr/login page for everyone. After login, routing logic decides: coach dashboard if role=coach/both, otherwise /coach/onboarding. | ✓ |
| Coach-only — separate from mobile flow | Only coaches use this page; mobile athletes continue using the mobile app auth. | |

**User's choice:** Shared login for all users
**Notes:** Avoids duplicate auth pages.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /coach/onboarding CTA | If logged-in user is not yet a coach, redirect them to /coach/onboarding instead of a dead-end. Makes 'become a coach' path seamless. | ✓ |
| Show a gate page | A page explaining 'this section is for coaches — upgrade your role' with a CTA button. More informative but adds an extra screen. | |

**User's choice:** Redirect to /coach/onboarding
**Notes:** Seamless flow, no dead-ends.

---

## Onboarding Journey Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard | Step 1: Role promotion. Step 2: Profile (name, bio, specialties, website, photo). Step 3: KYC (optional). Progress bar. Skip KYC available. | ✓ |
| Single long form | All fields on one scrollable page: role confirmation + profile + KYC. | |
| Minimal first (role only) | Just confirm role promotion; profile deferred entirely to /coach/settings. | |

**User's choice:** Multi-step wizard
**Notes:** User confirmed the FR-language preview: "Devenir coach / Votre compte Ziko existant sera mis à niveau."

---

| Option | Description | Selected |
|--------|-------------|----------|
| Public + auth-gated | Anyone can visit /coach/onboarding. Unauthenticated visitors redirect to /fr/login at Step 1 then return. | ✓ |
| Auth-required upfront | Visiting /coach/onboarding without login redirects to /fr/login first. | |

**User's choice:** Public + auth-gated
**Notes:** Landing page CTA can link directly to /coach/onboarding.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same flow, sets role=both | Detects current role. Step 1 copy adapts ("add the coach role"). Role becomes 'both'. | ✓ |
| Separate upgrade flow | Different screen: 'Upgrade to coach' with shorter form. More tailored but more code paths. | |

**User's choice:** Same flow, role becomes `both`
**Notes:** Single code path for all users.

---

## Coach Dashboard Shell

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state + sidebar nav skeleton | Sidebar with nav items (Clients, Programs, AI, Settings). Main area: welcome card with coach name, KYC status chip, Phase 25 invite CTA. | ✓ |
| Minimal welcome page only | Just a page that says 'Dashboard coming soon'. No sidebar yet. | |

**User's choice:** Sidebar nav skeleton + welcome card
**Notes:** User confirmed the sidebar preview showing disabled "Clients [Soon]", "Programmes [Soon]", "IA [Soon]" items.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — full settings page | SC2 requires values reflected on /coach/settings. Ships editable form + KYC section. | ✓ |
| Read-only settings in Phase 24 | Shows persisted values but no edit UI. | |

**User's choice:** Full /coach/settings ships in Phase 24
**Notes:** SC2 + SC5 both require it.

---

## KYC & Photo Uploads

| Option | Description | Selected |
|--------|-------------|----------|
| New private bucket 'coach-kyc' | Separate from existing 3 buckets. Path: coach-kyc/{user_id}/{filename}. RLS: owner-only. | ✓ |
| Reuse existing 'avatars' bucket | KYC docs alongside photos in one bucket. Simpler count but mixes personal IDs with photos. | |

**User's choice:** New `coach-kyc` bucket
**Notes:** Keeps future admin moderation scope clean.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — photo in onboarding Step 2 | Optional photo upload in profile step. Signed URL pattern from v1.3. Stored in coach-kyc/{user_id}/photo.{ext}. | ✓ |
| Defer photo to Phase 25+ | Phase 24 ships text profile only. Photo null until later. | |

**User's choice:** Photo upload included in Phase 24
**Notes:** Part of the profile step.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Button + file type label | Simple 'Add document' button per doc type. Native file picker. Filename chip + remove. Max 3 docs / 5 MB each. No drag-drop. | ✓ |
| Drag-drop drop zone | HTML5 drag-drop with fallback button. More polished on desktop but fragile on mobile browsers. | |
| Skip KYC in Phase 24 | SC3 requires it — not an option. | |

**User's choice:** Button + file type label
**Notes:** Mobile-friendly, simple to implement. KYC is low-traffic — no need for drag-drop polish.

---

## Claude's Discretion

- Sidebar CSS/Tailwind structure
- Wizard step state: URL params vs React client state
- `/fr/login?next=` allowlist validation approach
- Supabase Storage bucket creation via SQL migration vs MCP tool vs dashboard
- Whether `/coach/onboarding` lives inside or outside the `(coach)` layout guard

## Deferred Ideas

- Invitation code generation from dashboard → Phase 25
- KYC submission email notifications → Phase 31+
- Google OAuth / social login → post-v1.5
- Manual KYC review back-office → post-v1.5
- Playwright E2E tests for login + onboarding → planner decides timing
