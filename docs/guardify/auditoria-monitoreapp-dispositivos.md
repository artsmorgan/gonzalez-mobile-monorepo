# Auditoría de MonitoreApp: qué falta para aprobar o rechazar sus dispositivos desde Guardify

Estado: **auditoría de código, sin cambios ejecutados** · 2026-10-19 · Repo auditado: `gonzalez-mobile-monorepo` (rama `deploy/guardify-reports`, commit `a8d91de`) y Guardify `main`.

## 1. Respuesta corta

**Guardify ya está listo; MonitoreApp no tiene nada de esto todavía.** Hoy MonitoreApp solo habla con Guardify para los **reportes** (`apps/server/app/api/guardify/*`). La app móvil no sabe que existe Guardify: no pide código de empresa, no registra el equipo y no consulta su estado. Para que un dispositivo con MonitoreApp quede «pendiente» y un administrador lo apruebe o rechace en la consola, hacen falta **tres cosas**:

1. **La app móvil** registra el equipo con Guardify antes del login y respeta el estado (pendiente, aprobado, rechazado, bloqueado, retirado). Requiere una **versión nueva de la app** (módulo nativo de almacenamiento seguro).
2. **El servidor de MonitoreApp** rechaza las peticiones de equipos no aprobados. Es un solo punto de cambio (`verifyAccessTokenByApi`).
3. **Una migración ordenada** de los equipos que ya están en campo, porque una app antigua no sabe registrarse y quedaría bloqueada.

Lo que el equipo de MonitoreApp tiene que construir está acotado: la parte pesada (registro, aprobación, comandos, revocación, cupo, SDK) **ya existe en Guardify**.

## 2. Qué ya existe en Guardify (verificado en el código)

| Pieza | Dónde | Qué hace |
|---|---|---|
| Registro del equipo | `POST /api/v1/devices/register` | Recibe `code` (código de empresa `corporacion-gonzalez` + `appKey`, o un código de registro), `deviceUid`, plataforma, modelo, SO, versión. Crea el dispositivo **pendiente**, o activo si hay regla de auto-aprobación. Devuelve la credencial del equipo al aprobarse. |
| Aprobar / rechazar / bloquear / retirar | Consola → Dispositivos (`/api/tenant/devices/:id/:action`) | Permisos `dispositivos:aprobar`, `:bloquear`, `:retirar`; alcance por sucursal; motivo de rechazo; cupo por plan (50 por defecto); auditoría. |
| Estados | `PENDING · ACTIVE · BLOCKED · RETIRED · REJECTED` | El SDK los traduce a pantallas (`unregistered`, `pending`, `rejected`, `blocked`, `retired`, `locked`, `operational`). |
| SDK de dispositivo | `packages/sdk` (`GuardifyDevice`) | Sin dependencias de plataforma: recibe `fetch`, almacenamiento y reloj. Maneja registro, espera de aprobación, latidos, comandos (`LOGOUT_ALL`, `LOGOUT_USER`, `FORCE_UPDATE`, `PING`, `WIPE`), política sin conexión y reloj monótono. |
| Verificación en el servidor de la app | `@guardify/sdk/server` (`createVerifier`, JWKS) y `GET /api/v1/revocations` | El servidor de la app valida tokens de Guardify y consulta qué dispositivos y sesiones dejaron de estar activos. |
| Opciones | `deviceQuota`, `autoApprove`, `requireAttestation` por instalación; códigos de registro de un solo uso o permanentes por sucursal | Sirven para la migración (sección 6). |

## 3. Estado actual de MonitoreApp (hallazgos)

### App móvil (`apps/mobile`, Expo 54 / React Native 0.81)
- **Sin registro de dispositivo.** No hay pantalla de código de empresa; el arranque va directo al login (`contexts/AuthContext.tsx`). No existe ninguna llamada a `/api/v1/devices/*`.
- **Identidad del equipo débil.** Solo envía `deviceName = marca-modelo` (`AuthContext.tsx:173,467`), que **no es único**. No hay identificador de instalación. `expo-crypto` ya está instalado, así que se puede generar un UUID propio.
- **Almacenamiento sin cifrar.** Tokens, roles y datos del empleado van en `AsyncStorage`; **no hay `expo-secure-store`**. El SDK necesita un almacén seguro para guardar la credencial del equipo → **módulo nativo nuevo → nueva compilación y nueva versión** (no basta una actualización OTA).
- **Ya hay una buena base:** `expo-device`, `expo-notifications` con token FCM (`hooks/pushNotificationsService.ts`) y `expo-network`.
- **Un solo punto de salida de red:** `hooks/authedFetch.ts` (89 archivos lo usan). Ante 401/403 cierra la sesión de inmediato. Sirve para aplicar un bloqueo en caliente, pero **un 403 manda al login**, y el login hoy no sabe explicar «tu dispositivo no está aprobado».
- **Sin conexión:** la app es offline-first y hoy no tiene límite de tiempo sin conexión; no hay política de gracia.
- **Variantes de compilación:** Android `lite`, `full` y `prod` (`app.config.js`, `eas.json`). Hay que decidir si el código de empresa va fijo en la variante `prod` (recomendado) o se escribe.
- **Distribución y versionado:** la app se instala como **APK** y se actualiza desde la propia app: la pantalla de inicio descarga `MonitoreApp-<versión>.apk` desde `/api/mobile-versions/<versión>` (`mobile_versions.json` + `APP_LAST_VERSION`). No hay actualización obligatoria: cada persona decide cuándo instalar. Esto hace **más lenta y menos controlable la migración** de los equipos ya instalados (sección 6).

### Servidor (`apps/server`, Next.js 15)
- **Punto único de verificación:** `utils/verifyAccessTokenByApi.ts` se llama en ~680 sitios de ~210 rutas. Hace una petición a `/api/dynamic-prisma` para validar el JWT. **Es el lugar correcto para exigir que el dispositivo esté aprobado.**
- **Login** (`app/api/auth/login/route.ts`) valida contra Planillas y emite JWT propios (`JWT_SECRET`). No lleva ningún dato del dispositivo en el token.
- **La tabla `refresh_token` (campo `device`) vive en el esquema principal**, es decir, en la base de Planillas (del tercero). **No debe usarse para guardar el estado de aprobación**: ese estado vive en Guardify.
- **CORS abierto** (`Access-Control-Allow-Origin: *`) en todas las rutas.

### Servicio dinámico (`gonzalez-mobile-dynamic-api`, repo del desarrollador)
- La verificación real del token ocurre en su endpoint `GET /api/dynamic-prisma`. Si algún cliente le habla directo, esas rutas **no pasarían** por la comprobación de dispositivo del servidor principal. **Pendiente de confirmar con el desarrollador.**

## 4. Brechas y qué hay que construir

### A. App móvil (la más grande; requiere nueva versión)
1. Instalar `expo-secure-store` y generar el identificador de instalación (UUID guardado de forma segura).
2. Pantalla de **código de empresa** (o código fijo por variante) antes del login.
3. Integrar `GuardifyDevice` del SDK: registro → «Esperando aprobación» → login. Reutilizar `deviceName`, modelo, SO y versión de la app.
4. Pantallas de estado: **pendiente** (con botón «Reintentar» y aviso), **rechazado** (con el motivo), **bloqueado**, **retirado** (borra datos locales), **versión obligatoria** (`FORCE_UPDATE`).
5. Enviar el identificador del equipo al login y en cada petición (cabecera), y procesar los comandos (`LOGOUT_ALL`, `WIPE`…) y los latidos.
6. Cifrar la sesión local que hoy está en `AsyncStorage`.
7. Política sin conexión (opcional en la primera fase).

### B. Servidor de MonitoreApp
1. En el login: recibir el identificador/credencial del equipo, comprobarlo con Guardify y **meter el id del dispositivo (`dev`) en el JWT**.
2. En `verifyAccessTokenByApi`: rechazar (403 con código `device_not_approved`) si el token no trae dispositivo o si el dispositivo figura como no activo en la lista de revocaciones de Guardify (`GET /api/v1/revocations`, en caché de 30 a 60 s).
3. Variables nuevas: URL de Guardify y la llave de la app. Con **interruptor** (`GUARDIFY_DEVICE_ENFORCE=off | observe | on`).
4. Devolver al móvil un error distinguible para que muestre la pantalla correcta en lugar de volver al login sin explicación.

### C. Servicio dinámico (desarrollador)
Aplicar la misma comprobación si recibe tráfico directo, o confirmar que todo pasa por el servidor principal.

### D. Guardify
- Ya cubierto: registro, aprobación, rechazo, cupo, comandos, revocación y auditoría.
- Mejoras recomendadas: **aviso al administrador** cuando llega un equipo pendiente (hoy el registro no genera ninguna notificación: hay que entrar a Dispositivos para verlo), **aprobación en lote** y un filtro «pendientes» destacado, y **código de registro por sucursal / QR** para preregistrar equipos. Confirmar que la instalación `monitoreapp` de González tenga el cupo suficiente y definir si habrá `autoApprove` durante la migración.

## 5. Flujo propuesto

1. **Primera apertura:** la app genera su UUID y manda `register(código, appKey=monitoreapp, uuid, modelo…)` a Guardify. Queda **PENDIENTE**; la app muestra «Esperando aprobación».
2. **Administrador** (Guardify → Dispositivos): ve modelo, versión, momento y sucursal sugerida. **Aprueba** (asigna sucursal, propiedad empresa/personal, modo compartido/asignado) o **rechaza** con motivo.
3. **La app se entera** (consulta periódica o el canal de eventos del SDK): si se aprobó, muestra el login; si se rechazó, muestra el motivo y no deja avanzar.
4. **Login** (Planillas, como hoy) con el identificador del equipo; el servidor lo valida con Guardify y lo incluye en el JWT.
5. **Cada petición** pasa por `verifyAccessTokenByApi`, que corta si el equipo fue bloqueado o retirado (en hasta ~1 minuto) y, con un comando push, la app cierra sesión al instante.

## 6. Plan por fases y migración de los equipos ya instalados

| Fase | Contenido | Quién | Estimación orientativa |
|---|---|---|---|
| 0 | Acuerdos: código de empresa en la variante `prod`, cupo, regla de aprobación, qué hacer con equipos personales | Tú + Guardify | 1 día |
| 1 | Servidor en modo **`observe`**: registra qué peticiones llegan sin dispositivo, sin bloquear nada | Servidor MonitoreApp | 2–3 días |
| 2 | App móvil nueva (registro, pantallas de estado, almacenamiento seguro) en `lite` para pruebas; luego `prod` | App móvil | 1,5–2 semanas |
| 3 | **Migración de equipos:** versión nueva por EAS; los equipos se registran solos con `autoApprove` o con un **código de registro por sucursal** durante una ventana (p. ej. 2 semanas); el administrador revisa la lista y retira lo que no reconozca | Operación | 2 semanas de ventana |
| 4 | Servidor en modo **`on`**: sin dispositivo aprobado, 403 `device_not_approved`; `APP_LAST_VERSION` y `FORCE_UPDATE` para jubilar versiones viejas | Servidor + operación | 2–3 días |
| 5 | Aviso de pendientes, aprobación en lote, atestación Play Integrity, política sin conexión | Guardify + app | opcional |

## 7. Riesgos y decisiones

- **Nueva versión obligatoria y APK a mano:** sin la versión nueva nada funciona, y hoy la actualización es voluntaria (APK descargado desde la app). Hay que comunicar la fecha de corte, empujar la descarga y bloquear las versiones viejas solo al final, con la ventana de migración corriendo.
- **Equipos compartidos en garita:** varios guardas usan el mismo equipo. El modelo `SHARED` de Guardify lo cubre, pero hay que confirmar cómo reacciona la limpieza de caché que la app hace al cambiar de usuario.
- **Dependencia de Guardify en el login:** si Guardify no responde, el servidor necesita una política (usar la última lista en caché unos minutos, nunca abrir por defecto).
- **Dato del tercero:** el estado de aprobación se guarda **solo en Guardify**; nada se escribe en la base de Planillas.
- **Seguridad:** un equipo con la app modificada puede saltarse la pantalla; por eso el control real está en el servidor (cambio B2), no solo en la app. Cifrar la sesión local y, más adelante, la atestación.

### Decisiones que necesito de ti
1. ¿El código de empresa va **fijo en la variante `prod`** (los guardas no lo escriben) o lo teclean?
2. ¿Qué pasa con los equipos **personales**: se aprueban igual o requieren más revisión?
3. ¿Durante la migración usamos **auto-aprobación** o aprobación manual en lote?
4. ¿Quién del lado de MonitoreApp (el desarrollador) toma las fases 1, 2 y 4?
5. ¿El servicio dinámico recibe tráfico directo del móvil?
