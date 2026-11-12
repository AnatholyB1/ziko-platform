// Phase 23 (v1.20) - ATEL-03 / D-06 : bibliotheque de skills d'entrainement (statique, versionnee).
// Le modele charge un skill par `workshop_load_skill(id)` ; `workshop_list_skills` donne seulement
// id + resume (pas de corps) pour garder le prompt court.

export interface TrainingSkill {
  id: string;
  title: string;
  summary: string;
  body: string;
}

export const TRAINING_SKILLS: TrainingSkill[] = [
  {
    id: 'powerlifting-peaking',
    title: 'Powerlifting : pic de force avant compétition',
    summary: 'Cycle 6-8 semaines vers un max sur squat/bench/deadlift, intensité en % du 1RM, volume en baisse.',
    body: `Goal: peak squat/bench/deadlift for a meet (6-8 weeks out).
Structure: 3-4 sessions/week (squat-focus, bench-focus, deadlift-focus, optional bench/accessory).
Progression (competition lifts, % of current e1RM): W1 75-80% 4x4 | W2 80-85% 4x3 | W3 85-88% 3x3 | W4 88-92% 3x2 | W5 92-95% 2x2 then singles | W6 opener rehearsal 3x1 @ 90-95% | last week: deload, openers only @ 85-90%, RPE <= 7.
Rules: top single RPE 8-9 max until meet week; volume drops 20-30% per block, intensity rises; rest 3-5 min on main lifts; accessories 3x8-12 (RPE 7) cut in half in the last 2 weeks.
Always express main lifts with pct_1rm AND rpe; compute loads from the athlete's e1RM in context, never invent a 1RM. Ask for the competition date and current/target openers if missing.`,
  },
  {
    id: 'powerlifting-volume-block',
    title: 'Powerlifting : bloc de volume / capacité de travail',
    summary: 'Bloc 4-6 semaines de volume modéré en % du 1RM pour construire la capacité de travail avant l\'intensité.',
    body: `Goal: build work capacity and tonnage before an intensity/peaking block.
Structure: 4 sessions/week (upper/lower or SBD + accessories). Main lifts 4-6 sets of 5-8 @ 65-78% e1RM, RPE 6-8; variations (pause squat, tempo bench, deficit deadlift) 3-4 sets of 6-10.
Progression: add 1 set or +2.5% per week for 3 weeks, week 4 deload (-30% volume). Accessories hit weak points (upper back, hamstrings, triceps) 3x10-15.
Rest 2-3 min main, 90 s accessories.`,
  },
  {
    id: 'hypertrophy-ppl',
    title: 'Hypertrophie : Push / Pull / Legs',
    summary: 'Split PPL 5-6 jours, 10-20 séries par groupe par semaine, double progression.',
    body: `Goal: muscle gain. Split: Push/Pull/Legs x2 (6 days) or PPL + Upper/Lower (5 days).
Volume: 10-20 hard sets per muscle per week, 6-12 reps (compounds 6-10, isolation 10-15), RIR 1-3 (RPE 7-9), last set to RIR 0-1 on isolation.
Progression: double progression (hit top of rep range on all sets, then add load). Deload every 5th-6th week (-40% sets).
Rest 2-3 min compounds, 60-90 s isolation. Order: heaviest compound first.`,
  },
  {
    id: 'strength-531-5x5',
    title: 'Force : 5x5 et 5/3/1',
    summary: 'Programmes de force linéaires ou ondulés pour intermédiaires, 3-4 jours.',
    body: `Option A (5x5, novice/early intermediate, 3 days/week): A/B alternating. A: squat 5x5, bench 5x5, row 5x5. B: squat 5x5, overhead press 5x5, deadlift 1x5. Add 2.5 kg/session upper, 5 kg lower; on stall, reduce 10% then rebuild.
Option B (5/3/1, 4 days/week): per lift cycle on a training max (90% of 1RM): W1 65/75/85% x5/5/5+, W2 70/80/90% x3/3/3+, W3 75/85/95% x5/3/1+, W4 deload 40/50/60% x5. Add 2.5 kg (upper) / 5 kg (lower) per cycle. Supplemental 5x10 @ 50-60% (BBB) and 2 accessories.
Rest 3 min on top sets.`,
  },
  {
    id: 'beginner-full-body',
    title: 'Débutant : full body 3 jours',
    summary: 'Programme simple pour reprendre : 3 séances full body, progression linéaire, technique d\'abord.',
    body: `Goal: first 8-12 weeks. 3 non-consecutive days (Mon/Wed/Fri). Each session: 1 squat/lunge pattern, 1 push, 1 pull, 1 hinge, 1 core. 2-3 sets of 8-12 reps, RIR 2-3, rest 90-120 s.
Progression: add the smallest load when all sets hit the top of the range. Keep sessions < 60 min. Ask about equipment and injuries first. Avoid failure and complex lifts at first.`,
  },
  {
    id: 'deload-return-injury',
    title: 'Reprise / deload / retour de blessure',
    summary: 'Semaine de décharge et reprise progressive après pause ou gêne, sans prétendre soigner.',
    body: `Deload: keep exercises, cut sets by 40-50% and load by 10-15%, RPE <= 6, 1 week.
Return after >2 weeks off: restart at 60-70% of previous loads, 2 sets per exercise week 1, add 1 set / +5% per week back to baseline over 3-4 weeks.
Injury: you are not a clinician. Replace the painful pattern with a pain-free variation and recommend a health professional for pain that persists or worsens. Never program through sharp pain.`,
  },
  {
    id: 'hybrid-strength-cardio',
    title: 'Hybride force + cardio',
    summary: 'Concilier 3 séances de force et 2-3 séances d\'endurance sans interférence excessive.',
    body: `Goal: keep strength while building aerobic base. Week: 3 strength sessions (full/upper-lower, 3-4 main sets), 2 easy zone-2 sessions (30-50 min), 1 optional interval session (never the day before heavy legs).
Separate hard legs and hard intervals by >= 24 h. Keep lifting volume moderate (RPE 7-8). Put cardio after lifting when in the same session.`,
  },
  {
    id: 'calisthenics-progressions',
    title: 'Calisthenics : progressions au poids du corps',
    summary: 'Pompes, tractions, dips, jambes : progressions par paliers et rep ranges.',
    body: `Goal: strength/skill with bodyweight. 3-4 days: push (push-up -> archer/ring -> pseudo-planche), pull (row -> pull-up -> weighted/L-sit), legs (squat -> split squat -> pistol/Nordic), core (hollow, plank -> dragon flag).
Progress by leverage first, then reps (3x5 -> 3x8), then weight/tempo. Use rep ranges 5-12, rest 2 min on hard variations, tempo field for eccentrics (e.g. 3-1-1).`,
  },
];

export function listSkills(): Array<Pick<TrainingSkill, 'id' | 'title' | 'summary'>> {
  return TRAINING_SKILLS.map(({ id, title, summary }) => ({ id, title, summary }));
}

export function getSkill(id: string): TrainingSkill | undefined {
  return TRAINING_SKILLS.find((s) => s.id === id);
}
