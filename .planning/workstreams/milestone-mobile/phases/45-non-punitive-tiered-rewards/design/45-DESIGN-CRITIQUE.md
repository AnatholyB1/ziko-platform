# Phase 45 - Design Critique (self critique + audit of the prototypes)

## What works
- The overlay stays recognisably Phase 44: same badge, glow, CTA, headline. The points card is the only new object and follows the card radius (16) and one-hairline style.
- Missed week reads calm: neutral chip, muted `0`, reassurance sentence, bar untouched. No red anywhere.
- The reward appears in one static beat with an explicit "Choisi pour toi par Ziko" line, which carries the regulatory framing (REWARD-03) without suspense.

## Findings (audit)
| # | Severity | Finding | Action taken / proposed |
|---|---|---|---|
| F1 | High | CTA white on `#FF5C1A` = 3.09:1, fails 4.5:1 for 15/700 text. Inherited from 44 and CustomAlert, so a repo-wide issue. | Kept verbatim (mockup-first); Q2. |
| F2 | Medium | 44's reveal is a dark surface while CLAUDE.md says "no dark mode". It is a documented bounded exception; extending it adds 2 steps of dark UI. | Kept; Q1. |
| F3 | Medium | Accent orange now also on progress fill, step pill, tier nodes (44 reserved it for badge and CTA). Needed for hierarchy, tier nodes use dark numerals to pass contrast. | Accepted; note in contract. |
| F4 | Low | Reward card reason line is generic ("selon ton parcours"). A specific reason would need a catalog/AI field that D-04/D-05 do not define, and an unverifiable claim is risky. | Generic copy kept. |
| F5 | Low | Glow is a flat translucent disc (verbatim from 44), looks heavy behind the headline wrap. | Unchanged to stay pixel-faithful. |
| F6 | Low | Step 1 does not preview that a reward is coming; the "Continuer" CTA is the only hint. Deliberate to avoid anticipation mechanics. | Accepted. |

Checked and clean: overflow, min text 14px, tap target 52px, forbidden-word grep, Ionicons only, bar monotonic.

## Open questions (max 5)
1. Keep the Phase 44 dark exception for the new steps? Recommended: yes (consistency, bounded one-time moment). Alternative: light variant of all steps.
2. Fix CTA contrast now? Recommended: keep the colors but raise CTA label to 19/700 (passes 3:1 large-text rule) in a shared `ZikoRevealCta`, as a separate follow-up touching 43/44/CustomAlert. Alternative: leave as inherited waiver W-1.
3. Show a specific reason on the reward card (e.g. "pour tes 4 semaines régulières")? Recommended: no, generic line only. Alternative: add a catalog `reason_fr` field, needs a schema change and counsel review.
4. Tier-up without reward (grant failed): recommended to say nothing about a pending reward. Alternative: "Ta récompense arrive bientôt" (friendlier, but promises something that may be delayed).
5. Should the missed state show `0 pts` at all? Recommended: yes, muted, for transparency. Alternative: hide the number and show only the reassurance sentence.
