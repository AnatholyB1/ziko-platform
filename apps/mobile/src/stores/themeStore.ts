// Re-export from shared package for single store instance
export {
  useThemeStore,
  DEFAULT_THEME,
  THEME_REGISTRY,
  BANNER_REGISTRY,
} from '@ziko/plugin-sdk';
export type { ThemePalette, BannerDef } from '@ziko/plugin-sdk';
