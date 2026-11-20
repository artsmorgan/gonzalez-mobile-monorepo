# Control de equipos con Guardify

Issues #145 a #150. El estado de aprobación de un equipo vive **solo en Guardify**; el servidor no guarda nada en la base de Planillas ni en `refresh_token`.
El servidor es donde se **hace cumplir**: una app modificada podría saltarse la pantalla de bloqueo, pero no esto.

## Variables de entorno (servidor)

| Variable | Qué hace | Por defecto |
|---|---|---|
| `GUARDIFY_DEVICE_ENFORCE` | `off` / `observe` / `on` (ver abajo) | `off` (todo como hoy) |
| `GUARDIFY_URL` | URL base de Guardify (ej. `https://guardify.ejemplo.com`) | — |
| `GUARDIFY_APP_CLIENT_ID` / `GUARDIFY_APP_CLIENT_SECRET` | Credencial de la aplicación (la entrega Guardify). Se manda como `Authorization: Basic base64(id:secreto)` | — |
| `GUARDIFY_REVOCATIONS_TTL_SECONDS` | Cada cuánto se refresca la lista de equipos no activos (30 a 60) | `45` |
| `GUARDIFY_DEVICE_COLD_START` | Qué hacer si no hay ninguna lista cargada (arranque con Guardify caído): `allow` / `deny` | `allow` |
| `GUARDIFY_MIN_APP_VERSION` | Versión mínima de la app (`1.0.4`). Con `on`, una app anterior (o que no manda `X-App-Version`) recibe `403 device_not_approved\|UPDATE_REQUIRED\|…`. Debe ser la misma que la mínima del catálogo de APK de Guardify | — (sin mínima) |

> Escribir estas variables en Railway requiere permiso explícito del dueño del proyecto.

## Modos

- **off**: no hace nada ni consulta a Guardify.
- **observe**: deja un log estructurado (`{"guardify_device": {...}}`, con `cause`, `status`, `reason`, `route`, `empleado`, `gdev`, `gsid`) por cada petición sin equipo, con equipo/sesión no activo o con una versión menor a la mínima, **sin cambiar ninguna respuesta**.
- **on**: responde `403` con `message = device_not_approved|<ESTADO>|<motivo>` (estados: `BLOCKED`, `REJECTED`, `RETIRED`, `PENDING`, `LOCKED`, `UNREGISTERED` si el token no trae equipo, `UPDATE_REQUIRED` si la app es anterior a la mínima). La app lo distingue de un 401/403 normal y muestra la pantalla de estado sin cerrar la sesión.

Orden recomendado: servidor en `observe` → app nueva (todas las tareas de app en una versión) → piloto → `on`.

## Dónde se aplica

- `utils/verifyAccessTokenByApi.ts`: punto único de las ~210 rutas; tras validar el JWT evalúa `gdev` (equipo), `gsid` (sesión de Guardify) y la cabecera `X-App-Version`.
- `POST /api/auth/login`: recibe `guardifyDeviceId` (el id del equipo en Guardify, `guardify.deviceId` del SDK) y, si ya existe, `guardifySessionId`; los mete en el JWT de acceso y en el de renovación como `gdev` / `gsid`. Equipo no activo → `403 device_not_approved` antes de consultar Planillas.
- `POST /api/auth/refresh-token`: conserva `gdev` / `gsid`; si el token no los trae (login hecho antes de abrir la sesión en Guardify, o antes de esta función) toma los que manda la app. No renueva si el equipo dejó de estar activo.
- El **servicio dinámico** (`gonzalez-mobile-dynamic-api`) no recibe tráfico directo del móvil (la app solo llama a `API_SERVER`), así que no necesita el mismo control.

Como la sesión de Guardify se abre **después** del login en la app (`access/verify` necesita al empleado ya autenticado), el primer token solo trae `gdev`; `gsid` se incorpora en el primer refresh. Un equipo bloqueado se corta desde el primer momento; una sesión revocada, desde el primer refresh.

## Lista de revocaciones

`GET {GUARDIFY_URL}/api/v1/revocations?since=<ISO>` → `{ sessions: [{ sid }], devices: [{ id, status }], serverTime }` (contrato del SDK, `vendor/guardify-sdk/src/server.ts`; `utils/guardifyDevices.ts`):

- Incremental: la primera consulta pide desde la época y las siguientes desde `serverTime` menos 2 s.
- En memoria; una vez cargada, el refresco es en segundo plano (la petición del usuario no espera a Guardify).
- **Tolerante a fallos**: si Guardify no responde se usa la última lista (un equipo ya revocado sigue bloqueado) y no se lanza error.
- Un equipo que vuelve a `ACTIVE` sale de la lista.

## La app (issues #145, #147, #148)

Código: `apps/mobile/hooks/guardifyClient.ts` (SDK en `apps/mobile/vendor/guardify-sdk`, copia de `vendor/guardify-sdk/src/index.ts`), reglas puras en `hooks/guardifyLogic.ts` y la pantalla en `components/GuardifyGate.tsx`.

- **Interruptor general (bloqueado por defecto):** `GUARDIFY_ENABLED` (`EXPO_PUBLIC_GUARDIFY_ENABLED=true` en la build). Con él apagado, o sin URL, Guardify **no hace nada en la app**: no registra el equipo, no muestra pantallas de bloqueo, no consulta órdenes ni catálogo y no puede impedir su uso. El código se conserva para reactivarlo: encender el interruptor, poner la URL y recompilar. Con la app así, el servidor debe estar en `GUARDIFY_DEVICE_ENFORCE=off` u `observe`: en `on` rechazaría como `UNREGISTERED` a toda sesión sin equipo de Guardify.
- **Configuración** (variables de la build, `app.config.js` → `extra`): `GUARDIFY_URL` (junto con el interruptor), `GUARDIFY_APP_KEY` (`monitoreapp` por defecto) y `GUARDIFY_COMPANY_CODE` (embebido en producción; en lite/full se deja vacío y la persona lo escribe al registrar el equipo).
- **Registro (#145)**: al abrir la app con conexión el equipo se registra (código embebido) o se pide el código; queda pendiente y la pantalla se refresca sola cada 15 s. Estados rechazado, bloqueado, retirado y sin permiso de uso (política sin conexión) tienen su pantalla y no dejan llegar al login. El login envía `guardifyDeviceId`.
- **Sesión**: tras autenticar al empleado en la app se abre su sesión en Guardify (`login(cédula)`); también para sesiones que ya existían antes de integrar Guardify. Si Guardify no le da acceso, se cierra su sesión en la app. Sin conexión no se bloquea: se abre cuando vuelva. El permiso se renueva al llegar a la mitad de su duración.
- **Latidos y órdenes (#147)**: cada 5 min `heartbeat` (versión, batería en % y, **solo si la persona lo autorizó**, la ubicación) y cada 10 s `pollCommands()` mientras la app está abierta (React Native no entrega `fetch` en streaming, por eso no se usa el canal SSE). `LOGOUT_ALL`/`LOGOUT_USER` cierran la sesión; `FORCE_UPDATE` revisa el catálogo; `PING` solo se confirma.
- **Aviso de ubicación**: una sola vez, tras entrar a la app, se pregunta si Guardify puede ver la ubicación del equipo (Aceptar / No, gracias). Rechazarlo no bloquea nada; el latido informa `consent.location = false` y no manda coordenadas. La ubicación que se envía es la última lectura del GPS de la app y solo si tiene menos de 10 minutos. (El texto del aviso es provisional.)
- **Borrado remoto (`WIPE`) y equipo retirado**: un `WIPE` solo llega cuando un administrador lo ordena desde la consola. La app **no borra de inmediato** para que nadie pierda lo que no se sincronizó: se bloquea con la pantalla «Equipo en proceso de borrado», conserva la sesión, empuja la sincronización de las colas `*_actions` y, cuando la cola queda vacía, cierra la sesión y borra TODO lo local (llaves de `AsyncStorage`, archivos de `Paths.document` y caché; se conserva solo el registro del equipo en Guardify y su `device_uid`). Si pasan **72 horas** sin lograrlo (el equipo no se conecta o el servidor ya no lo acepta) borra igual. La orden se guarda en el almacén seguro y sobrevive a un reinicio; una orden repetida no reinicia el plazo. Un equipo en estado «retirado» hace el mismo borrado (una sola vez hasta que se registre de nuevo). Código: `apps/mobile/hooks/guardifyWipe.ts` (reglas) y `guardifyClient.ts` (ejecución).
- **Actualización (#148)**: cada 30 min (y al registrar) se consulta `apks/latest?variant=` (`full` usa `prod`). Si la versión instalada es menor que `minAppVersion`, una pantalla bloquea la app y descarga el APK con `Authorization: Device …`. Si solo hay una versión más nueva, el botón «Descargar APK» de Inicio usa el catálogo cuando ofrece la misma versión que `/api/mobile-versions` (que sigue funcionando como respaldo).
- **Cabeceras**: toda petición a la API lleva `X-Device-Uid`, `X-Guardify-Device` (id de Guardify) y `X-App-Version`.

## Pendiente de la parte de Guardify

- Confirmar la escala de `battery` en `heartbeat` (la app envía 0–100).
- Que la mínima del catálogo (`minAppVersion`) se exponga con la credencial de la aplicación para no repetirla en `GUARDIFY_MIN_APP_VERSION`.
- Un APK de cada variante (`prod`, `lite`) subido al catálogo; la app no verifica el `sha256` del archivo descargado.
