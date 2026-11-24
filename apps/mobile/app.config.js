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
  "version": "1.0.8",
  "id": "369a0930-5c58-476b-a32a-05da2f8b441e",
  "name": "MonitoreApp",
  "created_at": "2026-11-24T00:00:00Z",
  "title": "Solicitudes de permiso y mutuos con nuevos filtros, jerarquía sin descargar y permisos de Guardify",
  "description": "Las solicitudes de permiso muestran también las que debes aprobar o rechazar y sus adjuntos al dueño, los filtros de fecha de permisos y mutuos acuerdos nacen vacíos, la jerarquía sin descargar ofrece ir a su módulo y completar con la marca actual, Mis puestos solo cuenta turnos laborales reales y la app avisa cuando falta un permiso.",
  "notas": [
    {
      "title": "Solicitud de permiso",
      "description": "El listado muestra tus solicitudes y también las que debes aprobar o rechazar por ser el ejecutivo de cuenta a cargo, aunque hoy no tengas una marca vigente ni trabajes en un puesto de ejecutivo. Los adjuntos (imagen, archivo, audio o video) ahora los puede ver quien pidió el permiso y no solo el ejecutivo. El filtro tiene dos rangos de fecha, uno para la fecha de creación y otro para la fecha de inicio del permiso, y los dos cargan vacíos: al abrir el módulo no se oculta ninguna solicitud."
    },
    {
      "title": "Mutuos acuerdos",
      "description": "El filtro tiene tres rangos de fecha: la fecha de creación, la fecha de inicio del primer turno y la fecha del segundo turno. Los tres cargan vacíos, así que al abrir el módulo se ven todos tus mutuos acuerdos y los que debes aprobar o rechazar."
    },
    {
      "title": "Mis puestos",
      "description": "La próxima fecha de cada puesto solo toma en cuenta los turnos laborales reales: no cuentan los días libres ni las marcas sin tipo de turno, hora de inicio u hora de fin. Un puesto que solo tiene días libres ya no aparece."
    },
    {
      "title": "Ubicación del puesto",
      "description": "Se quitó la sección «Mis puestos» de este módulo: ahora está solo en su propio módulo."
    },
    {
      "title": "Jerarquía sin descargar",
      "description": "Donde la app necesita elegir la jerarquía (menús de los módulos, filtros y formularios) y todavía no está descargada, muestra un botón «Descargar jerarquía» que, tras confirmar, te lleva al módulo Jerarquía. Aparece una sola vez en el filtro y una sola vez en el formulario. En los formularios que guardan datos, mientras no haya jerarquía se usan los de tu marca actual (puesto, plaza, sucursal, etc.) y la pantalla te lo avisa. Con la jerarquía descargada todo funciona como siempre."
    },
    {
      "title": "Permisos y avisos de Guardify",
      "description": "Si tu equipo usa Guardify, las pantallas del menú se muestran según tu rol y los permisos que Guardify te asignó, y el servidor también los exige al guardar. Si falta un permiso, la app lo dice con «No tienes permiso para realizar esta acción» sin cerrar tu sesión, y lo que quedó pendiente sin conexión no se reintenta sin parar. También se muestra el mensaje «Tu administrador está intentando comunicarse contigo» cuando el administrador lo envía. Una versión sin Guardify que no pueda registrar el equipo lo dice con claridad: «Esta versión no puede registrar el equipo»."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.7",
  "id": "f48fb718-61f0-493e-94f3-8987eb3384de",
  "name": "MonitoreApp",
  "created_at": "2026-11-24T00:00:00Z",
  "title": "Solicitudes de permiso y mutuos con nuevos filtros, jerarquía sin descargar y permisos de Guardify",
  "description": "Las solicitudes de permiso muestran también las que debes aprobar o rechazar y sus adjuntos al dueño, los filtros de fecha de permisos y mutuos acuerdos nacen vacíos, la jerarquía sin descargar ofrece ir a su módulo y completar con la marca actual, Mis puestos solo cuenta turnos laborales reales y la app avisa cuando falta un permiso.",
  "notas": [
    {
      "title": "Solicitud de permiso",
      "description": "El listado muestra tus solicitudes y también las que debes aprobar o rechazar por ser el ejecutivo de cuenta a cargo, aunque hoy no tengas una marca vigente ni trabajes en un puesto de ejecutivo. Los adjuntos (imagen, archivo, audio o video) ahora los puede ver quien pidió el permiso y no solo el ejecutivo. El filtro tiene dos rangos de fecha, uno para la fecha de creación y otro para la fecha de inicio del permiso, y los dos cargan vacíos: al abrir el módulo no se oculta ninguna solicitud."
    },
    {
      "title": "Mutuos acuerdos",
      "description": "El filtro tiene tres rangos de fecha: la fecha de creación, la fecha de inicio del primer turno y la fecha del segundo turno. Los tres cargan vacíos, así que al abrir el módulo se ven todos tus mutuos acuerdos y los que debes aprobar o rechazar."
    },
    {
      "title": "Mis puestos",
      "description": "La próxima fecha de cada puesto solo toma en cuenta los turnos laborales reales: no cuentan los días libres ni las marcas sin tipo de turno, hora de inicio u hora de fin. Un puesto que solo tiene días libres ya no aparece."
    },
    {
      "title": "Ubicación del puesto",
      "description": "Se quitó la sección «Mis puestos» de este módulo: ahora está solo en su propio módulo."
    },
    {
      "title": "Jerarquía sin descargar",
      "description": "Donde la app necesita elegir la jerarquía (menús de los módulos, filtros y formularios) y todavía no está descargada, muestra un botón «Descargar jerarquía» que, tras confirmar, te lleva al módulo Jerarquía. Aparece una sola vez en el filtro y una sola vez en el formulario. En los formularios que guardan datos, mientras no haya jerarquía se usan los de tu marca actual (puesto, plaza, sucursal, etc.) y la pantalla te lo avisa. Con la jerarquía descargada todo funciona como siempre."
    },
    {
      "title": "Permisos y avisos de Guardify",
      "description": "Si tu equipo usa Guardify, las pantallas del menú se muestran según tu rol y los permisos que Guardify te asignó, y el servidor también los exige al guardar. Si falta un permiso, la app lo dice con «No tienes permiso para realizar esta acción» sin cerrar tu sesión, y lo que quedó pendiente sin conexión no se reintenta sin parar. También se muestra el mensaje «Tu administrador está intentando comunicarse contigo» cuando el administrador lo envía. Una versión sin Guardify que no pueda registrar el equipo lo dice con claridad: «Esta versión no puede registrar el equipo»."
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
         * Guardify (registro de equipos, órdenes y catálogo de APK) está APAGADO por defecto: ninguna build lo trae encendido, ni con URL ni con
         * código de empresa, salvo que su perfil de EAS lo pida (hoy solo `guardify-pruebas`). Así una build de producción hecha desde esta rama
         * no puede salir apuntando a Guardify ni a un cliente fijo. Para encenderlo: `EXPO_PUBLIC_GUARDIFY_ENABLED=true` y
         * `EXPO_PUBLIC_GUARDIFY_URL` en el perfil, y recompilar (ver docs/guardify/compilar-apk-pruebas.md).
         */
        GUARDIFY_ENABLED: process.env.EXPO_PUBLIC_GUARDIFY_ENABLED || process.env.GUARDIFY_ENABLED || "true",
        /** Sin valor por defecto: la URL de Guardify (staging o producción) se define en el perfil de EAS. */
        GUARDIFY_URL: process.env.EXPO_PUBLIC_GUARDIFY_URL || process.env.GUARDIFY_URL || "https://guardifyconsole-production.up.railway.app",
        /** Cada cuántos segundos manda el equipo su latido (batería y ubicación con permiso). Vacío = 300 (5 min); mínimo 30. */
        GUARDIFY_HEARTBEAT_SECONDS: process.env.EXPO_PUBLIC_GUARDIFY_HEARTBEAT_SECONDS || process.env.GUARDIFY_HEARTBEAT_SECONDS || 60,
        GUARDIFY_APP_KEY: process.env.EXPO_PUBLIC_GUARDIFY_APP_KEY || process.env.GUARDIFY_APP_KEY || "monitoreapp",
        /**
         * Código de empresa embebido. Sin valor por defecto: la app es multicliente; si el perfil no lo trae, la persona lo escribe al registrar
         * el equipo (pantalla de registro de Guardify).
         */
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