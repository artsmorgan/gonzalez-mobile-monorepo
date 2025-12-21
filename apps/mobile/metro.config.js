const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);

// Only add watchFolders if the monorepo root node_modules exists (for local dev)
// In Railway, we're building from apps/mobile as root, so node_modules is local
const rootNodeModules = path.resolve(__dirname, "../../node_modules");
try {
  require("fs").accessSync(rootNodeModules);
  config.watchFolders = [rootNodeModules];
} catch {
  // Root node_modules doesn't exist (Railway build context), use local only
  config.watchFolders = [];
}

module.exports = config;
