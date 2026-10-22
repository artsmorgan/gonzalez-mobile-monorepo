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
  "version": "1.0.2",
  "id": "9e045449-0841-48be-b1e1-47e85e99e0a0",
  "name": "MonitoreApp",
  "created_at": "2026-10-16T00:00:00Z",
  "title": "Corrección de horas en las marcas de asistencia",
  "description": "Corrige el cálculo de las horas de inicio y fin del turno y la selección de la marca cuando hay horarios en conflicto.",
  "notas": [
    {
      "title": "Marcas de asistencia",
      "description": "Corrección del cálculo de la hora de inicio y de fin del turno: dependía de la zona horaria del dispositivo y sumaba un día al inicio en los turnos anteriores a las 06:00, lo que bloqueaba el ingreso. Ahora se calcula como hora de reloj de Costa Rica, comparable con la hora de referencia de la aplicación. Además, cuando dos marcas del mismo empleado se traslapan en horario, se prioriza la de reemplazo y, en su defecto, la de inicio más temprano (a igual inicio, la de menor id)."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.1",
  "id": "43e3b21b-7091-415b-9e4a-78fadb696fbd",
  "name": "MonitoreApp",
  "created_at": "2026-10-16T00:00:00Z",
  "title": "Reportes en modalidad tabular, actualización de listas, quices de documentos y corrección de horas en marcas",
  "description": "Incorpora la modalidad tabular en los reportes, la actualización de las listas de los módulos mediante gesto de deslizamiento, la edición de preguntas y la visualización de calificaciones en el módulo de documentos, y la corrección del cálculo de horas en las marcas de asistencia.",
  "notas": [
    {
      "title": "Reportes",
      "description": "Incorporación de la modalidad tabular (consolidada) en los reportes: una fila por registro, con los datos del registro repetidos en cada fila derivada y los valores múltiples concatenados con «;»."
    },
    {
      "title": "Listas de módulos",
      "description": "Actualización de las listas mediante el gesto de deslizamiento (pull-to-refresh) al inicio de la lista: reejecuta la consulta vigente con los filtros aplicados, estén o no visibles, y respeta el estado de conectividad (consulta remota o caché local)."
    },
    {
      "title": "Documentos",
      "description": "Edición de las preguntas durante la creación del quiz, además de su alta y eliminación, y visualización de la calificación (0-100) de cada empleado en los quices revisados, calculada a partir de sus respuestas."
    },
    {
      "title": "Marcas de asistencia",
      "description": "Corrección del cálculo de la hora de inicio y de fin del turno: dependía de la zona horaria del dispositivo y sumaba un día al inicio en los turnos anteriores a las 06:00, lo que bloqueaba el ingreso. Ahora se calcula como hora de reloj de Costa Rica, comparable con la hora de referencia de la aplicación. Además, cuando dos marcas del mismo empleado se traslapan en horario, se prioriza la de reemplazo y, en su defecto, la de inicio más temprano (a igual inicio, la de menor id)."
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
          // prod https://gonzalez-mobile-app-production.up.railway.app
          "https://endless-rec-latter-done.trycloudflare.com",
        /** Debe coincidir con `MOBILE_ACCESS_TOKEN` del servidor (query en `/api/main-structure`). */
        MOBILE_ACCESS_TOKEN:
          process.env.EXPO_PUBLIC_MOBILE_ACCESS_TOKEN ||
          process.env.MOBILE_ACCESS_TOKEN ||
          "",
        /** Guardify (registro de equipos, órdenes y catálogo de APK). Sin URL la integración queda apagada. */
        GUARDIFY_URL: process.env.EXPO_PUBLIC_GUARDIFY_URL || process.env.GUARDIFY_URL || "https://falls-gamecube-rendering-program.trycloudflare.com",
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