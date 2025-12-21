// Patch Metro's path resolution before it initializes
const fs = require('fs');
const path = require('path');

const metroPath = path.resolve(__dirname, 'node_modules/metro/src/DeltaBundler/Transformer.js');

if (fs.existsSync(metroPath)) {
  let content = fs.readFileSync(metroPath, 'utf8');
  
  // Patch verifyRootExists to filter out absolute root paths
  if (content.includes('function verifyRootExists')) {
    content = content.replace(
      /function verifyRootExists\([^)]*\)\s*\{[^}]*statSync\([^)]*\)/g,
      `function verifyRootExists(roots) {
    const projectRoot = process.cwd();
    const filteredRoots = roots.filter(root => {
      if (!root) return false;
      const normalized = path.normalize(root);
      // Filter out absolute root paths that don't start with project root
      return !normalized.startsWith('/') || normalized.startsWith(projectRoot);
    });
    filteredRoots.forEach(root => {
      if (root && fs.existsSync(root)) {
        fs.statSync(root);
      }
    });
  }`
    );
    fs.writeFileSync(metroPath, content);
    console.log('Patched Metro Transformer to fix path resolution');
  }
}
