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
  // Set watchFolders to project root only (not empty, as Metro needs it)
  config.watchFolders = [projectRoot];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [localNodeModules],
    disableHierarchicalLookup: true,
  };
  
  // Override transformer to prevent checking absolute root paths
  const originalCreateTransformer = config.transformer?.createTransformer;
  if (originalCreateTransformer) {
    config.transformer = {
      ...config.transformer,
      createTransformer: function(...args) {
        const transformer = originalCreateTransformer.apply(this, args);
        // Patch verifyRootExists if it exists
        if (transformer && typeof transformer === 'object') {
          const originalVerify = transformer.verifyRootExists;
          if (originalVerify) {
            transformer.verifyRootExists = function(roots) {
              // Filter out absolute root paths
              const filteredRoots = roots.filter(root => {
                const normalized = path.normalize(root);
                return !normalized.startsWith('/') || normalized.startsWith(projectRoot);
              });
              return originalVerify.call(this, filteredRoots);
            };
          }
        }
        return transformer;
      },
    };
  }
}

module.exports = config;
