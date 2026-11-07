# Phase 45 - UI review + goal-backward verdict (REWARD-05 and overlay UI)

Branch audited: `milestone/v1.18` (tip "feat(46): overlay publishes visibility so unlock toast queues behind it"). Read-only audit of source.
Scope: `WeeklyReviewRevealOverlay.tsx`, `WeeklyReviewRevealView.tsx`, `weeklyRewardViewModel.ts`, `coach.weeklyReview.*` i18n.

## Verdict
REWARD-05 (reward is separate from coins/shop): PASS. The reward card shows only a catalog label, a "Titre/Badge/Theme de profil" type line and the tier. It has no number, currency, price or shop affordance, no rarity colour, no suspense. Nothing in the overlay imports coin/shop code.
Overlay UI contract (45-DESIGN-CONTRACT): PASS with one medium (a11y step announcement) and lows.

## Evidence
- Gate: `tsc --noEmit` clean for apps/mobile, packages/ui, packages/plugin-sdk (workspace links pointed at the worktree); root `vitest run` 15 files / 234 tests green.
- Visual: `WeeklyReviewRevealView` rendered through a react-native-web harness (port 3148, 390x844 DPR2, fixtures met/exceeded/missed/tier-up/reward/no-reward). The tier-up, reward and missed renders were compared with the contract PNGs and match: badge 76 radius 22, glow disc, gap 32, pills at top 8, 4-node stepper, reward card geometry, chip/numeral/bar layout. The only difference is the focus-summary fixture text.
- Contract checks: A-01/A-02/A-03 (56 px CTA, all text >= 14), A-10, A-14 (CTA 19/700) hold by code and render. A-06/A-07 hold: forbidden-word grep (perdu, echec, rate, penalite, malus, chance, tirage, hasard, jackpot, coffre, surprise, gagn-, boutique, euro, loot, lucky, fail, lost, random, chest) over all new fr/en strings finds only the `missed` key names, never copy. A-08/A-16 hold in `buildPointsView` (`barFrom <= barTo`, `previousTotal = total - earned`). A-12/A-13 are enforced by `buildPointsView` (state total must equal outcome total) and `pickReward` (tier_up, tier equal, granted_at >= decision.created_at), both unit tested. A-09 is covered by `getMotionSpec` tests. A-15 (RNTL snapshot parity) is not implemented: there are no component tests in the repo, only pure-function tests.
- CLAUDE.md rules: no `StyleSheet.create`, no emoji, Ionicons only, no `Alert.alert`. The dark surface is the Phase 44 documented exception, not a new dark mode.
- Non-punitive/non-gambling copy: clean in fr and en ("Semaine d'ajustement", "Ton palier et tes recompenses restent a toi", "Choisi pour toi par Ziko", "Il t'appartient pour toujours").
- i18n parity: 47 fr keys and 47 en keys across `coach.weeklyReview.*` and `plugins.locked/unlocked.*`, placeholders identical.
- Data reads: `ziko_athlete_state` (own row), `ziko_athlete_decisions` (latest weekly_focus, user scoped), `ziko_athlete_rewards` joined to `ziko_reward_catalog`. Rewards are SELECT-only with an own-row policy; the catalog has an active-rows SELECT policy for authenticated users. No n+1. The decision and reward reads are wrapped in try/catch and fall back to the Phase 44 layout; only the state read throws, as in 44. Decision and `last_review_at` are written in the same RPC (`ziko_record_athlete_decision`), so the decision cannot belong to an older review. The reward grant happens after the decision, so `granted_at >= created_at` is sound. The `limit(4)` on the rewards read is enough because rewards are unique per tier.

## Findings
| Sev | Where | Problem | Fix |
|---|---|---|---|
| MEDIUM | WeeklyReviewRevealView.tsx:102-110 (contract section 7) | No `announceForAccessibility` or focus move on open or on step change. The headline Text is reused in place, so a screen-reader user who presses the CTA gets no announcement of "Palier N atteint" or the reward. | Call `AccessibilityInfo.announceForAccessibility(headline)` in an effect keyed on `step`, or move focus to the headline with `setAccessibilityFocus`. |
| LOW | WeeklyReviewRevealView.tsx:102 (contract section 6) | The 150 ms step cross-fade is missing: steps swap instantly. | Add a keyed `FadeIn` wrapper, or amend the contract. |
| LOW | WeeklyReviewRevealOverlay.tsx:34-62 | The state, decision and reward reads are sequential (waterfall) and run on every launch, even when the seen marker already matches. | Run state and decision with `Promise.all`; skip them once `last_review_at === marker`. |
| LOW | WeeklyReviewRevealOverlay.tsx:88-124 | `step` and `dismissed` are never reset, so a second review in the same session is never shown. Same as Phase 44. | Reset `step` and `dismissed` when `last_review_at` changes. |
| LOW | tests | A-15 and the reveal-step CTA/step flow are unverified at component level (no RNTL harness). | Add an RNTL test, or record the manual render evidence above as the verification. |

Counts: critical 0, high 0, medium 1, low 4.
