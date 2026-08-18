# Phase 3: Legal — CGV & CGU - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-14
**Phase:** 3-Legal — CGV & CGU
**Areas discussed:** À vie scope & discontinuation, Retention period, Erasure mechanism, Counsel-review gate, Counsel-briefing status, Governing language

> **Note on provenance:** The "À vie scope & discontinuation" area below was discussed in an earlier
> session whose answers were captured in an interrupted `03-DISCUSS-CHECKPOINT.json` that was never
> committed — discovered only after this session had independently re-derived a less specific version
> of the same decisions from research alone. The checkpoint's answers are authoritative and are what's
> recorded here and in CONTEXT.md D-03/D-04.

---

## À vie scope & discontinuation

**From the earlier, interrupted session (checkpoint):**

| Question | Answer |
|----------|--------|
| What should "à vie" (lifetime) be legally scoped to? | Life of the Service — "valid for as long as Ziko operates the Service" |
| What exactly does "Premium" include for founders — frozen or evolving feature set? | Frozen at offer date + optional additions |
| How should the CGV state Ziko's right to modify or discontinue the offer? | Narrow + notice-bearing — genuine service-wide shutdown only, advance notice + data-export commitment |
| Should the CGV state the founder's AI-credit cap explicitly, and can that cap value itself change later? | Explicit parity, cap can evolve platform-wide — same rules as any premium user, adjustable only as a platform-wide policy change, never singling out founders |

**Locked decisions:** all four, as stated above. See CONTEXT.md D-03/D-04.

---

## Retention period (LEGAL-08)

| Option | Description | Selected |
|--------|-------------|----------|
| 3 years from last contact | Matches CNIL's NS-048 prospect-data ceiling exactly. Well-precedented, easy to defend to counsel. | ✓ |
| Until launch, then a short fixed window | Shorter data footprint, but risks erasing before all 200 founders have redeemed/confirmed. | |

**User's choice:** 3 years from last contact
**Notes:** See CONTEXT.md D-05.

---

## Erasure UX (LEGAL-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Email support@ziko-app.com, manual trigger | Privacy notice states the right + contact channel; a human runs Phase 1's anonymization RPC on request. No new UI needed. | ✓ |
| Self-service link in the confirmation email | Requires building the (v2-deferred) confirmation-email flow now — new scope. | |

**User's choice:** Email support@ziko-app.com, manual trigger
**Notes:** See CONTEXT.md D-06.

---

## Counsel gate

| Option | Description | Selected |
|--------|-------------|----------|
| Draft + blocking counsel-approval checkpoint | Claude drafts and publishes draft-marked pages, but the phase's final task is a blocking checkpoint — does not complete until the user confirms real counsel approved. Mirrors Phase 2's D-03. | ✓ |
| Draft + publish now, counsel review tracked separately | Publishes immediately without waiting for confirmed sign-off, accepting the flagged legal risk as an already-made judgment call. | |

**User's choice:** Draft + blocking counsel-approval checkpoint (the recommended option)
**Notes:** See CONTEXT.md D-01.

---

## Counsel status

| Option | Description | Selected |
|--------|-------------|----------|
| Package it for me | Deliver draft text plus a counsel-briefing document pulling together every open item PITFALLS.md already flagged. | ✓ |
| I'll brief counsel myself | Deliver clean draft text only; user extracts what counsel needs to see. | |

**User's choice:** Package it for me
**Notes:** See CONTEXT.md D-02.

---

## Governing language

| Option | Description | Selected |
|--------|-------------|----------|
| French governs, English is courtesy translation | French drafted first, legally binding; English is a professional translation with an explicit precedence clause. Standard for a French-law contract. | ✓ |
| Both equally authoritative, no precedence clause | Requires exact legal sync between both versions, less standard for French-law contracts. | |

**User's choice:** French governs, English is courtesy translation (the recommended option)
**Notes:** See CONTEXT.md D-08.

---

## Claude's Discretion

- Exact page routes/URL structure for the CGV/CGU pages under `apps/web`.
- Exact wording within the D-03/D-04 guardrails.
- Format and structure of the counsel-briefing document.
- How "draft pending review" is marked on the live pages before counsel clears the checkpoint.

## Deferred Ideas

- Self-service erasure link in a confirmation email (ENG-02/ENG-01) — v2.
- The waitlist form's actual checkbox/notice UI — Phase 5 (D-07 boundary).
- The credit-gate code change and feature-flag activation — Phase 4 / Phase 6.
