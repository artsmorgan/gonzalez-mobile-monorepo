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
  "version": "1.0.5",
  "id": "1a737a9f-f083-4119-99ff-6a19d920763b",
  "name": "MonitoreApp",
  "created_at": "2026-11-04T00:00:00Z",
  "title": "Nuevo diseño de Marcar ingreso y salida, siguiente turno sin conexión y avisos unificados",
  "description": "Se rediseña la pantalla de marcas con la información laboral por códigos, se guarda el siguiente turno para verlo sin conexión, todos los avisos y errores comparten estilo y se avisa cuando un turno no tiene datos para marcar.",
  "notas": [
    {
      "title": "Marcar ingreso y salida: nuevo diseño",
      "description": "La pantalla se reorganizó: fecha y hora actuales en un recuadro, empleado y puesto con su código, y la información laboral en una sección plegable (cerrada por defecto) que muestra el código o número de cada nivel de la jerarquía y el horario del turno. Los mensajes quedan arriba del estado, y el estado de ingreso o salida se ve sin títulos intermedios."
    },
    {
      "title": "Avisos y errores con un solo estilo",
      "description": "Todos los avisos y errores de la pantalla de marcas (minutos previos, tardía, día libre, salida anticipada, ubicación y errores de carga) usan ahora la misma caja y tipografía, y solo cambia el color según su tipo. El botón «Reintentar» ocupa todo el ancho."
    },
    {
      "title": "Siguiente turno sin conexión",
      "description": "La app guarda el siguiente turno laboral (sin contar los días libres) para consultarlo sin conexión desde «Ver turnos futuros», que ahora abre directamente en ese turno. La lista de los próximos 30 días solo se consulta cuando el usuario la pide y lo confirma. Cada usuario ve únicamente su propio turno guardado, aunque comparta el teléfono."
    },
    {
      "title": "Información laboral con códigos",
      "description": "Se muestran el código de la división, el número de contrato y el número de sucursal en lugar de sus identificadores, y se ocultan los identificadores del cliente, el rol y el horario. El cambio es solo visual; los datos internos no cambian. El tipo de turno se lee como Diurno, Mixto, Nocturno o Libre (Indeterminable si es otro)."
    },
    {
      "title": "Turno sin datos",
      "description": "Si el turno obtenido no tiene hora de inicio ni tipo de turno, la app muestra «Imposible marcar entrada, contacta a tu administrador o supervisor para que revise el caso correspondiente» y no permite marcar."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.4",
  "id": "8701c495-132c-4121-8ea3-a05562062979",
  "name": "MonitoreApp",
  "created_at": "2026-11-04T00:00:00Z",
  "title": "Nuevo diseño de Marcar ingreso y salida, siguiente turno sin conexión y avisos unificados",
  "description": "Se rediseña la pantalla de marcas con la información laboral por códigos, se guarda el siguiente turno para verlo sin conexión, todos los avisos y errores comparten estilo y se avisa cuando un turno no tiene datos para marcar.",
  "notas": [
    {
      "title": "Marcar ingreso y salida: nuevo diseño",
      "description": "La pantalla se reorganizó: fecha y hora actuales en un recuadro, empleado y puesto con su código, y la información laboral en una sección plegable (cerrada por defecto) que muestra el código o número de cada nivel de la jerarquía y el horario del turno. Los mensajes quedan arriba del estado, y el estado de ingreso o salida se ve sin títulos intermedios."
    },
    {
      "title": "Avisos y errores con un solo estilo",
      "description": "Todos los avisos y errores de la pantalla de marcas (minutos previos, tardía, día libre, salida anticipada, ubicación y errores de carga) usan ahora la misma caja y tipografía, y solo cambia el color según su tipo. El botón «Reintentar» ocupa todo el ancho."
    },
    {
      "title": "Siguiente turno sin conexión",
      "description": "La app guarda el siguiente turno laboral (sin contar los días libres) para consultarlo sin conexión desde «Ver turnos futuros», que ahora abre directamente en ese turno. La lista de los próximos 30 días solo se consulta cuando el usuario la pide y lo confirma. Cada usuario ve únicamente su propio turno guardado, aunque comparta el teléfono."
    },
    {
      "title": "Información laboral con códigos",
      "description": "Se muestran el código de la división, el número de contrato y el número de sucursal en lugar de sus identificadores, y se ocultan los identificadores del cliente, el rol y el horario. El cambio es solo visual; los datos internos no cambian. El tipo de turno se lee como Diurno, Mixto, Nocturno o Libre (Indeterminable si es otro)."
    },
    {
      "title": "Turno sin datos",
      "description": "Si el turno obtenido no tiene hora de inicio ni tipo de turno, la app muestra «Imposible marcar entrada, contacta a tu administrador o supervisor para que revise el caso correspondiente» y no permite marcar."
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