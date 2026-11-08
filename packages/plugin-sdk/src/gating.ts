// Progressive feature unlock (Phase 46). Pure helpers, no React / RN imports so
// they can be unit-tested under plain node.
import type { PluginManifest } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

/** Clamp any input to an integer level in [1, 5]. Non-finite => 1 (fail-safe floor). */
export function clampLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(n)));
}

/** Shape of the columns read from ziko_athlete_state. */
export interface AthleteLevelRow {
  tier?: number | null;
  level?: number | null;
}

/**
 * Effective level = athlete tier (D-02). The stored `level` column is
 * deliberately ignored: Phase 45 writes tier only and tier is monotonic.
 * No row / null tier => 1, so access never drops to zero.
 */
export function getEffectiveLevel(row: AthleteLevelRow | null | undefined): number {
  if (!row || row.tier == null) return MIN_LEVEL;
  return clampLevel(row.tier);
}

type GatedManifest = Pick<PluginManifest, 'mandatory' | 'minLevel'>;

/** Required level of a manifest, clamped to [1, 5] (a bad value can never exceed the scale). */
export function getPluginMinLevel(manifest: Pick<PluginManifest, 'minLevel'>): number {
  return manifest.minLevel == null ? MIN_LEVEL : clampLevel(manifest.minLevel);
}

/** mandatory -> always unlocked; otherwise level >= minLevel. */
export function isPluginUnlocked(manifest: GatedManifest, level: number): boolean {
  if (manifest.mandatory) return true;
  return clampLevel(level) >= getPluginMinLevel(manifest);
}

/**
 * Filters manifests by level. Floor guarantee: if the input is non-empty the
 * result is never empty - when nothing passes, the lowest-minLevel manifests
 * are returned.
 */
export function filterUnlockedPlugins<T extends GatedManifest>(manifests: T[], level: number): T[] {
  const unlocked = manifests.filter((m) => isPluginUnlocked(m, level));
  if (unlocked.length > 0 || manifests.length === 0) return unlocked;
  const lowest = Math.min(...manifests.map(getPluginMinLevel));
  return manifests.filter((m) => getPluginMinLevel(m) === lowest);
}

// ── Level read bookkeeping (pure, used by authStore) ─────────────────────
/** After this long without a first level read the store falls back to level 1. */
export const FIRST_LEVEL_READ_TIMEOUT_MS = 5000;

/**
 * True when a finished level read must be dropped: it belongs to another user
 * than the current one (sign-out / account switch while in flight) or a newer
 * read has already been applied (out-of-order response).
 */
export function shouldDiscardLevelRead(args: {
  requestUserId: string;
  currentUserId: string | null | undefined;
  requestSeq: number;
  appliedSeq: number;
}): boolean {
  return args.currentUserId !== args.requestUserId || args.requestSeq < args.appliedSeq;
}

export interface LevelReadState {
  level: number;
  loaded: boolean;
  /** true when `loaded` only reflects the timeout fallback, not a real read. */
  fallback: boolean;
}

export interface LevelReadResult {
  state: LevelReadState;
  /** Set only when a level already known from a real read went up. */
  levelUp: { from: number; to: number } | null;
}

/**
 * Applies a successful read. Same user, real prior read: level never decreases
 * (tier is server-monotonic, so a lower value is a stale response) and a raise
 * is announced. First read, or first real read after the timeout fallback:
 * taken as-is, never announced.
 */
export function reduceLevelRead(prev: LevelReadState, read: number): LevelReadResult {
  const next = clampLevel(read);
  const known = prev.loaded && !prev.fallback;
  if (!known) return { state: { level: next, loaded: true, fallback: false }, levelUp: null };
  const level = Math.max(prev.level, next);
  return {
    state: { level, loaded: true, fallback: false },
    levelUp: level > prev.level ? { from: prev.level, to: level } : null,
  };
}

// ── Static locked-plugin metadata (drawer "A debloquer" section) ─────────
export interface PluginLevelInfo {
  id: string;
  name: string;
  /** Ionicons name */
  icon: string;
  minLevel: number;
  mandatory?: boolean;
}

/**
 * id -> display metadata + required level (D-03). Locked plugins are not
 * registered by the loader, so the drawer needs this static source. Must stay
 * in sync with each plugins/<id>/src/manifest.ts (enforced by a unit test).
 */
export const PLUGIN_LEVEL_MAP: Readonly<Record<string, PluginLevelInfo>> = {
  coach:        { id: 'coach',        name: 'Mon coach',               icon: 'person-outline',         minLevel: 1, mandatory: true },
  habits:       { id: 'habits',       name: 'Daily Habits & Goals',    icon: 'checkmark-circle-outline', minLevel: 1 },
  nutrition:    { id: 'nutrition',    name: 'Nutrition Tracker',       icon: 'restaurant',             minLevel: 1 },
  timer:        { id: 'timer',        name: 'Timer & Chrono',          icon: 'timer-outline',          minLevel: 1 },
  hydration:    { id: 'hydration',    name: 'Hydratation',             icon: 'water-outline',          minLevel: 1 },
  stretching:   { id: 'stretching',   name: 'Stretching & Mobilité', icon: 'body-outline',        minLevel: 1 },
  rpe:          { id: 'rpe',          name: 'Calculateur RPE',         icon: 'calculator-outline',     minLevel: 1 },
  journal:      { id: 'journal',      name: 'Journal & Mindset',       icon: 'journal-outline',        minLevel: 2 },
  sleep:        { id: 'sleep',        name: 'Sommeil & Récupération', icon: 'moon-outline',  minLevel: 2 },
  measurements: { id: 'measurements', name: 'Mesures & Progression',   icon: 'resize-outline',         minLevel: 2 },
  stats:        { id: 'stats',        name: 'Analytics',               icon: 'stats-chart',            minLevel: 2 },
  pantry:       { id: 'pantry',       name: 'Garde-Manger',            icon: 'storefront-outline',     minLevel: 2 },
  persona:      { id: 'persona',      name: 'AI Persona & Habits',     icon: 'person-circle-outline',  minLevel: 2 },
  gamification: { id: 'gamification', name: 'Récompenses',        icon: 'trophy',                 minLevel: 3 },
  cardio:       { id: 'cardio',       name: 'Cardio & Running',        icon: 'fitness-outline',        minLevel: 3 },
  community:    { id: 'community',    name: 'Communauté',         icon: 'people',                 minLevel: 3 },
  wearables:    { id: 'wearables',    name: 'Wearables & Santé',  icon: 'watch-outline',          minLevel: 3 },
  'ai-programs': { id: 'ai-programs', name: 'Programmes IA',           icon: 'sparkles-outline',       minLevel: 4 },
  supplements:  { id: 'supplements',  name: 'Compléments Alimentaires', icon: 'flask',            minLevel: 4 },
};

/**
 * Id-based unlock check using the static map. Unknown ids are treated as unlocked
 * (not gated) on purpose: the route guard alert needs a map entry for the plugin
 * name, so fail-closed would redirect with a nameless alert. Coverage is
 * enforced in CI instead (gating.test.ts "covers every plugin directory").
 */
export function isPluginIdUnlocked(pluginId: string, level: number): boolean {
  const info = PLUGIN_LEVEL_MAP[pluginId];
  if (!info) return true;
  if (info.mandatory) return true;
  return clampLevel(level) >= info.minLevel;
}

/** Locked plugins for a level, sorted by minLevel then name (drawer section). */
export function getLockedPlugins(level: number): PluginLevelInfo[] {
  return Object.values(PLUGIN_LEVEL_MAP)
    .filter((p) => !isPluginIdUnlocked(p.id, level))
    .sort((a, b) => a.minLevel - b.minLevel || a.name.localeCompare(b.name));
}

/** Plugins newly unlocked when moving from `prevLevel` to `nextLevel` (unlock toast). */
export function getNewlyUnlockedPlugins(prevLevel: number, nextLevel: number): PluginLevelInfo[] {
  const prev = clampLevel(prevLevel);
  const next = clampLevel(nextLevel);
  if (next <= prev) return [];
  return Object.values(PLUGIN_LEVEL_MAP).filter((p) => p.minLevel > prev && p.minLevel <= next);
}

/**
 * Extracts the plugin id from expo-router segments, e.g.
 * ['(app)', '(plugins)', 'habits', 'dashboard'] => 'habits'. null if not a plugin route.
 */
export function getPluginIdFromSegments(segments: readonly string[]): string | null {
  const i = segments.indexOf('(plugins)');
  if (i < 0) return null;
  return segments[i + 1] ?? null;
}

/** Route guard decision: should this route be blocked at `level`? Level-1 plugins never block. */
export function isPluginRouteLocked(segments: readonly string[], level: number): boolean {
  const id = getPluginIdFromSegments(segments);
  if (!id) return false;
  return !isPluginIdUnlocked(id, level);
}
