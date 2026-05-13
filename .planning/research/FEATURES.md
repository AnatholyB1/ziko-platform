# Features Research — v1.5 Coach Platform & CRM

**Researched:** 2026-05-13
**Mode:** Ecosystem
**Confidence:** MEDIUM-HIGH (multiple credible sources cross-referenced)

## Overview

The fitness-coach SaaS landscape is dominated by 5-7 mature players (Trainerize/ABC, TrueCoach, Hevy Coach, Everfit, My PT Hub, FitSW, Virtuagym) plus a long tail of niche tools. Common pain points across all platforms: bloat (Trainerize), weak strength-training UX (TrueCoach), thin nutrition (Hevy), and poor data interoperability between athlete-tracked data and coach-prescribed plans. Ziko's positioning advantage for v1.5 is unique: it already owns a rich athlete-side data graph (18 plugins covering nutrition, sleep, journal, cardio, measurements, hydration, etc.) — most competitors only see what the athlete logs in *their* app. The opportunity is to make Ziko the "read-everything coach CRM" rather than "yet another program-assignment tool."

## Reference Platforms Studied

| Platform | Strength | Weakness | Key innovation to borrow |
|---|---|---|---|
| **ABC Trainerize** | All-in-one (programs + nutrition + messaging + payments + branded app), 2,900+ exercise library, AI Workout Builder, 60+ pre-built Master Programs | Bloated UI, endless submenus, slow day-to-day workflow, expensive | Master Workout Library + drag-drop program builder + content-library templates |
| **TrueCoach** | Clean focused workflow, thorough client profile, multi-week program builder, strong video form-check culture | Weak nutrition, weak business mgmt, less flexible workout builder | Thorough client profile + video form-check culture |
| **Hevy Coach** | Streamlined UX, drag-drop folders for plans, superior strength-logging (inherits Hevy app DNA), high-quality exercise library | Thin nutrition/scheduling/business features | Folder organization for plans + lift-data first-class |
| **Everfit** | Onboarding automation, messaging at scale, AutoFlow scheduled content delivery | Generic UX, less strength-specific | AutoFlow scheduled content + automated onboarding workflows |
| **My PT Hub** | Strong client-form library, customizable onboarding, package-based program auto-assignment | UI dated | Auto-assign programs via packages |
| **FitSW** | Lead-capture forms, free tier, simple | Limited polish | Public lead-capture form + invite link |
| **Virtuagym** | Gym-focused, scheduling-heavy | Heavy for solo coaches | — (not directly relevant) |
| **HubFit** | AutoFlow content drip + scheduled checkpoints | Newer, less mature | Scheduled content delivery |

Common across all: 6-12 character invite codes OR email-based invite links; PDF *export* of programs is universal but PDF *import* is essentially absent — this is a real differentiator opening for Ziko.

## Client Management

### Table Stakes (MUST ship in v1.5)

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Client list with search | Paginated list, search by name/email, sort by last activity | S | role column, coach_client_links |
| Client detail unified view | Single page showing profile + active program + recent sessions + measurements + nutrition + habits + sleep + cardio | M | All existing plugin tables, RLS join policy |
| Last-active indicator | Visible "active 2h ago" / "inactive 7d" status — coaches scan rosters by this | S | Last activity computed from any plugin log |
| Client notes (coach-private) | Free-text notes only the coach sees per client (injuries, preferences, history) | S | New `coach_client_notes` table |
| Read-only data access | Coach reads athlete's plugin data via RLS join; clearly labeled "read-only" in UI | M | RLS policy on coach_client_links |
| Revoke link | Athlete can revoke coach access at any time from mobile; immediate effect | S | UPDATE coach_client_links.revoked_at |

### Differentiators (cheap, ship if possible in v1.5)

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Unified athlete dashboard | Single "executive summary" card per client: compliance %, last workout, latest measurement, mood trend — competitors only show workouts | M | Aggregation queries across plugins |
| Roster filters by signal | "Show clients who missed last 2 sessions" / "clients with declining mood" — actionable triage | M | Filter queries on existing tables |
| Tags per client | Custom tags (e.g. "powerlifter", "weight-loss", "post-injury") for grouping | S | New tag column or join table |

### Anti-features (DO NOT build in v1.5)

| Anti-feature | Why avoid |
|---|---|
| Coach-side editing of athlete journals/nutrition/sleep logs | Breaks trust + RGPD complexity. Read-only is the contract. |
| Granular per-domain permissions (nutrition-only, training-only) | Adds UI complexity for 1% benefit. Already explicitly deferred. |
| Per-client custom fields builder | Trainerize ships this and coaches barely use it; ship 1-2 useful fixed fields instead. |
| Bulk-message broadcast to all clients | Looks spammy; competitors who built this regret it. Use individual coach actions. |

## Program Assignment & Templates

### Table Stakes

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Program templates | Coach builds reusable program (multi-week, multi-session, exercises with sets/reps/RPE/rest) | L | workout_programs extended schema |
| Template library per coach | List of saved templates with search/folder | S | is_template flag |
| Assign template to client | One-click assign → creates client-specific copy linked to original | M | assigned_to_user_id, copy semantics |
| Week-by-week structure | Standard fitness mental model: Week 1 → Day 1 (Push) / Day 2 (Pull) / etc. | M | weeks_data JSONB |
| Edit assigned program | Coach can adjust assigned program without affecting template (Trainerize-style detachment) | M | Snapshot pattern |
| Exercise picker | Use existing Ziko exercise library (already 1000+ in seed.sql) + free-text fallback | S | exercises table |

### Differentiators

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Folder organization | Drag-drop folders for templates (Hevy Coach pattern — coaches love this) | M | parent_folder_id on workout_programs |
| Pre-built Ziko templates | 5-10 expert-curated programs at launch (PPL, 5/3/1, Hyrox prep, body-recomp 12-week) | M (content work) | Template seeding |
| AI program generation for coaches | Coach prompts: "12-week hypertrophy program for intermediate, 4 days/week" → AI fills the template | L | AI tool, generateObject + Zod |
| Per-exercise RPE/RIR targets | Already supported in athlete app — extend to coach prescriptions | S | program_exercises.target_rpe |
| Program duplication | Right-click "Duplicate" on any template — coaches iterate by copy not by edit | S | INSERT...SELECT |

### Anti-features

| Anti-feature | Why avoid |
|---|---|
| Real-time collaborative editing | Google-Docs-style multi-cursor on programs is overkill for solo coaches. |
| Periodization auto-deload algorithm | Coaches want CONTROL over deload weeks. Algorithmic "we know better" is paternalistic. |
| In-program video upload from coach | Storage cost + moderation burden. Link to existing exercise videos instead. |
| Marketplace to sell/buy programs between coaches | Out of scope for v1.5; competitive moat for v2.0+. |

## AI File Imports

### Table Stakes

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Upload PDF | Drop a coaching PDF (most common format coaches store programs in) → AI parses | L | Storage signed URL, Claude PDF support |
| Upload image / screenshot | iPhone screenshot of a program in Notes / Excel → AI vision parses | L | Haiku vision (already migrated) |
| Upload Excel (.xlsx) | The 2nd most common format coaches use — convert to text → Claude parses | L | xlsx → text pipeline |
| Structured preview before commit | "Here's what I extracted — confirm before saving" with editable fields | M | generateObject + Zod schema |
| Athlete flow (import own data) | Athlete imports a coach-given PDF into their own programs | L | Same pipeline, different ownership |
| Coach flow (import template) | Coach imports a PDF program into their template library | L | Same pipeline, is_template=true |
| Credit-gated | Uses existing v1.4 credit system; expensive operations get higher cost | S | creditDeduct middleware |

### Differentiators

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Multi-page PDF program parsing | Full 12-week program in one PDF → AI extracts all weeks + sessions correctly | L | Claude PDF native |
| Word .docx import | Coaches often use Word — less common but underserved by competitors | M | docx → text pipeline |
| Confidence score per parsed field | "Bench Press 4x8 @ RPE 8 (HIGH confidence)" — flag low-confidence rows for review | M | Claude structured output with confidence |
| Re-upload to re-parse | Coach tweaks PDF, re-uploads, Ziko diffs against existing template | L | Diffing logic |

### Anti-features

| Anti-feature | Why avoid |
|---|---|
| Garmin .fit file import | Already explicitly deferred. Wearables sync covers daily summary. |
| Google Sheets API OAuth | Explicitly deferred. Excel upload covers 95% of the need. |
| CSV format with rigid schema | Already explicitly out-of-scope. AI parsing replaces this. |
| Strava bulk-export import | Strava OAuth (in v1.5) handles ongoing sync. Historical bulk-import is a 1-time edge case. |
| OCR of handwritten programs | High failure rate, frustrating UX. Tell coaches: "Please type it or photograph a typed program." |

## AI Coach Features

### Table Stakes

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| `analyze_client` tool | Coach asks "How is Sophie doing this month?" → AI summarizes compliance, trends, red flags | M | Existing user context pattern, extended to read-other-user via coach link |
| `generate_coaching_program` tool | Coach prompts for a program → AI returns structured weeks_data JSONB | L | Existing ai_programs_generate, adapted for coach context |
| `monitor_client_alerts` tool | "Which clients need attention?" → list of clients with declining metrics | M | Aggregation queries |
| Web chat UI for coach | ChatGPT-style sidebar/panel in `/coach/clients`; SSE streaming reused from mobile | M | Existing `/ai/chat/stream` |
| Context awareness | When coach is viewing a client, AI auto-injects that client's data into context | M | Conversation plugin_context JSONB |

### Differentiators

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Proactive weekly digest | AI generates "Monday morning briefing" per coach: who needs attention, who's PR'd, who's struggling | L | Vercel cron, batched analyses |
| "Adapt this program for X" inline | On a template page, right-click "Adapt for hypertrophy" or "Make it 3-day instead of 5" | M | Existing generation tool, prompted differently |
| Auto-flag concerning patterns | "Sophie's sleep dropped 30% this week AND she missed 2 sessions" — surface in coach inbox | L | Threshold rules + AI summarization |

### Anti-features

| Anti-feature | Why avoid |
|---|---|
| AI directly messages clients on coach's behalf | Liability + trust erosion. Coach must approve/send. |
| Full autopilot ("AI runs my coaching business") | Coaches lose value-add → unsubscribe. Position AI as assistant not replacement. |
| Voice-cloned coach replies | Uncanny valley + ethical landmine. Skip. |
| AI medical advice (injury rehab, nutrition for medical conditions) | Liability nightmare. Hard refuse in system prompt. |

## Invitation & Onboarding

### Table Stakes

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Coach generates 6-char invite code | Random alphanumeric, expires in N days, one-time-use OR multi-use toggle | S | invitations table |
| Athlete enters code in mobile app | New screen in mobile under settings or profile: "Link a coach" | S | Mobile UI + API endpoint |
| Auto-create `coach_client_link` on accept | Athlete sees "Link with Coach Sophie?" confirmation, accept → link created | S | API endpoint |
| Coach signup self-serve | Standalone signup flow on /coachs → role=coach on user_profiles | M | Auth flow, role column |
| Light KYC | Coach uploads photo ID OR certification doc → stored, manual review later (not blocking signup) | M | Storage bucket, kyc_documents table |
| Pending → active state | Coach can use platform immediately but is marked "unverified" in UI | S | KYC status enum |

### Differentiators

| Feature | Description | Complexity | Depends on |
|---|---|---|---|
| Invitation link (not just code) | Click `ziko-app.com/invite/ABC123` → deep-link into mobile app | M | Universal links / app links |
| QR code for invite | Coach shows QR in person (in-gym scenario) — common with Hevy Coach | S | QR generator |
| Athlete sees coach profile preview | Before accepting, athlete sees coach name + photo + certs to build trust | S | Public coach profile page |
| Welcome auto-message on link | Coach sets a template "welcome message" shown to athlete on link creation | S | coach_settings JSONB |

### Anti-features

| Anti-feature | Why avoid |
|---|---|
| Invite via email blast | Spam-adjacent. Codes/links shared peer-to-peer feel cleaner. |
| Multi-coach per athlete (athlete linked to 3 coaches at once) | Adds enormous schema complexity for 0.1% use case. Defer to v2.0. |
| Coach can re-invite without athlete consent on revoke | Athlete revoke is final until they re-initiate. Trust matters. |
| Hard-KYC blocking signup | Defeats self-serve. A posteriori moderation is the right call per PROJECT.md. |

## Mobile Athlete UX ("Mon coach" screen)

### Table Stakes

- **Empty state** — "Vous n'avez pas encore de coach. Entrez un code d'invitation." with prominent input field.
- **Linked state** — Coach name, photo, certs displayed; "Active program" card with current week + today's session preview.
- **Program viewer** — Tap today's session → full exercise list with sets/reps/RPE matching what coach assigned; tap exercise → demo video (existing).
- **Coach contact** — "Send message to coach" CTA (placeholder for v1.6 messaging; in v1.5 it can open mailto: or be disabled).
- **Revoke link button** — Buried in settings (not primary action), with 2-step confirmation: "Are you sure? Your coach will lose access to your data."
- **Read-only badge** — "Programme prescrit par Sophie" clearly visible so athlete knows this is from coach, not AI-generated or self-built.

### Differentiators

- **Compliance widget** — "You're at 75% adherence this week 🔥" — coaching the athlete on staying consistent.
- **Coach's last note visible** — If coach left a note like "great work last week, push harder on Wednesday", show it.
- **Sync indicator** — "Your data is synced with Sophie's coach view" — transparency builds trust.

### Anti-features

- **DO NOT** let athlete edit the prescribed program — read-only, period.
- **DO NOT** show athlete-side notes back to athlete that coach wrote privately — those are coach-private.
- **DO NOT** push notifications for every coach action — opt-in, throttled.

## Public Marketing /coachs

### Table Stakes (conversion-critical)

| Element | Why needed | Complexity |
|---|---|---|
| Above-the-fold value prop | "Le CRM tout-en-un pour coachs sportifs" + sub-headline + screenshot of coach dashboard | S |
| Primary CTA | "Rejoindre la bêta privée" / "Join private beta" — explicit beta framing per PROJECT.md (no pricing yet) | S |
| FR/EN i18n | Already required by site convention | S |
| 3-4 feature blocks | Client CRM · Programmes IA · Import PDF · Suivi temps réel — short, with screenshots | S |
| FAQ section | "C'est gratuit pendant la bêta ?" / "Mes clients ont-ils besoin de payer ?" / "RGPD ?" | S |
| Legal footer | Already required across site (mentions légales, CGU, privacy) | S |

### Differentiators (cheap wins)

- **Live demo video** (60s loop, muted, auto-play) — competitors all do this
- **"Built by athletes, for coaches"** — humanize via founder note
- **Comparison table** — "Ziko vs Trainerize vs TrueCoach" with honest tradeoffs (this is bold but works)

### Anti-features

- **Testimonials** — explicitly deferred (no real coaches yet). Don't fake them.
- **Pricing page** — explicitly deferred (free beta). Avoid the question entirely.
- **"Schedule a demo" form** — adds friction for solo trainers. Self-serve signup CTA is better.
- **Heavy chatbot/intercom widget** — slow page load, low conversion for B2B SaaS in 2026.

## v1.6+ Deferrals

Explicit non-goals for v1.5 (already documented in PROJECT.md, restated here for roadmap clarity):

| Feature | Reason deferred | Target |
|---|---|---|
| Real-time messaging coach↔client | Building messaging is its own 3-week milestone (push notifications, threading, attachments, moderation) | v1.6 |
| Mobile coach views (Expo) | Coach workflow is desktop-first; dense tables work poorly in RN | v1.7+ |
| Coach billing / subscription mgmt | Beta is free; payment infra is its own milestone (Stripe, invoices, VAT) | v1.8 |
| Coach scheduling / calendar | Needs OAuth Google Calendar + booking flow — separate scope | v1.8 |
| Coach hours tracking + accounting | ERP territory; comes after billing | v2.0 |
| Granular per-domain permissions | Full-access RLS join is sufficient for v1.5 trust model | v1.7 |
| Bulk-message broadcast | Anti-pattern; messaging itself comes first | v1.7+ |
| Marketplace (coaches sell programs) | Network-effect feature; needs critical mass first | v2.0+ |
| Multi-coach per athlete | Edge case; schema complexity disproportionate | v2.0+ |
| Garmin .fit / Google Sheets imports | AI file import + Strava OAuth cover the 80% | v1.7+ |

## Coach UX Expectations

1. **Fast roster scanning** — Coaches open the app to triage 30 clients in 5 minutes. Anything requiring more than 2 clicks per client is friction. Last-active + compliance% must be visible without opening detail.
2. **Template-first mental model** — Coaches think in reusable blocks ("my hypertrophy 12-week", "my Hyrox 8-week") and assign copies. Forcing them to build per-client from scratch is a deal-breaker.
3. **Detachment after assignment** — When a coach edits an assigned program for one client, they expect the template to stay unchanged. This is non-obvious but universally expected.
4. **Trust in read-only data** — Coaches want to see EVERYTHING the athlete logged, unfiltered, with timestamps. Aggregations are nice but raw access matters more than competitors realize.
5. **Workflow over features** — Coaches will tolerate fewer features (Hevy) over more features (Trainerize) if daily workflow is smooth. "How long does my Monday morning client review take?" is the real KPI.
6. **AI as assistant, not replacement** — Coaches see themselves as the expert; AI should propose, they dispose. Auto-applied AI changes erode their value-add.
7. **Mobile is for athlete, desktop is for coach** — Coaches build on desktop, check on mobile rarely. Stop pretending coach mobile-first matters in v1.5.

## Client/Athlete UX Expectations

1. **Single source of truth** — Athletes don't want to log workouts twice (once for self, once for coach). The coach must see exactly what the athlete already logs in Ziko — no duplicate effort.
2. **Clear "this is from my coach" labeling** — Athletes need to distinguish AI suggestions from coach prescriptions. Authority hierarchy: coach > athlete > AI.
3. **Privacy reassurance** — "What does my coach see?" must be answerable in one tap. A clear "data shared with coach" indicator builds trust.
4. **Easy revoke** — If the coaching relationship ends, athletes want a no-drama exit. Revoke link, done. Don't require explanation.
5. **Visible coach acknowledgment** — Athletes want to feel SEEN. "Sophie viewed your session yesterday" / "Sophie added a note" — even silent indicators boost retention.
6. **Demo videos for prescribed exercises** — Athletes don't want to guess form on a coach-prescribed exercise. Existing Ziko exercise library + video coverage is a strength.
7. **No surprise account changes** — Coach should not be able to modify athlete's profile, weight, goals, etc. Athletes own their data; coach observes + prescribes.

---

## Confidence Notes

- **HIGH confidence**: Competitor feature inventories (Trainerize, TrueCoach, Hevy Coach) — multiple direct sources including help center docs and comparison articles.
- **MEDIUM confidence**: Specific UX preferences ("coaches prefer folders") — drawn from comparison reviews and user-forum extracts, not direct user research with Ziko's audience.
- **LOW confidence flagged**: PDF import landscape (essentially unaddressed by competitors per searches) — opportunity is real but adoption pattern unproven.

## Sources

- [Hevy Coach vs Trainerize comparison](https://hevycoach.com/compare/trainerize/)
- [Hevy Coach vs TrueCoach comparison](https://hevycoach.com/compare/truecoach/)
- [Trainerize vs TrueCoach — Trainerfu](https://www.trainerfu.com/blog/trainerize-vs-truecoach/)
- [12REPS/TrueCoach/Everfit/MyPTHub/Trainerize comparison 2026](https://ptwill.com/blog/12reps-vs-truecoach-vs-everfit-vs-mypthub-vs-trainerize-which-fitness-app-is-actually-worth-your-money-in-2026/)
- [Trainerize Master Workout Library docs](https://help.trainerize.com/hc/en-us/articles/360035118052-Master-Workout-Library-Overview)
- [Trainerize AI Workout Builder](https://resources.trainerize.com/ai-workout-builder)
- [Trainerize Workout Templates](https://help.trainerize.com/hc/en-us/articles/208688896-How-do-I-use-Workout-Templates-)
- [FitFloww CRM feature list](https://fitflowwcrm.com/best-crm-personal-trainers-2026)
- [FitBudd CRM feature analysis](https://www.fitbudd.com/post/best-crm-software-for-fitness-coaches)
- [Capsule CRM for trainers 2026](https://capsulecrm.com/blog/crm-for-personal-trainers/)
- [Trainerize Client Onboarding ideas forum](https://ideas.trainerize.com/forums/167887-coach-trainer-abc-trainerize/suggestions/49101635-client-onboarding-flow-automated)
- [Trainerize onboarding guide 2026](https://www.trainerize.com/blog/the-ultimate-guide-to-onboarding-new-fitness-clients/)
- [Hevy Coach client app features](https://hevycoach.com/features/personal-trainer-app/)
- [Everfit platform](https://everfit.io/)
- [Best AI personal trainer apps 2026 — Ray](https://www.rayfit.com/blog/2026/02/best-ai-personal-trainer-app/)
- [WorkoutGen AI generator](https://workoutgen.app/)
- [Australian Institute of Fitness — coaching tech trends](https://fitness.edu.au/the-fitness-zone/leveraging-technology-the-best-apps-and-tools-for-personal-trainers/)
- [Virtuagym — best personal trainer apps 2026](https://business.virtuagym.com/blog/best-personal-trainer-app/)
- [Landingi — fitness landing page examples](https://landingi.com/landing-page/fitness-examples/)
- [Unbounce — 12 fitness landing pages](https://unbounce.com/landing-page-examples/fitness/)
