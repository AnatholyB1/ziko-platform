const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees workspace packages & plugins
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both app and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Alias workspace packages to their source so Metro can bundle them directly
config.resolver.extraNodeModules = {
  '@ziko/plugin-sdk':       path.resolve(monorepoRoot, 'packages/plugin-sdk/src'),
  '@ziko/ai-client':        path.resolve(monorepoRoot, 'packages/ai-client/src'),
  '@ziko/ui':               path.resolve(monorepoRoot, 'packages/ui/src'),
  '@ziko/plugin-nutrition': path.resolve(monorepoRoot, 'plugins/nutrition/src'),
  '@ziko/plugin-persona':   path.resolve(monorepoRoot, 'plugins/persona/src'),
  '@ziko/plugin-habits':       path.resolve(monorepoRoot, 'plugins/habits/src'),
  '@ziko/plugin-stats':        path.resolve(monorepoRoot, 'plugins/stats/src'),
  '@ziko/plugin-gamification': path.resolve(monorepoRoot, 'plugins/gamification/src'),
  '@ziko/plugin-community':    path.resolve(monorepoRoot, 'plugins/community/src'),
  '@ziko/plugin-stretching':   path.resolve(monorepoRoot, 'plugins/stretching/src'),
  '@ziko/plugin-sleep':        path.resolve(monorepoRoot, 'plugins/sleep/src'),
  '@ziko/plugin-measurements': path.resolve(monorepoRoot, 'plugins/measurements/src'),
  '@ziko/plugin-timer':        path.resolve(monorepoRoot, 'plugins/timer/src'),
  '@ziko/plugin-ai-programs':  path.resolve(monorepoRoot, 'plugins/ai-programs/src'),
  '@ziko/plugin-journal':      path.resolve(monorepoRoot, 'plugins/journal/src'),
  '@ziko/plugin-hydration':    path.resolve(monorepoRoot, 'plugins/hydration/src'),
  '@ziko/plugin-cardio':       path.resolve(monorepoRoot, 'plugins/cardio/src'),
};

module.exports = config;
