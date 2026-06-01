import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

// ── Theme Palette ────────────────────────────────────────
export interface ThemePalette {
  id: string;
  name: string;
  background: string;
  surface: string;
  border: string;
  primary: string;
  primaryLight: string;   // 8%  — badge bg, overlays
  primarySubtle: string;  // 5%  — very light background
  primaryBorder: string;  // 20% — borders, rings, dividers
  text: string;
  muted: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBarStyle: 'dark' | 'light';
  statusBarBg: string;
  // Semantic tokens
  success: string;
  info: string;
  violet: string;
  warn: string;
  danger: string;
  // Dark surface
  cardDark: string;
  cardDarkText: string;
  // Card style
  cardStyle: 'flat' | 'shadow' | 'outlined';
  // Typography
  fontDisplay: string;
  fontBody: string;
}

// ── Default (Sport Orange) ──────────────────────────────
export const DEFAULT_THEME: ThemePalette = {
  id: 'default',
  name: 'Sport Orange',
  background: '#F7F6F3',
  surface: '#FFFFFF',
  border: '#E2E0DA',
  primary: '#FF5C1A',
  primaryLight: '#FF5C1A15',
  primarySubtle: '#FF5C1A0D',
  primaryBorder: '#FF5C1A33',
  text: '#1C1A17',
  muted: '#6B6963',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E0DA',
  tabBarActive: '#FF5C1A',
  tabBarInactive: '#7A7670',
  statusBarStyle: 'dark',
  statusBarBg: '#F7F6F3',
  success: '#2E9E5B',
  info: '#2E7BF6',
  violet: '#7B5BD0',
  warn: '#E8A33A',
  danger: '#EF4444',
  cardDark: '#1C1A17',
  cardDarkText: '#FFFAF6',
  cardStyle: 'shadow',
  fontDisplay: 'Manrope_800ExtraBold',
  fontBody: 'Geist_400Regular',
};

// ── Theme Definitions ───────────────────────────────────
export const THEME_REGISTRY: Record<string, ThemePalette> = {
  default: DEFAULT_THEME,
  'Bleu Océan': {
    id: 'Bleu Océan', name: 'Bleu Océan',
    background: '#EFF6FF', surface: '#FFFFFF', border: '#BFDBFE',
    primary: '#2563EB', primaryLight: '#2563EB15', primarySubtle: '#2563EB0D', primaryBorder: '#2563EB33', text: '#1E293B', muted: '#64748B',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BFDBFE', tabBarActive: '#2563EB', tabBarInactive: '#94A3B8',
    statusBarStyle: 'dark', statusBarBg: '#EFF6FF',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#0F172A', cardDarkText: '#F0F9FF',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Violet Royal': {
    id: 'Violet Royal', name: 'Violet Royal',
    background: '#F5F3FF', surface: '#FFFFFF', border: '#C4B5FD',
    primary: '#7C3AED', primaryLight: '#7C3AED15', primarySubtle: '#7C3AED0D', primaryBorder: '#7C3AED33', text: '#1E1B4B', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#C4B5FD', tabBarActive: '#7C3AED', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F5F3FF',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#1E1B4B', cardDarkText: '#FAF5FF',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Vert Forêt': {
    id: 'Vert Forêt', name: 'Vert Forêt',
    background: '#F0FDF4', surface: '#FFFFFF', border: '#BBF7D0',
    primary: '#16A34A', primaryLight: '#16A34A15', primarySubtle: '#16A34A0D', primaryBorder: '#16A34A33', text: '#14532D', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BBF7D0', tabBarActive: '#16A34A', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F0FDF4',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#14532D', cardDarkText: '#F0FDF4',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Rouge Feu': {
    id: 'Rouge Feu', name: 'Rouge Feu',
    background: '#FEF2F2', surface: '#FFFFFF', border: '#FECACA',
    primary: '#DC2626', primaryLight: '#DC262615', primarySubtle: '#DC26260D', primaryBorder: '#DC262633', text: '#450A0A', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FECACA', tabBarActive: '#DC2626', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#FEF2F2',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#450A0A', cardDarkText: '#FFF1F2',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Or Prestige': {
    id: 'Or Prestige', name: 'Or Prestige',
    background: '#FFFBEB', surface: '#FFFFFF', border: '#FDE68A',
    primary: '#D97706', primaryLight: '#D9770615', primarySubtle: '#D977060D', primaryBorder: '#D9770633', text: '#451A03', muted: '#78716C',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FDE68A', tabBarActive: '#D97706', tabBarInactive: '#A8A29E',
    statusBarStyle: 'dark', statusBarBg: '#FFFBEB',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#451A03', cardDarkText: '#FFFBEB',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
  'Noir Carbone': {
    id: 'Noir Carbone', name: 'Noir Carbone',
    background: '#0F0F0F', surface: '#1A1A1A', border: '#333333',
    primary: '#FF5C1A', primaryLight: '#FF5C1A20', primarySubtle: '#FF5C1A0D', primaryBorder: '#FF5C1A33', text: '#F5F5F5', muted: '#A3A3A3',
    tabBarBg: '#1A1A1A', tabBarBorder: '#333333', tabBarActive: '#FF5C1A', tabBarInactive: '#737373',
    statusBarStyle: 'light', statusBarBg: '#0F0F0F',
    success: '#2E9E5B', info: '#2E7BF6', violet: '#7B5BD0', warn: '#E8A33A', danger: '#EF4444',
    cardDark: '#0A0A0A', cardDarkText: '#F5F5F5',
    cardStyle: 'shadow',
    fontDisplay: 'Manrope_800ExtraBold', fontBody: 'Geist_400Regular',
  },
};

// ── Banner Definitions ──────────────────────────────────
export interface BannerDef {
  id: string;
  name: string;
  colors: string[];
  style: 'solid' | 'gradient' | 'animated';
}

export const BANNER_REGISTRY: Record<string, BannerDef> = {
  'Flamme Ardente':   { id: 'Flamme Ardente',   name: 'Flamme Ardente',   colors: ['#FF5C1A', '#FF9800', '#FFD54F'], style: 'gradient' },
  'Glace Éternelle': { id: 'Glace Éternelle',  name: 'Glace Éternelle',  colors: ['#06B6D4', '#3B82F6', '#818CF8'], style: 'gradient' },
  'Néon Violet':      { id: 'Néon Violet',      name: 'Néon Violet',      colors: ['#A855F7', '#EC4899', '#F43F5E'], style: 'gradient' },
  'Émeraude':         { id: 'Émeraude',         name: 'Émeraude',         colors: ['#10B981', '#34D399', '#A7F3D0'], style: 'gradient' },
  'Or Massif':        { id: 'Or Massif',        name: 'Or Massif',        colors: ['#D97706', '#F59E0B', '#FDE68A'], style: 'gradient' },
  'Sang Royal':       { id: 'Sang Royal',       name: 'Sang Royal',       colors: ['#991B1B', '#DC2626', '#F87171'], style: 'gradient' },
  'Arc-en-ciel':      { id: 'Arc-en-ciel',      name: 'Arc-en-ciel',      colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'], style: 'gradient' },
  'Diamant Noir':     { id: 'Diamant Noir',     name: 'Diamant Noir',     colors: ['#1C1A17', '#525252', '#D4D4D4'], style: 'gradient' },
};

// ── Coach Storage (MMKV) ────────────────────────────────
export const coachStorage = new MMKV({ id: 'coach-storage' });

// ── Store ────────────────────────────────────────────────
interface ThemeState {
  theme: ThemePalette;
  equippedBanner: BannerDef | null;
  setTheme: (themeId: string) => void;
  setBanner: (bannerId: string | null) => void;
  resetTheme: () => void;
  setCustomTheme: (overrides: Partial<ThemePalette>) => void;
  clearCoachTheme: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => {
  const initialTheme = (() => {
    try {
      const raw = coachStorage.getString('coach:branding');
      if (!raw) return DEFAULT_THEME;
      const branding = JSON.parse(raw) as { primary_color?: string };
      if (!branding?.primary_color) return DEFAULT_THEME;
      const primary = branding.primary_color;
      return {
        ...DEFAULT_THEME,
        primary,
        primaryLight: primary + '15',
        primarySubtle: primary + '0D',
        primaryBorder: primary + '33',
        tabBarActive: primary,
      };
    } catch {
      return DEFAULT_THEME;
    }
  })();

  return {
  theme: initialTheme,
  equippedBanner: null,

  setTheme: (themeId) => {
    const palette = THEME_REGISTRY[themeId];
    if (palette) set({ theme: palette });
  },

  setBanner: (bannerId) => {
    if (!bannerId) { set({ equippedBanner: null }); return; }
    const banner = BANNER_REGISTRY[bannerId];
    if (banner) set({ equippedBanner: banner });
  },

  resetTheme: () => set({ theme: DEFAULT_THEME, equippedBanner: null }),

  setCustomTheme: (overrides) => {
    const primary = overrides.primary ?? DEFAULT_THEME.primary;
    const primaryLight = primary + '15';
    const primarySubtle = primary + '0D';
    const primaryBorder = primary + '33';
    const tabBarActive = primary;
    set({ theme: { ...DEFAULT_THEME, ...overrides, primaryLight, primarySubtle, primaryBorder, tabBarActive } });
  },

  clearCoachTheme: () => get().resetTheme(),
  };
});
