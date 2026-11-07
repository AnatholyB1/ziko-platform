# Phase 45 - Design Contract (non-punitive tiered rewards)

Surface: extension of `WeeklyReviewRevealOverlay` (D-08, no dedicated screen). Reqs REWARD-01..05.
Prototypes: `*.html` + `tokens.css` in this folder, PNGs at 390x844 DPR2 (see `MOCKUPS.md`).
Measurement script: `measure.js` (results in `measure-results.json`).

## 1. Principles
1. Reuse Phase 44 verbatim: dark reveal exception (`#1C1A17`), glow, 76x76 radius-22 sparkles badge, `FadeInUp.springify().damping(12)`, CTA 16px radius, same single headline "Ziko a fait le point sur ta semaine." for ALL results (44-UI-SPEC: no trajectory-conditional headline).
2. Non-punitive: no red, no minus sign, no downward arrow, no "perdu/échec/raté/manqué", no streak-loss wording. Missed = neutral chip + `0` in muted color + reassurance that tier and rewards are kept (D-07).
3. Not a loot box: no suspense animation, no shuffle/spin/slot count-up, no rarity colors, no gold/coin/price look, no "chance/tirage/surprise/coffre/gagné au hasard". The reward is stated as chosen by Ziko, and shown instantly with the standard entrance.
4. Non-monetary look: reward is a profile title/badge/theme (D-04) shown as an icon tile + name + type line; no numeric value, no currency, no "valeur".
5. The progress bar never moves backward (monotonic, D-07).

## 2. Tokens
All tokens live in `tokens.css` (shared with Phase 46). Overlay tokens are the Phase 44 set plus these deltas:
| Token | Value | Use |
|---|---|---|
| `--dk-card` / `--dk-line` | rgba(255,250,246,.06) / .14 | points card, reward card, bar track, dots |
| `--ok-ink` / `--ok-bg` | #8BDCAA / rgba(46,158,91,.20) | "Objectif atteint" chip |
| `--up-ink` / `--up-bg` | #FFB594 / rgba(255,92,26,.20) | "Objectif dépassé" chip, reward tile, eyebrow |
| `--neutral-bg` | rgba(255,250,246,.10) | "Semaine d'ajustement" chip |
Typography (delta to 44 scale, still 400/700/800 only): Display 28/32 700 (headline, reward name), Body 15/22 400, CTA 15/20 700, Label 14/18-20 700 (raised from 13 to meet the 14px floor), Numeral 40/44 800 (points). Spacing: multiples of 4 (24 side padding, 32 block gap, 16 card padding/radius, 12 intra-card gap). Accent `#FF5C1A` is used only for badge, CTA, progress fill, active step pill, tier nodes (44 reserved it for badge+CTA; extension flagged in the critique).

## 3. Flow
`WeeklyReviewRevealOverlay` becomes a 1 to 3 step sequence inside the same `<Modal>`:
- Step 1 (always): review + points card. If no tier-up: CTA "Voir mon focus" = final.
- If tier-up: step 1 CTA is "Continuer"; step 2 = tier-up; step 3 = reward reveal (only if a `reward_grant` exists for this tier-up). Step indicator (3 pills) appears only when tier-up.
- Grant failed / pool empty / grant still pending (D-06 retry): step 2 shows tier-up without any mention of a reward ("no-reward" state), CTA = "Voir mon focus". The reward surfaces on a later overlay open once granted (never promised in copy).
- Dismissal: Android back/gesture dismisses all steps and writes the seen marker (as 44). Data grounding rule from 44 still applies; additionally points block is rendered only when `points_awarded` is known for the review (else hide the card, show 44 layout unchanged).

## 4. States (screens)
| State | File | Content |
|---|---|---|
| met | `met.html` | chip ok "Objectif atteint", `+10 pts`, bar 60/150, "10 points ajoutés à ton total." |
| exceeded | `exceeded.html` | chip up (trending-up) "Objectif dépassé", `+15 pts`, "15 points ajoutés : tu as fait mieux que prévu." |
| missed | `missed.html` | chip calm (leaf) "Semaine d'ajustement", `0 pts` muted, bar unchanged, "Pas de points cette semaine, et rien n'est perdu : ton palier et tes récompenses restent à toi." |
| tier-up + reward (step 2) | `tier-up.html` | badge `medal`, "Palier 3 atteint", "Tu as cumulé 150 points. Ziko a choisi une récompense pour toi.", 4-node stepper (tier 5 hidden/reserved), CTA "Découvrir ma récompense" |
| tier-up + reward (step 3) | `reward.html` | eyebrow "Choisi pour toi par Ziko", "Ta récompense, palier 3", card: tile (ribbon icon) + name + "Titre de profil · Palier 3" + "Ziko l'a choisi pour toi selon ton parcours. Il t'appartient pour toujours.", CTA "Voir mon focus" |
| no-reward | `no-reward.html` | tier-up only: "Tu as cumulé 150 points. Ton palier est à toi pour toujours." CTA "Voir mon focus" |
Note: the step-1 variant that precedes tier-up is `met`/`exceeded` with CTA "Continuer" (only the label differs; bar fills to the threshold).
Variable text: focus summary (<= 2 lines at 15px, wraps), reward name from `ziko_reward_catalog.label_fr` (<= 24 chars; wraps to 2 lines at 28px, card grows), kind line from a catalog type (titre / badge / thème). Tier labels are numeric ("Palier N") so no catalog name is needed.

## 5. Microcopy (fr; en equivalents to be added to `packages/plugin-sdk/src/i18n.ts`, namespace `coach.weeklyReview.*`)
Keys proposed: `points.met`, `points.exceeded`, `points.missed`, `points.metSub`, `points.exceededSub`, `points.missedSub`, `tier.label` ("Palier {n}"), `tier.progress` ("{cur} / {max} points"), `tierUp.title`, `tierUp.bodyReward`, `tierUp.bodyNoReward`, `tierUp.cta`, `reward.eyebrow`, `reward.title`, `reward.body`, `cta.continue` ("Continuer"). Forbidden words (lint in review): perdu (except the reassurance sentence "rien n'est perdu"), échec, raté, pénalité, malus, chance, tirage, hasard, gagné au hasard, jackpot, coffre, valeur, euros, boutique.
Plural: "1 point" / "N points" (use a plural helper; chip values come from config constants, not hard-coded).

## 6. Motion and reduced motion
- Badge: unchanged FadeInUp spring (44). Points card: fade 240ms, delay 120ms. Progress fill: width animates from previous to new value 400ms ease-out, delay 300ms (never from a higher value). Reward card: same FadeInUp as badge; no staggered reveal, no scale pop, no particle/confetti.
- Total entrance <= 800ms per step; steps cross-fade 150ms.
- Reduced motion (`AccessibilityInfo.isReduceMotionEnabled` / reanimated `ReduceMotion.System`): all springs and translateY removed, opacity-only 150ms, bar jumps to final value.
- Haptics: none on missed; optional single light impact on tier-up (not on reward reveal, to avoid a gambling cue).

## 7. Accessibility
- VoiceOver/TalkBack order: step indicator, headline, body, points card (single group, label in the prototypes' `aria-label`), CTA. Reward card is one group "Récompense : titre Régulier, choisi pour toi par Ziko".
- Modal announces headline on open (`accessibilityViewIsModal`, focus to headline). Progress bar exposes `accessibilityValue {min:0,max:150,now:60}`.
- No information by color alone: chips carry text + icon; missed state is distinguishable by text, not hue.
- Text scaling to 200%: card and stack must scroll (wrap stack in `ScrollView` with `contentContainerStyle` flexGrow, CTA pinned below). Min body 14px.
- Contrast waiver W-1: CTA label white on `#FF5C1A` measures 3.09:1 (inherited from Phase 44 and `CustomAlert`; fails 4.5:1 for 15/700). Not changed here (mockup-first); recommended fix is open question Q2.

## 8. Measurable acceptance checks (run `node measure.js <dir>`; plus manual)
| ID | Check | Threshold | Result (prototype) |
|---|---|---|---|
| A-01 | No horizontal overflow at 390 wide | scrollWidth <= 390 | pass, 6/6 |
| A-02 | Every text >= 14px | min font-size 14 | pass (min 14) |
| A-03 | Interactive element (CTA) >= 44x44 | h>=44, w>=44 | pass (52 high, full width) |
| A-04 | Text contrast (composited over card/bg) | >= 4.5 body, >= 3 large | pass except CTA label 3.09 (W-1) |
| A-05 | Non-text contrast, progress fill vs track | >= 3:1 | 3.09 pass |
| A-06 | Missed screen contains none of: red hex, "-", minus/down icons, forbidden words | grep = 0 | pass |
| A-07 | Reward screen contains "Choisi pour toi par Ziko" and none of the random/monetary words | string present; forbidden grep = 0 | pass |
| A-08 | Bar fill on missed equals previous total (no decrease) | now == previous | pass (60 -> 60) |
| A-09 | Reduced motion: no translate/scale animation, duration <= 150ms | code review + RN test with mocked reduce motion | to verify in build |
| A-10 | Headline identical in met/exceeded/missed | string equal | pass |
| A-11 | Only `#1C1A17`-family dark tokens + tokens above used; Ionicons only, no emoji | grep emoji = 0 | pass |
| A-12 | Overlay renders no points card when `points_awarded` unknown | RNTL test | to verify in build |
| A-13 | Step 3 shown only when reward row exists for this decision | RNTL test | to verify in build |

## 9. Requirement -> screen -> check
| Req | Screen(s) | Checks |
|---|---|---|
| REWARD-01 (points by result; missed = no reward, never penalty) | met, exceeded, missed | A-06, A-08, A-10 |
| REWARD-02 (points unlock tiers) | met/exceeded (bar + "Palier N"), tier-up | A-05, A-13 |
| REWARD-03 (exactly one reward, deterministic, not random) | reward ("Choisi pour toi par Ziko", one card) | A-07, A-13 |
| REWARD-04 (monotonic) | missed (kept copy, bar unchanged), no-reward ("à toi pour toujours") | A-06, A-08 |
| REWARD-05 (separate from coins/shop) | reward (no coin/price/shop visuals; distinct title/badge type line) | A-07, A-11 |
