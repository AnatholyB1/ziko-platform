// ============================================================
// Onboarding answers (ziko_user_profiles.settings.onboarding)
// ============================================================
// level / frequency / equipment / sex have no dedicated column: onboarding
// step-7 stores them under settings.onboarding. These pure helpers read that
// blob defensively and translate the onboarding vocabulary into the ones the
// feature screens use (program generator, TDEE calculator).

export interface OnboardingSettings {
  /** 'beg' | 'med' | 'conf' */
  level: string | null;
  /** Sessions per week (1-7), null when unset or out of range. */
  frequency: number | null;
  /** Subset of 'gym' | 'home' | 'body' | 'out'. */
  equipment: string[];
  /** 'm' | 'f' | 'x' */
  sex: string | null;
}

export const EMPTY_ONBOARDING: OnboardingSettings = {
  level: null,
  frequency: null,
  equipment: [],
  sex: null,
};

/** Reads settings.onboarding from a raw ziko_user_profiles.settings value. */
export function parseOnboardingSettings(settings: unknown): OnboardingSettings {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as { onboarding?: unknown }).onboarding
      : null;
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ONBOARDING, equipment: [] };
  const o = raw as Record<string, unknown>;
  const freq = Math.floor(Number(o.frequency));
  return {
    level: typeof o.level === 'string' ? o.level : null,
    frequency: Number.isFinite(freq) && freq >= 1 && freq <= 7 ? freq : null,
    equipment: Array.isArray(o.equipment)
      ? o.equipment.filter((e): e is string => typeof e === 'string')
      : [],
    sex: typeof o.sex === 'string' ? o.sex : null,
  };
}

export type ProgramExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export function onboardingLevelToExperience(level: string | null): ProgramExperienceLevel | null {
  switch (level) {
    case 'beg':
      return 'beginner';
    case 'med':
      return 'intermediate';
    case 'conf':
      return 'advanced';
    default:
      return null;
  }
}

/** Maps the onboarding equipment multi-select to the generator's single choice. */
export function onboardingEquipmentToProgram(
  equipment: string[],
): 'full_gym' | 'home' | 'bodyweight' | null {
  if (equipment.includes('gym')) return 'full_gym';
  if (equipment.includes('home')) return 'home';
  if (equipment.includes('body') || equipment.includes('out')) return 'bodyweight';
  return null;
}

/** Onboarding goal ids match the generator's, except health -> general_fitness. */
export function onboardingGoalToProgram(goal: string | null | undefined): string | null {
  if (!goal) return null;
  return goal === 'health' ? 'general_fitness' : goal;
}

export type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'active' | 'extreme';

/** Sessions per week -> TDEE activity level. */
export function onboardingFrequencyToActivity(frequency: number | null): ActivityKey | null {
  if (frequency == null) return null;
  if (frequency <= 1) return 'sedentary';
  if (frequency <= 3) return 'light';
  if (frequency <= 5) return 'moderate';
  if (frequency === 6) return 'active';
  return 'extreme';
}

export function onboardingSexToGender(sex: string | null): 'male' | 'female' | null {
  if (sex === 'm') return 'male';
  if (sex === 'f') return 'female';
  return null;
}
