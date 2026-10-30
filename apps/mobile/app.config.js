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
  "version": "1.0.4",
  "id": "2934cfc9-344a-4c84-94e3-32b184c56bdd",
  "name": "MonitoreApp",
  "created_at": "2026-10-30T00:00:00Z",
  "title": "Colas por usuario, edición de documentos, plazos de red y sesión protegida, importación de Excel acotada y mejoras en permisos y alimentación",
  "description": "Cada usuario conserva sus acciones pendientes sin que otro empleado las vea, los documentos se pueden editar desde la app, las peticiones lentas fallan con un mensaje en vez de quedar cargando, la importación de Excel tiene límites, y se corrigen las fechas del permiso, el contador de alimentación y el botón de regreso.",
  "notas": [
    {
      "title": "Acciones pendientes por usuario",
      "description": "Las acciones guardadas sin conexión ahora pertenecen al usuario que las creó: otro empleado que use el mismo teléfono no las ve, no las envía ni las borra, y se sincronizan con la sesión de su dueño cuando vuelve a conectarse. Las de quien no se conecta en más de 2 semanas se eliminan junto con sus archivos adjuntos. El token de Planillas ya no se guarda dentro de las acciones pendientes."
    },
    {
      "title": "Edición de documentos",
      "description": "Los roles distintos de operativo ven el botón «Editar» en el módulo de documentos: permite cambiar los datos, reemplazar el archivo y editar las preguntas del quiz, y avisa antes de elegir «Nueva versión». Los archivos se pueden previsualizar y la versión del documento es visible. Requiere conexión."
    },
    {
      "title": "Respuestas lentas y errores del servidor",
      "description": "Las peticiones ya no dejan la pantalla cargando indefinidamente: fallan con un mensaje a los 20, 30 o 120 segundos según su tipo, y las consultas y los envíos seguros se reintentan una vez. Un envío repetido por una respuesta perdida no crea una marca duplicada."
    },
    {
      "title": "Sesión y permisos",
      "description": "Si una operación no está permitida para el usuario, la app muestra «no tienes permiso» sin cerrar la sesión. Una falla de red tampoco cierra la sesión, y si un administrador la cierra, la app lo avisa y vuelve al inicio."
    },
    {
      "title": "Importación de Excel",
      "description": "Los archivos de más de 5 MB se rechazan al instante, y una celda de más de 2.000 caracteres se reporta como error de su fila con el número. Si se sale de la pantalla o se elige otro archivo mientras se lee, no aparecen mensajes del primero."
    },
    {
      "title": "Jerarquía sin conexión",
      "description": "La jerarquía descargada se valida antes de reemplazar la anterior: si la descarga falla, llega incompleta o la app se cierra mientras se actualiza, se conserva la versión anterior y sigue disponible sin conexión."
    },
    {
      "title": "Solicitud de permiso",
      "description": "La fecha y la hora de fin ya no pueden quedar antes de las de inicio: al elegir una fecha al revés, la otra se ajusta automáticamente."
    },
    {
      "title": "Tiempo de alimentación",
      "description": "Con conexión, el contador toma los minutos del horario del puesto y se actualiza al deslizar hacia abajo si aún no ha iniciado. Se quitaron los botones de editar y reiniciar, iniciar pide confirmación la primera vez, y el tiempo siempre se muestra en una sola línea."
    },
    {
      "title": "Marcar ingreso y salida",
      "description": "La flecha de regreso lleva a la pantalla de inicio al entrar directo a esta pantalla tras iniciar sesión. Una salida que ya estaba marcada muestra el aviso de marca repetida en lugar de un error genérico."
    },
    {
      "title": "Instalación y actualización",
      "description": "El APK se genera por arquitectura del teléfono (mucho más liviano) y «Actualizar» descarga el que corresponde. La app consulta si hay una versión nueva cada 30 minutos, no cada minuto. Se piden solo los permisos necesarios, al usarlos, y ya no se incluyen en las copias de seguridad de Android los datos de la sesión."
    }
  ]
};

const APP_VERSION_INFO_PROD = {
  "version": "1.0.3",
  "id": "297945a8-5f04-4f79-97b9-a3dfeb06678c",
  "name": "MonitoreApp",
  "created_at": "2026-10-30T00:00:00Z",
  "title": "Colas por usuario, edición de documentos, plazos de red y sesión protegida, importación de Excel acotada y mejoras en permisos y alimentación",
  "description": "Cada usuario conserva sus acciones pendientes sin que otro empleado las vea, los documentos se pueden editar desde la app, las peticiones lentas fallan con un mensaje en vez de quedar cargando, la importación de Excel tiene límites, y se corrigen las fechas del permiso, el contador de alimentación y el botón de regreso.",
  "notas": [
    {
      "title": "Acciones pendientes por usuario",
      "description": "Las acciones guardadas sin conexión ahora pertenecen al usuario que las creó: otro empleado que use el mismo teléfono no las ve, no las envía ni las borra, y se sincronizan con la sesión de su dueño cuando vuelve a conectarse. Las de quien no se conecta en más de 2 semanas se eliminan junto con sus archivos adjuntos. El token de Planillas ya no se guarda dentro de las acciones pendientes."
    },
    {
      "title": "Edición de documentos",
      "description": "Los roles distintos de operativo ven el botón «Editar» en el módulo de documentos: permite cambiar los datos, reemplazar el archivo y editar las preguntas del quiz, y avisa antes de elegir «Nueva versión». Los archivos se pueden previsualizar y la versión del documento es visible. Requiere conexión."
    },
    {
      "title": "Respuestas lentas y errores del servidor",
      "description": "Las peticiones ya no dejan la pantalla cargando indefinidamente: fallan con un mensaje a los 20, 30 o 120 segundos según su tipo, y las consultas y los envíos seguros se reintentan una vez. Un envío repetido por una respuesta perdida no crea una marca duplicada."
    },
    {
      "title": "Sesión y permisos",
      "description": "Si una operación no está permitida para el usuario, la app muestra «no tienes permiso» sin cerrar la sesión. Una falla de red tampoco cierra la sesión, y si un administrador la cierra, la app lo avisa y vuelve al inicio."
    },
    {
      "title": "Importación de Excel",
      "description": "Los archivos de más de 5 MB se rechazan al instante, y una celda de más de 2.000 caracteres se reporta como error de su fila con el número. Si se sale de la pantalla o se elige otro archivo mientras se lee, no aparecen mensajes del primero."
    },
    {
      "title": "Jerarquía sin conexión",
      "description": "La jerarquía descargada se valida antes de reemplazar la anterior: si la descarga falla, llega incompleta o la app se cierra mientras se actualiza, se conserva la versión anterior y sigue disponible sin conexión."
    },
    {
      "title": "Solicitud de permiso",
      "description": "La fecha y la hora de fin ya no pueden quedar antes de las de inicio: al elegir una fecha al revés, la otra se ajusta automáticamente."
    },
    {
      "title": "Tiempo de alimentación",
      "description": "Con conexión, el contador toma los minutos del horario del puesto y se actualiza al deslizar hacia abajo si aún no ha iniciado. Se quitaron los botones de editar y reiniciar, iniciar pide confirmación la primera vez, y el tiempo siempre se muestra en una sola línea."
    },
    {
      "title": "Marcar ingreso y salida",
      "description": "La flecha de regreso lleva a la pantalla de inicio al entrar directo a esta pantalla tras iniciar sesión. Una salida que ya estaba marcada muestra el aviso de marca repetida en lugar de un error genérico."
    },
    {
      "title": "Instalación y actualización",
      "description": "El APK se genera por arquitectura del teléfono (mucho más liviano) y «Actualizar» descarga el que corresponde. La app consulta si hay una versión nueva cada 30 minutos, no cada minuto. Se piden solo los permisos necesarios, al usarlos, y ya no se incluyen en las copias de seguridad de Android los datos de la sesión."
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