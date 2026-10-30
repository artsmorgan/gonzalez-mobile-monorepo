# Troubleshooting Metro Build Issues on Railway

## Current Issue
Metro Bundler is trying to access `/node_modules` (absolute root path) causing build failures.

## Solutions Attempted

### 1. Postinstall Script (Current)
- **Location**: `apps/mobile/package.json` → `"postinstall": "node patch-metro.js || true"`
- **How it works**: Runs automatically after `npm install`
- **Status**: May not be working if Railway runs install differently

### 2. Metro Config
- **Location**: `apps/mobile/metro.config.js`
- **Changes**: Set `watchFolders = []` for Railway context
- **Status**: Not preventing the issue

### 3. Patch Script
- **Location**: `apps/mobile/patch-metro.js`
- **Purpose**: Patches Metro's Transformer.js to filter out absolute root paths
- **Status**: Needs verification in build logs

## What to Check in Build Logs

1. **Look for postinstall execution**:
   ```
   > gonzalez-mobile-app@1.0.0 postinstall
   > node patch-metro.js || true
   ```

2. **Look for patch success**:
   ```
   ✓ Patched Metro Transformer to fix path resolution
   ```

3. **If patch fails, look for**:
   ```
   ⚠ Could not patch Metro Transformer
   ```

4. **The actual error**:
   ```
   ENOENT: no such file or directory, stat '/node_modules'
   ```

## Alternative Solutions if Patching Fails

### Option 1: Use Metro's Resolver Config
Modify `metro.config.js` to completely override path resolution:
```javascript
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  disableHierarchicalLookup: true,
  // Add custom resolver
  resolveRequest: (context, moduleName, platform) => {
    // Custom resolution logic
  }
};
```

### Option 2: Use Expo's Webpack Instead of Metro
Change `app.json`:
```json
{
  "expo": {
    "web": {
      "bundler": "webpack"
    }
  }
}
```

### Option 3: Create Symlink (if permissions allow)
Add to build script:
```bash
mkdir -p /tmp/node_modules_fix
ln -sf $(pwd)/node_modules /tmp/node_modules_fix/node_modules || true
```

### Option 4: Downgrade Metro/React Native
If the issue is version-specific, try older versions that don't have this bug.

## Next Steps

1. **Check Railway Build Logs** for:
   - Postinstall script execution
   - Patch script output
   - Actual error messages

2. **Verify Railway Configuration**:
   - Root Directory: `/apps/mobile`
   - Build Command: Should be auto-detected or from `nixpacks.toml`
   - No UI overrides in Railway dashboard

3. **If still failing**, try Option 2 (Webpack bundler) as it doesn't use Metro.
