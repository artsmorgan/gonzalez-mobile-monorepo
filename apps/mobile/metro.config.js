const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = path.resolve(__dirname);
const config = getDefaultConfig(projectRoot);

// Explicitly set project root using absolute path
config.projectRoot = projectRoot;

// Monorepo: npm/yarn suelen hoistear dependencias al root; Metro debe buscar ahí aunque
// `apps/mobile/node_modules` no exista o esté casi vacío.
const workspaceRoot = path.resolve(projectRoot, "../..");
const rootNodeModules = path.resolve(workspaceRoot, "node_modules");
const localNodeModules = path.resolve(projectRoot, "node_modules");

const nodeModulesPaths = [];
if (fs.existsSync(localNodeModules)) {
  nodeModulesPaths.push(localNodeModules);
}
if (fs.existsSync(rootNodeModules) && !nodeModulesPaths.includes(rootNodeModules)) {
  nodeModulesPaths.push(rootNodeModules);
}

// Incluimos `rootNodeModules` en la lista solo si existe; eso marca entorno monorepo hoisteado.
const isMonorepoDev = nodeModulesPaths.includes(rootNodeModules);

if (isMonorepoDev) {
  config.watchFolders = [workspaceRoot];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths,
    // Sin esto Metro puede ignorar el segundo path y no resolver paquetes hoisteados.
    disableHierarchicalLookup: nodeModulesPaths.length > 1,
  };
} else if (nodeModulesPaths.length > 0) {
  // Solo `apps/mobile/node_modules` (p. ej. build aislado / CI con install en la app)
  config.watchFolders = [];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths,
    disableHierarchicalLookup: false,
    blockList: [/^\/node_modules\/.*/],
  };
  if (!config.cacheStores) {
    config.cacheStores = [];
  }
} else {
  config.watchFolders = [];
  config.resolver = {
    ...config.resolver,
    nodeModulesPaths: [localNodeModules],
    disableHierarchicalLookup: false,
    blockList: [/^\/node_modules\/.*/],
  };
  if (!config.cacheStores) {
    config.cacheStores = [];
  }
}

module.exports = config;
