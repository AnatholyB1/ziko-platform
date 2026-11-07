# Phase 45 - Design Contract (non-punitive tiered rewards)

Revision 2 (design refinement pass after viewing the renders). Surface: extension of `WeeklyReviewRevealOverlay` (D-08, no dedicated screen). Reqs REWARD-01..05.
Prototypes: `*.html` + `tokens.css` here, PNGs 390x844 DPR2 (see `MOCKUPS.md`). Measurement: `measure.js` (results in `measure-results.json`). Critique: `45-DESIGN-CRITIQUE.md`.

## 0. Locked decisions (user)
- L1: keep the Phase 44 overlay look for every phase 45 step, matched to the real `apps/mobile/src/components/WeeklyReviewRevealOverlay.tsx` (not only 44-UI-SPEC): `#1C1A17` dark exception, glow disc `top -40`, 360x360, `rgba(255,92,26,0.25)`, 76x76 radius-22 badge, `FadeInUp.springify().damping(12)`, content block `paddingHorizontal 24`, `justifyContent: 'center'`, `gap: 32` between EVERY child including the CTA (CTA is part of the centered stack, not pinned to the bottom), headline 28/700, body 15/400 `lineHeight 22`.
- L2: CTA label 19px bold (700), colours unchanged (`#FF5C1A` fill, `#fff` text, radius 16, `paddingVertical 16`). 19px bold counts as large text (>= 18.66px bold), so 3.09:1 meets the 3:1 large-text threshold (WCAG 1.4.3). Waiver W-1 is retired for this overlay.

## 1. Principles
1. Reuse Phase 44 verbatim (L1). Same single headline "Ziko a fait le point sur ta semaine." for ALL step-1 results (44-UI-SPEC: no trajectory-conditional headline).
2. Non-punitive: no red, no minus sign, no downward arrow, no "perdu / échec / raté / pénalité / malus". Missed = neutral chip + muted `0` + one reassurance sentence. The word "perdu" is no longer allowed anywhere (the previous "rien n'est perdu" was removed: it names the loss it denies).
3. Not a loot box: no suspense, shuffle, count-up, rarity colour, coin look, no "chance / tirage / surprise / coffre / hasard". The reward appears in one static beat with the standard entrance.
4. Non-monetary look: reward is a profile title/badge/theme (D-04): name + type line, no number, no currency, no price look.
5. The progress bar never moves backward (D-07).
6. No claim the product cannot prove: the previous "selon ton parcours" line was removed (REWARD-03 says deterministic by tier, not by a personal reason).

## 2. Tokens
All tokens live in `tokens.css` (shared with Phase 46). Overlay deltas over Phase 44:
| Token | Value | Use |
|---|---|---|
| `--dk-card` / `--dk-line` | rgba(255,250,246,.06) / .14 | points card, reward card, bar track, step dots |
| `--ok-ink` / `--ok-bg` | #8BDCAA / rgba(46,158,91,.20) | "Objectif atteint" chip |
| `--up-ink` / `--up-bg` | #FFB594 / rgba(255,92,26,.20) | "Objectif dépassé" chip, "Choisi pour toi par Ziko" chip |
| `--neutral-bg` | rgba(255,250,246,.10) | "Semaine d'ajustement" chip |
Typography (400/700/800 only): headline and reward name 28/700 (line 33), body 15/400 (22), CTA 19/700 (24), labels and chip 14/700 or 14/400, numeral 40/800 (44). Spacing: multiples of 4; the main rhythm is the Phase 44 `gap 32`; card padding 16, intra-card gap 12. Accent `#FF5C1A` is also used for progress fill, active step pill, tier nodes (44 reserved it for badge + CTA; accepted extension, tier nodes use `#1C1A17` numerals, 5.6:1).

## 3. Flow
`WeeklyReviewRevealOverlay` becomes a 1 to 3 step sequence inside the same `<Modal>`:
- Step 1 (always): badge, headline, focus line, points card, CTA. No tier-up: CTA "Voir mon focus" is final. Tier-up: CTA "Continuer".
- Step 2 (tier-up only): badge `medal`, "Palier N atteint", body, tier stepper, CTA "Découvrir ma récompense" if a `reward_grant` exists for this tier-up, else "Voir mon focus" and no mention of a reward (no-reward state, grant failed / pool empty / pending retry, D-06).
- Step 3 (reward only): badge `ribbon`, headline, one reward card, CTA "Voir mon focus".
- Step pills (3) shown only on steps 2 and 3, absolutely positioned at `top: 8` of the safe area so the centered stack is not displaced.
- Android back / gesture dismisses all steps and writes the seen marker (as 44). Grounding: points card rendered only when `points_awarded` is known (else 44 layout unchanged).

## 4. States (screens)
| State | File | Content |
|---|---|---|
| met | `met.html` | chip ok "Objectif atteint", `+10 pts`, bar 70/150, row "Palier 2 ... 70 / 150 points" |
| exceeded | `exceeded.html` | chip up (trending-up) "Objectif dépassé", `+15 pts`, bar 75/150 |
| missed | `missed.html` | chip calm (leaf) "Semaine d'ajustement", `0 pts` muted, bar 60/150 unchanged, "Pas de points cette semaine. Ton palier et tes récompenses restent à toi." |
| tier-up (step 2) | `tier-up.html` | badge `medal`, "Palier 3 atteint", "Tu as cumulé 150 points. Ziko a choisi une récompense pour toi.", 4-node stepper (tier 5 reserved), CTA "Découvrir ma récompense" |
| reward (step 3) | `reward.html` | badge `ribbon`, "Ta récompense, palier 3", "Il t'appartient pour toujours.", card: chip "Choisi pour toi par Ziko" + name "Régulier" 28/700 + "Titre de profil · Palier 3", CTA "Voir mon focus" |
| no-reward | `no-reward.html` | badge `medal`, "Palier 3 atteint", "Tu as cumulé 150 points. Ton palier est à toi pour toujours.", stepper, CTA "Voir mon focus" |
Data coherence (fixed): the displayed numbers are one story. Totals before the week: 60. met 60+10 = 70, exceeded 60+15 = 75, missed 60+0 = 60, all at Palier 2 with the next threshold 150 (Palier 3). The tier-up screens show Palier 3 reached at 150. Previously met showed "Palier 1 · 60/150" while tier-up showed Palier 3 at 150, which contradicted itself.
The redundant sentences "10 points ajoutés à ton total." / "15 points ajoutés : tu as fait mieux que prévu." were removed (the chip and the `+N pts` already say it). The accessible label of the card still states the full sentence.
Variable text: focus summary (<= 2 lines at 15/22), reward name from `ziko_reward_catalog.label_fr` (<= 24 chars, wraps to 2 lines at 28), kind line from catalog type (titre / badge / thème).

## 5. Microcopy (fr; en to add in `packages/plugin-sdk/src/i18n.ts`, namespace `coach.weeklyReview.*`)
Keys: `points.met`, `points.exceeded`, `points.missed`, `points.missedSub`, `tier.label` ("Palier {n}"), `tier.progress` ("{cur} / {max} points"), `tierUp.title`, `tierUp.bodyReward`, `tierUp.bodyNoReward`, `tierUp.cta`, `reward.chip`, `reward.title`, `reward.body`, `cta.continue`. Forbidden words (zero exceptions now): perdu, échec, raté, pénalité, malus, chance, tirage, hasard, gagné au hasard, jackpot, coffre, valeur, euros, boutique. Plural helper for "1 point" / "N points".

## 6. Motion and reduced motion
- Badge: unchanged FadeInUp spring (44). Points card fade 240ms delay 120ms. Progress fill grows from the previous value to the new one, 400ms ease-out, delay 300ms, never from a higher value. Reward card: same FadeInUp as the badge, no stagger, no scale pop, no particles. Total entrance <= 800ms per step; steps cross-fade 150ms.
- Reduced motion (`ReduceMotion.System`): springs and translateY removed, opacity-only 150ms, bar jumps to final value.
- Haptics: none on missed; optional single light impact on tier-up, none on the reward reveal.

## 7. Accessibility
- Order: step indicator, headline, body, points card (one group), CTA. Reward card one group "Récompense : titre Régulier, choisi pour toi par Ziko".
- Modal announces the headline on open (`accessibilityViewIsModal`). Progress bar `accessibilityValue {min:0,max:150,now}`.
- No information by colour alone: chips carry text + icon.
- 200% text scaling: the centered stack is wrapped in a `ScrollView` (`contentContainerStyle: {flexGrow:1, justifyContent:'center', gap:32}`); the CTA scrolls with the content because it is part of the stack (L1).
- Contrast: CTA 19/700 white on `#FF5C1A` = 3.09:1, passes as large text (3:1). Everything else >= 4.5:1.

## 8. Measurable acceptance checks (`node measure.js <dir>`; NODE_PATH must resolve `playwright-core`)
| ID | Check | Threshold | Result (rev 2) |
|---|---|---|---|
| A-01 | No horizontal overflow at 390 wide | scrollWidth <= 390 | pass, 6/6 |
| A-02 | Every text node >= 14px | min font-size 14 | pass, 6/6 (0 small) |
| A-03 | CTA tap area >= 44x44 | h>=44, w>=44 | pass (56 high, full width) |
| A-04 | Text contrast (composited), 4.5 body / 3 large | no failure | pass, 0 failures (CTA large) |
| A-05 | Non-text contrast, progress fill vs track | >= 3:1 | 3.09 pass |
| A-06 | No forbidden word, minus/dash/down glyph, emoji in any state text | `forbidden=[]` | pass, 6/6 |
| A-07 | Reward screen contains "Choisi pour toi par Ziko", no random/monetary word | present; A-06 | pass |
| A-08 | Bar fill on missed equals previous total | now == previous (60) | pass |
| A-09 | Reduced motion: no translate/scale, duration <= 150ms | RN test with mocked reduce motion | to verify in build |
| A-10 | Headline identical in met/exceeded/missed | string equal | pass |
| A-11 | Ionicons only, Phase 44 tokens only | grep | pass |
| A-12 | No points card when `points_awarded` unknown | RNTL | to verify in build |
| A-13 | Step 3 only when a reward row exists for this decision | RNTL | to verify in build |
| A-14 | CTA label font size | == 19, weight 700 | pass (`ctaFont=19`) |
| A-15 | Phase 44 parity: glow, badge, gap 32, CTA inside the centered stack | RNTL snapshot of step 1 without points == current component | to verify in build |
| A-16 | Numbers coherent: tier label and bar value consistent across states | 70 / 75 / 60 of 150 at Palier 2; Palier 3 only on tier-up | pass (manual) |

## 9. Requirement -> screen -> check
| Req | Screen(s) | Checks |
|---|---|---|
| REWARD-01 (points by result; missed = no reward, never penalty) | met, exceeded, missed | A-06, A-08, A-10, A-16 |
| REWARD-02 (points unlock tiers) | met/exceeded (bar + "Palier N"), tier-up | A-05, A-13, A-16 |
| REWARD-03 (exactly one reward, deterministic, not random) | reward ("Choisi pour toi par Ziko", one card, no personal-reason claim) | A-07, A-13 |
| REWARD-04 (monotonic) | missed (bar unchanged), no-reward ("à toi pour toujours") | A-06, A-08 |
| REWARD-05 (separate from coins/shop) | reward (no coin/price/shop visuals; type line) | A-07, A-11 |
