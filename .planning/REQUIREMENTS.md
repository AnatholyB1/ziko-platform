# Requirements: Ziko Platform

**Defined:** 2026-04-05
**Core Value:** A fitness user has a single app that coaches them, tracks everything, tells them what to cook based on what's in their kitchen — and controls AI costs through gamified engagement.

## v1.4 Requirements

Requirements for AI Credit System & Monetization milestone. Each maps to roadmap phases.

### Credit System

- [ ] **CRED-01**: User can see their AI credit balance in the app at all times
- [ ] **CRED-02**: User receives a daily base allocation (1 photo scan + 1 AI chat) without any activity
- [ ] **CRED-03**: User receives 1 free AI program generation per month without any activity
- [ ] **CRED-04**: User sees the credit cost displayed next to each AI action button before using it
- [ ] **CRED-05**: User sees an exhaustion bottom sheet when credits reach 0, explaining why and how to earn more
- [ ] **CRED-06**: User's credits are deducted atomically via PostgreSQL RPC (no negative balance possible)
- [ ] **CRED-07**: User has a separate AI credits balance from shop coins (dual balance)

### Activity Earn

- [ ] **EARN-01**: User earns AI credits by logging a workout
- [ ] **EARN-02**: User earns AI credits by completing daily habits
- [ ] **EARN-03**: User earns AI credits by logging meals
- [ ] **EARN-04**: User earns AI credits by logging body measurements
- [ ] **EARN-05**: User earns AI credits by completing a stretching session
- [ ] **EARN-06**: User earns AI credits by completing a cardio/running session
- [ ] **EARN-07**: User's daily earned credits are capped (bonus max not exceeded)
- [ ] **EARN-08**: User sees a "+1 AI credit" toast after earning credits from an activity
- [ ] **EARN-09**: User sees daily earn progress ("2 credits available — log a stretch to earn")
- [ ] **EARN-10**: Earned credits are idempotent (mobile retry does not double-credit)

### Vision & Cost

- [ ] **COST-01**: Photo scan uses Claude Haiku 4.5 instead of Sonnet (~70% cost reduction)
- [ ] **COST-02**: Each AI API call's token usage is logged to Supabase for cost tracking
- [ ] **COST-03**: Monthly cost per active freemium user stays under €0.75

### Premium Prep

- [ ] **PREM-01**: User profile has a tier column (free/premium) — premium users bypass credit gate
- [ ] **PREM-02**: Credit gate middleware checks tier before deducting credits

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### In-App Purchases

- **IAP-01**: User can purchase premium subscription via in-app purchase (RevenueCat)
- **IAP-02**: Premium tier removes all credit limits
- **IAP-03**: Premium pricing compensates freemium usage costs

### Engagement Bonuses

- **STREAK-01**: User earns bonus credits from activity streaks
- **HIST-01**: User can view credit usage history screen

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-app purchases (IAP) | RevenueCat integration, 30% platform cut, RGPD compliance — future milestone |
| Credit rollover | Breaks cost projection — accumulated balances cause unpredictable API spikes |
| Referral/gift credits | Abuse vector complexity exceeds v1.4 scope |
| Credit usage history screen | Add when support tickets about balance appear |
| Streak multiplier | Requires dedicated streak table, timezone logic — defer |
| Dark mode credit UI | Light sport theme only — project constraint |
| Coins-to-credits conversion | Arbitrage anti-pattern destroys gamification economy |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRED-01 | Phase 21 | Pending |
| CRED-02 | Phase 18 | Pending |
| CRED-03 | Phase 18 | Pending |
| CRED-04 | Phase 21 | Pending |
| CRED-05 | Phase 21 | Pending |
| CRED-06 | Phase 17 | Pending |
| CRED-07 | Phase 17 | Pending |
| EARN-01 | Phase 20 | Pending |
| EARN-02 | Phase 20 | Pending |
| EARN-03 | Phase 20 | Pending |
| EARN-04 | Phase 20 | Pending |
| EARN-05 | Phase 20 | Pending |
| EARN-06 | Phase 20 | Pending |
| EARN-07 | Phase 18 | Pending |
| EARN-08 | Phase 21 | Pending |
| EARN-09 | Phase 21 | Pending |
| EARN-10 | Phase 18 | Pending |
| COST-01 | Phase 17 | Pending |
| COST-02 | Phase 19 | Pending |
| COST-03 | Phase 19 | Pending |
| PREM-01 | Phase 17 | Pending |
| PREM-02 | Phase 18 | Pending |

**Coverage:**
- v1.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 — traceability mapped to Phases 17–21*
