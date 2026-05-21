import { useMemo } from 'react';
import { appStorage } from '../lib/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tip {
  key: string;
  tag: string;
  text: string;
}

export interface HomeDataForTips {
  sleepDurationH: number;
  hydrationMl: number;
  hydrationGoalMl: number;
  unmetHabitName?: string;
}

// ---------------------------------------------------------------------------
// Pure computation — no side-effects, no async
// ---------------------------------------------------------------------------

export function computeTips(data: HomeDataForTips): Tip[] {
  const tips: Tip[] = [];

  // 1. Sleep quality tip
  const sleepPct = data.sleepDurationH / 8;
  if (sleepPct >= 0.7) {
    const h = Math.floor(data.sleepDurationH);
    const m = Math.round((data.sleepDurationH - h) * 60);
    const label = m > 0 ? `${h}h${m}` : `${h}h`;
    tips.push({
      key: 'sleep_good',
      tag: 'Pré-séance',
      text: `Tu as bien dormi (${label}). Bon créneau pour pousser — vise +2.5 kg sur ta dernière série.`,
    });
  }

  // 2. Hydration deficit tip
  if (data.hydrationGoalMl > 0 && data.hydrationMl < data.hydrationGoalMl * 0.5) {
    const deficit = Math.round(data.hydrationGoalMl - data.hydrationMl);
    tips.push({
      key: 'hydration',
      tag: 'Hydratation',
      text: `Il manque ${deficit}ml pour atteindre ta cible aujourd'hui. Bois un verre avant ta séance.`,
    });
  }

  // 3. Unmet habit tip (only after midday)
  if (data.unmetHabitName && new Date().getHours() >= 12) {
    tips.push({
      key: 'habit',
      tag: 'Habitude',
      text: `Tu n'as pas encore loggué ${data.unmetHabitName} aujourd'hui. 2 minutes suffisent.`,
    });
  }

  // 4. Default motivational tip (always present)
  tips.push({
    key: 'default',
    tag: 'Coach Ziko',
    text: "Consistance > intensité. Montre-toi aujourd'hui, même 30 minutes, ça compte.",
  });

  return tips;
}

// ---------------------------------------------------------------------------
// Dismiss helpers — async, called imperatively from the component
// ---------------------------------------------------------------------------

const DISMISS_PREFIX = 'coach_tip_dismissed_';

/**
 * Returns true if the tip was dismissed within the given hours window.
 * hoursWindow = 24 for both "Plus tard" and "J'applique" (per HOME-03).
 */
export async function isDismissed(tipKey: string, hoursWindow: number): Promise<boolean> {
  const ts = await appStorage.getNumber(`${DISMISS_PREFIX}${tipKey}`);
  if (ts === undefined) return false;
  return Date.now() - ts < hoursWindow * 3600 * 1000;
}

/**
 * Stores the current timestamp for the given tip key, dismissing it for 24h.
 */
export async function dismissTip(tipKey: string): Promise<void> {
  await appStorage.set(`${DISMISS_PREFIX}${tipKey}`, Date.now());
}

// ---------------------------------------------------------------------------
// Hook — synchronous derivation, memoised on data inputs
// ---------------------------------------------------------------------------

export function useAITips(data: HomeDataForTips): { tips: Tip[] } {
  const tips = useMemo(
    () => computeTips(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.sleepDurationH, data.hydrationMl, data.hydrationGoalMl, data.unmetHabitName],
  );
  return { tips };
}
