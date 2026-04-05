# Feature Research

**Domain:** Gamified AI credit system & freemium monetization for fitness mobile app
**Researched:** 2026-04-05
**Confidence:** HIGH (cross-verified across game design literature, live app analysis, AI pricing guides, and competitor systems)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Visible credit balance in UI | Every gated system shows remaining credits; users need to know what they have before acting | LOW | Header or profile widget; reads from `ai_credits` balance |
| Daily base allocation (free quota) | Users expect a guaranteed baseline — "zero free uses" = immediate rejection | LOW | 1 free vision scan + 1 free AI chat/day; 1 program/month; soft-reset via cron or lazy-eval |
| Clear per-action cost disclosure | Must show cost before consumption ("1 credit") — surprises cause churn | LOW | In-screen label near each AI action button |
| Credit exhaustion state with CTA | When credits hit zero, show WHY and HOW to earn more — not a raw error | MEDIUM | Bottom sheet: balance display + earn actions list |
| Activity-to-credit earn (fitness logging) | Fitness gamification standard: logging activity yields rewards (Habitica, Workout Quest, BetterPoints) | MEDIUM | Hook into existing plugin log events (workout, habit, meal, stretching, cardio, measurements) |
| Hard separation of cosmetic coins vs AI credits | Dual currency is industry norm (Duolingo Hearts + Gems, Habitica Gold + Gems); merging them creates confusion about scarcity | MEDIUM | `coins` = existing shop currency (unlimited earn); `ai_credits` = new capped functional currency |
| Monthly quota for expensive actions | Heavy AI features (program gen) are expected to have monthly not daily limits — precedent from ChatGPT, Perplexity, Notion AI | LOW | Separate monthly counter for `ai_programs_generate` tool only |
| Model cost transparency (Haiku migration) | If vision scan silently degrades in quality, users notice and complain — but if it's presented as "Fast scan", framing matters | LOW | Label update in nutrition vision screen; output quality difference is negligible for food recognition |
| Idempotent earn (no double-award) | Tapping "save workout" twice should not award 2 credits — users expect fairness | MEDIUM | `ai_credit_log` table with unique constraint on `(user_id, source_type, date)` |
| user_tier field (premium-ready) | Even if IAP is not live, the infrastructure must not require a schema migration when premium launches | LOW | `user_tier TEXT DEFAULT 'free'` on `user_profiles`; credit gate skips for `premium` |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Activity-gated AI (earn by doing) | Applying activity-earn mechanics specifically to AI access is novel in fitness apps; incentivizes consistent logging as a side effect of the credit system | MEDIUM | Triggers on 6 activity types; 2 bonus credits/day cap across all activity types combined |
| Credit earn toast on activity save | After logging a workout, show "+1 AI credit" in the success confirmation — immediate positive reinforcement, like Habitica's XP pop-up | LOW | Extend existing post-save toast/snackbar in each plugin; no new infrastructure |
| In-context credit nudge (not interstitial) | Show credit count inline with AI buttons rather than a blocking modal — lower friction than Duolingo Hearts, better UX per Trophy.so analysis | LOW | UI label only — "Ask AI (2 credits left)" next to each AI button |
| Streak-safe earn cap with progress display | "2 more credits available today — log a stretch session to earn" gives users agency; Fitbit and MyFitnessPal use this progress widget pattern | LOW | Daily earn progress bar in credit widget; computed from `ai_credit_log` count for today |
| Haiku vision with "Fast scan" framing | Reframe cost optimization as a user benefit — Claude Haiku is faster; positioning as "Fast scan" rather than "cheaper model" preserves perceived quality | LOW | Label change in nutrition vision screen |
| Usage transparency log | Let users see what consumed their credits: "AI Chat — 1 credit — 14:32" — builds trust that system is fair; rare among fitness apps | MEDIUM | `ai_credit_log` screen in profile or settings; reads existing log table |
| Premium tier architecture (no migration later) | Implementing `user_tier` now means upgrading a user to premium is a single column update — no schema changes when IAP eventually lands | LOW | Set via Supabase dashboard manually for early testers; IAP wires to same column in v2 |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Credit rollover (unused credits carry forward) | Users feel cheated when unused credits expire | Rollover causes balance accumulation — users save up then burst-use, creating unpredictable API cost spikes; breaks cost projection model | No rollover; communicate "use it or lose it" upfront with a daily countdown; the base quota resets daily so loss is always small |
| In-app purchase credits (IAP) | Obvious monetization lever; users expect to be able to pay for more | Requires RevenueCat or native StoreKit/Google Play Billing integration (3-8 week effort), 30% platform cut, RGPD compliance for purchases, App Store review for IAP features — disproportionate for v1.4 | Defer IAP to premium subscription milestone (v2+); this milestone only implements earn-by-activity |
| Coins-to-credits bridge (top-up via cosmetic currency) | Seems clever — users with excess coins could "buy" AI credits | Decouples coins from their cosmetic purpose; users grind coins specifically for AI credits, inflating AI cost and defeating the scarcity design; creates arbitrage loops | Keep currencies strictly separated: coins = cosmetic shop only, AI credits = activity-gated only |
| Retroactive credit award for past activity | Existing users expect credit for workouts they logged before the system launched | Creates a one-time DB migration risk (how far back?), sets precedent for credit disputes ("my habit from 2025 counted?"), and could award large balances to inactive users | Grant a one-time welcome bonus (e.g., 5 credits) at feature launch for all existing users via migration; no retroactive per-activity awards |
| Hard paywall (zero free AI access) | Simplest cost control model | Zero free uses = no trial, no virality, immediate rejection; research (RevenueCat 2025) shows "selective free access creates conviction to upgrade" — without it, free users see no product value | Always maintain a daily free base (1 scan, 1 chat) regardless of activity; gating is on bonus credits, not the base |
| UTC-midnight quota reset | Engineering convenience | Users in non-UTC timezones get unpredictable day boundaries — a Paris user hitting limit at 11:45pm CET loses their next day's quota in 15 minutes; this is the exact failure mode seen in Google AI Pro / OpenRouter complaints in 2025 | Reset at midnight user local time (store timezone on `user_profiles`) OR use a 24h rolling window keyed from first use that calendar day |
| Energy-style gates on activity logging | Duolingo-style limits on core app actions | Logging activity IS the core retention mechanic — gating it with any credits would collapse the fitness app's value loop; users would stop logging rather than earn credits | Only gate AI-powered features (chat, vision scan, program gen); NEVER gate activity logging itself |
| Unlimited earn (no daily credit cap) | More earn options = more engagement | Without a daily earn cap, a user could log 20 activities in one day and accumulate 20 AI credits — destroying the cost control model; a single power user could spike API spend to 40x the target | Hard cap: 2 bonus credits per day maximum regardless of number of activities logged |

---

## Feature Dependencies

```
[Daily base credit allocation]
    └──requires──> [ai_credits balance (column or table on user_profiles)]
                       └──requires──> [DB migration]

[Activity-to-credit earn]
    └──requires──> [Credit balance system]
    └──requires──> [Plugin log event hooks (workout, habit, meal, stretching, cardio, measurements)]
    └──requires──> [ai_credit_log table — idempotency key: (user_id, source_type, date)]

[Per-action credit gate (backend middleware)]
    └──requires──> [Credit balance system]
    └──requires──> [Backend middleware wrapping AI routes]
    └──enhances──> [Existing Upstash Redis rate limiter (v1.3) — second independent defense layer]

[Credit exhaustion CTA UI]
    └──requires──> [Per-action credit gate — to receive 402 response]
    └──requires──> [Earn activity list (static config of what earns credits)]

[Credit earn toast on activity save]
    └──requires──> [Activity-to-credit earn]
    └──requires──> [Post-save hook in each plugin]

[Usage history screen]
    └──requires──> [ai_credit_log table]
    └──independent of credit gate]

[Premium tier skip-gate]
    └──requires──> [Per-action credit gate middleware]
    └──requires──> [user_tier column on user_profiles]

[Haiku vision migration]
    └──requires──> [Model config change in nutrition vision route]
    └──INDEPENDENT of credit system — can ship in same phase without coordination]

[Streak earn multiplier — DEFERRED]
    └──requires──> [Activity-to-credit earn]
    └──requires──> [Streak tracking (separate table or computed from habit_logs daily)]
    └──DEFERRED to v2 — complexity exceeds v1.4 scope]
```

### Dependency Notes

- **Activity-to-credit earn requires idempotency:** Each plugin log action must award at most one credit event per day per `(user_id, source_type)` pair. The `ai_credit_log` table with a unique constraint on `(user_id, source_type, credit_date)` enforces this without application-level locking. Application logic also enforces the 2 bonus credits/day total cap.
- **Credit gate middleware builds on existing auth, not rate limiter:** The v1.3 Upstash Redis rate limiter is per-request. The credit gate is a Supabase DB transaction (deduct + check atomically). They run independently and both apply — rate limiter fires first (Redis), credit gate second (Supabase).
- **Haiku migration is independently shippable:** Swapping Claude vision calls to the Haiku model in the nutrition vision route is a one-line model config change. It reduces cost from ~€0.01 to ~€0.003/scan immediately without waiting for credit infrastructure.
- **user_tier conflicts with IAP complexity:** Adding `user_tier DEFAULT 'free'` now is a 5-minute migration. Wiring IAP to flip it to `premium` is a separate v2 effort. Both coexist — the column can be set via Supabase dashboard for internal testers before IAP is built.

---

## MVP Definition

### Launch With (v1.4)

Minimum set to control API cost, reward engagement, and not break the existing experience.

- [ ] **ai_credits balance** — new column or dedicated `user_ai_credits` table; tracks per-user balance — why essential: without a tracked balance, no gating is possible
- [ ] **Daily base allocation** — 1 free vision scan + 1 free AI chat/day; 1 free program gen/month — why essential: without a base, free users see zero AI value and churn immediately
- [ ] **Per-action credit gate (backend middleware)** — deducts credit before calling Anthropic; returns 402 if balance = 0 — why essential: this is the primary cost control mechanism
- [ ] **Activity-to-credit earn (6 triggers)** — workout, habit log, meal log, measurement, stretching, cardio each award +1 credit (max 2 bonus/day total) — why essential: engagement flywheel that offsets API cost with user behavior
- [ ] **ai_credit_log table** — idempotency + audit trail — why essential: prevents double-award bugs; foundation for transparency and debugging
- [ ] **Credit exhaustion UI** — bottom sheet on 402 with earn actions list and balance — why essential: without this, 402 is an opaque error that feels like a bug
- [ ] **Visible balance widget** — header or profile screen showing credit count — why essential: users must see their balance to trust the system and plan usage
- [ ] **Haiku vision migration** — swap nutrition vision route to claude-haiku model — why essential: immediate 70% cost reduction per scan, independent of credit system
- [ ] **user_tier column** — `free` | `premium`; credit gate skips for premium users — why essential: future-proofs upgrade path at zero migration cost now

### Add After Validation (v1.x)

Features to add once core credit system is working and cost projections are confirmed against the €0.75/user/month target.

- [ ] **Credit usage history screen** — list of earn + spend events with timestamps — trigger: when users ask "where did my credits go?" or support tickets about balance
- [ ] **Low balance push notification** — "You have 1 credit left — log a workout to earn more" — trigger: when push notification infrastructure is instrumented (Expo Notifications)
- [ ] **Per-plugin earn differentiation** — some activities worth more credits than others — trigger: when activity data shows which log types drive DAU most
- [ ] **Earn actions discovery screen** — dedicated "How to earn credits" list — trigger: if credit exhaustion CTA bottom sheet is not enough to educate users

### Future Consideration (v2+)

Features to defer until product-market fit and cost projections are validated.

- [ ] **In-app purchases (IAP)** — RevenueCat + StoreKit / Google Play Billing for credit top-up packs or premium subscription — defer: 30% platform cut, complex review, RGPD purchase compliance, 4-6 week integration
- [ ] **Premium subscription tier** — unlimited AI credits, unlocks all plugins — defer: needs pricing strategy, paywall copy, cancellation flow, RGPD compliance for recurring billing
- [ ] **Streak earn multiplier** — 7-day activity streak = 2x credit earn rate — defer: requires dedicated streak tracking table, timezone-aware day boundaries, missed-day grace logic
- [ ] **Referral credits** — invite a friend, both earn bonus credits — defer: requires referral attribution infrastructure (deep links, tracking), significant complexity
- [ ] **Credit gifting** — send credits to a friend — defer: abuse vector, requires community plugin maturity, major complexity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Credit balance + daily base allocation | HIGH | LOW | P1 |
| Per-action credit gate (backend middleware) | HIGH | MEDIUM | P1 |
| Activity-to-credit earn (6 triggers) | HIGH | MEDIUM | P1 |
| Haiku vision migration | HIGH (cost impact) | LOW | P1 |
| ai_credit_log (idempotency + history) | HIGH | LOW | P1 |
| Credit exhaustion UI (402 handling) | HIGH | LOW | P1 |
| Visible balance widget | HIGH | LOW | P1 |
| user_tier column (premium-ready) | MEDIUM | LOW | P1 |
| Credit usage history screen | MEDIUM | MEDIUM | P2 |
| Low balance push notification | MEDIUM | LOW | P2 |
| Earn actions discovery screen | LOW | LOW | P2 |
| Streak earn multiplier | MEDIUM | HIGH | P3 |
| IAP credit top-up | LOW (v1.4) / HIGH (v2) | HIGH | P3 |
| Premium subscription tier | HIGH (long-term revenue) | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.4 launch
- P2: Add after cost validation (v1.4.x)
- P3: Future milestone (v2+)

---

## Competitor Feature Analysis

| Feature | Duolingo | Habitica | Workout Quest | Ziko v1.4 Approach |
|---------|----------|----------|--------------|-------------------|
| Dual currency | Hearts (functional gate) + Gems (IAP premium) | Gold (earn by activity) + Gems (IAP) | Coins (cosmetic) only | Coins (cosmetic, existing, unlimited) + AI Credits (functional, new, capped) |
| Activity-based earn | Practice exercises to earn Hearts | Complete habits/dailies to earn Gold + XP | Complete workouts = XP + loot | Log any of 6 fitness activities = +1 AI credit |
| Daily earn cap | 5 Hearts max (functional ceiling) | No cap on Gold earn | No cap | 2 bonus credits/day from activity regardless of number of logs |
| Free base quota | 5 Hearts/session (not daily allocation) | All features free | Unlimited free | 1 vision scan + 1 AI chat/day free; 1 program/month |
| Premium removes gate | Super Duolingo = unlimited Hearts | No equivalent | Not applicable | `user_tier = premium` = no credit check |
| IAP for credits | Gems purchasable via App Store | Gems purchasable | Not applicable | Deferred to v2 |
| Exhaustion state UX | "Out of hearts — practice or wait" (controversial, removed practice option 2024) | Credits never run out | Not applicable | Bottom sheet: balance + earn action list (no practice-to-earn removal risk) |
| Currency exchange | None (Hearts not convertible) | None | None | None (strict separation — anti-pattern avoided) |
| Model cost optimization | Not applicable | Not applicable | Not applicable | Haiku for vision (70% cost reduction); Sonnet for chat |

---

## Existing System Dependencies (Ziko-Specific)

This milestone is additive — no existing behavior is torn out.

| Existing System | v1.4 Integration |
|----------------|----------------|
| `gamification` plugin (`user_xp`, `shop_items`, `user_inventory`) | Coins remain untouched; AI credits do NOT use these tables — strict separation |
| Upstash Redis rate limiting (v1.3) | Rate limiter still applies as first defense; credit gate is a separate Supabase-level check as second defense |
| `POST /ai/chat/stream` + `POST /ai/chat` | Credit middleware wraps these routes — deduct before forwarding to Anthropic; middleware runs after `authMiddleware` for user ID |
| Nutrition vision/photo route | Model config change (Haiku) + credit deduction added; signed URL flow from v1.3 Storage unchanged |
| `ai_programs_generate` tool (`backend/api/src/tools/`) | Monthly counter added alongside daily credit system; counted separately |
| Plugin post-save handlers (habits, nutrition, workout, cardio, stretching, measurements) | Each emits credit-earn event after successful DB insert; idempotency enforced by `ai_credit_log` unique constraint |
| `user_profiles` table | Add `user_tier TEXT DEFAULT 'free'` column; `ai_credits` balance stored in `user_ai_credits` table or as column on `user_profiles` |
| Supabase JWT auth middleware (v1.3) | Credit gate middleware depends on `c.get('auth').userId` being set — same requirement as rate limiter; order: auth → rate limit → credit check |

---

## Sources

- [Duolingo Hearts System — Duolingo Wiki](https://duolingo.fandom.com/wiki/Hearts)
- [Why Duolingo's Energy System Works — Trophy.so](https://trophy.so/blog/why-duolingos-energy-system-works-and-when-to-copy-it)
- [Fitness App Gamification Examples 2025 — Trophy.so](https://www.trophy.so/blog/fitness-gamification-examples)
- [Types of Game Currencies in Mobile Free-to-Play — Game Developer](https://www.gamedeveloper.com/business/types-of-game-currencies-in-mobile-free-to-play)
- [Token-Based Pricing Patterns for AI Apps — Afternoon.co](https://www.afternoon.co/blog/token-based-pricing-guide)
- [How to Build a Sustainable AI Subscription App Pricing Model — RevenueCat](https://www.revenuecat.com/blog/growth/ai-subscription-app-pricing/)
- [Microtransactions: How Freemium Apps Monetize in 2025 — TyrAds](https://tyrads.com/microtransaction/)
- [Mobile Gaming Currencies — Happy Gamer](https://happygamer.com/amp/mobile-gaming-currencies-from-freemium-models-to-pay-to-win-debates-133241/)
- [Gamification in Health and Fitness Apps — Plotline](https://www.plotline.so/blog/gamification-in-health-and-fitness-apps)
- [Dual Currency System Advantages — Quora](https://www.quora.com/What-are-the-advantages-of-using-a-dual-currency-system-in-freemium-mobile-games)
- [Multi-Reward Strategies for Mobile Apps — AppSamurai](https://appsamurai.com/blog/multi-reward-strategies/)
- [OpenRouter Daily Quota UX Failure Analysis — Oreate AI](https://www.oreateai.com/blog/indepth-analysis-of-openrouters-free-policy-adjustments-daily-quota-changes-and-response-strategies/d450d1aa56b67882c0100e68510fac55)
- [Google AI Pro Weekly Quota Lockouts — AI Productivity](https://aiproductivity.ai/news/google-ai-pro-weekly-quota-caps-lockouts/)
- [Gamification in Fitness Apps — Nudge](https://www.nudgenow.com/blogs/gamify-your-fitness-apps)
- [Top Gamified Fitness Apps 2025 — Online Tech Tips](https://www.online-tech-tips.com/best-gamified-fitness-apps/)

---

*Feature research for: Gamified AI credit system & freemium monetization (Ziko Platform v1.4)*
*Researched: 2026-04-05*
