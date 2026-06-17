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
      package: "com.abrjpo98.MonitoreApp.soft"
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
      ], [
        "expo-file-system",
        {
          "supportsOpeningDocumentsInPlace": true,
          "enableFileSharing": true
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
        "https://api-gonzalez-mobile-monorepo-production.up.railway.app",
      APP_VERSION_INFO: {
        "version": "1.0.0",
        "id": "34cd939c-893f-4a98-9279-d76c82cbca3c",
        "name": "MonitoreApp",
        "created_at": "2026-06-12T00:00:00Z",
        "title": "Asistencia, manuales y ubicación de puesto",
        "description": "Mejoras en marcación de ingreso/salida, tiempo de almuerzo, manuales de trabajo y actualización de coordenadas del puesto.",
        "notas": [
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Marcar entrada y salida con validación de horario (mínimo 15 minutos antes del inicio o durante el turno)."
          },
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Validación de ubicación GPS en radio de 50 m del puesto para marcar entrada, con reintento manual y sondeo automático cada 30 s."
          },
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Uso de última ubicación conocida como respaldo; aviso al usuario solo al marcar entrada o al reintentar la comprobación GPS."
          },
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Consulta de turnos futuros (próximos 30 días) con empresa, cliente, contrato, corpo, puesto y tipo de turno."
          },
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Información laboral de la marca actual, motivo de ausencia, salida temprana con razón y reversión de salida."
          },
          {
            "title": "Marcar Ingreso/Salida",
            "description": "Registro offline de marcas y sincronización al recuperar conexión; configuración del tiempo de almuerzo al marcar entrada."
          },
          {
            "title": "Tiempo de almuerzo",
            "description": "Temporizador con cuenta regresiva, registro de pausas con motivo y finalización automática al terminar el tiempo."
          },
          {
            "title": "Tiempo de almuerzo",
            "description": "Registro manual de almuerzo: hora de inicio, pausas y validación del tiempo efectivo frente a los minutos disponibles."
          },
          {
            "title": "Tiempo de almuerzo",
            "description": "Configuración manual de minutos cuando no existe una duración válida en la marca."
          },
          {
            "title": "Tiempo de almuerzo",
            "description": "Firma digital del empleado al iniciar el temporizador, con aviso si se usa ubicación en caché."
          },
          {
            "title": "Tiempo de almuerzo",
            "description": "El temporizador continúa en segundo plano y el registro se sincroniza al volver a tener conexión."
          },
          {
            "title": "Manuales de trabajo",
            "description": "Consulta y registro de manuales asociados al puesto, con archivos adjuntos (documento, imagen, audio y video)."
          },
          {
            "title": "Manuales de trabajo",
            "description": "Filtros por jerarquía (cliente, contrato, sucursal y puesto) para supervisores y administrativos; el operativo ve los manuales de su marca activa."
          },
          {
            "title": "Manuales de trabajo",
            "description": "Firma digital del responsable al crear manuales y registro de lectura con firma del empleado y cuestionario de comprensión."
          },
          {
            "title": "Manuales de trabajo",
            "description": "Creación y consulta offline con sincronización al recuperar conexión; escaneo QR para vincular manuales a puestos."
          },
          {
            "title": "Ubicación del puesto",
            "description": "Selección del puesto por jerarquía (cliente, contrato, sucursal y puesto), con precarga desde la marca activa."
          },
          {
            "title": "Ubicación del puesto",
            "description": "Visualización de las coordenadas actuales del puesto y de la ubicación del dispositivo, con actualización automática cada 15 segundos."
          },
          {
            "title": "Ubicación del puesto",
            "description": "Actualización de coordenadas GPS del puesto desde la ubicación del dispositivo o ingreso manual de latitud y longitud."
          },
          {
            "title": "Ubicación del puesto",
            "description": "Reintento manual de obtención de GPS y persistencia local de ubicaciones para uso sin conexión."
          }
        ]
      },
      MINUTES_LIFE_TIME_TOKEN: 24 * 60, // 24 hours (default)
      APP_MODE: process.env.APP_MODE || process.env.NODE_ENV || "dev",
      router: {},
      eas: {
        projectId: "0e68d6d2-7653-4d13-a407-3823ff43722a"
      }
    }
  }
};
