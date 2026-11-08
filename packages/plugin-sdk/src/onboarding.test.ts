import { describe, it, expect } from 'vitest';
import {
  parseOnboardingSettings,
  onboardingLevelToExperience,
  onboardingEquipmentToProgram,
  onboardingGoalToProgram,
  onboardingFrequencyToActivity,
  onboardingSexToGender,
} from './onboarding';

describe('parseOnboardingSettings', () => {
  it('returns empty answers for null, non-object or missing onboarding', () => {
    for (const input of [null, undefined, 'x', 42, {}, { onboarding: null }, { onboarding: 'x' }]) {
      expect(parseOnboardingSettings(input)).toEqual({
        level: null,
        frequency: null,
        equipment: [],
        sex: null,
      });
    }
  });

  it('reads a well-formed onboarding blob', () => {
    expect(
      parseOnboardingSettings({
        privacy: { show_stats: true },
        onboarding: { level: 'med', frequency: 4, equipment: ['gym', 'body'], sex: 'f' },
      }),
    ).toEqual({ level: 'med', frequency: 4, equipment: ['gym', 'body'], sex: 'f' });
  });

  it('coerces string frequencies and rejects out-of-range ones', () => {
    expect(parseOnboardingSettings({ onboarding: { frequency: '5' } }).frequency).toBe(5);
    expect(parseOnboardingSettings({ onboarding: { frequency: 0 } }).frequency).toBeNull();
    expect(parseOnboardingSettings({ onboarding: { frequency: 9 } }).frequency).toBeNull();
    expect(parseOnboardingSettings({ onboarding: { frequency: 'abc' } }).frequency).toBeNull();
  });

  it('drops non-string equipment entries and non-array equipment', () => {
    expect(parseOnboardingSettings({ onboarding: { equipment: ['gym', 3, null] } }).equipment).toEqual(['gym']);
    expect(parseOnboardingSettings({ onboarding: { equipment: 'gym' } }).equipment).toEqual([]);
  });
});

describe('mappings', () => {
  it('level -> experience', () => {
    expect(onboardingLevelToExperience('beg')).toBe('beginner');
    expect(onboardingLevelToExperience('med')).toBe('intermediate');
    expect(onboardingLevelToExperience('conf')).toBe('advanced');
    expect(onboardingLevelToExperience('zzz')).toBeNull();
    expect(onboardingLevelToExperience(null)).toBeNull();
  });

  it('equipment -> program equipment, gym wins over home over bodyweight', () => {
    expect(onboardingEquipmentToProgram(['home', 'gym'])).toBe('full_gym');
    expect(onboardingEquipmentToProgram(['home', 'body'])).toBe('home');
    expect(onboardingEquipmentToProgram(['out'])).toBe('bodyweight');
    expect(onboardingEquipmentToProgram(['body'])).toBe('bodyweight');
    expect(onboardingEquipmentToProgram([])).toBeNull();
  });

  it('goal: health becomes general_fitness, others pass through', () => {
    expect(onboardingGoalToProgram('health')).toBe('general_fitness');
    expect(onboardingGoalToProgram('strength')).toBe('strength');
    expect(onboardingGoalToProgram(null)).toBeNull();
    expect(onboardingGoalToProgram('')).toBeNull();
  });

  it('frequency -> activity level boundaries', () => {
    expect(onboardingFrequencyToActivity(null)).toBeNull();
    expect(onboardingFrequencyToActivity(1)).toBe('sedentary');
    expect(onboardingFrequencyToActivity(2)).toBe('light');
    expect(onboardingFrequencyToActivity(3)).toBe('light');
    expect(onboardingFrequencyToActivity(4)).toBe('moderate');
    expect(onboardingFrequencyToActivity(5)).toBe('moderate');
    expect(onboardingFrequencyToActivity(6)).toBe('active');
    expect(onboardingFrequencyToActivity(7)).toBe('extreme');
  });

  it('sex -> gender; other/unknown stays unset', () => {
    expect(onboardingSexToGender('m')).toBe('male');
    expect(onboardingSexToGender('f')).toBe('female');
    expect(onboardingSexToGender('x')).toBeNull();
    expect(onboardingSexToGender(null)).toBeNull();
  });
});
