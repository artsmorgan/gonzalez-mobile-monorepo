module.exports = {
  expo: {
    name: "MonitoreApp",
    slug: "Gonzalez-Mobile-App",
    version: "1.0.0",
    platforms: [
      "android",
      "ios",
      "web"
    ],
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "monitoreapp",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.abrjpo98.MonitoreApp"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ],
      package: "com.abrjpo98.MonitoreApp"
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "./plugins/react-native-picker-fix.js"
      ],
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      "expo-font",
      "expo-web-browser",
      [
        "expo-camera",
        {
          cameraPermission: "La aplicación necesita acceso a la cámara para escanear códigos QR."
        }
      ],
      "expo-audio",
      "expo-video"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      // Use environment variable if available (Railway production)
      // Falls back to local development URL if not set
      API_SERVER: process.env.EXPO_PUBLIC_API_SERVER ||
        process.env.API_SERVER ||
        process.env.NEXT_PUBLIC_API_SERVER ||
        // https://api-gonzalez-mobile-monorepo-production.up.railway.app
        "https://api-gonzalez-mobile-monorepo-production.up.railway.app", // Local dev fallback
      MINUTES_LIFE_TIME_TOKEN: 15, // 15 minutes (default)
      APP_MODE: process.env.APP_MODE || process.env.NODE_ENV || "dev",
      router: {},
      eas: {
        projectId: "0e68d6d2-7653-4d13-a407-3823ff43722a"
      }
    }
  }
};
