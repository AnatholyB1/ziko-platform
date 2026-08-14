# Phase 3: Legal — CGV & CGU - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the bilingual (FR/EN) CGV and CGU text describing the founder offer and the AI-credit
cap, published as real page routes marked draft-pending-review, plus a counsel-briefing package —
gated behind a blocking checkpoint that only clears on the user's confirmation that real outside
counsel has reviewed and approved. It also delivers the retention-period statement (LEGAL-08) and the
erasure-request mechanism (LEGAL-09) for waitlist addresses, and the FR/EN copy for the waitlist form's
consent checkbox and point-of-collection RGPD notice (LEGAL-06/07) — the copy only, not the form UI
itself (that's Phase 5's `<domain>`).

**In scope:** CGV page (FR+EN), CGU revision for AI-credit-cap consistency, the counsel-briefing
document, the consent-checkbox + collection-notice copy, the retention statement, the erasure-request
mechanism (email-based, manual trigger), and the blocking counsel-approval checkpoint.

**Out of scope:** the waitlist form's actual UI (checkbox rendering, notice placement — Phase 5); the
credit-gate code change itself (Phase 4, which this phase's completion gates per LEGAL-05); any
self-service erasure UI or confirmation-email flow (deferred to v2 per ENG-01–05); flipping the
credit-gate feature flag (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Counsel-review gate

- **D-01:** This phase follows Phase 2's D-03 pattern: Claude drafts the highest-quality CGV/CGU text
  it can and builds the actual page routes, marked as a draft pending legal review — but the phase's
  final task is a **blocking checkpoint** that does not clear until the user confirms real outside
  counsel has reviewed and approved. Phase 3 is not "complete" on drafting alone; LEGAL-05's "reviewed
  by counsel before publish" is binding on the phase's own completion, not just on Phase 4's start.
  — **Reversibility:** costly — reverting to "publish now, review later" after this phase closes means
  re-opening a phase already marked complete and re-litigating whatever went live in the meantime.

- **D-02:** Deliver a **counsel-briefing package** alongside the draft text: a short document pulling
  together every open question `research/PITFALLS.md` already flagged for lawyer review — the "à vie"
  scope under `pratique commerciale trompeuse` (Pitfall 7), the black-list/grey-list line on the
  modification clause (Pitfall 8), and the free-vs-paid lifetime-benefit consumer-law nuance (Pitfall
  8) — so the user can hand it to any lawyer without re-deriving the open questions themselves.

### Drafting content

> **Provenance note:** D-03/D-04 below were originally discussed in an earlier, interrupted session
> whose answers were captured in a `03-DISCUSS-CHECKPOINT.json` that was never committed — discovered
> only after this session had independently derived a slightly less specific version of the same
> decisions from research alone. The checkpoint's answers are authoritative and are what's recorded
> here (all four sub-questions had a clear "recommended" option the user's checkpoint selected).

- **D-03:** The "à vie" clause is scoped to **the life of the Service**, not the person, per
  `research/PITFALLS.md` Pitfall 7: "l'avantage Premium à vie est valable pour toute la durée
  d'exploitation du Service par [Company]." **Premium is frozen at the offer date's feature set, with
  future additions extended to founders only at the company's discretion** (adding, not taking away —
  the exact checkpoint wording, narrower than "may or may not extend"). **The AI-credit cap is stated
  explicitly in the CGV with founder parity to any other premium user, and the cap value itself may
  evolve — but only as a platform-wide policy change that never singles out founders specifically.**
  No "premium = unlimited AI" implication anywhere, including marketing copy.

- **D-04:** No unconditional unilateral-modification clause (Pitfall 8's black-list trap). Modification
  rights follow the grey-list pattern: **narrow and notice-bearing** — genuine service-wide shutdown
  only, with an advance notice period and a data-export commitment, never a way to quietly remove the
  founder benefit while the rest of the app continues.

### Bilingual governing language

- **D-08:** **French governs legally; English is a professional courtesy translation** with an
  explicit precedence clause stating French controls in case of discrepancy. Ziko is a French company
  and Code de la consommation is the applicable law — this is the standard pattern for a French-law
  contract offered bilingually, not an area requiring further discussion. French is drafted first;
  English follows as translation, not parallel independent drafting.
  — **Reversibility:** costly — switching to dual-authoritative text after publish means re-verifying
  the two versions say the same thing with no gaps, effectively a re-draft.

### Retention & erasure (LEGAL-08/09)

- **D-05:** Retention period is **3 years from last contact** — matches CNIL's NS-048 prospect-data
  ceiling, well-precedented and easy to defend to counsel. Stated explicitly in the collection-point
  notice and the CGV/privacy text.
  — **Reversibility:** reversible — a documented policy value, changeable with a new decision record.

- **D-06:** Erasure requests go through **email (`support@ziko-app.com`) with a manual trigger** — the
  privacy notice states the right and the contact channel; a human runs Phase 1's
  `anonymize_waitlist_signup()` RPC on request. No self-service UI is built this milestone — matches
  scope (no waitlist account/dashboard exists) and REQUIREMENTS.md's explicit deferral of a
  confirmation-email flow (ENG-01–05) to v2.
  — **Reversibility:** reversible — a self-service link can be added later without touching this
  phase's text or the anonymization mechanism itself.

### Scope boundary vs. Phase 5

- **D-07:** LEGAL-06/07 (consent checkbox + collection-point notice) are satisfied by Phase 3
  delivering **final FR+EN copy only** — the checkbox label text and the notice text, as reviewable
  content. The actual form UI that renders them doesn't exist until Phase 5 builds the waitlist page;
  wiring the copy in is Phase 5's job. This follows Phase 1's D-15 precedent exactly ("phase 3 defines
  what goes in [the consent columns], phase 5 for the UI") extended to the checkbox/notice copy by the
  same logic — Claude's own inference from established precedent, not re-discussed with the user.
  — **Reversibility:** reversible — a boundary-placement decision, not a one-way door.

### Claude's Discretion

- Exact page routes/URL structure for the CGV/CGU pages under `apps/web` (follow existing legal-page
  conventions already in the codebase — Mentions légales, Politique de confidentialité, CGU already
  exist per `.planning/PROJECT.md`'s v1.0 shipped log).
- Exact wording within the D-03/D-04 guardrails — the research gives the shape of correct language,
  not verbatim clauses.
- Format and structure of the counsel-briefing document (D-02).
- How the "draft pending review" state is visually/textually marked on the live pages before
  counsel approval clears the checkpoint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone specs
- `.planning/workstreams/lien-invite/REQUIREMENTS.md` — LEGAL-01→09 are this phase's requirements;
  also the "Lawyer Review Required" section (three open items research explicitly refused to settle).
- `.planning/workstreams/lien-invite/ROADMAP.md` — Phase 3 goal and 5 success criteria; the LEGAL-05
  hard-precondition relationship to Phase 4.
- `.planning/workstreams/lien-invite/research/PITFALLS.md` — Pitfalls 1, 2, 3, 4, 6, 7, 8, 10 (all
  flagged as relevant at plan time); Pitfalls 7 and 8 specifically are the source of D-03/D-04 and are
  the single highest-severity item in the whole milestone.
- `.planning/workstreams/lien-invite/phases/01-data-foundation/01-CONTEXT.md` D-15/D-16 — the
  consent-proof columns and `anonymize_waitlist_signup()` RPC this phase's D-06 relies on.
- `.planning/workstreams/lien-invite/phases/02-test-account-purge/02-CONTEXT.md` D-03 — the
  build-then-human-gate pattern this phase's D-01 mirrors.

### Codebase idioms this phase must follow
- Existing legal pages (Mentions légales, Politique de confidentialité, CGU) shipped in v1.0 per
  `.planning/PROJECT.md` — read their actual routes/structure before creating new ones, follow the
  same FR/EN i18n pattern (`next-intl`, `[locale]` URL prefix per `CLAUDE.md`'s i18n section).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `next-intl` FR/EN routing already in place (`apps/web/src/i18n/`) — new legal pages follow the same
  pattern as existing ones, no new i18n infrastructure needed.
- Phase 1's `anonymize_waitlist_signup(email)` RPC — the mechanism D-06's manual erasure trigger calls.

### Established Patterns
- Existing legal pages (CGU, Mentions légales, Politique de confidentialité) are the closest analog
  for page structure, routing, and FR/EN treatment — read them, don't invent a new pattern.

### Integration Points
- No database changes anticipated — the consent-proof columns and retention config already exist from
  Phase 1 (`app_config`, consent timestamp/version columns).
- Phase 5 consumes this phase's D-07 copy output when it builds the actual waitlist form.
- Phase 4 is blocked on this phase's completion (LEGAL-05) — the blocking checkpoint (D-01) is the
  literal gate.

</code_context>

<specifics>
## Specific Ideas

- The counsel-briefing package (D-02) should be genuinely usable — organized around the exact open
  questions, not a generic "please review our legal docs" note.
- The "draft pending review" marking on the live pages should be honest and visible, not a hidden
  flag only Claude can see — since real visitors could see these pages before counsel clears them.

</specifics>

<deferred>
## Deferred Ideas

- Self-service erasure link in a confirmation email (ENG-02/ENG-01) — v2, per REQUIREMENTS.md.
- The waitlist form's actual checkbox/notice UI — Phase 5, per D-07.
- The credit-gate code change itself and its feature-flag activation — Phase 4 and Phase 6
  respectively; this phase only gates their start via LEGAL-05.

</deferred>

---

*Phase: 3-Legal — CGV & CGU*
*Context gathered: 2026-08-14*
