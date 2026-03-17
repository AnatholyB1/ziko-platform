import { create } from 'zustand';
import { usePluginStore } from '@ziko/plugin-sdk';

export interface Habit {
  id: string;
  label: string;
  frequency: 'daily' | 'weekly';
  completedDates: string[]; // ISO date strings
}

export interface PersonaState {
  agentName: string;
  traits: string[];
  backstory: string;
  coachingStyle: 'motivational' | 'analytical' | 'friendly' | 'strict';
  habits: Habit[];
  isLoaded: boolean;

  setAgentName: (name: string) => void;
  setTraits: (traits: string[]) => void;
  toggleTrait: (trait: string) => void;
  setBackstory: (text: string) => void;
  setCoachingStyle: (style: PersonaState['coachingStyle']) => void;
  addHabit: (label: string, frequency?: Habit['frequency']) => void;
  removeHabit: (id: string) => void;
  completeHabit: (id: string, date: string) => void;
  setIsLoaded: (v: boolean) => void;
  todayStreak: () => number;
}

const defaultTraits = ['Encouraging', 'Direct', 'Science-based'];

export const usePersonaStore = create<PersonaState>((set, get) => ({
  agentName: 'Ziko',
  traits: defaultTraits,
  backstory: '',
  coachingStyle: 'motivational',
  habits: [],
  isLoaded: false,

  setAgentName: (agentName) => set({ agentName }),
  setTraits: (traits) => set({ traits }),
  toggleTrait: (trait) => set((s) => ({
    traits: s.traits.includes(trait)
      ? s.traits.filter((t) => t !== trait)
      : [...s.traits, trait],
  })),
  setBackstory: (backstory) => set({ backstory }),
  setCoachingStyle: (coachingStyle) => set({ coachingStyle }),

  addHabit: (label, frequency = 'daily') => set((s) => ({
    habits: [...s.habits, {
      id: `${Date.now()}`,
      label,
      frequency,
      completedDates: [],
    }],
  })),

  removeHabit: (id) => set((s) => ({
    habits: s.habits.filter((h) => h.id !== id),
  })),

  completeHabit: (id, date) => set((s) => ({
    habits: s.habits.map((h) =>
      h.id === id && !h.completedDates.includes(date)
        ? { ...h, completedDates: [...h.completedDates, date] }
        : h,
    ),
  })),

  setIsLoaded: (isLoaded) => set({ isLoaded }),

  todayStreak: () => {
    const { habits } = get();
    const today = new Date().toISOString().split('T')[0];
    return habits.filter((h) => h.frequency === 'daily' && h.completedDates.includes(today)).length;
  },
}));

/** Build the dynamic system prompt addition from current persona state */
export function buildPersonaSystemPrompt(state: PersonaState): string {
  const { agentName, traits, backstory, coachingStyle, habits } = state;
  const habitList = habits.map((h) => `- ${h.label} (${h.frequency})`).join('\n');

  return `
=== AI PERSONA ===
Your name is ${agentName}. You are a personal fitness and wellness coach.
Coaching style: ${coachingStyle}.
Core traits: ${traits.join(', ')}.
${backstory ? `Background: ${backstory}` : ''}
${habits.length > 0 ? `\nUser's tracked habits:\n${habitList}` : ''}
Always address the user by their first name when appropriate. Stay in character consistently.
`.trim();
}
