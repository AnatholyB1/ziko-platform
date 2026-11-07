# Phase 45 - Design Critique, revision 2 (after viewing all 6 renders)

Method: opened every PNG before and after; read the real `WeeklyReviewRevealOverlay.tsx` and 44-UI-SPEC; ran `critique` (design review) and `audit` (measurements) on the output. Skills applied: impeccable, shape, high-end-visual-design, design-taste-frontend, frontend-design, layout, typeset, adapt, critique, audit.

## Defects seen in the v1 renders
1. CTA pinned to the bottom of the screen, 400px below the content, leaving a large dead zone in the middle. The real overlay places the CTA inside the centered stack (`gap: 32`). Not "Phase 44 exact".
2. Headline to body gap was 12px; the real overlay uses 32 between every child. Headline line-height 32 vs RN default.
3. Numbers contradicted each other: met/exceeded showed "Palier 1 · 60/150" while the tier-up screens said Palier 3 at 150 points.
4. Redundant text: "10 points ajoutés à ton total." repeated the chip and the `+10 pts`.
5. The reassurance sentence contained "perdu" ("rien n'est perdu"), naming the loss it denies.
6. Reward card nested a second 76px tile inside a card on a screen that already had a glow disc; line "selon ton parcours" claims a personal reason the system cannot show (REWARD-03 is by tier). Eyebrow sat on the glow disc edge.
7. CTA label at 15px: weak against a 56px button and failed contrast as small text (3.09:1).
8. Step 2 had a lonely stepper floating mid-screen and the step pills sat inside the layout flow, shifting the stack.

## Changes made
- Layout rebuilt on the real structure: centered column, `gap 32`, CTA inside the stack, step pills absolutely positioned.
- CTA 19/700 (locked decision), height 56; contrast now passes as large text.
- One coherent data story (60 -> 70 / 75 / 60 of 150, Palier 2; Palier 3 at 150 on tier-up). Card meta row: "Palier 2" left, "70 / 150 points" right.
- Redundant sentences removed; "perdu" removed; reassurance is "Pas de points cette semaine. Ton palier et tes récompenses restent à toi."
- Reward step: badge becomes the ribbon, one card (chip "Choisi pour toi par Ziko", name, type line); body reduced to "Il t'appartient pour toujours."
- `measure.js` gained forbidden-word/dash/emoji scan and CTA font check.

## What works
- Same badge, glow, headline and CTA as Phase 44; the only new object is the points card at radius 16 with one hairline.
- Missed week is visibly calm: neutral chip, muted `0`, no red, bar untouched.
- The reward is one static beat with the framing line, no suspense.

## Remaining (not fixed, by design or by constraint)
- The glow is a flat hard-edged disc (verbatim from 44). It cuts behind the headline on 2-line headlines. Locked by L1.
- The stack shifts vertically between states with different content height (met vs missed focus wrapping). Inherent to `justifyContent: 'center'` and the same as 44.
- 32px between headline and body reads loose; kept for exact Phase 44 parity.
- Tier stepper shows a tier 4 target; if the tier ladder is not final, hide node 4.

## Open questions (max 3)
1. Tier-up without a granted reward: say nothing (current) or "Ta récompense arrive bientôt"? Recommended: nothing; it would promise something a failed grant may not deliver.
2. Show `0 pts` on missed (current, muted) or hide the number? Recommended: show, for transparency.
3. Should the step-1 "Continuer" CTA hint that more follows (e.g. a small tier chip)? Recommended: no, avoids anticipation mechanics.
