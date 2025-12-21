const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname);
const config = getDefaultConfig(projectRoot);

// Explicitly set project root using absolute path
config.projectRoot = projectRoot;

// Check if monorepo root node_modules exists (for local dev)
const workspaceRoot = path.resolve(projectRoot, "../..");
const rootNodeModules = path.resolve(workspaceRoot, "node_modules");
const localNodeModules = path.resolve(projectRoot, "node_modules");

// Configure watchFolders and nodeModulesPaths based on environment
if (fs.existsSync(rootNodeModules) && fs.existsSync(localNodeModules)) {
  // Local dev with monorepo - use both
  config.watchFolders = [workspaceRoot];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [
      localNodeModules,
      rootNodeModules,
    ],
    disableHierarchicalLookup: true,
  };
} else {
  // Railway build context - only use local node_modules
  // CRITICAL: Set watchFolders to empty array to prevent Metro from checking absolute root paths
  // Metro's verifyRootExists checks watchFolders, and if any path resolves incorrectly, it fails
  config.watchFolders = [];
  
  // Ensure resolver only uses local node_modules with absolute path
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [localNodeModules],
    disableHierarchicalLookup: true,
    // Block any attempts to resolve from absolute root
    blockList: [
      /^\/node_modules\/.*/,
      /^\/.*node_modules\/.*/,
    ],
  };
  
  // Set cache to use project-relative paths only
  if (!config.cacheStores) {
    config.cacheStores = [];
  }
}

module.exports = config;
