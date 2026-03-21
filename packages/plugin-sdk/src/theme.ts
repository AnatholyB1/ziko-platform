import { create } from 'zustand';

// ── Theme Palette ────────────────────────────────────────
export interface ThemePalette {
  id: string;
  name: string;
  background: string;
  surface: string;
  border: string;
  primary: string;
  primaryLight: string;
  text: string;
  muted: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBarStyle: 'dark' | 'light';
  statusBarBg: string;
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
  text: '#1C1A17',
  muted: '#6B6963',
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E0DA',
  tabBarActive: '#FF5C1A',
  tabBarInactive: '#7A7670',
  statusBarStyle: 'dark',
  statusBarBg: '#F7F6F3',
};

// ── Theme Definitions ───────────────────────────────────
export const THEME_REGISTRY: Record<string, ThemePalette> = {
  default: DEFAULT_THEME,
  'Bleu Océan': {
    id: 'Bleu Océan', name: 'Bleu Océan',
    background: '#EFF6FF', surface: '#FFFFFF', border: '#BFDBFE',
    primary: '#2563EB', primaryLight: '#2563EB15', text: '#1E293B', muted: '#64748B',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BFDBFE', tabBarActive: '#2563EB', tabBarInactive: '#94A3B8',
    statusBarStyle: 'dark', statusBarBg: '#EFF6FF',
  },
  'Violet Royal': {
    id: 'Violet Royal', name: 'Violet Royal',
    background: '#F5F3FF', surface: '#FFFFFF', border: '#C4B5FD',
    primary: '#7C3AED', primaryLight: '#7C3AED15', text: '#1E1B4B', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#C4B5FD', tabBarActive: '#7C3AED', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F5F3FF',
  },
  'Vert Forêt': {
    id: 'Vert Forêt', name: 'Vert Forêt',
    background: '#F0FDF4', surface: '#FFFFFF', border: '#BBF7D0',
    primary: '#16A34A', primaryLight: '#16A34A15', text: '#14532D', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#BBF7D0', tabBarActive: '#16A34A', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#F0FDF4',
  },
  'Rouge Feu': {
    id: 'Rouge Feu', name: 'Rouge Feu',
    background: '#FEF2F2', surface: '#FFFFFF', border: '#FECACA',
    primary: '#DC2626', primaryLight: '#DC262615', text: '#450A0A', muted: '#6B7280',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FECACA', tabBarActive: '#DC2626', tabBarInactive: '#9CA3AF',
    statusBarStyle: 'dark', statusBarBg: '#FEF2F2',
  },
  'Or Prestige': {
    id: 'Or Prestige', name: 'Or Prestige',
    background: '#FFFBEB', surface: '#FFFFFF', border: '#FDE68A',
    primary: '#D97706', primaryLight: '#D9770615', text: '#451A03', muted: '#78716C',
    tabBarBg: '#FFFFFF', tabBarBorder: '#FDE68A', tabBarActive: '#D97706', tabBarInactive: '#A8A29E',
    statusBarStyle: 'dark', statusBarBg: '#FFFBEB',
  },
  'Noir Carbone': {
    id: 'Noir Carbone', name: 'Noir Carbone',
    background: '#0F0F0F', surface: '#1A1A1A', border: '#333333',
    primary: '#FF5C1A', primaryLight: '#FF5C1A20', text: '#F5F5F5', muted: '#A3A3A3',
    tabBarBg: '#1A1A1A', tabBarBorder: '#333333', tabBarActive: '#FF5C1A', tabBarInactive: '#737373',
    statusBarStyle: 'light', statusBarBg: '#0F0F0F',
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

// ── Store ────────────────────────────────────────────────
interface ThemeState {
  theme: ThemePalette;
  equippedBanner: BannerDef | null;
  setTheme: (themeId: string) => void;
  setBanner: (bannerId: string | null) => void;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: DEFAULT_THEME,
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
}));
