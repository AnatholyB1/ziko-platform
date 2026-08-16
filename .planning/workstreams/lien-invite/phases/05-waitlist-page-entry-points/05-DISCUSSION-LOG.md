# Phase 5: Waitlist Page & Entry Points - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-16
**Phase:** 5-Waitlist Page & Entry Points
**Areas discussed:** Coexistence with /coach/onboarding, Entry-point prominence, Athlete vs. coach page content, "Complete" state framing

---

## Coexistence with /coach/onboarding

**Q1: What should happen to the two /coachs CTAs currently pointing at /coach/onboarding during the waitlist period?**

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /fondateurs | Replace both CTA targets with /fondateurs (coach profile preselected) | ✓ |
| Coexist unchanged | Leave both CTAs as-is; add /fondateurs as a separate additional link | |
| Reframe CTA copy, same target | Change copy to mention founder offer but keep linking to /coach/onboarding | |

**User's choice:** Redirect to /fondateurs (Recommended)

**Q2: Should /coach/onboarding itself still work for anyone who reaches it directly?**

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it fully functional | No code change to the route; just no longer linked from /coachs | ✓ |
| Redirect it to /fondateurs too | Harder gate — any visit server-redirects to /fondateurs | |

**User's choice:** Leave it fully functional (Recommended)

**Q3: Does the header CTA (/coach/dashboard, existing coach login) change during the waitlist period?**

| Option | Description | Selected |
|--------|-------------|----------|
| No — leave it as-is | It's a login entry point, not a signup funnel | ✓ |
| Yes — also point it at /fondateurs | Funnels every coach path through the waitlist, including logins | |

**User's choice:** No — leave it as-is (Recommended)

**Q4: How should the new founders nav link in header/footer read/stand out?**

| Option | Description | Selected |
|--------|-------------|----------|
| Plain nav link | Same visual weight as existing footer links | ✓ |
| Highlighted/badged pill | Visually distinct, competes with primary CTA button | |

**User's choice:** Plain nav link, e.g. "Fondateurs" (Recommended)

---

## Entry-point prominence

**Q1: Should the homepage get a prominent founders banner/section, or just a subtle link?**

| Option | Description | Selected |
|--------|-------------|----------|
| Add a dedicated banner/section | New homepage section specifically promoting the offer | ✓ |
| Subtle nav/footer link only | No new homepage section, minimal footprint | |

**User's choice:** Add a dedicated banner/section (Recommended)

**Q2: Where should the founders banner/section sit on the homepage?**

| Option | Description | Selected |
|--------|-------------|----------|
| Right after Hero | Second thing a visitor sees, maximum visibility | ✓ |
| Slim announcement bar above Hero | Sticky-ish strip above even the header | |
| Near the bottom, before/replacing Pricing | Late-scroll conversion nudge | |

**User's choice:** Right after Hero (Recommended)

**Q3: Does /coachs also need a dedicated founders section, or is the CTA redirect enough?**

| Option | Description | Selected |
|--------|-------------|----------|
| CTAs redirected is enough | The already-redirected CTAs are the natural conversion points | ✓ |
| Also add a dedicated section | Same treatment as the homepage | |

**User's choice:** CTAs redirected is enough (Recommended)

---

## Athlete vs. coach page content

**Q1: Does the page's narrative/copy branch by audience beyond the profile picker, or stay one shared story?**

| Option | Description | Selected |
|--------|-------------|----------|
| One shared narrative | Only the picker and confirmation are audience-aware | ✓ |
| Branching content blocks | Value-prop sections swap depending on profile selected | |

**User's choice:** One shared narrative (Recommended)

**Q2: How should the coach-preselection from the /coachs redirect behave?**

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-picked, still changeable | Coach highlighted, email field visible, athlete still clickable | ✓ |
| Locked to coach, no athlete option shown | Separate landing view with no picker at all | |

**User's choice:** Pre-picked, still changeable (Recommended)

---

## "Complete" state framing

**Q1: What should the "complete" state actually offer once 200 founder spots are claimed?**

| Option | Description | Selected |
|--------|-------------|----------|
| General waitlist for updates | Form keeps working, honest that lifetime premium is gone | ✓ |
| Redirect to app download / homepage | Stop capturing emails on this page once full | |

**User's choice:** General waitlist for updates (Recommended)

**Q2: How should the counter area look in the complete state?**

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with a clear "complete" message | Distinct sold-out message instead of "0 remaining" | ✓ |
| Keep showing "0 remaining" plus a note | Counter stays visually consistent throughout | |

**User's choice:** Replace with a clear "complete" message (Recommended)

---

## Claude's Discretion

- Exact visual layout of the profile picker, homepage founders section, and complete-state message —
  belongs to the UI-SPEC phase (`/gsd-ui-phase 5`).
- Exact copy/wording within the shared-narrative and complete-state framing constraints.
- Which analytics mechanism satisfies ENTRY-06 (`@vercel/analytics`/`@vercel/speed-insights` per
  research, and/or the UTM columns Phase 1 already stores).
- Bot-protection stack composition (`mailchecker` + `botid` + Upstash) — already fully specified in
  research, not re-litigated in this discussion.

## Deferred Ideas

- Redirecting or gating `/coach/onboarding` itself — considered and rejected.
- A dedicated founders section on `/coachs` — considered and rejected.
- Branching page content per audience — considered and rejected; could be revisited post-launch based
  on conversion data.
- Visible CAPTCHA (Turnstile) — held in reserve, only if BotID proves insufficient post-launch.
