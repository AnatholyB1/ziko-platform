// Phase 46 UI helpers (locked-plugin drawer section + unlock toast). Pure, no
// React / RN imports so they run under plain node (vitest).
import { PLUGIN_LEVEL_MAP, clampLevel, isPluginIdUnlocked } from './gating';

/** Toast stays visible this long (L2). */
export const UNLOCK_TOAST_DURATION_MS = 4000;
/** Tab bar height is 70 + bottom inset (app/(app)/_layout.tsx). */
export const TAB_BAR_BASE_HEIGHT = 70;
/** Gap between the toast and the tab bar. */
export const UNLOCK_TOAST_GAP = 12;

/** Short drawer labels (the full names wrap at hyphens / truncate after 2 lines). */
export const LOCKED_SHORT_NAMES: Readonly<Record<string, string>> = {
  journal: 'Journal',
  sleep: 'Sommeil',
  measurements: 'Mesures',
  stats: 'Stats',
  pantry: 'Garde-manger',
  persona: 'Persona IA',
  gamification: 'Récompenses',
  cardio: 'Cardio',
  community: 'Communauté',
  wearables: 'Wearables',
  'ai-programs': 'Programmes IA',
  supplements: 'Compléments',
};

export interface LockedPluginTile {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  minLevel: number;
  /** 'next' = unlocks at the very next level (primary tint pill), 'later' = grey pill. */
  pillTone: 'next' | 'later';
}

export interface LockedSectionModel {
  level: number;
  /** Locked tiles, minLevel asc then registry order. Empty => nothing locked. */
  tiles: LockedPluginTile[];
  /** Render the "A debloquer" header + grid. */
  showLockedSection: boolean;
  /** Render the closing "Tout est debloque" line instead (B-08: never both). */
  showAllUnlocked: boolean;
}

/** Builds the drawer locked-section model for a level (B-08, B-12). */
export function buildLockedSection(rawLevel: number): LockedSectionModel {
  const level = clampLevel(rawLevel);
  const tiles = Object.values(PLUGIN_LEVEL_MAP)
    .map((p, order) => ({ p, order }))
    .filter(({ p }) => !isPluginIdUnlocked(p.id, level))
    .sort((a, b) => a.p.minLevel - b.p.minLevel || a.order - b.order)
    .map(({ p }) => ({
      id: p.id,
      name: p.name,
      shortName: LOCKED_SHORT_NAMES[p.id] ?? p.name,
      icon: p.icon,
      minLevel: p.minLevel,
      pillTone: (p.minLevel === level + 1 ? 'next' : 'later') as 'next' | 'later',
    }));
  return {
    level,
    tiles,
    showLockedSection: tiles.length > 0,
    showAllUnlocked: tiles.length === 0,
  };
}

/** Accent colour of the locked pill / header level (primary-ink for contrast, contract section 2). */
export const LOCKED_TOKENS = {
  lockedBg: '#EFEEEA',
  lockedIcon: '#858279',
  primaryInk: '#B8400D',
  primaryLight: '#FF5C1A15',
  primaryBorder: '#FF5C1A33',
} as const;

/** i18n key + params for the locked-tap alert (B-09): title only, nothing else. */
export function lockedTapAlertArgs(minLevel: number): { key: string; params: { n: number } } {
  return { key: 'plugins.locked.required', params: { n: clampLevel(minLevel) } };
}

export type UnlockToastAction = 'pick' | 'run' | 'suspend' | 'none';

/**
 * Reactive overlay gate for the unlock toast (46 review, MEDIUM). Re-evaluated
 * on every change of shown / levelUp / overlay visibility:
 *  - 'pick'    nothing shown yet, a level-up is pending and no overlay is open
 *  - 'run'     toast on screen, overlay closed: the display timer may run
 *  - 'suspend' toast on screen but the overlay opened meanwhile: cancel the
 *              timer and reset `shown`; the store entry is NOT cleared, so the
 *              toast restarts once the overlay closes
 *  - 'none'    nothing to do
 */
export function unlockToastAction(args: {
  shown: unknown | null;
  levelUp: { plugins: readonly unknown[] } | null | undefined;
  blockingOverlayOpen: boolean;
}): UnlockToastAction {
  if (args.shown) return args.blockingOverlayOpen ? 'suspend' : 'run';
  return shouldShowUnlockToast({ levelUp: args.levelUp, blockingOverlayOpen: args.blockingOverlayOpen })
    ? 'pick'
    : 'none';
}

/** Delay between closing the drawer Modal and presenting the alert Modal (iOS cannot stack them). */
export const LOCKED_ALERT_DELAY_MS = 350;

/**
 * Locked-tile tap (B-09, 46 review MEDIUM): close the drawer FIRST, then show
 * the title-only alert once the drawer dismissal has had time to finish, so the
 * alert Modal is never presented on top of a still-open Modal (iOS drops it).
 */
export function openLockedTapAlert(args: {
  minLevel: number;
  closeDrawer: () => void;
  showAlert: (title: string) => void;
  translate: (key: string, params?: Record<string, string | number>) => string;
  schedule?: (fn: () => void, ms: number) => unknown;
}): void {
  const { key, params } = lockedTapAlertArgs(args.minLevel);
  const title = args.translate(key, params);
  args.closeDrawer();
  (args.schedule ?? ((fn, ms) => setTimeout(fn, ms)))(() => args.showAlert(title), LOCKED_ALERT_DELAY_MS);
}

/**
 * Toast vertical offset above the screen bottom: clears the tab bar
 * (70 + inset) plus a gap (B-14). Negative / NaN inset => 0.
 */
export function unlockToastBottom(insetBottom: number): number {
  const inset = Number.isFinite(insetBottom) && insetBottom > 0 ? insetBottom : 0;
  return TAB_BAR_BASE_HEIGHT + inset + UNLOCK_TOAST_GAP;
}

/** Queue rule (B-10): show only when there is something to announce and no blocking overlay is open. */
export function shouldShowUnlockToast(args: {
  levelUp: { plugins: readonly unknown[] } | null | undefined;
  blockingOverlayOpen: boolean;
}): boolean {
  return !!args.levelUp && args.levelUp.plugins.length > 0 && !args.blockingOverlayOpen;
}

/** Detail i18n key for k newly unlocked modules (singular for 1). */
export function unlockToastDetailKey(count: number): string {
  return count === 1 ? 'plugins.unlocked.toastDetailOne' : 'plugins.unlocked.toastDetail';
}

export interface ToastMotion {
  from: { opacity: number; translateY?: number };
  animate: { opacity: number; translateY?: number };
  duration: number;
}

/** Toast enter motion (B-13): reduced motion = opacity only, 150ms. */
export function unlockToastMotion(reduceMotion: boolean): ToastMotion {
  return reduceMotion
    ? { from: { opacity: 0 }, animate: { opacity: 1 }, duration: 150 }
    : { from: { opacity: 0, translateY: 20 }, animate: { opacity: 1, translateY: 0 }, duration: 300 };
}
