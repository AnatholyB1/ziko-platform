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
  '@ziko/plugin-habits':    path.resolve(monorepoRoot, 'plugins/habits/src'),
};

module.exports = config;
