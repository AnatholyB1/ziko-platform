# Pitfalls Research — Public Waitlist + Lifetime Premium Founder Offer

**Domain:** Adding a public unauthenticated waitlist, a "first 200 lifetime premium" founder offer, new CGV/revised CGU, a credit-gate behavior change for `tier === 'premium'`, and a production test-account cleanup — to the live Ziko platform (French, RGPD-scoped, existing paid AI-credit system).

**Researched:** 2026-08-12
**Confidence:** MEDIUM-HIGH overall. RGPD/CNIL sourcing is HIGH confidence (official CNIL pages, GDPR text, CJEU case law). French consumer-law specifics on "clause abusive" are HIGH confidence (Légifrance, DGCCRF). "Premium à vie" enforceability and the downgrade-of-existing-entitlement risk are reasoned from general French consumer-law principles, not a case directly on point — **flagged for lawyer review below**. Next.js/Vercel caching mechanics are HIGH confidence (official docs + known GitHub issues). Lifetime-deal financial post-mortems are MEDIUM confidence (founder blog/community sources, not audited financials).

---

## Critical Pitfalls

### Pitfall 1: Waitlist consent checkbox is legally invalid (pre-ticked, bundled, or missing a real choice)

**What goes wrong:**
The waitlist form ships with a pre-ticked "I agree to receive emails" checkbox, or bundles waitlist signup + marketing consent into a single unchecked/pre-checked box, or infers consent from the act of clicking "Join the waitlist" alone.

**Why it happens:**
Waitlist forms are usually built fast, by analogy to a simple newsletter signup, without separating "processing needed to run the waitlist itself" (contract/pre-contractual step, doesn't strictly need a checkbox) from "sending marketing/founder-offer emails" (which, for a French B2C audience, needs a genuine opt-in).

**How to avoid:**
- CJEU *Planet49* (C‑673/17, 1 Oct 2019) and Recital 32 GDPR are explicit: silence, pre-ticked boxes, or inactivity do **not** constitute valid consent — consent must be an unambiguous affirmative act. ([CNIL — Comment recueillir le consentement](https://www.cnil.fr/fr/les-bases-legales/consentement), case law summarized at [dastra.eu](https://www.dastra.eu/fr/article/collecte-des-donnees-la-case-pre-cochee-ne-vaut-pas-consentement/53345))
- Use an **unchecked** checkbox, clearly worded, separate from the "join waitlist" action if you also want to send non-waitlist marketing later.
- For the *waitlist itself* (email + audience type, used only to notify about launch/founder offer), the cleanest legal basis in French B2C practice is **consent** — do not try to justify it as "legitimate interest," which CNIL treats as the exception, not the norm, for consumer-facing prospecting: "en B2C, pas de consentement, pas d'email" ([CNIL — la prospection par courrier électronique](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique)).
- Do not require the checkbox to be ticked to submit the form only if you can genuinely still let the user browse without it — in practice for a waitlist the checkbox IS the point of the form, so this is less of a bundling problem than for e.g. an e-commerce purchase, but keep it as its own decision, not folded into "I accept the CGU."

**Warning signs:** Single checkbox that reads "J'accepte les CGU et je consens à recevoir des emails" (bundled); checkbox rendered `checked` by default in the UI-SPEC or component code; no checkbox at all, just an email field and a submit button.

**Phase to address:** UI-SPEC / design phase for the waitlist page (checkbox copy + default state must be specified before implementation) + a legal-copy review phase.

---

### Pitfall 2: No information notice at the point of collection (Article 13 GDPR)

**What goes wrong:**
The waitlist page collects email + audience with no visible text about who the controller is, why the data is collected, how long it's kept, and how to exercise rights — that text only exists buried in the general Politique de Confidentialité, several clicks away.

**Why it happens:**
Teams treat the privacy policy as a catch-all and assume linking to it in the footer (already present sitewide per `PROJECT.md` v1.0 requirements) is enough. GDPR Article 13 requires this information to be given **at the time the data is obtained**, not just discoverable elsewhere.

**How to avoid:**
- Add a short, waitlist-specific notice right under the email field: purpose (waitlist + founder-offer notification), controller identity, retention period, and a link to the full privacy policy for the rest of Article 13/14 items (legal basis, recipients, rights, DPO contact if any, right to complain to CNIL).
- Reuse the tone/structure already established in `apps/web/src/app/[locale]/(marketing)/politique-de-confidentialite/page.tsx` and `cgu/page.tsx` — this repo already has a working pattern for RGPD-compliant copy in fr/en; extend it rather than inventing new legal language.

**Warning signs:** Waitlist page has no text near the form beyond a CTA button; privacy policy has no dedicated waitlist/founder-offer section.

**Phase to address:** Waitlist UI-SPEC phase (copy block is part of the design contract) + legal-pages phase (privacy policy amendment).

---

### Pitfall 3: Retention has no defined end — waitlist becomes an indefinite email database

**What goes wrong:**
Emails that never convert to an account sit in the `waitlist` table forever with no deletion job, becoming a growing liability (breach exposure, DSAR burden, and eventually a CNIL non-compliance finding on retention).

**Why it happens:**
There is no obvious "expiry" moment for a waitlist entry the way there is for a session or a code — the founder offer or the app itself might launch in an unknown number of months, so nobody sets a TTL, and the founder wants to keep "unlimited runway" to reach 200 signups.

**How to avoid:**
- CNIL's prospecting norm (NS-048 referential) treats prospect data as retainable **3 years from collection or last contact**, after which the organization must re-solicit consent or delete ([CNIL NS-048 discussion](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000033117901), summarized at [leto.legal](https://www.leto.legal/guides/rgpd-quelle-est-la-duree-de-conservation-de-vos-donnees)). A waitlist entry is functionally a prospect record — apply the same ceiling: define and document a retention period (e.g., "kept until launch + 3 years, or until you convert to an account, whichever first") in the privacy notice, and build a deletion job for entries that never convert.
- Separate the "founder rank / spot number" (see Pitfall 4) from the raw contact data lifecycle — the rank can be retained in aggregate/anonymized form (e.g., "we honored the first 200") even after the individual's email is erased.

**Warning signs:** No `deleted_at`/TTL logic anywhere in the waitlist schema or migration; no cron job scoped to the waitlist table; privacy policy silent on waitlist retention.

**Phase to address:** Database/migration phase (design the retention column and cleanup cron alongside the waitlist table itself, not as an afterthought) + legal-pages phase (state the retention period).

---

### Pitfall 4: Right to erasure conflicts with the "spot #47 of 200" promise

**What goes wrong:**
A waitlist member who is one of the first 200 (and has been told "you're #47, lifetime premium reserved") requests erasure under Article 17 GDPR. If the system treats "spot number" and "email row" as the same record, honoring erasure either (a) deletes the person's earned lifetime-premium claim entirely, which may create a *separate* contractual dispute if they already believe the offer is theirs, or (b) the team refuses/delays erasure to "protect the counter," which is itself a GDPR violation.

**Why it happens:**
The founder-offer mechanic (public claimed-spots counter) creates a business incentive to treat the waitlist row as permanent proof of a commercial commitment, which is in tension with the individual's unconditional right to erasure of personal data.

**How to avoid:**
- Design the data model so the **numeric rank/counter** is decoupled from **personal data**: the counter can be a simple incrementing integer stored once (or an aggregate count), while the row linking a *specific person* to *that* rank is the erasable personal data. On erasure, the person's email/PII is deleted; the counter total does not need to decrease (see Pitfall 8 on why decrementing publicly displayed counts is its own problem) — but any lifetime-premium entitlement tied to their (now-deleted) identity is void once they've asked to be forgotten, because you can no longer serve them personalized service tied to an erased identity. Document this tradeoff explicitly in the CGV: exercising erasure before conversion voids the reserved spot.
- If the person has already **converted to an account** (signed up, tier flipped to premium), erasure of the waitlist *row* does not erase their *account* — those are separate lawful bases (contract performance for the account, consent for the pre-signup marketing contact) and Article 17(1)(b)/(3) carves out data needed for contract performance and legal claims.
- **Flag for lawyer review:** whether a granted-but-unclaimed "spot" constitutes an accepted contractual offer that survives an erasure request is not settled by GDPR text alone — this sits at the RGPD/consumer-contract-law intersection and should be reviewed by counsel before the CGV language is finalized.

**Warning signs:** Waitlist schema stores rank as a column directly on the personal-data row with no separable identifier; no erasure endpoint/procedure exists for waitlist entries at all (v1.0 already built self-service account deletion per `PROJECT.md` — the waitlist needs an equivalent, even if manual/support-ticket-driven for v1).

**Phase to address:** Waitlist schema design phase + legal-pages phase (CGV must state what erasure does to a reserved spot) — flag as a **lawyer-review item**, not a pure engineering call.

---

### Pitfall 5: Double opt-in treated as either "required" or "pointless" — both wrong

**What goes wrong:**
Team either (a) skips any verification step, so a malicious actor can enter any third party's email and that person starts receiving "you're #N on the Ziko waitlist" emails they never asked for (see Pitfall 12 for the abuse angle), or (b) assumes double opt-in is a hard GDPR requirement and blocks launch on building a full confirmation-email flow.

**Why it happens:**
Confusion between "GDPR requires proof of consent" and "GDPR requires double opt-in." They are not the same thing.

**How to avoid:**
- Double opt-in is **not** a GDPR/French legal requirement — CNIL and other EU DPAs recommend it as a *best practice and evidentiary safeguard*, not a mandate; Germany's BfDI treats it as "quasi-mandatory" but France does not ([donneespersonnelles.fr — Newsletter et RGPD](https://www.donneespersonnelles.fr/newsletter-rgpd-conformite)).
- Given this specific feature has a **scarce, valuable reward attached** (lifetime premium, publicly countable spots), the abuse/enumeration incentive is much higher than for a plain newsletter — recommend implementing double opt-in (or at minimum a confirmation email with a magic link before the entry counts toward the public 200) specifically *because* of the founder-offer stakes, not because GDPR demands it in the abstract. This also solves the "someone else's email in the counter" abuse case.
- Without double opt-in, log proof of single opt-in (timestamp, IP, form version/copy shown, checkbox state) per CNIL guidance on evidentiary burden.

**Warning signs:** Waitlist entry counts toward the public "N/200" counter immediately on form submit with no verification step.

**Phase to address:** Waitlist backend phase (design decision: does an unconfirmed entry count toward the 200? Recommend: no, only confirmed entries count).

---

### Pitfall 6: Marketing reuse of the email address without a fresh legal basis

**What goes wrong:**
Six months after collecting a waitlist email for "notify me at launch," the marketing team starts sending unrelated newsletters, feature announcements, or upsell campaigns to the same list, without having said that's what the email would be used for at collection time, and without a separate opt-in for it.

**Why it happens:**
Once an email is "in the system" it's tempting to treat it as general-purpose marketing inventory. GDPR's purpose-limitation principle (Art. 5(1)(b)) says otherwise: the lawful basis and the stated purpose at collection govern what you can do with the data later.

**How to avoid:**
- State the purpose narrowly and accurately at collection ("we will email you about the Ziko launch and, if applicable, your founder offer status") — do not write "and other Ziko news" unless you actually mean to send other news, in which case that must be its own opt-in choice (can be a second checkbox, unchecked by default).
- If the purpose later expands, this is a new processing activity requiring either a fresh consent capture or a demonstrable existing-customer exception under the CNIL's `prospection B to C` guidance — and a waitlist prospect who never converted is not an "existing customer," so the LCEN/Code des postes et communications électroniques (art. L.34-5) "soft opt-in" exception for existing customers likely does **not** apply to them. ([CNIL — la prospection B to C](https://www.cnil.fr/fr/la-prospection-b-to-c-quelles-regles-pour-transmettre-des-donnees-des-partenaires))

**Warning signs:** Marketing/growth later asks "can we just email the waitlist about X" with no re-consent step.

**Phase to address:** Legal-pages phase (write the purpose statement precisely) + a standing product policy (not a one-time phase) that the team should be told about explicitly at handoff.

---

### Pitfall 7: "Premium à vie" written into CGV without the disclosures needed to make it enforceable and non-deceptive

**What goes wrong:**
The CGV says "les 200 premiers membres bénéficient du Premium à vie" with no further qualification. A user later discovers AI credits are capped even on "lifetime premium," or the service pivots/shuts down/changes what "Premium" includes, and claims the offer was a `pratique commerciale trompeuse` (deceptive commercial practice, Code de la consommation Art. L.121-2/L.121-3) because "à vie" implied an unconditional, permanent, unlimited benefit.

**Why it happens:**
"Lifetime" is marketing shorthand that papers over three distinct questions the CGV must actually answer: lifetime of *what* (the user's life? the company's existence? the product line's existence?), what exactly is included (does "Premium" mean "all current + all future features," or "the feature set as of the offer date"?), and what happens if the company can no longer sustain the offer (shutdown, pivot, acquisition).

**How to avoid:**
- **"À vie" legally should be tied to the life of the *service*, not the person** — CGV should state explicitly: "l'avantage Premium à vie est valable pour toute la durée d'exploitation du Service par [Company]" and separately state what happens on discontinuation (e.g., pro-rated refund is not applicable since it was free, but give advance notice and, if feasible, data export). Leaving this ambiguous is the deceptive-practice risk, not solving it.
- **Define "Premium" as of the offer date and reserve the right to evolve feature scope** — but see Pitfall 8 for the abusive-clause limit on how broadly this reservation can be worded. State plainly that AI credit caps (per the CGU) apply to the founder-tier premium exactly as to any other premium, so there is no implied "premium = unlimited AI" reading.
- **Do not promise "unlimited AI"** anywhere in the founder-offer marketing copy — this directly contradicts the CGU/CGV cap language you're simultaneously shipping (see Pitfall 9). Any landing-page copy, social post, or email about the founder offer must be reviewed against the CGV wording before publishing, not treated as "just marketing."
- **Real-world grounding:** founders who ran uncapped/loosely-defined lifetime deals (e.g., via AppSumo) report the ambiguity of "lifetime" became a customer-trust and cost crisis — companies who survived treated the lifetime tier as capped/scoped from day one and explicitly limited the number of codes ([The Bootstrapped Founder — Lifetime Deals and SaaS Businesses](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/); [ancientgeekery.com — AppSumo Lifetime Deals, Whose Lifetime, Exactly?](https://ancientgeekery.com/articles/appsumo-lifetime-deals-whose-lifetime-exactly)). Ziko is already doing the two things that matter most (hard cap of 200, and capped AI credits even for premium) — the remaining risk is purely in how precisely the CGV states the scope.
- **Flag for lawyer review:** whether the specific French phrase "à vie" carries an implied warranty under `pratique commerciale trompeuse` case law beyond what's outlined above is a question for counsel — this section gives you the shape of the answer, not a citable ruling on this exact fact pattern.

**Warning signs:** Any marketing copy (landing page hero, social post, email) uses "à vie," "gratuit pour toujours," "sans limite" without a footnote/link to the CGV scope; CGV founder-offer section is shorter than the CGV's standard-tier description.

**Phase to address:** CGV drafting phase (must be written and lawyer-reviewed *before* the founder-offer page goes live, not after) + marketing-copy review gate on the waitlist/landing page phase.

---

### Pitfall 8: CGV reserves too broad a right to change/discontinue — becomes an abusive clause (`clause abusive`)

**What goes wrong:**
To protect against Pitfall 7's cost exposure, the CGV includes a clause like "Ziko se réserve le droit de modifier ou de mettre fin à l'offre Premium à vie à tout moment et sans préavis" — this is precisely the kind of clause French law voids automatically.

**Why it happens:**
Overcorrecting for the financial risk of an open-ended lifetime promise by writing an equally open-ended escape hatch, without realizing French consumer-contract law has a **"liste noire"** (blacklist) of clauses that are irrebuttably presumed abusive — including clauses that "réservent au professionnel le droit de modifier unilatéralement les clauses du contrat relatives à sa durée, aux caractéristiques ou au prix du bien à livrer ou du service à rendre" (Code de la consommation, Art. R.212-1, via [Légifrance](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032807194/)). Such clauses are void by law and expose the company to a fine of up to €15,000 for a company ([economie.gouv.fr — clauses abusives](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/clauses-abusives-12-clauses-interdites-et-10-clauses-dont-il-faut-demontrer-la-legitimite)).

**How to avoid:**
- Do not write an unconditional unilateral-modification clause. Instead: (1) define the Premium feature set **as of the offer date** with a link/reference to the CGU feature list, (2) state that **future feature additions** to "Premium" may or may not be extended to founder members at the company's discretion (this is adding, not taking away — lower risk), (3) reserve the right to modify AI credit *limits specifically* only with advance notice and only in the direction of aligning founder members with the same rules that apply to all premium members (i.e., you are not singling them out — you're applying a platform-wide, previously-disclosed cap), and (4) reserve discontinuation rights only for genuine service-wide shutdown scenarios, with notice period and data export commitment, not as a way to quietly remove the lifetime benefit from paying founders while the rest of the app continues.
- The "grey list" (Art. R.212-2, clauses presumed abusive unless the professional proves otherwise) is more forgiving of modification clauses that are **narrow, justified by a legitimate reason (e.g., cost sustainability, legal compliance), and give the consumer a right to react** (e.g., notice + right to leave/be reimbursed if reimbursement is applicable) — draft toward this pattern, not the black-list pattern.
- **Flag for lawyer review:** the precise line between "black list" (irrebuttable) and "grey list" (arguable) for a *free/discounted* lifetime benefit (as opposed to a paid subscription) is a nuance counsel should confirm — consumer law protections are generally strongest for contracts involving payment, and it's not settled how they map onto a "free lifetime perk" attached to an otherwise free product tier.

**Warning signs:** Any CGV clause using "à tout moment," "sans préavis," or "à sa seule discrétion" attached to *removing* an already-granted benefit rather than *adding* new features.

**Phase to address:** CGV drafting phase — this is the single highest-severity legal item in this milestone and should be the first thing sent to counsel, before any public page ships.

---

### Pitfall 9: Existing `tier === 'premium'` users get silently downgraded when the credit gate changes

**What goes wrong:**
`creditGate.ts` currently bypasses the credit deduction entirely for `tier === 'premium'` (`PREM-02`, confirmed by reading the file: `if (profile?.tier === 'premium') { c.set('creditPassThrough', true); return next(); }`). This milestone changes that so premium is capped, not unlimited. Any user who is *already* `tier === 'premium'` in production **today** — before this change ships — was implicitly promised (by the existing product behavior, and by whatever CGU/marketing copy was live when they became premium) unlimited AI use. The code change silently reduces what they get, with no notice, no grandfathering, and no distinction between pre-existing premium users and future founder-offer members.

**Why it happens:**
The team is thinking of this as one boolean flip (`tier === 'premium'` bypass → capped) rather than as "we are changing the terms of an entitlement some real users already hold." `CONCERNS.md`/`PROJECT.md` don't currently distinguish "premium granted before this change" from "premium granted after."

**How to avoid:**
- **First, find out who is already `tier='premium'` in production** and how they got there — query `user_profiles WHERE tier = 'premium'` and cross-reference `ai_credit_transactions WHERE type = 'premium_grant'` (this transaction type already exists in the schema per migration 026's CHECK constraint, suggesting it may already be in use or was planned for this exact purpose). If any real (non-test) users hold premium today, they were sold/granted unlimited AI under the current code and current CGU — retroactively capping them without notice is the same `pratique commerciale trompeuse` / unilateral-modification risk as Pitfall 7 and 8, just applied to *existing* users instead of *future* founder members.
- **Grandfather pre-existing premium users, or explicitly notify + get consent for the change.** The safest technical/legal move: introduce a distinct tier or a `granted_before` timestamp/flag so the credit-gate logic can apply the old unlimited behavior to legacy premium grants and the new capped behavior only to `tier='premium'` rows created via the founder-offer flow going forward. This is a straightforward schema addition (a new column, or a `premium_source` / `premium_plan` enum) that avoids re-litigating existing users' expectations.
- If there are **zero real premium users today** (only test accounts — plausible, since `PREM-02` shipped in v1.4 and the product may not have had paying premium users yet), this whole pitfall collapses to "make sure test-account cleanup (Pitfall 13) runs *before* checking who's grandfathered" — verify this with a query before assuming it's moot.
- Whichever path is chosen, update the CGU premium-tier description in lockstep (see Pitfall 10) so the code and the legal text describe the same entitlement on the same day.
- **Flag for lawyer review:** if any real paying premium user exists and did not explicitly agree to the new capped terms, silently downgrading them is a genuine consumer-law exposure, not just a UX rough edge — get counsel's read on whether advance notice + continued use = implied acceptance is sufficient here, or whether affirmative re-consent is needed.

**Warning signs:** `SELECT COUNT(*) FROM user_profiles WHERE tier = 'premium'` returns > 0 in production before this milestone starts, and the credit-gate PR does not reference how those rows are treated.

**Phase to address:** This should be its own discrete phase (or a mandatory gate at the start of the credit-gate-change phase): "audit existing premium users" → decide grandfather vs. notify-and-migrate → *then* change `creditGate.ts`.

---

### Pitfall 10: Legal text and code ship out of sync (either direction)

**What goes wrong:**
Two failure modes, both real:
1. **CGU ships first, capping AI credits in writing** — but `creditGate.ts` still has the unconditional `tier === 'premium'` bypass live. For a window (hours to weeks depending on deploy cadence), the CGU makes a promise ("credits remain capped") the running code doesn't keep in the *other* direction — actually this is the safe order for the company (code is more generous than the contract, not a violation) but it does mean premium users are getting *more* than advertised, which is a cost/business risk, not a legal one.
2. **Code ships first, capping credits before the CGU/CGV say so** — this is the dangerous order: existing premium users (and new founder-offer members who read the old CGU/marketing copy before the cap was documented) are now factually capped in a way that contradicts what's currently written in the live legal pages. This is a direct, checkable discrepancy between "what we told you" and "what the app does" — exactly the kind of gap CNIL/DGCCRF or an individual user complaint would point to first.

**Why it happens:**
Legal-copy changes and code changes are typically owned by different people/phases with independent review cycles and no shared deploy gate; a code PR can merge and deploy to Vercel production well before the CGU page PR is written, reviewed, translated (fr/en), and merged.

**How to avoid:**
- Sequence explicitly: **CGU/CGV amendment merges and is live in production *before or in the same deploy* as the `creditGate.ts` change**, never after.
- Add a single feature flag or config value (e.g., `PREMIUM_CREDIT_CAP_ENABLED`) that the `creditGate.ts` change reads, defaulting to `false` (today's unlimited behavior) until explicitly flipped — this decouples "deploy the code" from "activate the new behavior," so the team can merge the code change safely ahead of the legal text and flip the flag only once the CGU is confirmed live, translated, and the existing-user question (Pitfall 9) is resolved.
- Treat this as a single release checklist item spanning two phases, not two independent phases with no cross-check.

**Warning signs:** The CGU/CGV PR and the `creditGate.ts` PR are planned as fully independent phases with no shared verification step; no feature flag exists to decouple deploy from activation.

**Phase to address:** Both the legal-pages phase and the credit-gate-change phase need this cross-check as an explicit acceptance criterion; recommend a dedicated small "activation" phase or task that gates the flag flip on both being confirmed live.

---

### Pitfall 11: The public counter itself becomes a liability — low numbers, stale numbers, inflated numbers, or a plateau that never fills

**What goes wrong:** Several distinct failure modes:
- **Embarrassingly low count** shown for weeks after launch, signaling low demand to visitors (undermining the exact social-proof goal of the feature).
- **Count that appears to go down** (e.g., after Pitfall 4's erasure handling, or after test-account cleanup, or after a bugged double-counting fix) — users notice and lose trust; a *decreasing* public counter reads as a bug or a lie either way.
- **Inflated/fabricated count** — even "rounding up" or seeding the counter with a starting offset to look more advanced is a textbook DGCCRF "fausse rareté" dark pattern: DGCCRF has explicitly named artificial scarcity/urgency counters ("plus que deux articles en stock" style, often "générés aléatoirement... et ne correspondent à aucune réalité logistique") as a 2025–2028 enforcement priority ([economie.gouv.fr — pièges dark patterns](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/pieges-sur-les-sites-de-commerce-en-ligne-attention-aux-dark-patterns)). The counter here must reflect the real row count, full stop — no offset, no rounding, no "starting bonus."
- **Stale/cached counter** (see Pitfall 15) shows a wrong number due to Next.js static rendering — reads as either a bug or, worse, as evidence of the fabrication above.
- **Counter reveals signup *velocity*/volume to competitors** — a real-time public number lets a competitor infer conversion rate off known traffic, or infer when to launch a copycat offer; consider whether the counter needs to show the exact number vs. a coarser bucket (e.g., "150+ inscrits" instead of "147/200") especially in the early, low, slow-moving phase.
- **What happens at spot 200:** the page must have an explicit "SOLD OUT" / "offre complète" state designed and copy-reviewed *before* launch, not improvised on the day it fills — including whether the waitlist itself still accepts signups after 200 (recommend: yes, for regular free-tier notification, clearly distinguished from the now-closed founder tier) and whether the counter freezes at "200/200" or switches to a different display entirely.

**Why it happens:** The counter is treated as a pure marketing/growth widget bolted on late, rather than as a data-integrity + legal-compliance surface designed alongside the waitlist schema.

**How to avoid:**
- Counter value = `SELECT COUNT(*) FROM waitlist WHERE confirmed = true AND founder_offer_claimed = true` (or equivalent), computed live or with short-TTL cache (seconds, not the default static-render duration) — never a hardcoded/offset value.
- Design and copy-review the "200/200, offre complète" end-state before launch (this is a UI-SPEC deliverable, not a "we'll figure it out later" item).
- Decide up front whether the counter shows exact numbers or a bucketed range, weighing competitive-intelligence exposure against the social-proof goal.
- Never let the number decrease publicly — if erasure or cleanup removes rows, either don't recompute downward-visible counts in real time (freeze display at a high-water mark once past a threshold) or accept and disclose that the number reflects "confirmed active reservations," understanding that a small amount of churn is expected and shouldn't visibly whipsaw the count.

**Warning signs:** Counter component has a hardcoded `+N` offset constant anywhere in the code; no design/copy exists yet for the "full" state; counter query has no time-bound freshness guarantee.

**Phase to address:** Waitlist UI-SPEC phase (design the full lifecycle: 0 → climbing → full) + backend phase (counter must be a real, live, unfudged aggregate query).

---

### Pitfall 12: Public unauthenticated write endpoint gets abused — bots, disposable emails, email-bombing third parties, enumeration

**What goes wrong:** This is the most conventional pitfall of the set but the stakes are unusually high here because a *scarce, valuable reward* (one of 200 lifetime-premium spots) is directly gated by an anonymous POST. Concretely:
- **Bot/script signups** race to claim spots before real users, either to squat spots for resale/leverage or simply as noise.
- **Disposable/throwaway emails** (temp-mail services) claim spots that will never convert, permanently wasting founder-offer slots on unreachable addresses.
- **Email-bombing a third party** — an attacker enters a real stranger's email repeatedly (or once, if it triggers a "you're #N!" notification), harassing that person with unwanted Ziko emails they never requested. This is the "someone else's email in the counter" abuse case flagged in Pitfall 5 — double opt-in / confirmation-before-counting is the direct mitigation.
- **Enumeration** — an error message or response-timing difference reveals whether a given email is *already* on the waitlist (e.g., a distinct "this email is already registered" error vs. a generic success), letting an attacker build a list of who signed up, or confirm a specific person's interest, which is itself a privacy leak.
- **Rate-limit bypass** — same IP rotates, or the endpoint is hit from many distinct IPs (distributed), defeating simple per-IP rate limiting.
- **Anon-key insert abuse** — if the waitlist insert path goes directly through a Supabase RLS policy allowing anonymous `INSERT`, someone can call the Supabase REST/PostgREST endpoint directly with the public anon key, bypassing the app's own rate limiting, validation, and CAPTCHA entirely, since the anon key is client-exposed by design.

**Why it happens:** Public write endpoints are inherently the highest-abuse surface class, and this codebase's existing invitation-code system (`backend/api/src/coach/clients/service.ts`) already had to be specifically hardened for exactly this class of problem — the constant-time `INVALID_OR_EXPIRED` envelope on `/links/preview` and `/links/redeem` exists precisely to prevent enumeration/timing attacks on a similar "is this code/is this identity valid" surface. The waitlist is a new instance of the same problem shape (public, unauthenticated, reward-gated, needs anti-enumeration) and risks reinventing the mistakes that pattern already fixed once.

**How to avoid:**
- **Route the waitlist write through the Hono API, not directly through a public Supabase anon-key insert policy** — this puts rate limiting (Upstash Redis, already used elsewhere per `PROJECT.md` v1.3), validation (Zod, already the house pattern), and response shaping under the app's control instead of Postgres RLS's more limited expressiveness. If a Supabase RLS insert policy is used at all for defense-in-depth, keep it as a second layer, not the only gate.
- **Adopt the same constant-time, generic-envelope pattern already proven in this codebase**: respond identically (same shape, same timing budget) whether an email is new or already registered — e.g., always return `{ ok: true }` and only reveal "already registered" via a subsequent authenticated flow (e.g., magic-link email says "you're already on the list" if applicable) rather than in the synchronous HTTP response.
- **Require double opt-in / confirmation-email before an entry counts toward the public 200** (ties directly to Pitfall 5 and 11) — this alone neutralizes most bot/disposable-email/email-bombing abuse because a spot isn't "claimed" until the recipient proves control of the inbox.
- **Rate-limit per-IP AND per-email** using the existing Upstash Redis sliding-window pattern (already a documented Key Decision: "Sliding window over fixed window — Prevents boundary spike traffic," v1.3) — reuse, don't reinvent.
- **CAPTCHA or equivalent (e.g., Cloudflare Turnstile, hCaptcha) on the public form** — this project has no existing CAPTCHA integration; budget it as new scope, not assumed infrastructure.
- **Validate email format + do basic disposable-domain filtering** (a maintained blocklist or a third-party validation API) before accepting an entry — accept that this is imperfect but reduces obvious throwaway-domain abuse.

**Warning signs:** Waitlist insert is a raw Supabase client `.insert()` call from a public page component with an RLS policy allowing anon inserts and no server-side rate limit in front of it; error responses differ in shape or timing for "already exists" vs. "new email"; no CAPTCHA on the form; spots are decremented/counted synchronously on unconfirmed submission.

**Phase to address:** Backend waitlist-endpoint phase — treat as security-review-gated, referencing the existing `coach/clients` redemption pattern as the model to follow.

---

### Pitfall 13: Deleting test accounts from production goes wrong — cascade over-deletion, no dry run, no backup, ambiguous match criteria, orphaned rows, no transaction

**What goes wrong:** This is a one-way door with several concrete, specific failure modes given this schema:
- **`ON DELETE CASCADE` deletes more than intended.** `user_ai_credits`, `ai_credit_transactions`, and virtually every per-user table in this codebase reference `auth.users(id) ON DELETE CASCADE` (confirmed directly in `026_ai_credits.sql`: `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, same pattern repeated across the 73 migrations per the RLS-pattern convention documented in `CLAUDE.md`). Deleting a row from `auth.users` cascades through workout sessions, nutrition logs, coach links, AI conversations, credit ledgers — everything. If the deletion criteria are even slightly too broad, this destroys real user history irrecoverably.
- **No dry run.** Running a `DELETE` directly, rather than first running the equivalent `SELECT` and eyeballing (or better, exporting) the exact row set that *would* be deleted, is the single most common cause of over-deletion incidents in every "prod cleanup" post-mortem pattern.
- **No backup.** No point-in-time snapshot or export taken immediately before running the deletion, so if the criteria were wrong there is no fast recovery path beyond Supabase's PITR (Point-in-Time Recovery, if enabled on the plan) — which is a much bigger, slower recovery than "restore this row from a CSV I exported 5 minutes ago."
- **Criteria that also match real users.** Matching on patterns like `email LIKE '%test%'`, `email LIKE '%@example.com'`, or a name pattern (`name = 'Test User'`) is exactly the kind of heuristic that can accidentally match a real user who happens to have "test" in their email handle, or a coach who named a demo client "Test" inside their own real account, or — specific to this codebase — any of the multiple documented placeholder/test artifacts already known to exist in production per `CONCERNS.md` (App Store ID placeholder, legal-page TODOs, marketing placeholder content) suggesting the team has a history of test/placeholder data leaking into prod without a clean tag.
- **Deleting from `auth.users` vs. `user_profiles` and leaving orphans.** Because `auth.users` is Supabase's own managed table, deleting from it must go through the Supabase Admin API (`supabase.auth.admin.deleteUser()`) or you risk exactly the orphan scenario: deleting a `user_profiles` row without deleting the corresponding `auth.users` row leaves a "ghost" auth identity that can still log in but has no profile, or vice versa — deleting `auth.users` without confirming all `ON DELETE CASCADE` chains actually fire cleanly (some older migrations in this 73-migration history predate later foreign-key additions and may not all cascade correctly, per the `CONCERNS.md` note on duplicate/inconsistent migration numbering).
- **No transaction.** Running the deletion as a sequence of separate `DELETE` statements (one per table) instead of one transaction means a failure partway through leaves the database in an inconsistent half-deleted state with no easy rollback.
- **Founder-counter credibility angle specific to this milestone:** the *reason* this deletion is happening is to make the public "N/200" counter credible — which means the criteria must specifically target test/dev accounts that would otherwise be counted in `N`, without touching real early-access users who might already be genuinely on the waitlist or already `tier='premium'` (tying directly into Pitfall 9's audit).

**How to avoid — concrete, reviewable procedure:**
1. **Define exact match criteria in writing before touching the database** — prefer an explicit allowlist of known test-account IDs/emails (compiled by whoever created them) over a pattern match; if a pattern must be used, require it to be reviewed by a second person and cross-checked against the full row list it would match.
2. **Dry run first: run the equivalent `SELECT`, not `DELETE`.** Export the exact row set (IDs, emails, created_at, tier, any waitlist rows) to a CSV/file and have it reviewed before proceeding.
3. **Take a fresh backup/export immediately before running the real deletion** — a `pg_dump` of at minimum the affected tables, or confirm Supabase PITR is enabled and note the timestamp to restore to if needed.
4. **Use the Supabase Admin API for `auth.users` deletion** (`supabase.auth.admin.deleteUser(id)`), not a raw SQL `DELETE FROM auth.users` — this keeps Supabase's own internal auth state consistent and lets the documented `ON DELETE CASCADE` chains do their job as designed.
5. **Wrap any accompanying SQL cleanup (e.g., waitlist rows that don't cascade from `auth.users` because they predate account creation) in an explicit transaction** (`BEGIN; ... COMMIT;`), and test the exact statements against a local/staging Supabase instance first (per Supabase's own agent-skill guidance already available in this environment: "Prefer local development and testing before applying changes to a remote project").
6. **Run it once, by one person, with a second person reviewing the dry-run output beforehand** — this is a two-person-rule situation given the irreversibility.
7. **Verify post-deletion**: re-run the original `SELECT` criteria (should return 0 rows), spot-check that a few known-real users are unaffected, and confirm the public counter now reflects only genuine entries.

**Warning signs:** Anyone proposes running a `DELETE` directly in the Supabase SQL editor without first running the matching `SELECT`; match criteria are a `LIKE` pattern with no allowlist cross-check; no mention of backup/PITR before the task starts; deletion planned as ad hoc "just run this query" rather than as its own reviewed phase/task.

**Phase to address:** Its own explicit, narrowly-scoped phase (not a footnote inside another phase) — "Production test-account cleanup" — gated by a written criteria doc + dry-run export + a second reviewer, executed *after* the founder counter is otherwise ready to go live but *before* the public launch announcement, so the counter is credible from the first moment it's publicly visible.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Single opt-in, no confirmation email | Faster to build, higher raw signup count | Counter inflated by dead/bot/disposable emails; abuse vector for email-bombing third parties (Pitfall 5, 12) | Never, given the reward attached — acceptable only for a plain non-rewarded newsletter |
| Reusing `tier='premium'` boolean for both "legacy unlimited" and "founder capped" | No schema change needed | Cannot distinguish existing users' prior entitlement from new capped grants (Pitfall 9); makes rollback of the credit-gate change ambiguous | Never for this milestone — add a distinguishing column/enum |
| Hardcoded `+N` offset on the public counter "to look more active early on" | Feels better for the first few days of launch | DGCCRF dark-pattern / deceptive-practice exposure (Pitfall 11) | Never |
| Deferring the "spot 200 reached" end-state design | Ships the happy-path counter sooner | Live incident when the milestone actually succeeds — a designed dead-end at your own success metric | Only acceptable if genuinely certain 200 won't be reached before a follow-up phase ships — risky bet on a feature explicitly designed to hit 200 |
| Skipping CAPTCHA for v1 to ship faster | Simpler form, faster build | Bot signups pollute the counter and waste founder spots (Pitfall 12); harder to add after real user muscle-memory forms around the frictionless form | Acceptable only if double opt-in + rate limiting are both in place as compensating controls, and CAPTCHA is a fast-follow, not "later, maybe" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase RLS on waitlist table | Allowing a public `INSERT` RLS policy directly reachable via the anon key, bypassing app-level rate limiting/validation | Route writes through the Hono API (Zod validation + Upstash rate limit) as the primary gate; if RLS insert is kept as defense-in-depth, still don't rely on it alone |
| Supabase `auth.users` deletion | Raw SQL `DELETE FROM auth.users` instead of the Admin API | Always use `supabase.auth.admin.deleteUser(id)` for `auth.users` rows |
| next-intl new route | Adding `/waitlist` only under the default locale, forgetting the `/en/waitlist` mirror and `alternates.languages` in metadata (the existing `cgu/page.tsx` pattern shows the expected shape) | Add the route inside the `[locale]` segment, wire `generateStaticParams`, and mirror the `alternates: { canonical, languages: { fr, en } }` pattern already used sitewide |
| Vercel cron for waitlist cleanup | Adding a new cron job without reserving it in `vercel.json`'s existing 7-job budget, or without the same `CRON_SECRET` hard-fail guard `CONCERNS.md` already flags as missing elsewhere | Add `CRON_SECRET` verification with a hard 503 (not pass-through) if unset — this is already a known gap in this codebase per `CONCERNS.md`; do not repeat it in the new cron |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Live `COUNT(*)` query on every page load with no cache at all | Slow TTFB on the marketing page under any real traffic spike (e.g., a founder social post going semi-viral) | Cache the count with a short TTL (seconds, via `revalidateTag`/`fetch` cache or Redis) — short enough to feel live, long enough to absorb bursts | Noticeable once traffic exceeds a few requests/second on a cold Vercel function; a viral moment is exactly when this feature needs to not fall over |
| Static-rendered waitlist/counter page (Next.js default for App Router pages with no dynamic APIs used) | Counter shows a build-time or last-ISR-revalidation number, not the live count, especially right after a deploy | Explicitly mark the counter's data source as dynamic (`export const dynamic = 'force-dynamic'` on the counter's fetch, or isolate it in a small dynamic component/route handler) or use `revalidateTag`/`revalidatePath` triggered on every successful waitlist insert | Immediately, on first deploy, if this isn't addressed — this is a correctness bug, not a scale bug |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Symmetric/non-constant-time response for "already registered" vs "new signup" | Enumeration of who is on the waitlist (privacy leak; also lets an attacker confirm a specific target's participation) | Reuse the `INVALID_OR_EXPIRED`-style generic envelope pattern already proven in `backend/api/src/coach/clients/service.ts` |
| No rate limit on the waitlist POST endpoint | Bot spam inflates/exhausts the founder-offer spots; enables email-bombing | Reuse the existing Upstash Redis sliding-window rate limiter (per-IP + per-email) already established in this codebase |
| CGV/CGU legal text drafted and reviewed after the code ships | Live discrepancy between what the app does and what it legally promises, directly checkable by any user or regulator | Sequence per Pitfall 10 — legal text live before or with the code change, behind a feature flag if needed |
| Deleting `auth.users` rows via raw SQL instead of Admin API | Inconsistent internal Supabase auth state, potential login/orphan bugs | Use `supabase.auth.admin.deleteUser()` exclusively for `auth.users` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Counter shows a number that visibly decreases | User assumes the site is buggy or lying, undermines trust in the founder offer specifically | Freeze/smooth the displayed count once past a threshold rather than showing raw real-time churn; be transparent in copy that the count reflects "confirmed reservations" |
| No clear "what happens after I join the waitlist" messaging | User doesn't know if they need to check email, whether they're guaranteed a spot, or when to expect news | Confirmation screen/email states explicitly: confirm email (if double opt-in), your rank if in the first 200, and what "lifetime premium" does and doesn't include (link to CGV) |
| "200/200 full" state not designed | Visitors who arrive after the cutoff get a broken/empty experience or a page that still implies spots remain | Design the full-state explicitly: acknowledge the offer closed, invite plain waitlist signup for launch notifications instead |

## "Looks Done But Isn't" Checklist

- [ ] **Waitlist consent checkbox:** Often looks done with just an email field + submit button — verify a genuine, unchecked, clearly-worded consent action exists and is legally separable from "join the waitlist" if marketing reuse is intended (Pitfall 1).
- [ ] **CGV "à vie" clause:** Often looks done as one marketing-sounding sentence — verify it states scope (which features, current vs future), the meaning of "lifetime" (service lifetime, not user lifetime), and does not contain an unqualified unilateral-modification clause (Pitfalls 7, 8).
- [ ] **Credit-gate change:** Often looks done as a one-line diff flipping the premium bypass — verify existing `tier='premium'` production users have been audited and either grandfathered or explicitly migrated with notice, and that the CGU is live describing the new behavior before the flag is flipped (Pitfalls 9, 10).
- [ ] **Public counter:** Often looks done as a `SELECT COUNT(*)` badge — verify it's not statically cached stale, has a designed "full" end-state, and contains no artificial offset (Pitfall 11).
- [ ] **Test-account deletion:** Often looks done as "ran a DELETE query" — verify a dry-run export, a backup/PITR checkpoint, and a second reviewer all happened first, and that `auth.users` rows were removed via the Supabase Admin API (Pitfall 13).
- [ ] **fr/en parity on new legal pages:** Often looks done in French only, with English added as an afterthought — verify the CGV and any waitlist-specific privacy notice ship fully translated per the existing `next-intl` `[locale]` pattern before public launch, matching the `alternates.languages` metadata pattern already used on `cgu/page.tsx`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Over-deleted real users during test-account cleanup | HIGH | Immediately stop further writes; restore from the pre-deletion export/backup for the specific affected rows, or trigger Supabase PITR to the checkpoint timestamp if the export was incomplete; notify affected users if any user-facing impact occurred |
| Existing premium users complain about silent AI-credit downgrade | MEDIUM | Immediately grandfather them (flip their rows back to the pre-change unlimited behavior via the distinguishing column proposed in Pitfall 9) while the legal/product team decides the permanent policy; do not argue the point live with affected users |
| Counter caught being inflated/fabricated or visibly decreasing without explanation | MEDIUM-HIGH | Publish a correction/transparency note; align the displayed number with the real query immediately; this is a trust-repair problem more than a technical one — treat it accordingly, do not just quietly fix the number |
| CGV shipped with an abusive unilateral-modification clause | LOW-MEDIUM if caught before enforcement, HIGH if a regulator or claimant acts first | Amend the CGV promptly with counsel, notify affected users of the corrected terms, do not attempt to retroactively enforce the voided clause |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Invalid consent checkbox | Waitlist UI-SPEC | Checkbox renders unchecked by default; consent action is a distinct, unambiguous affirmative act |
| 2. No Article 13 notice at collection | Waitlist UI-SPEC + legal-pages | Notice text visible on the form itself, not only via footer link |
| 3. No retention limit | Waitlist DB/migration phase | Retention column/cron exists; privacy policy states the period |
| 4. Erasure vs. founder-rank conflict | Waitlist schema design + legal-pages (lawyer review) | Data model separates identity from rank; CGV states what erasure does to a reserved spot |
| 5. Double opt-in decision | Waitlist backend phase | Only confirmed entries count toward the public 200 |
| 6. Marketing reuse without fresh basis | Legal-pages phase + standing product policy | Purpose statement is narrow and accurate; any expansion requires new consent |
| 7. "À vie" enforceability/deceptive-practice risk | CGV drafting phase (lawyer review before launch) | CGV defines scope of "lifetime," ties it to service lifetime, matches marketing copy exactly |
| 8. Abusive unilateral-modification clause | CGV drafting phase (lawyer review before launch) | No black-list-pattern clause; any modification right is narrow, justified, and notice-bearing |
| 9. Silent downgrade of existing premium users | Dedicated audit phase before credit-gate change | Query confirms count of pre-existing `tier='premium'` rows; grandfather/migration decision documented and implemented |
| 10. Legal text / code drift | Legal-pages phase + credit-gate-change phase (shared gate) | Feature flag decouples deploy from activation; CGU confirmed live before flag flips |
| 11. Public counter failure modes | Waitlist UI-SPEC + backend phase | No hardcoded offset; live/short-TTL query; "200/200" state designed and copy-reviewed |
| 12. Public endpoint abuse | Backend waitlist-endpoint phase (security-review gated) | Rate limiting, CAPTCHA, constant-time generic envelope, double opt-in all present before public launch |
| 13. Test-account deletion gone wrong | Dedicated cleanup phase (two-person rule) | Written criteria doc, dry-run export, backup/PITR checkpoint, Admin API used for `auth.users`, post-deletion verification query returns 0 |
| Next.js caching of the counter | Waitlist implementation phase | Confirm via a fresh deploy + immediate manual signup that the displayed count updates without a full redeploy |

## Sources

- CNIL — [Comment recueillir le consentement des personnes](https://www.cnil.fr/fr/les-bases-legales/consentement)
- CNIL — [La prospection commerciale par courrier électronique, SMS-MMS et automate d'appel](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique)
- CNIL — [La prospection B to C : quelles règles pour transmettre des données à des partenaires ?](https://www.cnil.fr/fr/la-prospection-b-to-c-quelles-regles-pour-transmettre-des-donnees-des-partenaires)
- CJEU, *Planet49* (C‑673/17, 1 Oct. 2019) — pre-ticked boxes do not constitute valid consent; summarized at [dastra.eu](https://www.dastra.eu/fr/article/collecte-des-donnees-la-case-pre-cochee-ne-vaut-pas-consentement/53345)
- GDPR Recital 32 — no consent from silence, pre-ticked boxes, or inactivity
- CNIL NS-048 referential on retention of client/prospect data (3-year rule) — via [Légifrance](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000033117901) and summarized at [leto.legal](https://www.leto.legal/guides/rgpd-quelle-est-la-duree-de-conservation-de-vos-donnees)
- Double opt-in best-practice status (not a legal requirement in France) — [donneespersonnelles.fr](https://www.donneespersonnelles.fr/newsletter-rgpd-conformite)
- Code de la consommation, Art. R.212-1 (liste noire of abusive clauses, including unilateral modification of duration/characteristics/price) — [Légifrance](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032807194/)
- DGCCRF / economie.gouv.fr — [Clauses abusives: 12 clauses interdites et 10 clauses dont il faut démontrer la légitimité](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/clauses-abusives-12-clauses-interdites-et-10-clauses-dont-il-faut-demontrer-la-legitimite)
- DGCCRF / economie.gouv.fr — [Pièges sur les sites de commerce en ligne : attention aux dark patterns !](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/pieges-sur-les-sites-de-commerce-en-ligne-attention-aux-dark-patterns) (DGCCRF 2025–2028 priority on false scarcity/urgency counters)
- The Bootstrapped Founder — [Lifetime Deals and SaaS Businesses](https://thebootstrappedfounder.com/lifetime-deals-and-saas-businesses/)
- ancientgeekery.com — [AppSumo Lifetime Deals. Whose Lifetime, Exactly?](https://ancientgeekery.com/articles/appsumo-lifetime-deals-whose-lifetime-exactly)
- Next.js official docs — [App Router: Static and Dynamic Rendering](https://nextjs.org/learn/dashboard-app/static-and-dynamic-rendering); community/GitHub discussion on `revalidatePath` reliability on Vercel ([vercel/next.js #60641](https://github.com/vercel/next.js/discussions/60641))
- Codebase evidence (read directly, not inferred): `backend/api/src/middleware/creditGate.ts` (current unconditional `tier==='premium'` bypass); `supabase/migrations/026_ai_credits.sql` (`ON DELETE CASCADE` pattern, `premium_grant` transaction type already in the schema's CHECK constraint); `backend/api/src/coach/clients/service.ts` (existing constant-time `INVALID_OR_EXPIRED` anti-enumeration pattern for invitation codes); `.planning/codebase/CONCERNS.md` (CRON_SECRET pass-through gap, placeholder legal content, duplicate migration numbers); `apps/web/src/app/[locale]/(marketing)/cgu/page.tsx` and `politique-de-confidentialite/page.tsx` (existing fr/en legal-page pattern and metadata structure)

**Uncertainty flagged for lawyer review (do not treat as settled legal conclusions):**
- Whether an unclaimed/claimed "founder spot" survives an erasure request as an accepted contractual offer (Pitfall 4)
- The precise enforceability boundary of "à vie" language under `pratique commerciale trompeuse` case law for this exact fact pattern (Pitfall 7)
- Whether the "clause abusive" black-list/grey-list framework, developed primarily around paid consumer contracts, applies identically to a free lifetime perk attached to an otherwise free/freemium product tier (Pitfall 8)
- Whether advance notice + continued use is sufficient acceptance of new capped terms for existing premium users, or whether affirmative re-consent is required (Pitfall 9)

---
*Pitfalls research for: Public waitlist + lifetime-premium founder offer (Ziko Platform, `lien-invite` workstream)*
*Researched: 2026-08-12*
