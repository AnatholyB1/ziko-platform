# Feature Research

**Domain:** Conversational AI onboarding + adaptive weekly coaching + non-punitive tiered rewards (fitness/habit-formation app, v1.18 AI Coach Core)
**Researched:** 2026-08-30
**Confidence:** MEDIUM (patterns well-established in adjacent domains; exact combination — AI-curated reward pool as loot-box substitute — has thin precedent, flagged LOW where noted)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist once a product frames itself as "AI onboarding" or "adaptive coach." Missing these makes the AI feel decorative rather than functional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Conversational free-text intake with ≤5 questions | Every mainstream AI-onboarding pattern (dating-app AI coaches, ChatGPT-style setup assistants) replaces multi-screen forms with a short chat; users expect to type naturally, not pick radio buttons — MEDIUM confidence, WebSearch-verified across 2 sources | LOW-MEDIUM | Already scoped: ≤4 questions in the milestone. Question count matters more than sophistication — Noom's 10-question slider quiz takes 15-20 min and is a known friction point in teardown critiques; the 5-minute target in this milestone is deliberately shorter |
| Adaptive first-session difficulty (placement-test pattern) | Duolingo's onboarding test adjusts question difficulty in real time from user answers to place them in the right unit — users of any onboarding-adaptive product expect the *first* real task to already be calibrated, not generic (HIGH confidence, Duolingo official/verified pattern) | MEDIUM | Ziko's equivalent: the single micro-action assigned within 5 minutes must already reflect the inferred profile (hydration log for a fragile beginner vs. a full workout for an experienced athlete), not a fixed "welcome task" |
| Immediate completable action + celebration ("quick win") | Freeletics and Duolingo both engineer a near-guaranteed early win to anchor retention; a 20-minute first task kills day-1 completion, a sub-1-minute task doesn't | LOW | Already scoped as "micro-action ... within 5 minutes ... first celebration" — matches the domain pattern exactly |
| Weekly feedback loop tied to logged (not self-reported difficulty) data | Freeletics adjusts next week's plan from post-workout difficulty ratings + completion; the Ziko design goes further by using *actual logged activity* rather than a subjective rating, which is stronger signal but requires reliable logging plugins to already be wired (habits, nutrition, hydration are pre-existing) | MEDIUM | Depends on existing plugin activity tables already being queried — the six-query `fetchUserContext` pattern already exists (`backend/api/src/context/user.ts`) and is a natural extension point |
| Streak/consistency signal without punitive reset | Loss-aversion mechanics (streaks) are default in the category, but 2026 best practice is protection-first: streak freezes reduce anxiety-driven churn and keep users engaged 17.19 vs 11.62 days past the 7-day mark (MEDIUM confidence, cited stat from gamification best-practices roundup, single-source) | LOW-MEDIUM | Ziko's ask is stronger than a freeze — literally zero punishment, only asymmetric upside. This is compatible with, not contradicted by, the freeze pattern: freeze is a *mitigation* for punitive systems; Ziko removes the punishment at the root, which is simpler to reason about |
| Progressive disclosure of complexity (not full UI on day 1) | Established UX pattern independent of AI: "get user to first success with minimum features, reveal more when the next step creates the need" (MEDIUM confidence, UX literature, multiple sources agree) | MEDIUM | Directly matches "plugin drawer restricted then expanded." The generic pattern is contextual (reveal on next-step-need); Ziko's variant is a coach-graded readiness score, which is a stricter/more centralized gating rule than typical reactive disclosure |

### Differentiators (Competitive Advantage)

Features that go beyond category norms and directly express Ziko's "AI as pilot, not decoration" positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Free-text → structured confidence/experience profile (not slider/multi-choice) | Competitors (Noom, most fitness apps) use structured quizzes because they're cheap to build and easy to validate; inferring the *same* structured profile from open text ("j'ai déjà lâché 3 apps de sport") is harder to build but produces richer signal (adherence risk, not just stated experience level) and feels conversational rather than clinical — this is the single biggest differentiator named in the milestone | MEDIUM-HIGH | Technically: `generateObject` (Vercel AI SDK v6, already the stack's AI library) with a Zod schema is the standard 2026 pattern for structured extraction from free text (HIGH confidence, official Vercel AI SDK docs). Confidence scoring is the harder part — no out-of-box field-level confidence from `generateObject`; options are (a) ask the model to self-report a confidence field per inferred attribute inside the same schema (cheap, some noise), or (b) log-probability based scoring (more accurate, requires provider support for logprobs, added complexity, not confirmed available for the Claude Sonnet model already used in `models.ts`). **Recommend (a)** for v1 — self-reported confidence field in the same `generateObject` call, validated against real usage before investing in logprob-based scoring |
| Adherence-risk-first skip logic (skip the ramp-up for experienced users) | Category norm is a *single* onboarding-to-plan pipeline with cosmetic personalization (goal, equipment). Ziko's ask — an experienced athlete bypasses the "training wheels" week entirely — is closer to Duolingo's placement test (skip units you've already mastered) applied to *behavior change* rather than knowledge, which has thinner precedent (LOW-MEDIUM confidence: pattern exists in adjacent domain, not found as a named pattern in fitness apps specifically) | MEDIUM | Real risk: false positive (an inexperienced user talks a confident game, gets the full program, drops in week 1) is asymmetric and costly for a product explicitly optimizing adherence. Mitigate by keeping the *first week's real logged behavior* as a fast override signal, not just the onboarding inference — i.e., the weekly adaptive engine (capability 2) is also the safety net for onboarding profiling errors (capability 1) |
| Real-activity-driven weekly focus decision (not calendar/curriculum-driven) | Freeletics adapts *within* a fixed program structure (harder/easier variant of the same plan); Ziko's design decides *what domain* to focus on next (hydration-only vs. full program) based on adherence, which is a coarser, more structural adaptation than difficulty-tuning — this is closer to a stepped-care behavior-change model (used in clinical/therapy apps) than to fitness-app norms (LOW confidence — no direct fitness-app precedent found, inferring from stepped-care behavioral health literature via training knowledge, not verified this session) | HIGH | Flag for phase-specific research: stepped-care / minimal-effective-dose behavior change design is a real clinical concept worth a dedicated research pass before the weekly-engine phase is planned, since none of this session's sources confirm a consumer-fitness-app precedent |
| Asymmetric reward (never worse for under-performing, always equal-or-better for over-performing) | This is a genuine differentiator versus the loss-aversion-with-freeze pattern that dominates the category — Ziko removes downside risk entirely rather than mitigating it. No direct precedent found for this exact "floor-guaranteed, upside-only" mechanic in a consumer fitness app (LOW confidence — did not find a named example; inferred as a stronger version of documented "recoverable loss" and "protection feature" best practices) | LOW-MEDIUM | Main design risk is *not* technical, it's motivational: pure upside-only removal of stakes can under-motivate anyone who is intrinsically driven by loss aversion. Standard mitigation in the literature is to keep *visible* progress/streak state (so there is still something to protect emotionally) while the *reward tier* itself never regresses — Ziko's design already separates "logged activity vs. assigned" from "reward tier," which naturally supports this: streak/consistency display can still visually dip, only the reward ratchet cannot |
| AI-curated reward from a fixed pool (not randomized loot box) | This is the standout differentiator and also the highest-uncertainty item researched this session. Industry commentary confirms the *opposite* trend is more common and more monetization-effective: "AI-driven loot boxes... tailor rewards based on playstyle... reduces likelihood of undesirable items" is described as an emerging idea, still framed around randomized *drop mechanics* with AI adjusting odds/content, not a fully deterministic AI pick from a curated pool (MEDIUM confidence — this is the dominant framing found; true deterministic-pick systems are described as rare and only prototyped) | MEDIUM | See dedicated Anti-Features and Dependency Notes below — this is the item with the clearest regulatory rationale (ANJ) but the thinnest product-precedent |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Randomized loot-box / mystery-box rewards | Proven to maximize engagement — variable-ratio reinforcement is the single most effective psychological mechanic in gamification, and it is the industry default (games like Genshin Impact built $5B+ revenue on it) (HIGH confidence, well-documented mechanic) | Explicitly out of scope per product requirement: French ANJ (Autorité Nationale des Jeux) treats chance-based digital reward mechanics as adjacent to gambling regulation; ANJ, ARCOM, and the Défenseur des droits have flagged loot-box-style mechanics as producing at-risk behavior, and the new JONUM framework specifically targets "financial sacrifice + chance mechanics + monetizable digital objects" combinations (MEDIUM confidence — regulatory landscape is evolving; JONUM is an experimental framework, not yet settled law) — even if Ziko's rewards have no resale/monetary value (as stated in the constraint), staying clear of anything chance-based avoids future regulatory reclassification risk as the reward catalog grows | AI picks deterministically from the tier-eligible pool; this doubles as a UX benefit (users can trust that better performance never produces a worse outcome, which chance-based systems cannot guarantee) |
| Full randomized A/B'd cosmetic drop rates that "feel" random to hide determinism | Product/growth teams sometimes want to preserve the dopamine hit of surprise without the regulatory exposure — i.e., deterministic selection but revealed with fake randomness/animation | Presenting a deterministic choice as if it were chance-based is a dark-pattern risk (perceived deception) and, if the underlying selection is provably deterministic but the UI implies randomness, it does not remove ANJ exposure — regulators look at the actual mechanic, not the presentation | Be transparent that a coach (AI) chose the reward "for you" — framing it as personalization/merit rather than luck is both honest and reinforces the coaching narrative already central to the product |
| Punitive streak reset / worse-reward-for-underperformance | Common in the category (default Duolingo-style hard streak reset) and requested reflexively because "it's how these apps work" | Explicitly contradicts the product owner's stated non-punitive design goal; also empirically the harshest version (total reset) drives abandonment rather than recovery, per gamification best-practice sources | Floor-guaranteed reward tier (never decreases) + optional visible streak/consistency indicator that can dip without affecting unlocked rewards |
| Fully generic single onboarding-to-plan pipeline (structured form, same plan shape for everyone) | Simplest to build, matches most competitors including the *existing* Ziko 7-step onboarding being extended here | Undermines the core differentiator (adherence-aware personalization) and the explicit "beginner gets training wheels / expert skips them" requirement | Keep the structured 7-step onboarding for objective facts (goals, equipment, constraints) and layer the new conversational module specifically for the subjective/behavioral inference (confidence, adherence risk) — do not try to replace the existing onboarding wholesale |
| Reusing the existing gamification plugin's XP/coins/shop system as-is for the new reward-tier mechanic | Looks like less work — a currency + shop system already exists (`plugins/gamification/`) | It is a *fixed-price purchase* model (`price` vs. `level_required` on `ShopItem`, user spends coins to buy any affordable+unlocked item) — the opposite mechanic from "AI picks the single best-fit reward from an eligible pool." Conflating them would either break the existing purchase UX or force the AI-selection logic to fight the shop's buy-anything-you-can-afford model. The codebase's own v1.4 decision log explicitly separates AI credits from gamification coins for analogous reasons ("dual balance — coins are unlimited reward currency, credits are cost-controlled") | Model the new mechanic as a **distinct** points/tier track (new tables) that can *reference* the existing shop catalog or `LevelDef`/`ShopItem` types for reward *content*, without reusing the balance/spend semantics. Needs an explicit product decision: is this a third currency, or does it feed into existing XP? Recommend a new dedicated counter to keep AI-selection logic simple and auditable, separate from user-driven shop spending |
| Real-time dynamic drop-rate tuning per user (the "AI-driven loot box" framing found in research) | Sounds like the sophisticated version of what's being asked | Confuses two different concepts: tuning *odds* (still random, still ANJ-adjacent) vs. tuning *selection* (deterministic, ANJ-safe). The industry commentary found this session mostly describes the former even when using "AI" language — a trap for anyone copying "AI-driven rewards" pattern language uncritically | Be explicit in specs/tool design that the "AI decision" tool always returns exactly one reward id, never a probability distribution over rewards |

## Feature Dependencies

```
[Structured 7-step onboarding] (existing, unchanged)
    └──feeds──> [Conversational profiling module] (new)
                    └──produces──> [athlete_state: experience/confidence/adherence-risk profile]
                                        └──requires──> [Weekly adaptive decision engine]
                                        └──requires──> [Feature-gating / plugin drawer restriction]
                                        └──requires──> [Starting reward tier / starting level]

[Weekly adaptive decision engine]
    └──requires──> [Real logged activity data] (existing plugins: habits, nutrition, hydration, workouts — already queried in fetchUserContext)
    └──requires──> [athlete_state + athlete_decisions journal] (new tables, GSD-STATE.md-inspired pattern)
    └──produces──> [Next week's assigned focus/objective]
    └──produces──> [Points delta] ──feeds──> [Tiered reward system]
    └──acts as safety net for──> [Onboarding profiling errors] (corrects false positives/negatives from capability 1)

[Tiered reward system] (new — distinct from existing plugins/gamification XP/coins/shop)
    └──requires──> [Points accumulation from weekly engine]
    └──requires──> [Reward pool definitions per tier] (content, possibly authored by coach/admin)
    └──requires──> [AI selection tool] (new AI tool in backend/api/src/tools/registry.ts)
    └──conflicts with──> [Randomized/chance-based reward selection] (explicit anti-feature, ANJ)
    └──must never──> [Decrease previously-unlocked tier] (non-punitive constraint)

[Feature-gating / plugin drawer restriction]
    └──requires──> [athlete_state readiness/level field]
    └──enhances──> [Progressive onboarding UX] (reduces overwhelm for fragile-adherence beginners)
    └──requires──> [PluginLoader / plugin drawer to read a per-user visibility rule] (existing 19-plugin registry, new gating layer on top)

[AI tools: objective creation, reward creation, program creation]
    └──requires──> [Existing AI orchestrator + tool registry] (backend/api/src/tools/registry.ts, already handles nutrition/pantry/coach tools)
    └──requires──> [Credit gating] (existing creditCheck/creditDeduct middleware — new AI calls must be classified into a credit kind or explicitly exempted)
```

### Dependency Notes

- **Conversational profiling requires the existing 7-step onboarding to stay in place, not be replaced:** the milestone scope is additive (mascot chat layered onto/after the structured flow for the subjective/behavioral dimension), not a rewrite of objective-fact collection (goals, equipment, constraints already captured structurally).
- **Weekly adaptive engine requires real logged activity as source of truth, not self-report:** this is a stronger dependency than Freeletics' model (which relies on self-rated difficulty). It means the engine cannot function meaningfully until at least one full week of activity exists in the relevant plugin tables — the first week's assignment is necessarily driven by the onboarding-inferred profile alone, with the engine only correcting from week 2 onward.
- **Weekly adaptive engine acts as the safety net for onboarding profiling errors:** because free-text inference (LLM-based, self-reported confidence) is inherently noisier than a form field, the weekly engine's real-activity check is the mechanism that catches an over- or under-estimated starting profile. This should be treated as a required design property, not an incidental benefit, when the roadmap phases these two capabilities — the weekly engine should not be scoped as strictly "later/optional" relative to onboarding, since onboarding's risk is unmitigated without it.
- **Tiered reward system conflicts with reusing the existing gamification plugin's coin/shop mechanic directly:** see Anti-Features above. This is a phase-ordering-relevant dependency — a data-model decision (new tables vs. extending `plugins/gamification`) needs to be made before implementing either the weekly engine's point-awarding step or the AI reward-selection tool.
- **Feature-gating enhances but does not require the reward-tier system:** plugin drawer restriction can be driven purely by the onboarding-computed starting level + engine-updated readiness, independent of whether reward-tier selection is fully built — meaning gating could ship in an earlier phase than the full AI-reward-pool mechanic if sequencing pressure requires it.
- **All new AI tools require credit-gate classification:** the existing `creditCheck(kind)` pattern only recognizes `chat`, `scan`, `program` kinds today (per CLAUDE.md AI routes table). New tools (objective creation, reward creation) need an explicit product decision — are these charged against the athlete's AI credit balance, or are they system-initiated/free (since they're proactive coaching decisions, not user-requested)? This should be resolved before backend implementation, not discovered mid-phase.

## MVP Definition

### Launch With (v1)

- [ ] Conversational onboarding chat (≤4 free-text questions) with `generateObject`-based structured extraction into an experience/confidence/constraints profile, including a self-reported confidence field per inferred attribute — core differentiator, explicitly in scope
- [ ] Single immediately-completable micro-action + first celebration, scaled to the inferred profile (not generic) — table stakes, proven pattern (Duolingo/Freeletics quick-win)
- [ ] `athlete_state` + `athlete_decisions` append-only journal (already named in PROJECT.md target features) — required foundation for both onboarding output and weekly engine input; nothing else can be built without this
- [ ] Weekly adaptive decision engine reading real logged activity vs. assigned focus, producing next week's single focus objective — core mechanic, cannot be deferred since it's also the safety net for onboarding errors
- [ ] Non-punitive point accrual: assigned-target met = standard reward signal, exceeded = better reward signal, under-performed = no reward, never negative
- [ ] Tiered reward pool + AI-selection tool returning exactly one deterministic reward id per tier-unlock event (new data model, separate from `plugins/gamification` coins/shop)
- [ ] Feature-gating layer: plugin drawer visibility driven by athlete readiness level, computed at onboarding and updated by the weekly engine

### Add After Validation (v1.x)

- [ ] Logprob-based or otherwise more rigorous confidence scoring for onboarding extraction, if self-reported confidence proves unreliable in practice (trigger: manual review shows systematic over/under-confidence in AI self-ratings)
- [ ] Coach-authored/customizable reward pools per tier (if the initial pool is hardcoded/seeded, this generalizes it) — trigger: coach platform demand once CRM-side visibility into athlete reward state exists
- [ ] Richer readiness signals beyond week-over-week activity (e.g., session quality, RPE trends from the existing `rpe` plugin) feeding the weekly engine — trigger: once the basic activity-vs-assigned comparison is validated as sufficient signal

### Future Consideration (v2+)

- [ ] Factions/leagues/leaderboards/promotion-relegation/battle-pass — explicitly out of scope per PROJECT.md (SEED-001), deferred to a future milestone; do not let reward-tier design accidentally couple to social/competitive mechanics
- [ ] Cosmetic loot/skins — explicitly out of scope per PROJECT.md
- [ ] Extended multi-state mascot — explicitly out of scope per PROJECT.md; current milestone's mascot is chat-only for onboarding, not a persistent animated character system

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Conversational onboarding + free-text profile inference | HIGH | MEDIUM-HIGH | P1 |
| Micro-action + celebration within 5 min | HIGH | LOW | P1 |
| `athlete_state`/`athlete_decisions` journal | HIGH (foundation) | LOW-MEDIUM | P1 |
| Weekly adaptive decision engine | HIGH | HIGH | P1 |
| Non-punitive point accrual logic | HIGH | LOW-MEDIUM | P1 |
| AI-curated tiered reward selection | MEDIUM-HIGH (regulatory necessity + differentiator) | MEDIUM | P1 |
| Feature-gating by readiness | MEDIUM-HIGH | MEDIUM | P1 |
| Coach-customizable reward pools | MEDIUM | MEDIUM | P2 |
| Logprob-based confidence scoring | LOW-MEDIUM | MEDIUM | P3 |
| Session-quality/RPE-enriched readiness signal | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for launch (all of them, per PROJECT.md's target feature list — this milestone has no soft/optional core features; every listed capability is load-bearing for the others)
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Duolingo | Freeletics | Noom | Our Approach |
|---------|----------|------------|------|--------------|
| Onboarding profiling | Adaptive placement *test* (right/wrong answers, knowledge-based) | Structured goal/equipment questions, not conversational | Structured 10-question slider quiz, 15-20 min | Free-text conversational chat, ≤4 questions, <5 min, infers *behavioral risk* not knowledge — more ambitious extraction target than any of the three |
| Weekly adaptation | Continuous per-lesson adaptation, not weekly-batched | Weekly plan regenerated from self-rated difficulty + completion | Human coach + curriculum, not algorithmic weekly re-scoping | Weekly batch decision from *real logged activity* (not self-report), coarser structural adaptation (which domain to focus on, not just difficulty) |
| Reward mechanic | Streak + freeze (loss-averse, punitive-if-broken) + gems (mixed) | Points/achievements, no chance mechanic found | Group/coach social reinforcement, no points-shop | Points → tier → AI-picked reward, explicitly non-random, explicitly non-punitive — no direct competitor precedent found for this exact combination |
| Feature gating | Unit-based (must complete/test out of prior units) | Minimal — most features available from day 1 | Curriculum unlocks day-by-day on a fixed calendar | Readiness-based (AI-judged), not calendar-based and not test-based — closer to Duolingo's unit-gating logic than to Noom's fixed calendar |

## Sources

- [How the Freeletics Coach gets you](https://www.freeletics.com/en/blog/posts/how-freeletics-coach-gets-you/) — MEDIUM confidence, official brand content
- [Duolingo partial-credit placement test blog](https://blog.duolingo.com/partial-credit-improvements-to-duolingos-placement-test/) — HIGH confidence, official Duolingo engineering blog
- Streak/milestone gamification roundup — [AppStorys](https://appstorys.com/blog-Streaks-Milestones-Habit-Gamification), [Plotline](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps) — MEDIUM confidence, industry blog, cross-referenced across 2 sources
- [Noom Product Critique: Onboarding — The Behavioral Scientist](https://www.thebehavioralscientist.com/articles/noom-product-critique-onboarding) — MEDIUM confidence, independent critique
- [Noom web-to-app onboarding teardown — RevenueCat](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel) — MEDIUM confidence
- [Progressive Feature Unlock — AI UX Playground](https://aiuxplayground.com/pattern/progressive-feature-unlock/) — MEDIUM confidence, UX pattern catalog
- [Progressive Disclosure in UX — UXPin](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/) — MEDIUM confidence
- ANJ / JONUM regulatory landscape — [e-Legal](https://www.e-legal.fr/jeux-video-en-ligne-reglementation-des-loot-boxes/), [Assemblée Nationale question écrite](https://questions.assemblee-nationale.fr/q15/15-14570QE.htm), [LE MAG JURIDIQUE](https://www.lemag-juridique.com/categories/consommation-15612/articles/la-reglementation-des-lootboxes-2971.htm) — MEDIUM confidence, French legal/institutional sources cross-referenced across 3 sources; JONUM framework noted as experimental/evolving, not settled law
- [Mystery Box Reward Design — Yu-kai Chou](https://yukaichou.com/advanced-gamification/decoding-the-mystery-box-a-dive-into-the-intricacies-of-reward-design/) — MEDIUM confidence, established gamification-design authority
- [Loot Boxes 2.0: Embracing Immersive Tech and Intelligent Systems — data40.com](https://data40.com/articles/loot-boxes-2-0-embracing-immersive-tech-and-intelligent-systems/) — LOW-MEDIUM confidence, single source for "AI-driven loot box" framing, treated cautiously (this framing conflates odds-tuning with deterministic selection — see Anti-Features)
- [Structured Data Extraction — Vercel Academy](https://vercel.com/academy/ai-sdk/structured-data-extraction) — HIGH confidence, official Vercel AI SDK docs (same SDK/version family already used in this codebase per CLAUDE.md: AI SDK v6)
- [A confidence score for LLM answers — Medium/inganalytics](https://medium.com/wbaa/a-confidence-score-for-llm-answers-c668844d52c8) — LOW-MEDIUM confidence, single source on logprob-based confidence scoring, not verified against the specific Claude Sonnet model already pinned in `backend/api/src/config/models.ts`
- [Predictors of long-term resistance exercise adherence — Frontiers in Sports and Active Living](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2026.1855668/full) — MEDIUM-HIGH confidence, peer-reviewed cohort study; supports "first-28-days activity is the strongest adherence predictor" claim underlying the weekly engine's real-activity-driven design
- Codebase inspection: `plugins/gamification/src/store.ts`, `plugins/gamification/src/manifest.ts`, `.planning/PROJECT.md` (v1.4 decision log: "Separate AI credits table (not gamification coins)") — HIGH confidence, primary source, direct read

---
*Feature research for: Conversational AI onboarding + adaptive weekly coaching + non-punitive tiered rewards (Ziko Platform v1.18 AI Coach Core)*
*Researched: 2026-08-30*
