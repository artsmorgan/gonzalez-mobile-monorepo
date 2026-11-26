# Fix Railway Picking Wrong Commits

## Problem
Railway is deploying commits like `070bab3f` or `5eee58dc` that don't exist in your local `servidor` branch.

## Current State
- **Latest Local Commit**: `6df0484` (docs: add troubleshooting guide)
- **Latest Remote Commit**: `6df0484` (synced)
- **Branch**: `servidor`

## How to Fix in Railway Dashboard

### Step 1: Verify Repository Connection
1. Go to Railway Dashboard → Your Mobile Project (`APP-gonzalez-mobile-monorepo`)
2. Click **Settings** → **Source**
3. Verify:
   - **Repository**: `artsmorgan/gonzalez-mobile-monorepo`
   - **Branch**: `servidor` (NOT `main` or `master`)
   - **Root Directory**: `/apps/mobile`

### Step 2: Check Branch Settings
If the branch is wrong:
1. Click **Change** next to the branch
2. Select `servidor` branch
3. Save changes

### Step 3: Clear Build Cache
1. Go to **Settings** → **Build**
2. Click **Clear Build Cache**
3. This forces Railway to fetch fresh code

### Step 4: Trigger Manual Deployment
1. Go to **Deployments** tab
2. Click **Deploy** or **Redeploy**
3. Select the latest commit (`6df0484`)

### Step 5: Verify Latest Commit
After deployment starts, check:
- The commit hash should be `6df0484` or newer
- The commit message should match your latest commits

## Alternative: Force Push (if needed)

If Railway is still stuck on old commits:

```bash
# Make a small change to force a new commit
echo "# Railway sync check" >> apps/mobile/.railway-sync
git add apps/mobile/.railway-sync
git commit -m "chore: force Railway sync"
git push origin servidor
```

## Check Railway is Using Correct Project

Make sure you're looking at the **mobile** project, not the server project:
- **Mobile Project**: `APP-gonzalez-mobile-monorepo` (should deploy from `/apps/mobile`)
- **Server Project**: Different project name (deploys from `/apps/server`)

## Verify in Railway Logs

After triggering a new deployment, check the build logs:
1. Look for: `fetched snapshot sha256:...`
2. The commit hash in the logs should match `6df0484`
3. If it shows a different commit, Railway is still using cached/old code

## If Still Not Working

1. **Disconnect and Reconnect** the GitHub repository in Railway
2. **Delete and Recreate** the Railway project (last resort)
3. **Check GitHub** to ensure `servidor` branch exists and has your commits
