const { execSync } = require("child_process");

/** Últimos 4 caracteres del commit actual (o EXPO_PUBLIC_GIT_COMMIT en CI). */
function getGitCommitLast4() {
  try {
    const fromEnv = String(process.env.EXPO_PUBLIC_GIT_COMMIT || process.env.GIT_COMMIT || "").trim();
    if (fromEnv) return fromEnv.slice(-4).toLowerCase();
    const hash = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return hash.slice(-4).toLowerCase();
  } catch {
    return "----";
  }
}

/**
 * Información de versión que muestra la app (notas de versión y comparación con la última publicada).
 * Cada variante tiene su propia numeración: lite (entorno de pruebas) y prod (producción).
 * Debe coincidir con la entrada de `apps/server/mobile_versions_test.json` (lite) o `mobile_versions_prod.json` (prod).
 */
const APP_VERSION_INFO_LITE = {
  "version": "1.0.7",
  "id": "2f2dbe94-6fa6-4e48-b7c8-fdcbc75ec977",
  "name": "MonitoreApp",
  "created_at": "2026-11-18T00:00:00Z",
  "title": "Mis puestos, mapa flotante con elección de aplicación, permisos y mutuos acuerdos por turnos, y mensajes claros al marcar",
  "description": "Se agrega el módulo Mis puestos y el mapa del puesto en una ventana flotante con Google Maps, Waze u otra aplicación; las solicitudes de permiso ya no piden plaza, los mutuos acuerdos permiten elegir los turnos, y Marcar maneja días libres, marcas incompletas y los mensajes de Planillas.",
  "notas": [
    {
      "title": "Ubicación del puesto en una ventana flotante",
      "description": "El mapa del puesto se abre en una ventana propia, con tu ubicación actual, para moverlo y acercarlo sin chocar con el desplazamiento de la pantalla. El botón «Cómo llegar» permite elegir con qué aplicación abrirlo: Google Maps, Waze u otra aplicación de mapas del teléfono."
    },
    {
      "title": "Mis puestos",
      "description": "Nuevo módulo «Mis puestos», disponible para todos los roles y tipos de usuario, con o sin marca. Muestra los puestos donde tienes turnos de hoy en adelante, cada uno con su mapa y la ruta para llegar."
    },
    {
      "title": "Marcar ingreso y salida: días libres y marcas incompletas",
      "description": "Si un día trae varias marcas, se toma la que tiene tipo de turno y horario; si ninguna los tiene, el día se muestra como libre (en el turno actual, el siguiente turno y los turnos futuros). Una marca sin hora de inicio o de fin muestra solo la fecha, sin horas inventadas y sin mensaje de tardía."
    },
    {
      "title": "Mensajes de Planillas al marcar",
      "description": "Si Planillas no permite marcar la entrada o la salida (por ejemplo, en un día libre o sin turno asignado), la aplicación muestra el mensaje que Planillas envía en lugar de un error genérico."
    },
    {
      "title": "Banner con la versión instalada",
      "description": "El banner superior de la versión de pruebas muestra el número de versión (por ejemplo, Versión de prueba - 1.0.7) en lugar de los caracteres del repositorio; el de producción muestra Versión y su número."
    },
    {
      "title": "Solicitud de permiso",
      "description": "Ya no hace falta elegir una plaza: solo se indican las fechas. Al buscar los turnos se revalida la contraseña de Planillas si es necesario, el botón muestra una animación de carga y la lista incluye el código del puesto y descarta los turnos sin tipo ni horario."
    },
    {
      "title": "Mutuos acuerdos",
      "description": "Ahora se elige qué turno de cada empleado se intercambia. Cada turno indica si es propio o de reemplazo, con una advertencia al elegir uno de reemplazo. No aparecen los turnos sin datos ni los propios que hoy cubre otra persona, y la lista muestra el código del puesto."
    },
    {
      "title": "Notificaciones",
      "description": "Una persona sin turno ya no recibe un error al abrir las notificaciones: se muestran las propias."
    },
    {
      "title": "Reportes de actividades",
      "description": "El reporte de actividades incluye las columnas «Horario diurno», «Horario mixto» y «Horario nocturno» (Sí o No). Los reportes de mutuos acuerdos, permisos, control de asistencia y acciones personales muestran el tipo de turno con su nombre y las fechas de los mutuos como DD-MM-AAAA."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.6",
  "id": "c0fb0a43-8fcc-4d6c-a61e-ac5687c0c230",
  "name": "MonitoreApp",
  "created_at": "2026-11-18T00:00:00Z",
  "title": "Mis puestos, mapa flotante con elección de aplicación, permisos y mutuos acuerdos por turnos, y mensajes claros al marcar",
  "description": "Se agrega el módulo Mis puestos y el mapa del puesto en una ventana flotante con Google Maps, Waze u otra aplicación; las solicitudes de permiso ya no piden plaza, los mutuos acuerdos permiten elegir los turnos, y Marcar maneja días libres, marcas incompletas y los mensajes de Planillas.",
  "notas": [
    {
      "title": "Ubicación del puesto en una ventana flotante",
      "description": "El mapa del puesto se abre en una ventana propia, con tu ubicación actual, para moverlo y acercarlo sin chocar con el desplazamiento de la pantalla. El botón «Cómo llegar» permite elegir con qué aplicación abrirlo: Google Maps, Waze u otra aplicación de mapas del teléfono."
    },
    {
      "title": "Mis puestos",
      "description": "Nuevo módulo «Mis puestos», disponible para todos los roles y tipos de usuario, con o sin marca. Muestra los puestos donde tienes turnos de hoy en adelante, cada uno con su mapa y la ruta para llegar."
    },
    {
      "title": "Marcar ingreso y salida: días libres y marcas incompletas",
      "description": "Si un día trae varias marcas, se toma la que tiene tipo de turno y horario; si ninguna los tiene, el día se muestra como libre (en el turno actual, el siguiente turno y los turnos futuros). Una marca sin hora de inicio o de fin muestra solo la fecha, sin horas inventadas y sin mensaje de tardía."
    },
    {
      "title": "Mensajes de Planillas al marcar",
      "description": "Si Planillas no permite marcar la entrada o la salida (por ejemplo, en un día libre o sin turno asignado), la aplicación muestra el mensaje que Planillas envía en lugar de un error genérico."
    },
    {
      "title": "Banner con la versión instalada",
      "description": "El banner superior de la versión de pruebas muestra el número de versión (por ejemplo, Versión de prueba - 1.0.7) en lugar de los caracteres del repositorio; el de producción muestra Versión y su número."
    },
    {
      "title": "Solicitud de permiso",
      "description": "Ya no hace falta elegir una plaza: solo se indican las fechas. Al buscar los turnos se revalida la contraseña de Planillas si es necesario, el botón muestra una animación de carga y la lista incluye el código del puesto y descarta los turnos sin tipo ni horario."
    },
    {
      "title": "Mutuos acuerdos",
      "description": "Ahora se elige qué turno de cada empleado se intercambia. Cada turno indica si es propio o de reemplazo, con una advertencia al elegir uno de reemplazo. No aparecen los turnos sin datos ni los propios que hoy cubre otra persona, y la lista muestra el código del puesto."
    },
    {
      "title": "Notificaciones",
      "description": "Una persona sin turno ya no recibe un error al abrir las notificaciones: se muestran las propias."
    },
    {
      "title": "Reportes de actividades",
      "description": "El reporte de actividades incluye las columnas «Horario diurno», «Horario mixto» y «Horario nocturno» (Sí o No). Los reportes de mutuos acuerdos, permisos, control de asistencia y acciones personales muestran el tipo de turno con su nombre y las fechas de los mutuos como DD-MM-AAAA."
    }
  ]
};

module.exports = ({ config }) => {

  /** Lite por defecto si no se define APP_VARIANT (prebuild local, EAS preview-lite, etc.). */
  const variant = process.env.APP_VARIANT ?? "lite"; // "lite" | "full" | "prod"
  const APPLICATION_ID_BY_VARIANT = {
    lite: "com.abrjpo98.MonitoreApp.lite",
    full: "com.abrjpo98.MonitoreApp.full",
    prod: "com.abrjpo98.MonitoreApp.prod",
  };
  const applicationId = APPLICATION_ID_BY_VARIANT[variant] || APPLICATION_ID_BY_VARIANT.lite;
  const APP_VERSION_INFO = variant === "lite" ? APP_VERSION_INFO_LITE : APP_VERSION_INFO_PROD;
  const gitCommitLast4 = getGitCommitLast4();

  return {
      expo: {
      /** Nombre visible bajo el ícono: "MonitoreApp (Test)" en lite y "MonitoreApp" en prod/full (en Android lo fija el recurso app_name de cada flavor). */
      name: variant === "lite" ? "MntrApp (Test)" : "MonitoreApp",
      slug: "Gonzalez-Mobile-App",
      version: APP_VERSION_INFO.version,
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
        bundleIdentifier: applicationId
      },
      android: {
        googleServicesFile: "./google-services.json",
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true,
        permissions: [
          "android.permission.CAMERA",
          "android.permission.RECORD_AUDIO",
          "android.permission.MODIFY_AUDIO_SETTINGS",
          "android.permission.POST_NOTIFICATIONS",
          "android.permission.RECEIVE_BOOT_COMPLETED",
          "android.permission.VIBRATE",
          "android.permission.REQUEST_INSTALL_PACKAGES"
        ],
        package: applicationId
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
        [
          "./plugins/withAndroidAppVariants.js"
        ],
        "expo-router",
        [
          "expo-notifications",
          {
            icon: "./assets/images/notification-icon.png",
            defaultChannel: "general",
          },
        ],
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
        "expo-video",
        // Permisos que la app no usa y exclusión de backups (issues #177 y #180): sobrevive a `expo prebuild`.
        "./plugins/withAndroidSecurityPolicy.js",
        // APK por arquitectura en vez de uno universal de ~130 MB (issue #179).
        "./plugins/withAndroidAbiSplits.js",
        [
          "./plugins/withAndroidAppVariantsFinalize.js"
        ]
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
          // test https://api-gonzalez-mobile-monorepo-production.up.railway.app
          // prod https://gonzalez-mobile-server-production.up.railway.app
          "https://api-gonzalez-mobile-monorepo-production.up.railway.app",
        /** Debe coincidir con `MOBILE_ACCESS_TOKEN` del servidor (query en `/api/main-structure`). */
        MOBILE_ACCESS_TOKEN:
          process.env.EXPO_PUBLIC_MOBILE_ACCESS_TOKEN ||
          process.env.MOBILE_ACCESS_TOKEN ||
          "",
        /**
         * Guardify (registro de equipos, órdenes y catálogo de APK) está BLOQUEADO por defecto: aunque haya URL, la app no lo usa mientras este interruptor
         * no sea "true". El código se conserva; para reactivarlo: `EXPO_PUBLIC_GUARDIFY_ENABLED=true` y `EXPO_PUBLIC_GUARDIFY_URL`, y recompilar.
         */
        GUARDIFY_ENABLED: process.env.EXPO_PUBLIC_GUARDIFY_ENABLED || process.env.GUARDIFY_ENABLED || "true",
        /** Sin valor por defecto: una URL de túnel temporal no debe quedar embebida en ninguna build. Se define en el perfil de EAS (ver docs/guardify/compilar-apk-pruebas.md). */
        GUARDIFY_URL: process.env.EXPO_PUBLIC_GUARDIFY_URL || process.env.GUARDIFY_URL || "https://guardifyconsole-production.up.railway.app",
        /** Cada cuántos segundos manda el equipo su latido (batería y ubicación con permiso). Vacío = 300 (5 min); mínimo 30. */
        GUARDIFY_HEARTBEAT_SECONDS: process.env.EXPO_PUBLIC_GUARDIFY_HEARTBEAT_SECONDS || process.env.GUARDIFY_HEARTBEAT_SECONDS || 60,
        GUARDIFY_APP_KEY: process.env.EXPO_PUBLIC_GUARDIFY_APP_KEY || process.env.GUARDIFY_APP_KEY || "monitoreapp",
        /** Código de empresa embebido (producción). En lite/full se deja vacío y se escribe al registrar el equipo. */
        GUARDIFY_COMPANY_CODE: process.env.EXPO_PUBLIC_GUARDIFY_COMPANY_CODE || process.env.GUARDIFY_COMPANY_CODE || "corporacion-gonzalez",
        /** Variante con la que se evaluó esta configuración (la app usa la real, del paquete nativo: ver hooks/appVariant.ts). */
        APP_VARIANT: variant,
        /** Información de versión de la build según el entorno de construcción. */
        APP_VERSION_INFO,
        /** Información de versión por variante: la app elige la de su paquete nativo, aunque esta configuración se haya evaluado con otra. */
        APP_VERSION_INFO_BY_VARIANT: { lite: APP_VERSION_INFO_LITE, full: APP_VERSION_INFO_PROD, prod: APP_VERSION_INFO_PROD },
        MINUTES_LIFE_TIME_TOKEN: 24 * 60, // 24 hours (default)
        APP_MODE: process.env.APP_MODE || process.env.NODE_ENV || "dev",
        GIT_COMMIT_LAST4: gitCommitLast4,
        router: {},
        eas: {
          projectId: "0e68d6d2-7653-4d13-a407-3823ff43722a"
        }
      }
    }
  }
};