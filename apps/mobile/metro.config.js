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
  config.watchFolders = [rootNodeModules];
} catch {
  // Root node_modules doesn't exist (Railway build context), use local only
  config.watchFolders = [];
}

// Ensure Metro uses the local node_modules
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [path.resolve(projectRoot, "node_modules")],
};

module.exports = config;
