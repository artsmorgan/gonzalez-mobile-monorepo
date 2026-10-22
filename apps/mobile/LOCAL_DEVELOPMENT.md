# Local Development Setup

## API Server Configuration

The app supports both local development and Railway production environments.

### Default Behavior (No Configuration Needed)

By default, the app uses the ngrok URL for local development:
- **API_SERVER**: `https://598ab127822b.ngrok-free.app`

This works out of the box - just run:
```bash
npm start
# or
expo start
```

### Option 1: Use Local Server

If you're running the server locally (e.g., `http://localhost:3000`):

1. Create a `.env.local` file in `apps/mobile/`:
```bash
EXPO_PUBLIC_API_SERVER=http://localhost:3000
```

2. Restart Expo:
```bash
expo start --clear
```

### Option 2: Use Different API URL

If you need a different API URL (e.g., different ngrok tunnel):

1. Create a `.env.local` file:
```bash
EXPO_PUBLIC_API_SERVER=https://your-api-url.com
```

2. Restart Expo:
```bash
expo start --clear
```

### Option 3: Use Environment Variable (Terminal)

Set the variable before starting Expo:

```bash
export EXPO_PUBLIC_API_SERVER=http://localhost:3000
expo start
```

Or in one line:
```bash
EXPO_PUBLIC_API_SERVER=http://localhost:3000 expo start
```

## Railway Production

In Railway, the `EXPO_PUBLIC_API_SERVER` environment variable is automatically set during build, so no local configuration is needed.

## How It Works

1. **Railway**: Reads `EXPO_PUBLIC_API_SERVER` from Railway Variables
2. **Local with .env.local**: Reads from `.env.local` file (if exists)
3. **Local default**: Falls back to ngrok URL in `app.config.js`

## Verifying the API URL

In your app code, you can check which API is being used:

```typescript
import Constants from 'expo-constants';

console.log('API Server:', Constants.expoConfig?.extra?.API_SERVER);
```

## Notes

- `.env.local` is gitignored, so it won't be committed
- Changes to `.env.local` require restarting Expo
- The `EXPO_PUBLIC_` prefix is required for Expo to expose the variable to client code
