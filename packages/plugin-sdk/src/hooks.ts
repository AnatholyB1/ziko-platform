import { create, StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useCallback } from 'react';
import type {
  PluginManifest,
  UserProfile,
  WorkoutSession,
  Permission,
  AISkill,
} from './types';

// ── Plugin Registry Store ─────────────────────────────────
interface PluginRegistryState {
  installedPlugins: string[];
  enabledPlugins: string[];
  manifests: Record<string, PluginManifest>;
  registeredSkills: Record<string, AISkill[]>;
  registerPlugin: (manifest: PluginManifest) => void;
  unregisterPlugin: (pluginId: string) => void;
  enablePlugin: (pluginId: string) => void;
  disablePlugin: (pluginId: string) => void;
  registerSkills: (pluginId: string, skills: AISkill[]) => void;
}

export const usePluginRegistry = create<PluginRegistryState>()((set, get) => ({
  installedPlugins: [],
  enabledPlugins: [],
  manifests: {},
  registeredSkills: {},

  registerPlugin: (manifest) =>
    set((state) => ({
      installedPlugins: state.installedPlugins.includes(manifest.id)
        ? state.installedPlugins
        : [...state.installedPlugins, manifest.id],
      enabledPlugins: state.enabledPlugins.includes(manifest.id)
        ? state.enabledPlugins
        : [...state.enabledPlugins, manifest.id],
      manifests: { ...state.manifests, [manifest.id]: manifest },
    })),

  unregisterPlugin: (pluginId) =>
    set((state) => {
      const { [pluginId]: _m, ...restManifests } = state.manifests;
      const { [pluginId]: _s, ...restSkills } = state.registeredSkills;
      return {
        installedPlugins: state.installedPlugins.filter((id) => id !== pluginId),
        enabledPlugins: state.enabledPlugins.filter((id) => id !== pluginId),
        manifests: restManifests,
        registeredSkills: restSkills,
      };
    }),

  enablePlugin: (pluginId) =>
    set((state) => ({
      enabledPlugins: state.enabledPlugins.includes(pluginId)
        ? state.enabledPlugins
        : [...state.enabledPlugins, pluginId],
    })),

  disablePlugin: (pluginId) =>
    set((state) => ({
      enabledPlugins: state.enabledPlugins.filter((id) => id !== pluginId),
    })),

  registerSkills: (pluginId, skills) =>
    set((state) => ({
      registeredSkills: { ...state.registeredSkills, [pluginId]: skills },
    })),
}));

// ── Per-plugin Zustand store factory ─────────────────────
const pluginStores: Record<string, ReturnType<typeof create>> = {};

export function usePluginStore<T extends object>(
  pluginId: string,
  initialState: T,
): [T, (partial: Partial<T> | ((state: T) => Partial<T>)) => void] {
  if (!pluginStores[pluginId]) {
    pluginStores[pluginId] = create<T>()(
      persist(() => initialState, {
        name: `plugin-${pluginId}`,
      }),
    );
  }

  const store = pluginStores[pluginId] as ReturnType<typeof create<T>>;
  const state = (store as any).getState() as T;
  const setState = (store as any).setState as (
    partial: Partial<T> | ((state: T) => Partial<T>),
  ) => void;

  return [state, setState];
}

// ── Register plugin at mount time ─────────────────────────
export function registerPlugin(manifest: PluginManifest): void {
  const { registerPlugin: reg, registerSkills } = usePluginRegistry.getState();
  reg(manifest);
  if (manifest.aiSkills?.length) {
    registerSkills(manifest.id, manifest.aiSkills);
  }
}

// ── Permission Hook ───────────────────────────────────────
export function usePermission(permission: Permission): {
  granted: boolean;
  request: () => Promise<boolean>;
} {
  // In a full app: integrate with expo-permissions or native API
  // For now returns true for all plugin-level permissions
  return {
    granted: true,
    request: async () => true,
  };
}

// ── Placeholder hooks (implemented concretely in mobile app) ─
// These are re-exported from the SDK so plugins can import them
// The actual implementations are provided via React Context in the app.

export type UseAIHook = (options?: {
  skillContext?: string;
  pluginId?: string;
}) => {
  sendMessage: (message: string) => Promise<void>;
  isStreaming: boolean;
  streamContent: string;
};

export type UseUserProfileHook = () => {
  profile: UserProfile | null;
  isLoading: boolean;
};

export type UseWorkoutHistoryHook = (days: number) => {
  sessions: WorkoutSession[];
  isLoading: boolean;
};
