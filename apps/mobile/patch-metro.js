#!/usr/bin/env node
// Patch Metro's Transformer to prevent checking absolute root paths
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const metroTransformerPath = path.join(projectRoot, 'node_modules/metro/src/DeltaBundler/Transformer.js');

if (!fs.existsSync(metroTransformerPath)) {
  console.log('⚠ Metro Transformer not found at:', metroTransformerPath);
  console.log('  This is normal if Metro hasn\'t been installed yet.');
  process.exit(0); // Don't fail if Metro isn't found yet
}

let content = fs.readFileSync(metroTransformerPath, 'utf8');
const originalContent = content;

// Patch verifyRootExists - use a more flexible approach
// Look for the function and replace the entire function body
if (content.includes('verifyRootExists')) {
  // Try to find and replace the function using multiple patterns
  const patterns = [
    // Pattern 1: function verifyRootExists(roots) { ... }
    /function\s+verifyRootExists\s*\([^)]*\)\s*\{[^}]*roots[^}]*forEach[^}]*statSync[^}]*\}/s,
    // Pattern 2: More flexible - match from function to closing brace
    /function\s+verifyRootExists\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/,
  ];
  
  const patchedVerify = `function verifyRootExists(roots) {
  if (!roots || roots.length === 0) return;
  
  // Filter out absolute root paths that don't start with project root
  const projectRoot = ${JSON.stringify(projectRoot)};
  const filteredRoots = roots.filter(root => {
    if (!root) return false;
    try {
      const normalized = path.normalize(root);
      // Only allow paths that are within the project root or relative
      return normalized.startsWith(projectRoot) || !normalized.startsWith('/');
    } catch (e) {
      return false;
    }
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
  
  let patched = false;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, patchedVerify);
      patched = true;
      break;
    }
  }
  
  // If pattern matching didn't work, try a simpler approach: replace the statSync call
  if (!patched && content.includes('statSync')) {
    // Replace any statSync call that references '/node_modules' or absolute paths
    content = content.replace(
      /fs\.statSync\([^)]*\)/g,
      (match) => {
        // If it's checking an absolute root path, wrap it in a try-catch that ignores it
        if (match.includes("'/node_modules'") || match.includes('"/node_modules"')) {
          return `(function() { try { ${match} } catch(e) { /* Ignore absolute root paths */ } })()`;
        }
        return match;
      }
    );
    patched = true;
  }
  
  if (patched && content !== originalContent) {
    fs.writeFileSync(metroTransformerPath, content);
    console.log('✓ Patched Metro Transformer to fix path resolution');
  } else {
    console.log('⚠ Could not patch Metro Transformer - function structure may have changed');
    console.log('  Attempting to continue anyway...');
  }
} else {
  console.log('⚠ verifyRootExists function not found in Metro Transformer');
  console.log('  Metro version may be different than expected');
}
