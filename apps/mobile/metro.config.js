const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Explicitly set project root to prevent Metro from looking in wrong places
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
  // Don't set watchFolders to avoid Metro checking absolute paths
  config.watchFolders = [];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [localNodeModules],
    disableHierarchicalLookup: true,
    // Prevent Metro from looking in absolute root
    blockList: [/\/node_modules\/.*/],
  };
  
  // Set cache directory to local
  config.cacheStores = [
    {
      get: () => null,
      set: () => {},
    },
  ];
}

module.exports = config;
