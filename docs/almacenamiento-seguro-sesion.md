# Almacenamiento seguro de la sesión: sin texto plano y con borrado pendiente (issue #173, H02)

Lógica pura en `apps/mobile/hooks/secureStorageRouter.ts` (probada en `apps/server/utils/secureStorageRouter.test.ts`); la conexión con
`AsyncStorage` y `expo-secure-store` está en `hooks/installSecureStorage.ts`. Las llaves sensibles son `SENSITIVE_STORAGE_KEYS` (tokens, datos del
empleado, token de Planillas, modo de sesión).

## Qué cambió

| Antes | Ahora |
|---|---|
| Si el almacén seguro no estaba disponible o rechazaba la escritura, la credencial se guardaba **en claro** en `AsyncStorage`, sin avisar. | `setItem` lanza `SecureStorageError` (`secure_unavailable` / `secure_write_failed`, con la llave) y **no escribe nada en claro**. El respaldo en claro solo existe con `allowPlainFallback`, que la app activa únicamente con `__DEV__` (desarrollo / Expo Go). |
| Un fallo pasajero del Keystore degradaba la credencial. | Se reintenta la escritura (2 intentos) antes de fallar. |
| Si el almacén seguro estaba no disponible un instante al abrir, quedaba fijado «no disponible» toda la ejecución. | Se vuelve a probar en la siguiente escritura (y migra lo que haya quedado en `AsyncStorage`). |
| Un error al borrar del Keystore solo se escribía en la consola: el token seguía ahí y volvía a leerse tras «cerrar sesión». | La llave queda **pendiente** (se persiste solo su nombre en `secure_pending_deletes`), **no se vuelve a leer su valor viejo**, y se reintenta al abrir la app, al leerla y con `retryPendingDeletes()`. `multiRemove` intenta todas las llaves aunque una falle. |
| El credencial del equipo de Guardify (`guardifyStorage.set`) caía a claro sin almacén seguro. | Misma política: falla con `SecureStorageError` fuera de desarrollo. |

Compatibilidad: **leer** lo que una versión anterior dejó en `AsyncStorage` sigue funcionando aunque el Keystore no esté, para no perder la sesión
existente; la migración al almacén seguro (copiar, verificar y solo entonces borrar) no cambió. El inicio de sesión distingue este error
(«No se pudo guardar la sesión de forma segura en este equipo…») en vez de decir «Error de conexión», y limpia lo que haya alcanzado a guardarse.

## Prueba manual (pendiente, requiere dispositivo)

1. Instalar sobre una versión anterior con sesión iniciada: la sesión debe conservarse y, tras abrir, no quedar tokens en `AsyncStorage`
   (comprobar con un volcado de `shared_prefs`/base de `AsyncStorage` en un equipo de pruebas con `adb run-as`).
2. Iniciar y cerrar sesión con normalidad: tras cerrar, `secure_pending_deletes` no existe o está vacío.
3. (Difícil de forzar en un equipo real; se cubre con la prueba automática) Un Keystore que rechaza el borrado: la app debe seguir tratando la
   sesión como cerrada y completar el borrado en la siguiente apertura.
