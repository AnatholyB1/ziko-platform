// Phase 24 (v1.20) - prompt de la relance automatique (instructions en anglais ; sortie dans la langue
// de l'utilisateur, francais par defaut). Ajoute au prompt de l'atelier un bloc RESULTATS + la regle non punitive.
import type { DraftProgram } from '../workshop/draft.js';
import { buildWorkshopSystemPrompt } from '../workshop/prompt.js';
import type { WorkshopContext } from '../workshop/context.js';

export const NON_PUNITIVE_RULES = `## Rules for the next phase (non-punitive)
- Never frame the previous program as a failure or the athlete as behind. Missed sessions are information, not a fault: use them only to size the next phase (volume, frequency).
- Choose the direction from the results: progress = build on the gains (new stimulus, higher loads from the new estimated 1RM); consolidate = repeat a similar level with small progressions; reentry = easier, lower-volume return with fewer sessions per week.
- Compute loads from the CURRENT estimated 1RM in the results/context, not from the old program.
- Do not touch credits, rewards, streaks or goals. Do not ask the athlete to justify anything.`;

export function buildRelaunchSystemPrompt(
  ctx: WorkshopContext,
  resultsBlock: string,
  sequenceNames: string[],
  currentDraft: DraftProgram | null,
): string {
  const chain = sequenceNames.length ? sequenceNames.map((n, i) => `${i + 1}. ${n}`).join('\n') : '(this is the first program of the sequence)';
  return [
    buildWorkshopSystemPrompt(ctx, currentDraft),
    `## AUTOMATIC RELAUNCH
The athlete just finished a program and the Workshop relaunched itself with the results below. Without asking questions first, build the NEXT program of the ordered sequence with workshop_set_draft (complete program, all weeks), then summarise in 3-5 short sentences: what the results showed (neutral tone), what the next phase does and why. Web search is not available in this automatic turn.`,
    `## PREVIOUS PROGRAM RESULTS\n${resultsBlock}`,
    `## SEQUENCE SO FAR (oldest first)\n${chain}`,
    NON_PUNITIVE_RULES,
  ].join('\n\n');
}

export const RELAUNCH_USER_MESSAGE = 'Mon programme est terminé. Prépare la suite à partir de mes résultats.';
