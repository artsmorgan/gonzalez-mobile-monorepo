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
if (fs.existsSync(rootNodeModules)) {
  // Local dev with monorepo
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
  config.watchFolders = [projectRoot];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [localNodeModules],
    disableHierarchicalLookup: true,
  };
}

module.exports = config;
