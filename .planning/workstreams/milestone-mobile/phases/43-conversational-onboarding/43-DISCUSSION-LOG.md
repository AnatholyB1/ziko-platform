# Phase 43: Conversational Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-01
**Phase:** 43-conversational-onboarding
**Areas discussed:** Onboarding trigger & placement, Mascotte presentation, Question content & tone, Micro-action & celebration UX

---

## Onboarding trigger & placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right after OBReady, before first app screen | Final step after existing 7-step flow, before home tab | ✓ |
| During step-7's loading screen | Replace static LOAD_PHASES with live chat | |
| Deferred, first app-open prompt | Prompt/banner on first home-tab visit | |

**User's choice:** Right after OBReady, before first app screen.

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy, on next app open | Mirrors v1.4 lazy-daily-reset pattern | ✓ |
| One-time backfill script | Ops script at deploy time | |
| Weekly cron picks it up | Piggyback Phase 44's cron | |

**User's choice:** Lazy, on next app open.

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory, no skip | No skip button, avoids default-fallback contradiction | ✓ |
| Skippable with a default fallback | Visible skip, writes conservative default | |

**User's choice:** Mandatory, no skip.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing AI chat stack | ai_conversations, getOrCreateConversation/appendMessages | ✓ |
| Lightweight one-off, no persistence | Client-collects-then-submits-once | |

**User's choice:** Reuse existing AI chat stack.

**Notes:** No follow-up clarifications; all recommended options accepted.

---

## Mascotte presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Static avatar + chat bubbles | Reuses apps/mobile/app/(app)/ai/index.tsx pattern | ✓ |
| Custom full-screen conversational experience | Bespoke one-question-at-a-time screen | |
| Text-only, no visual mascotte yet | No avatar, generic coach voice | |

**User's choice:** Static avatar + chat bubbles.

| Option | Description | Selected |
|--------|-------------|----------|
| Generic 'coach' voice, no name yet | Avoids inventing brand asset mid-engineering-phase | |
| You have a name/character in mind | User provides name/personality | ✓ |

**User's choice:** User has a name/character in mind → follow-up asked directly (plain text, not AskUserQuestion, per empty-option-elaboration handling).
**User's answer:** "ziko, playfull" → captured as name **Ziko**, personality **playful**.

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder icon now, real art later | Ionicons glyph or colored circle avatar | ✓ |
| Commission/generate real mascotte artwork this phase | Actual character art before shipping | |

**User's choice:** Placeholder icon now, real art later.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate, fixed onboarding character | Ziko always Ziko regardless of persona-plugin state | ✓ |
| Same entity — Ziko is the persona-plugin coach's default identity | Onboarding introduces the persona-plugin coach under name "Ziko" | |

**User's choice:** Separate, fixed onboarding character.

**Notes:** Mascotte name/personality came from user free text, not a predefined option — captured verbatim in CONTEXT.md D-06.

---

## Question content & tone

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drafts them now, you review in CONTEXT.md | Fixed candidate questions, editable | |
| AI generates questions dynamically per athlete | No fixed bank, fully adaptive | ✓ |
| You write the exact questions | User provides exact wording | |

**User's choice:** AI generates questions dynamically per athlete (not the recommended option).

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded French only | Matches existing plugin-screen convention | |
| Full fr/en via useTranslation() | New coach.onboarding.* namespace | ✓ |

**User's choice:** Full fr/en via useTranslation() (not the recommended option).

**Follow-up tension identified:** dynamic AI-generated question text has no fixed string to put behind a t() key — Claude flagged this and asked a clarifying follow-up.

| Option | Description | Selected |
|--------|-------------|----------|
| AI generates in the athlete's app locale; only UI chrome uses t() | System prompt sets locale; static chrome translated | ✓ |
| Fixed question bank per locale, AI only picks which to ask | Reconsider fully-dynamic generation | |

**User's choice:** AI generates in the athlete's app locale; only UI chrome uses t(). Resolves the dynamic-generation ↔ i18n tension.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured guidance: must cover 3 fixed themes, wording is free | System prompt names required signal categories | ✓ |
| Fully open, minimal constraint | Only tone + question cap specified | |

**User's choice:** Structured guidance: must cover 3 fixed themes, wording is free.

| Option | Description | Selected |
|--------|-------------|----------|
| Playful + casual (tutoiement, light emoji ok) | Full mascotte voice with emoji | |
| Playful but restrained (tutoiement, no emoji) | Warm/informal, no emoji/decoration | ✓ |

**User's choice:** Playful but restrained (tutoiement, no emoji).

**Notes:** This area had the most deviation from recommended defaults — reflects a deliberate product choice for a fully adaptive, non-scripted conversational onboarding.

---

## Micro-action & celebration UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline card at end of chat, hands off to the right plugin on tap | Deep-links into existing plugin completion flow | ✓ |
| Fully self-contained in the onboarding screen | Self-contained tap-to-confirm | |

**User's choice:** Inline card at end of chat, hands off to the right plugin on tap.

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen Ziko celebration moment | Overlay with avatar, copy, animation | ✓ |
| Toast/banner, less intrusive | CreditEarnToast-style brief confirmation | |

**User's choice:** Full-screen Ziko celebration moment.

| Option | Description | Selected |
|--------|-------------|----------|
| Small curated set | Hydration/journal/measurements starting candidates | ✓ |
| Any installed plugin, AI's full discretion | Broader adaptive selection | |

**User's choice:** Small curated set.

| Option | Description | Selected |
|--------|-------------|----------|
| Poll/refetch real logged data | Re-verify against actual table before celebrating | ✓ |
| Self-reported 'I did it' tap | No re-fetch, trust the tap | |

**User's choice:** Poll/refetch real logged data.

**Notes:** All recommended options accepted in this area — consistent with the research's Pitfall 1 grounding discipline extended to the first athlete interaction.

---

## Claude's Discretion

- Exact final list of curated micro-action target plugins/actions beyond the three starting candidates (hydration, journal, measurements) — confirm during planning.
- Exact `coach.onboarding.*` (or equivalent) i18n key namespace naming and full fr/en key set for UI chrome.
- Exact mechanism for resuming Ziko's chat if the app was killed mid-flow.
- Exact placeholder avatar treatment (icon choice, sizing).
- Exact polling/refetch mechanism and timing for completion detection (e.g. `useFocusEffect` vs. a manual check button).
- Whether the onboarding-tagged AI conversation uses a distinct `stopWhen` cap (research suggests raising the interactive-turn step cap to a named constant like 8) — confirm against the ≤4-question UX requirement during planning.

## Deferred Ideas

- Real/commissioned mascotte artwork for Ziko — placeholder only this phase, art production is a separate future effort.
- Ziko as the persona plugin's default identity — considered and explicitly rejected; Ziko stays fixed and separate.
- Fixed/translatable question bank instead of full AI generation — considered and rejected; noted for a possible future revisit if manual review shows the AI drifting off required signal categories.
- Extended multi-state animated mascotte, factions/leagues/social layer — already out of scope at the milestone level (PROJECT.md SEED-001), not re-litigated here.
