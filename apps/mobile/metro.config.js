const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Explicitly set project root to prevent Metro from looking in wrong places
config.projectRoot = projectRoot;

// Only add watchFolders if the monorepo root node_modules exists (for local dev)
// In Railway, we're building from apps/mobile as root, so node_modules is local
const rootNodeModules = path.resolve(__dirname, "../../node_modules");
try {
  fs.accessSync(rootNodeModules);
  // Only add if it exists and is accessible
  if (fs.existsSync(rootNodeModules)) {
    config.watchFolders = [rootNodeModules];
  } else {
    config.watchFolders = [];
  }
} catch {
  // Root node_modules doesn't exist (Railway build context), use local only
  config.watchFolders = [];
}

// Ensure Metro uses the local node_modules and doesn't look in wrong places
const localNodeModules = path.resolve(projectRoot, "node_modules");
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [localNodeModules],
  // Prevent Metro from looking in absolute root paths
  extraNodeModules: {},
};

// Set watchFolders to only include local node_modules if root doesn't exist
if (config.watchFolders.length === 0) {
  config.watchFolders = [localNodeModules];
}

module.exports = config;
