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
        "https://barrett-nondelirious-denisha.ngrok-free.dev", // Local dev fallback
      APP_VERSION_INFO: {
        "version": "1.0.0",
        "id": "34cd939c-893f-4a98-9279-d76c82cbca3c",
        "name": "MonitoreApp",
        "created_at": "2026-03-18T00:00:00Z",
        "title": "MonitoreApp versión inicial",
        "description": "Versión inicial de la aplicación MonitoreApp",
        "notas": [
          "Módulo de navegación principal y menú lateral para acceso a todas las funciones.",
          "Módulo de operación diaria: asistencia, control de presencia, minutas físicas y mutuos acuerdos.",
          "Módulo de seguridad y calidad: gestión de incidentes, matrices de riesgo, no conformidades y acciones de mejora.",
          "Módulo de recursos: gestión de vehículos, llaves, equipos de mantenimiento y documentos entregados.",
          "Módulo de personas: visitas, rutas, capacitaciones, evaluaciones de personal y encuestas de satisfacción."
        ]
      },
      MINUTES_LIFE_TIME_TOKEN: 15, // 15 minutes (default)
      APP_MODE: process.env.APP_MODE || process.env.NODE_ENV || "dev",
      router: {},
      eas: {
        projectId: "0e68d6d2-7653-4d13-a407-3823ff43722a"
      }
    }
  }
};
