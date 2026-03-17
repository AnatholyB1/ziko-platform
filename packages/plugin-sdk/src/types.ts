// ============================================================
// ZIKO Plugin SDK — Core Types & Interfaces
// ============================================================

// ── Permissions ───────────────────────────────────────────
export type Permission =
  | 'read_profile'
  | 'write_profile'
  | 'read_workout_history'
  | 'write_workout'
  | 'read_nutrition'
  | 'write_nutrition'
  | 'read_ai_history'
  | 'notifications'
  | 'camera';

// ── AI ────────────────────────────────────────────────────
export interface AISkill {
  name: string;
  description: string;
  triggerKeywords: string[];
  /** Returns data injected into the AI context when this skill is active */
  contextProvider: () => Record<string, unknown>;
}

// ── Plugin Routes ─────────────────────────────────────────
export interface PluginRoute {
  /** Expo Router path, e.g. "/(plugins)/nutrition/log" */
  path: string;
  title: string;
  /** Lucide-react-native icon name or remote URL */
  icon: string;
  showInTabBar: boolean;
}

// ── Plugin Manifest ───────────────────────────────────────
export type PluginCategory =
  | 'nutrition'
  | 'coaching'
  | 'persona'
  | 'analytics'
  | 'social';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon: string;
  category: PluginCategory;
  /** 'free' or price in EUR */
  price: 'free' | number;
  requiredPermissions: Permission[];
  /** Zustand store keys this plugin reads / writes */
  userDataKeys: string[];
  aiSkills: AISkill[];
  aiPersonaTraits?: string[];
  /** Appended to the AI system prompt when this plugin is active */
  aiSystemPromptAddition?: string;
  routes: PluginRoute[];
}

// ── User Domain Types ─────────────────────────────────────
export type FitnessGoal =
  | 'muscle_gain'
  | 'fat_loss'
  | 'maintenance'
  | 'endurance';

export interface UserProfile {
  id: string;
  name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal: FitnessGoal | null;
  units: 'metric' | 'imperial';
  avatar_url: string | null;
  onboarding_done: boolean;
}

// ── Workout Domain Types ──────────────────────────────────
export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  instructions: string | null;
  video_url: string | null;
  is_custom: boolean;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  program_workout_id: string | null;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  total_volume_kg: number | null;
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  completed: boolean;
}

// ── AI Message ────────────────────────────────────────────
export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string | null;
  plugin_context: Record<string, unknown>;
  created_at: string;
}

// ── Plugin Context passed to AIBridge ─────────────────────
export interface PluginAIContext {
  pluginId: string;
  data: Record<string, unknown>;
}

// ── Plugin Registration ────────────────────────────────────
export interface RegisteredPlugin {
  manifest: PluginManifest;
  isInstalled: boolean;
  isEnabled: boolean;
}
