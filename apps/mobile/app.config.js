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
  "version": "1.0.3",
  "id": "b1b7b720-814a-4ac3-89de-d2619b41d9c4",
  "name": "MonitoreApp",
  "created_at": "2026-10-22T00:00:00Z",
  "title": "Versionado de documentos, evidencia de cada acción, almuerzo manual corregido y nuevos campos",
  "description": "Los documentos tienen versiones y se entregan al marcar ingreso, cada acción guarda su dispositivo, ubicación y hora (también sin conexión), el almuerzo manual guarda las horas escritas y se agregan campos al acta de entrega, a los vehículos y a inducción y recorrido.",
  "notas": [
    {
      "title": "Documentos",
      "description": "Los documentos tienen versiones: al publicar una versión nueva se conservan las anteriores con sus firmas y el empleado firma la nueva. Al marcar el ingreso se entregan automáticamente los documentos pendientes de su puesto, incluido quien entra después. La nota del quiz queda guardada como dato consolidado y no cambia si el quiz se edita."
    },
    {
      "title": "Evidencia de cada acción",
      "description": "Cada alta o edición guarda el dispositivo, la ubicación y la hora de la acción. Si se hizo sin conexión se conserva la ubicación y la hora del momento en que se hizo, no las de la sincronización. Si el permiso de ubicación se niega, el registro se guarda igual y queda marcado."
    },
    {
      "title": "Tiempo de alimentación",
      "description": "El registro manual guarda la hora de inicio y de fin que se escribieron (antes se desplazaban 6 horas). Además se corrigió un duplicado que podía crearse al sincronizar un almuerzo hecho sin conexión."
    },
    {
      "title": "Marcas y turnos",
      "description": "Un turno sin cerrar deja de contar pasadas unas horas desde su salida (configurable en Nomencladores, 4 horas por defecto) y no se ofrecen acciones de ese turno vencido. Con marcas traslapadas por un cambio de guardia, la entrada ya no cierra como «salida anticipada» una marca que se traslapa."
    },
    {
      "title": "Acta de entrega de productos",
      "description": "Cada acta lleva un consecutivo por empresa (0001, 0002…), que también se asigna al sincronizar un acta hecha sin conexión."
    },
    {
      "title": "Vehículos corporativos",
      "description": "El registro y la revisión admiten el VIN o chasis y el número o dato del título de propiedad, la RTV y el marchamo (todos opcionales)."
    },
    {
      "title": "Inducción y recorrido",
      "description": "Nuevo campo opcional «Tipo de capacitación» (Presencial o Virtual), visible en la lista y al editar."
    },
    {
      "title": "Seguridad de la sesión",
      "description": "La sesión y los datos del empleado se guardan en el almacenamiento seguro del teléfono. Al actualizar, la sesión abierta se conserva."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.2",
  "id": "f72ef0b2-274f-45ba-bad7-7ce71d141b13",
  "name": "MonitoreApp",
  "created_at": "2026-10-22T00:00:00Z",
  "title": "Versionado de documentos, evidencia de cada acción, almuerzo manual corregido y nuevos campos",
  "description": "Los documentos tienen versiones y se entregan al marcar ingreso, cada acción guarda su dispositivo, ubicación y hora (también sin conexión), el almuerzo manual guarda las horas escritas y se agregan campos al acta de entrega, a los vehículos y a inducción y recorrido.",
  "notas": [
    {
      "title": "Documentos",
      "description": "Los documentos tienen versiones: al publicar una versión nueva se conservan las anteriores con sus firmas y el empleado firma la nueva. Al marcar el ingreso se entregan automáticamente los documentos pendientes de su puesto, incluido quien entra después. La nota del quiz queda guardada como dato consolidado y no cambia si el quiz se edita."
    },
    {
      "title": "Evidencia de cada acción",
      "description": "Cada alta o edición guarda el dispositivo, la ubicación y la hora de la acción. Si se hizo sin conexión se conserva la ubicación y la hora del momento en que se hizo, no las de la sincronización. Si el permiso de ubicación se niega, el registro se guarda igual y queda marcado."
    },
    {
      "title": "Tiempo de alimentación",
      "description": "El registro manual guarda la hora de inicio y de fin que se escribieron (antes se desplazaban 6 horas). Además se corrigió un duplicado que podía crearse al sincronizar un almuerzo hecho sin conexión."
    },
    {
      "title": "Marcas y turnos",
      "description": "Un turno sin cerrar deja de contar pasadas unas horas desde su salida (configurable en Nomencladores, 4 horas por defecto) y no se ofrecen acciones de ese turno vencido. Con marcas traslapadas por un cambio de guardia, la entrada ya no cierra como «salida anticipada» una marca que se traslapa."
    },
    {
      "title": "Acta de entrega de productos",
      "description": "Cada acta lleva un consecutivo por empresa (0001, 0002…), que también se asigna al sincronizar un acta hecha sin conexión."
    },
    {
      "title": "Vehículos corporativos",
      "description": "El registro y la revisión admiten el VIN o chasis y el número o dato del título de propiedad, la RTV y el marchamo (todos opcionales)."
    },
    {
      "title": "Inducción y recorrido",
      "description": "Nuevo campo opcional «Tipo de capacitación» (Presencial o Virtual), visible en la lista y al editar."
    },
    {
      "title": "Seguridad de la sesión",
      "description": "La sesión y los datos del empleado se guardan en el almacenamiento seguro del teléfono. Al actualizar, la sesión abierta se conserva."
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