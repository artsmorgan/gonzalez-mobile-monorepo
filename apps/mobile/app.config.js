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

module.exports = ({ config }) => {

  const variant = process.env.APP_VARIANT;
  const isLite = variant === "lite";
  const gitCommitLast4 = getGitCommitLast4();

  return {
      expo: {
      name: isLite ? "MonitoreApp Lite" : "MonitoreApp",
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
        bundleIdentifier: isLite
          ? "com.abrjpo98.MonitoreApp.lite"
          : "com.abrjpo98.MonitoreApp.full"
      },
      android: {
        googleServicesFile: isLite ? "./google-services-lite.json" : "./google-services-full.json",
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
        package: isLite ? "com.abrjpo98.MonitoreApp.lite" : "com.abrjpo98.MonitoreApp.full"
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
          "expo-notifications",
          {
            icon: "./assets/images/icon.png",
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
          "https://nonresonantly-captivative-shizue.ngrok-free.dev",
        /** Debe coincidir con `MOBILE_ACCESS_TOKEN` del servidor (query en `/api/main-structure`). */
        MOBILE_ACCESS_TOKEN:
          process.env.EXPO_PUBLIC_MOBILE_ACCESS_TOKEN ||
          process.env.MOBILE_ACCESS_TOKEN ||
          "",
        APP_VERSION_INFO: {
          "version": "1.0.0",
          "id": "a7e2c41f-6b8d-4f19-9e53-2c0d8f1a5b67",
          "name": "MonitoreApp",
          "created_at": "2026-07-30T00:00:00Z",
          "title": "Planillas, permisos, mutuos y sincronización",
          "description": "Integración con Planillas para turnos y marcas, validación de conflictos en permisos y mutuos acuerdos, mejoras en actividades, entrega de puestos y archivos de acciones.",
          "notas": [
            {
              "title": "Actividades",
              "description": "Marcar y gestionar actividades del turno con foto, frecuencia/horario y sincronización offline."
            },
            {
              "title": "Actividades",
              "description": "Revisión de equipo/inventario por actividad y acceso a entrega de puestos cuando el módulo está visible."
            },
            {
              "title": "Checklist de Supervisión",
              "description": "Evaluación por división/puesto con ítems dinámicos, fotos y firmas de supervisor/responsable."
            },
            {
              "title": "Checklist de Supervisión",
              "description": "Uso offline con cola local y actualización de estado de artículos y cachés relacionadas."
            },
            {
              "title": "Mi Firma Digital",
              "description": "QR de firma con ubicación GPS y firma manual dibujada/guardada en el perfil."
            },
            {
              "title": "Mi Firma Digital",
              "description": "Escaneo de firma QR desde Inicio para validar identidad en otros módulos."
            },
            {
              "title": "Entrega de Puestos",
              "description": "Acta de entrega/recibo del turno con firmas, fotos de entrega y recepción, e inventario del puesto."
            },
            {
              "title": "Entrega de Puestos",
              "description": "Al confirmar, actualiza la revisión de equipo en actividades y el último mantenimiento en jerarquía."
            },
            {
              "title": "Inicio",
              "description": "Accesos rápidos (marca, escanear firma, jerarquía), hora de acción y ubicación del dispositivo."
            },
            {
              "title": "Inicio",
              "description": "Modal de sincronizaciones pendientes, notas de versión y aviso cuando hay actualización disponible."
            },
            {
              "title": "Jerarquía",
              "description": "Navegación de la estructura empresa → cliente → división → contrato → sucursal → puesto → plaza → empleado."
            },
            {
              "title": "Jerarquía",
              "description": "Descarga de fragmentos de main-structure con conexión y consulta offline."
            },
            {
              "title": "Tiempo de alimentación",
              "description": "Temporizador con pausas, firma del empleado y registro offline (continúa en segundo plano)."
            },
            {
              "title": "Tiempo de alimentación",
              "description": "Configuración de minutos del almuerzo en el horario de la marca con token de Planillas y cola de sincronización."
            },
            {
              "title": "Equipo del puesto",
              "description": "Consulta de artículos del puesto, mantenimientos, adjuntos y movimientos, con sync offline."
            },
            {
              "title": "Equipo del puesto",
              "description": "Descarga unificada de documentos adjuntos y carga masiva/plantilla para perfiles administrativos."
            },
            {
              "title": "Marcar Ingreso/Salida",
              "description": "Entrada/salida con validación de horario, GPS (radio 50 m) y token de Planillas; cola offline de asistencia."
            },
            {
              "title": "Marcar Ingreso/Salida",
              "description": "Consulta de turnos futuros vía Planillas (30 días) y enriquecimiento desde c_marca_dia."
            },
            {
              "title": "Marcar Ingreso/Salida",
              "description": "Ausencia, salida temprana, reversión de salida y sincronización al recuperar conexión con renovación del token si expiró."
            },
            {
              "title": "Mutuos acuerdos",
              "description": "Intercambio de turnos: marcas por empleado/fecha vía Planillas, firmas, adjuntos y renovación del token con contraseña."
            },
            {
              "title": "Mutuos acuerdos",
              "description": "Bloqueo al crear si hay conflicto de fechas con permisos u otros mutuos pendientes/aprobados (ausente y reemplazo)."
            },
            {
              "title": "Solicitud de permiso",
              "description": "Solicitud por plaza y rango de fechas con turnos obtenidos vía Planillas, firmas y archivos adjuntos."
            },
            {
              "title": "Solicitud de permiso",
              "description": "Validación de solape con otros permisos o mutuos acuerdos pendientes/aprobados del mismo empleado."
            },
            {
              "title": "Perfil de Usuario",
              "description": "Consulta de datos personales y laborales (nombre, cédula, código, email, teléfono y fecha de contratación)."
            },
            {
              "title": "Ubicación del puesto",
              "description": "Selección por jerarquía (precarga desde marca) y comparación de coordenadas del puesto vs GPS del dispositivo."
            },
            {
              "title": "Ubicación del puesto",
              "description": "Actualización de coordenadas (GPS o manual) con persistencia y sincronización offline."
            },
            {
              "title": "Archivos de acciones",
              "description": "Listado de acciones personales pendientes de adjunto (cliente, sucursal, puesto, tipo y vencimiento)."
            },
            {
              "title": "Archivos de acciones",
              "description": "Subida de imagen, audio, video o documento con caché local y cola offline de archivos de acciones."
            }
          ]
        },
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