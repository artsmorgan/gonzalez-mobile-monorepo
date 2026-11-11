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
  "version": "1.0.6",
  "id": "246b7e64-e980-416b-82dc-382668ab24f1",
  "name": "MonitoreApp",
  "created_at": "2026-11-10T00:00:00Z",
  "title": "Versión en el inicio de sesión, ubicación del puesto con Waze, Mis puestos y actividades con varios tipos de turno",
  "description": "El inicio de sesión muestra la versión y permite descargar la última, Marcar ingreso y salida estrena estilo y ubicación del puesto con mapa y Waze, se agrega Mis puestos y las actividades pueden aplicar a varios tipos de turno.",
  "notas": [
    {
      "title": "Versión y actualización en el inicio de sesión",
      "description": "La pantalla de inicio de sesión muestra la versión de la aplicación, busca sola si hay una versión nueva y permite buscarla con un botón. Si la hay, muestra sus notas y permite descargar el instalador sin iniciar sesión. Si el servidor exige otra versión, la aplicación lo avisa con un mensaje claro."
    },
    {
      "title": "Banner con la versión en producción",
      "description": "En la versión de producción se muestra un banner fijo en la parte superior con el número de versión instalada (por ejemplo, Versión 1.0.5). La versión de pruebas conserva su banner de prueba."
    },
    {
      "title": "Marcar ingreso y salida: nuevo estilo",
      "description": "La fecha y hora actual, el estado y las fechas y horas de entrada y de salida se muestran con el mismo estilo que el empleado y el puesto. Los mensajes aparecen debajo del estado, el botón de ingreso es verde y las fechas se ven como DD-MM-AAAA."
    },
    {
      "title": "Turnos futuros",
      "description": "Un día con un solo turno libre muestra «Tienes libre este día» en lugar de un turno sin hora, y cada tarjeta de turno incluye su fecha."
    },
    {
      "title": "Ubicación del puesto con mapa y Waze",
      "description": "En Marcar ingreso y salida, debajo de los botones, y en las tarjetas de turnos futuros hay un botón «Mostrar ubicación del puesto» que muestra las coordenadas del puesto, un mapa con tu ubicación actual y un botón para llegar con Waze."
    },
    {
      "title": "Mis puestos",
      "description": "El módulo Ubicación del puesto incluye la sección «Mis puestos». Con conexión a internet muestra los puestos de tus turnos de hoy en adelante; cada uno se abre para ver su mapa con tu ubicación y llegar con Waze si el puesto tiene coordenadas."
    },
    {
      "title": "Actividades con varios tipos de turno",
      "description": "Al crear o editar una actividad se pueden seleccionar varios tipos de turno (Diurno, Mixto y Nocturno) con casillas; la actividad aplica a los turnos seleccionados."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.5",
  "id": "2f46c3a0-616d-4512-a49e-d7b13ac33603",
  "name": "MonitoreApp",
  "created_at": "2026-11-10T00:00:00Z",
  "title": "Versión en el inicio de sesión, ubicación del puesto con Waze, Mis puestos y actividades con varios tipos de turno",
  "description": "El inicio de sesión muestra la versión y permite descargar la última, Marcar ingreso y salida estrena estilo y ubicación del puesto con mapa y Waze, se agrega Mis puestos y las actividades pueden aplicar a varios tipos de turno.",
  "notas": [
    {
      "title": "Versión y actualización en el inicio de sesión",
      "description": "La pantalla de inicio de sesión muestra la versión de la aplicación, busca sola si hay una versión nueva y permite buscarla con un botón. Si la hay, muestra sus notas y permite descargar el instalador sin iniciar sesión. Si el servidor exige otra versión, la aplicación lo avisa con un mensaje claro."
    },
    {
      "title": "Banner con la versión en producción",
      "description": "En la versión de producción se muestra un banner fijo en la parte superior con el número de versión instalada (por ejemplo, Versión 1.0.5). La versión de pruebas conserva su banner de prueba."
    },
    {
      "title": "Marcar ingreso y salida: nuevo estilo",
      "description": "La fecha y hora actual, el estado y las fechas y horas de entrada y de salida se muestran con el mismo estilo que el empleado y el puesto. Los mensajes aparecen debajo del estado, el botón de ingreso es verde y las fechas se ven como DD-MM-AAAA."
    },
    {
      "title": "Turnos futuros",
      "description": "Un día con un solo turno libre muestra «Tienes libre este día» en lugar de un turno sin hora, y cada tarjeta de turno incluye su fecha."
    },
    {
      "title": "Ubicación del puesto con mapa y Waze",
      "description": "En Marcar ingreso y salida, debajo de los botones, y en las tarjetas de turnos futuros hay un botón «Mostrar ubicación del puesto» que muestra las coordenadas del puesto, un mapa con tu ubicación actual y un botón para llegar con Waze."
    },
    {
      "title": "Mis puestos",
      "description": "El módulo Ubicación del puesto incluye la sección «Mis puestos». Con conexión a internet muestra los puestos de tus turnos de hoy en adelante; cada uno se abre para ver su mapa con tu ubicación y llegar con Waze si el puesto tiene coordenadas."
    },
    {
      "title": "Actividades con varios tipos de turno",
      "description": "Al crear o editar una actividad se pueden seleccionar varios tipos de turno (Diurno, Mixto y Nocturno) con casillas; la actividad aplica a los turnos seleccionados."
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
        GUARDIFY_ENABLED: process.env.EXPO_PUBLIC_GUARDIFY_ENABLED || process.env.GUARDIFY_ENABLED || "false",
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