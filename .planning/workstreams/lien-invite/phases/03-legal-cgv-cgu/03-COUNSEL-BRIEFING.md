# Ziko — Counsel Briefing: Founder Offer CGV/CGU Review

**Prepared for:** outside counsel reviewing the CGV, the CGU, and the founder-offer legal copy
before public launch.
**Prepared by:** Ziko, with drafting assistance from Claude (Anthropic). **Every clause quoted or
excerpted in this document is Claude-generated within the guardrails recorded in this phase's
planning context and research — it is a proposal for counsel to accept, amend, or reject, not a
settled legal conclusion.** `03-RESEARCH.md`'s Assumptions Log entry **A4** marks this drafting as
unconfirmed pending exactly this review: *"Concrete clause skeletons synthesized here (e.g. the
sample 'draft pending review' banner text, the AI-credit-cap parity phrasing) are legally sound in
the shape PITFALLS.md's Pitfalls 7/8 describe... this is exactly the category of claim D-01's
blocking counsel-review checkpoint exists to catch; must not be treated as legally final without
outside counsel sign-off."*

You have not read this repository's planning history and have not been part of any prior
conversation about this project. This document is self-contained: it tells you who Ziko is, what
is enclosed, and exactly seven open questions we need your judgment on. You should not need to
re-derive anything from the enclosed drafts themselves.

---

## 1. Orientation

**Who Ziko is.** Ziko is a French fitness-and-AI-coaching product (mobile app + web) offered to a
French consumer audience. It is governed by French law, including the Code de la consommation.

**What the founder offer is, in three sentences.** Ziko is launching a public waitlist. The first
200 people to confirm their registration receive, free of charge and without any purchase or
subscription obligation, lifetime access to Ziko's Premium tier. Premium unlocks every feature of
the app, but use of the AI features specifically (AI coach, meal-photo analysis, program
generation) remains subject to a monthly credit allowance identical to that of any other Premium
user — "lifetime Premium" does not mean "unlimited AI."

**What is enclosed and where it is live.**

| Document | Where it lives |
|---|---|
| CGV (Conditions Générales de Vente) — the founder-offer contract | `/fr/cgv` and `/en/cgv` (public route) |
| CGU (Conditions Générales d'Utilisation) — general terms of use, revised this phase for AI-credit-cap consistency | `/fr/cgu` and `/en/cgu` (public route) |
| Politique de confidentialité — revised this phase for waitlist retention/erasure | `/fr/politique-de-confidentialite` and `/en/...` |

Both the CGV and the CGU currently carry a visible "document under legal review" banner on the
live page — every visitor sees it, it is not a hidden flag. Removing that banner is the natural
next step once you sign off.

**Governing language.** The CGV and CGU are drafted in French first; French is the sole
authoritative version. English is provided only as a courtesy translation for non-French-speaking
users, with an explicit clause stating French controls in the event of any discrepancy between the
two.

**Status of the drafting.** Everything enclosed — every clause quoted below, every sentence in the
live pages — was drafted by Claude (an AI system) within decision guardrails the Ziko team set
(recorded in `03-CONTEXT.md`), without legal advice. It is offered as a considered starting point,
not as text ready to ship. Your role is to tell us where it is wrong, where it is legally
unenforceable, and where it needs a number, a jurisdiction, or a legal nuance we are not qualified
to supply ourselves.

**How to use this document.** Sections Q1 through Q7 below are the seven open questions that block
our own internal sign-off. Each follows the same shape: the question, the exact source text that
raised it (quoted verbatim, never paraphrased), the clause as currently drafted, and what we are
specifically asking you to decide or confirm. Please answer them in order; nothing else in this
package requires your review beyond what Q1–Q7 point at.

---

## Q1. Does "à vie" (lifetime), as scoped in the CGV, hold up under `pratique commerciale trompeuse`?

**Source — `research/PITFALLS.md`, Pitfall 7** (quoted verbatim):

> "Flag for lawyer review: whether the specific French phrase 'à vie' carries an implied warranty
> under `pratique commerciale trompeuse` case law beyond what's outlined above is a question for
> counsel — this section gives you the shape of the answer, not a citable ruling on this exact
> fact pattern."

**Source — `REQUIREMENTS.md`, "Lawyer Review Required" section** (quoted verbatim):

> "Rédaction de la clause « à vie » au regard de l'article R.212-1 du Code de la consommation"

**The clause as currently drafted** (`LIFETIME_SCOPE_SENTENCE`, from
`apps/web/src/content/legal/founder-offer.ts`, CGV section 4 / CGU cross-reference):

> FR: "L'avantage Premium à vie est valable pour toute la durée d'exploitation du Service par
> Ziko. Il correspond à l'ensemble des fonctionnalités Premium disponibles à la date de l'offre
> fondateurs. Les fonctionnalités Premium ajoutées ultérieurement pourront être étendues aux
> membres fondateurs, à la discrétion de Ziko, sans que cela ne constitue un engagement
> contractuel additionnel."
>
> EN: "The lifetime Premium benefit is valid for the entire operating lifetime of the Service by
> Ziko. It corresponds to the set of Premium features available as of the founder offer date.
> Premium features added later may be extended to founding members at Ziko's discretion, without
> this constituting an additional contractual commitment."

**What we are asking:** Does scoping "à vie" to the Service's operating lifetime (rather than the
user's), combined with the frozen-feature-set framing, sufficiently avoid the `pratique
commerciale trompeuse` risk Pitfall 7 flags? Is there a more defensible phrasing under Article
L.121-2/L.121-3 of the Code de la consommation, or is the drafted approach sound as written?

---

## Q2. Does the abusive-clause (`clause abusive`) black-list/grey-list framework apply the same way to a free lifetime benefit as it does to a paid subscription?

**Source — `research/PITFALLS.md`, Pitfall 8** (quoted verbatim):

> "Flag for lawyer review: the precise line between 'black list' (irrebuttable) and 'grey list'
> (arguable) for a *free/discounted* lifetime benefit (as opposed to a paid subscription) is a
> nuance counsel should confirm — consumer law protections are generally strongest for contracts
> involving payment, and it's not settled how they map onto a 'free lifetime perk' attached to an
> otherwise free product tier."

**Source — `REQUIREMENTS.md`, "Lawyer Review Required" section** (quoted verbatim):

> "Applicabilité du régime des clauses abusives à un avantage gratuit à vie"

**The clause as currently drafted** (`SHUTDOWN_MODIFICATION_CLAUSE`, from
`apps/web/src/content/legal/founder-offer.ts`, CGV section 6):

> FR: "Ziko ne peut mettre fin à l'avantage Premium à vie des membres fondateurs que dans le cadre
> d'une cessation générale du Service. Dans ce cas, Ziko s'engage à notifier les utilisateurs
> concernés avec un préavis raisonnable d'au moins [TBD — nombre de jours à confirmer par le
> conseil] jours et à leur permettre d'exporter leurs données personnelles avant la fermeture."
>
> EN: "Ziko may only end founding members' lifetime Premium benefit as part of a general shutdown
> of the Service. In that case, Ziko commits to notifying affected users with reasonable advance
> notice of at least [TBD — day count to be confirmed by counsel] days and to allowing them to
> export their personal data before closure."

We deliberately avoided the black-list trap Pitfall 8 names — an unconditional
"à tout moment, sans préavis, à sa seule discrétion" modification right — and instead scoped the
only permitted termination to a genuine service-wide shutdown, with notice and a data-export
commitment (the CGV's grey-list-pattern approach, per Article R.212-1's distinction between
irrebuttably abusive and arguable clauses).

**What we are asking:** Is the grey-list framing (narrow, justified, notice-bearing) the right
legal shape here given this is a free benefit rather than a paid one? Does anything about the
"free lifetime perk" fact pattern change the analysis compared to a standard paid-subscription
modification clause?

---

## Q3. Does a claimed founder spot survive an erasure request as an accepted contractual offer?

**Source — `research/PITFALLS.md`, Pitfall 4** (quoted verbatim):

> "Flag for lawyer review: whether a granted-but-unclaimed 'spot' constitutes an accepted
> contractual offer that survives an erasure request is not settled by GDPR text alone — this sits
> at the RGPD/consumer-contract-law intersection and should be reviewed by counsel before the CGV
> language is finalized."

**Source — `REQUIREMENTS.md`, "Lawyer Review Required" section** (quoted verbatim):

> "Sort d'une place fondateur revendiquée face à une demande d'effacement RGPD"

**The mechanism as currently built:** Phase 1's `anonymize_waitlist_signup(p_email)` RPC
(`supabase/migrations/20260812_waitlist_founder_offer.sql` lines 217-241) is the only erasure path.
On erasure it blanks the stored email and identifying fields and sets `anonymized_at` — but it
**deliberately does not touch `founder_rank` or `is_founder`**. The person's identity is gone; the
numbered spot stays consumed. This keeps the public counter from ever appearing to move backward
(FOND-04's monotonicity guarantee), but it does not by itself answer whether the underlying
*entitlement* — "you get lifetime Premium" — survives once the identity it was granted to has been
erased and, if the same person later signs up for a real account under a different address,
whether they can reclaim it.

**The CGV's related text** (section 7, "Données personnelles"): points to the Politique de
confidentialité rather than restating the mechanics. The privacy page's waitlist section states
the retention period and the erasure-request channel but does not address the fate of the
underlying founder-status entitlement.

**What we are asking:** Does a claimed-but-unconverted founder spot constitute an accepted
contractual offer under French consumer-contract law that survives (or should survive) an erasure
request? Should the CGV state explicitly that exercising erasure before converting to an account
voids the reserved spot — and if so, is our current silence on this point a gap we need to close
before launch, or is the RPC's current behavior (identity erased, spot number retained but
unclaimed by anyone) legally sufficient as-is?

---

## Q4. Is advance notice plus continued use sufficient acceptance of the new AI-credit cap for any existing Premium user?

**Source — `research/PITFALLS.md`, Pitfall 9** (quoted verbatim):

> "Flag for lawyer review: if any real paying premium user exists and did not explicitly agree to
> the new capped terms, silently downgrading them is a genuine consumer-law exposure, not just a
> UX rough edge — get counsel's read on whether advance notice + continued use = implied
> acceptance is sufficient here, or whether affirmative re-consent is needed."

**Context, not yet resolved by code:** Phase 4 of this milestone (not yet started) will remove the
current unconditional `tier === 'premium'` AI-credit bypass and replace it with the same capped
allowance founder members receive. Before any code changes, Phase 4's own first gate audits the
live count of `tier='premium'` users in production — the working assumption
(`REQUIREMENTS.md` A-01) is that zero real users currently hold that tier, only test accounts. If
that assumption turns out to be false, the question below becomes live and blocking; if it holds,
this question is moot for v1 but the answer is still worth having on record for any future
capacity change.

**What we are asking:** If Ziko does find real premium users who were previously granted
unlimited AI access under the current CGU, is advance notice of the new cap plus their continued
use of the app sufficient legal acceptance of the new, more restrictive terms — or does French
consumer law require an affirmative re-consent step (e.g. a checkbox, a re-acceptance click)
before the cap can be enforced against them?

---

## Q5. Does the CGU's pre-existing general amendment clause (section 10) need the same grey-list narrowing as the new founder-offer clause?

**Source — `03-RESEARCH.md`, Open Question 3** (quoted verbatim):

> "Whether the pre-existing, general CGU amendment clause (unrelated to the founder offer, present
> since v1.0) also needs the grey-list-pattern narrowing D-04 describes, or whether it's acceptable
> as a standard ToS-amendment clause because it doesn't single out revoking a specific granted
> benefit... Include this clause in the counsel-briefing package's review list even though
> CONTEXT.md's decisions don't explicitly scope it in — counsel reviewing CGU/CGV consistency will
> read it regardless, and flagging it proactively is cheaper than a follow-up question mid-review."

**The clause, quoted verbatim from the live CGU page**
(`apps/web/src/app/[locale]/(marketing)/cgu/page.tsx`, section 10, "Modification des CGU" — this
text predates this phase and was **deliberately left unmodified** this round):

> FR: "Ziko se réserve le droit de modifier les présentes CGU à tout moment. Les modifications
> seront notifiées aux utilisateurs par e-mail ou via l'application avec un préavis raisonnable. La
> poursuite de l'utilisation du Service après notification vaut acceptation des nouvelles CGU."

This is a standard, near-universal general ToS-amendment reservation, not scoped to (and written
before) the founder offer. It was not touched this phase because CONTEXT.md's decisions do not
explicitly ask us to — but it sits directly beside the new, more narrowly grey-list-scoped
founder-offer modification clause (Q2 above) in the same document family, so we are flagging it
proactively rather than waiting for you to notice the inconsistency on your own.

**What we are asking:** Is this general "à tout moment... avec un préavis raisonnable" amendment
clause defensible as a normal ToS-amendment reservation distinct from a founder-benefit-revocation
clause (our working assumption), or does it need the same narrow, justified, notice-bearing
grey-list treatment we applied to the CGV's founder-specific clause?

---

## Q6. What advance-notice period (in days) should the shutdown clause commit to?

**Source — `03-UI-SPEC.md`** (quoted verbatim):

> "The `[TBD]` notice-period length is a genuine open question — CONTEXT.md's D-04 specifies 'an
> advance notice period' without a number; do not invent a legally-binding figure. Flag verbatim in
> the counsel-briefing package per D-02 rather than silently defaulting it."

**The placeholder as it currently ships, live on the CGV page**
(`SHUTDOWN_MODIFICATION_CLAUSE`, `apps/web/src/content/legal/founder-offer.ts`):

> FR: "...un préavis raisonnable d'au moins **[TBD — nombre de jours à confirmer par le conseil]**
> jours..."
>
> EN: "...reasonable advance notice of at least **[TBD — day count to be confirmed by counsel]**
> days..."

This placeholder is visible on the live `/cgv` page today, inside the still-active
"document under legal review" banner. It was deliberately left unresolved rather than guessed at.

**What we are asking:** What number of days should replace this placeholder for a genuine,
service-wide shutdown notice to founder members, given French law and practice for this kind of
consumer commitment? Is there a minimum period that would itself be considered unreasonably short
under Article R.212-1's grey-list standard?

---

## Q7. Should the CGU's court-designation placeholder be filled in, and is a jurisdiction clause worth carrying at all?

**Source — the live CGU page**
(`apps/web/src/app/[locale]/(marketing)/cgu/page.tsx`, section 11, "Droit applicable et
juridiction" — quoted verbatim, unresolved since before this phase and also **left unmodified**
this round):

> FR: "Les présentes CGU sont soumises au droit français. En cas de litige relatif à
> l'interprétation ou à l'exécution des présentes, les parties s'engagent à tenter de résoudre le
> différend à l'amiable avant tout recours judiciaire. À défaut, les tribunaux compétents
> **[A COMPLÉTÉ]** seront seuls compétents pour connaître du litige."

The CGV's own equivalent clause (section 10, drafted fresh this phase) deliberately avoids naming
a specific court or carrying this same placeholder forward — it instead defers to "les tribunaux
compétents désignés par le droit commun" (ordinary-law jurisdiction) and adds a reference to
consumer mediation under Articles L.616-1 et seq.

**What we are asking:** Should the live CGU's `[A COMPLÉTÉ]` placeholder be filled with a specific
court/jurisdiction designation, or is the CGV's newer, more generic "ordinary-law jurisdiction"
approach the better pattern to carry back into the CGU for consistency? For a French-law
consumer contract, is naming a specific tribunal even advisable, given consumer-protection rules
that often override a professional's preferred jurisdiction choice in B2C disputes?

---

## 2. What we are *not* asking you to review

To keep your time focused on the seven questions above, the following are **out of scope** for
this review — they are either already-settled engineering choices or a straightforward regulatory
checklist, not legal-judgment calls:

- **The milestone's engineering choices** — the database schema, the `SECURITY DEFINER` RPC
  pattern, the founder-rank sequence, and the rate-limiting/anti-abuse design are all internal
  implementation decisions, not legal questions.
- **The retention figure** — three years from last contact, already aligned to CNIL's NS-048
  prospect-data guidance and seeded into the database (`app_config.waitlist_retention_years = 3`).
  We are not asking you to re-derive this number; flag it only if you believe NS-048 does not apply
  to this fact pattern.
- **The Article 13 collection-point notice's field set** — controller identity, purpose, legal
  basis, recipients, retention duration, and data-subject rights are all present as a checklist
  match against CNIL's documented minimum fields, not a drafting judgment call.

**Enclosed as context, not as a question:** the AI-credit-cap sentence
(`AI_CREDIT_CAP_SENTENCE`) and the consent-checkbox / point-of-collection-notice copy
(`CONSENT_CHECKBOX_LABEL`, `COLLECTION_POINT_NOTICE`) are included so you can confirm they
reconcile cleanly with the clauses under review above — not because we are asking you to redraft
them independently.

---

## 3. Closing note

Everything above — every quoted clause, every proposed phrasing — is Claude-generated drafting,
not legal advice, and not a settled conclusion. `03-RESEARCH.md`'s Assumptions Log entry **A4**
records this explicitly as the highest-risk assumption in this phase's research, gated on exactly
the review this document requests. Please treat every clause excerpt above as a proposal for you
to accept, amend, or reject — none of it should be read as Ziko (or Claude) having already decided
the legal question on your behalf.
