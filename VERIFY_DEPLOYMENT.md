# How to Verify Mobile App Deployment on Railway

## Quick Checklist

### 1. **Check Latest Commit in Railway**
- Go to Railway dashboard → Your mobile project → Deployments
- Look at the commit hash (e.g., `adfa86c9`)
- Compare with your local commits:
  ```bash
  git log --oneline -10
  ```
- The latest commit should be `14936bc` (fix: improve Metro patch script regex matching)

### 2. **Verify Build Configuration in Railway**

In Railway dashboard, check the **Build** section:

**Expected Build Command:**
```
export EXPO_PROJECT_ROOT=$(pwd) && export METRO_PROJECT_ROOT=$(pwd) && export NODE_PATH=$(pwd)/node_modules && node patch-metro.js && npx expo export --platform web --clear
```

**What to look for:**
- ✅ Should include `node patch-metro.js` (Metro patching script)
- ✅ Should include `--platform web` flag
- ✅ Should include `--clear` flag
- ❌ Should NOT just be `npm install && npx expo export`

### 3. **Check Build Logs**

In Railway → Build Logs, look for:

**✅ Good signs:**
- `✓ Patched Metro Transformer to fix path resolution` (from patch-metro.js)
- `Starting Metro Bundler` (should work without errors)
- `Exporting...` (Expo export should complete)
- `dist/` folder created with web files

**❌ Bad signs:**
- `ENOENT: no such file or directory, stat '/node_modules'` (Metro path error)
- `TypeError: Cannot read properties of undefined (reading 'transformFile')` (Metro error)
- Build command doesn't include `patch-metro.js`

### 4. **Verify Files Are Correct**

Check that these files exist in your repo:
```bash
# Check nixpacks.toml has the patch script
grep "patch-metro.js" apps/mobile/nixpacks.toml

# Check patch-metro.js exists
ls -la apps/mobile/patch-metro.js

# Check metro.config.js has empty watchFolders for Railway
grep -A 5 "Railway build context" apps/mobile/metro.config.js
```

### 5. **Check Railway Project Root**

In Railway dashboard → Settings → Root Directory:
- Should be: `/apps/mobile`
- NOT: `/` (root of monorepo)

### 6. **Verify Start Command**

In Railway → Deploy section:
- **Start Command:** `npx serve dist -l $PORT`
- **Healthcheck Path:** `/` (or `/index.html` if that's where your app is)

## Common Issues

### Issue: Railway shows old build command
**Solution:** 
1. Check if `nixpacks.toml` is in the correct location (`apps/mobile/nixpacks.toml`)
2. Verify Railway is reading from the correct root directory (`/apps/mobile`)
3. Try clearing Railway's build cache (Settings → Clear Build Cache)

### Issue: Commit hash doesn't match
**Solution:**
1. Make sure you've pushed all commits:
   ```bash
   git push origin servidor
   ```
2. Check if Railway is connected to the correct branch (`servidor`)
3. Verify the commit exists on GitHub

### Issue: Metro still failing
**Solution:**
1. Check build logs for `✓ Patched Metro Transformer` message
2. If missing, verify `patch-metro.js` is in the repo and `nixpacks.toml` calls it
3. Check that `metro.config.js` has `watchFolders = []` for Railway context

## Quick Verification Commands

```bash
# 1. Check latest local commit
git log --oneline -1

# 2. Check if patch script exists
ls apps/mobile/patch-metro.js

# 3. Verify nixpacks.toml includes patch
grep "patch-metro.js" apps/mobile/nixpacks.toml

# 4. Check what's in the latest commit
git show HEAD --stat

# 5. Compare with remote
git log origin/servidor --oneline -1
```
