# Setting Up API Server Environment Variable in Railway

## Overview
The mobile app uses `API_SERVER` from `app.config.js` which reads from environment variables.

## Step 1: Add Environment Variable in Railway

1. Go to **Railway Dashboard** → Your Mobile Project (`APP-gonzalez-mobile-monorepo`)
2. Click **Variables** tab
3. Click **+ New Variable**
4. Add the following:
   - **Name**: `EXPO_PUBLIC_API_SERVER`
   - **Value**: `https://api-gonzalez-mobile-monorepo-production.up.railway.app`
   - **Scope**: Select the environment (Production/Preview)
5. Click **Add**

## Alternative Variable Names

The app.config.js supports multiple variable names (in order of precedence):
1. `EXPO_PUBLIC_API_SERVER` (recommended - Expo public variable)
2. `API_SERVER` (fallback)
3. Default: `https://598ab127822b.ngrok-free.app` (development fallback)

## Step 2: Verify the Variable

After adding the variable:
1. Railway will automatically trigger a new deployment
2. The variable will be available during the build process
3. `app.config.js` will read it and inject it into `expo.extra.API_SERVER`

## Step 3: How It Works

- **Build Time**: Railway sets `EXPO_PUBLIC_API_SERVER` environment variable
- **app.config.js**: Reads `process.env.EXPO_PUBLIC_API_SERVER`
- **App Code**: Accesses via `Constants.expoConfig?.extra?.API_SERVER`

## Code Usage

In your React Native code, the API URL is accessed like this:

```typescript
import Constants from 'expo-constants';

const apiUrl = Constants.expoConfig?.extra?.API_SERVER;
// Will be: https://api-gonzalez-mobile-monorepo-production.up.railway.app
```

## Multiple Environments

You can set different values for different environments:
- **Production**: `https://api-gonzalez-mobile-monorepo-production.up.railway.app`
- **Preview/Staging**: Different URL if needed
- **Development**: Falls back to ngrok URL in code

## Important Notes

1. **EXPO_PUBLIC_ prefix**: Variables prefixed with `EXPO_PUBLIC_` are exposed to the client-side code
2. **Build-time**: The variable is read at build time, not runtime
3. **Redeploy**: After adding/changing the variable, Railway will automatically redeploy
4. **HTTPS**: Make sure to use `https://` in the URL

## Troubleshooting

If the API URL is not updating:
1. Check Railway Variables tab - ensure variable is set correctly
2. Check build logs - look for environment variable usage
3. Verify `app.config.js` is being used (not `app.json`)
4. Clear Railway build cache if needed
