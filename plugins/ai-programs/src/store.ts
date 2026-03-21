import { create } from 'zustand';

export interface GeneratedProgram {
  id: string;
  user_id: string;
  name: string;
  goal: string;
  split_type: string;
  days_per_week: number;
  experience_level: string;
  equipment: string;
  program_data: any; // full workout structure
  is_active: boolean;
  created_at: string;
}

interface AIProgramsState {
  programs: GeneratedProgram[];
  isLoading: boolean;
  isGenerating: boolean;

  setPrograms: (p: GeneratedProgram[]) => void;
  setIsLoading: (b: boolean) => void;
  setIsGenerating: (b: boolean) => void;
  addProgram: (p: GeneratedProgram) => void;
}

export const useAIProgramsStore = create<AIProgramsState>()((set) => ({
  programs: [],
  isLoading: false,
  isGenerating: false,

  setPrograms: (programs) => set({ programs }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  addProgram: (program) => set((s) => ({ programs: [program, ...s.programs] })),
}));
