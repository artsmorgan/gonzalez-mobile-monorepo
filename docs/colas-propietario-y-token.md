# Colas sin conexión: propietario por acción y sin token de Planillas (issues #176 H03 y #170 H01)

Lógica pura en `apps/mobile/hooks/queueOwnership.ts` (probada en `apps/server/utils/queueOwnership.test.ts` con `AsyncStorage` en memoria); la conexión
con `AsyncStorage` está en `hooks/installQueueOwnership.ts`, que `index.js` carga **después** de `installSecureStorage` y **antes** de
`installEvidenceQueue` (para que el sello de evidencia vea la cola del usuario). Ninguna pantalla ni ciclo de sincronización cambió su forma de leer
o guardar las colas: la capa es transparente.

## #176: propietario en cada acción

Cada acción de una cola `*_actions` se guarda con `__owner = { empleadoId, orgId }`: la sesión que la creó. `orgId` es el host del servidor
(`API_SERVER`), de modo que el trabajo de pruebas y el de producción no se mezclan en un mismo equipo.

| Operación | Efecto |
|---|---|
| Leer una cola | El usuario ve **solo sus acciones** y las anteriores a esta versión (sin propietario), sin el campo `__owner`. |
| Guardar una cola | Las acciones ajenas que ya estaban se **conservan intactas**; las propias se sellan; lo que el usuario consumió desaparece. |
| Vaciar una cola (`removeItem`) | Solo se van las acciones propias. |
| Entra otro empleado | Ya **no se borran** las colas pendientes del anterior (antes el barrido del login las eliminaba). Siguen en disco y **se sincronizan cuando ese mismo usuario vuelve a conectarse**, por muchas sesiones de otros usuarios que haya en medio. Un usuario nunca sincroniza ni ve lo de otro. Si pasa más de 2 semanas sin conectarse, se eliminan (ver más abajo). |
| Sin sesión | No se filtra nada (comportamiento de siempre). |
| Borrado remoto de Guardify (`wipe`) | Usa el acceso **sin filtrar** (`queueRaw`): espera el trabajo pendiente de **todos** los usuarios del equipo y, al borrar, se lleva todo. |

El propietario se deduce de las escrituras en `employee_data` (inicio y cierre de sesión) o, al arrancar, del empleado ya guardado.

Alcance: solo las llaves `*_actions` (`isQueueKey`). Las cachés (`*_cache`, jerarquía) siguen siendo del último usuario y el login de otro empleado las
sigue limpiando, como antes. Una cola cuyo contenido no es un arreglo de objetos se guarda igual, sin propietario.

## Caducidad: 2 semanas sin conectarse

Si un usuario con acciones en espera lleva **más de 14 días sin conectarse**, el sistema elimina sus acciones **y los archivos de expo-files que esas
acciones citan**. Lógica pura en `apps/mobile/hooks/queueRetention.ts` (probada en `apps/server/utils/queueRetention.test.ts`); se ejecuta desde
`runQueueRetention()` (`installQueueOwnership.ts`) en cada sincronización con conexión y sesión activa (`App.tsx`, como mucho cada 5 minutos).

- **«Se conecta»** = una sincronización con conexión real y la sesión activa de ese usuario. Esa hora se guarda por usuario y organización en
  `queue_owner_last_seen_v1` (con `getHoraAccion`; si no hay hora del servidor, la del equipo).
- **Plazo estricto:** a los 14 días exactos todavía no se borra; un milisegundo después, sí. Una hora «en el futuro» (reloj corregido) nunca hace caducar.
- **Nunca caduca el usuario con la sesión activa**, y sin sesión activa no se borra nada.
- **Al actualizar** no se borra de golpe: un usuario con acciones y sin registro empieza a contar desde la primera vez que la app lo ve.
- **Las acciones sin propietario** (guardadas antes de esta versión) no se pueden atribuir y no caducan.
- **Archivos:** las acciones citan los archivos por nombre (`localFileName`, firmas, adjuntos, en cualquier nivel o como ruta). Se borra el archivo
  de `Paths.document` solo si lo citan las acciones eliminadas, existe, no es la foto de perfil ni la caché de la jerarquía, y **ninguna acción
  restante (de cualquier usuario) lo cita**. Primero se reescriben las colas y después se borran los archivos: un corte deja archivos huérfanos,
  nunca acciones sin su archivo. Un archivo que no se deja borrar no detiene a los demás.
- La reescritura de la cola usa el mismo bloqueo que los guardados normales, así que no pisa una acción que se esté guardando.
- Cada eliminación deja un aviso en el registro de la app (`[colas] se eliminaron N acción(es)…`) sin datos de las acciones.

**Lo que NO se borra:** cachés y datos que no son colas `*_actions` (siguen la regla de siempre: el login de otro empleado las limpia), ni archivos
que ninguna acción eliminada citaba.

## Limpiezas de caché: no borran trabajo pendiente de nadie

Regla única en `apps/mobile/hooks/cleanupGuard.ts` (probada en `apps/server/utils/cleanupGuard.test.ts`): **ninguna limpieza de caché puede borrar
trabajo pendiente de sincronizar de ningún usuario, tampoco el de quien está desconectado.** Solo la caducidad de 2 semanas y el borrado remoto de
Guardify (que espera a que todo se sincronice o venza su plazo de 72 h) pueden quitarlo.

| Limpieza | Antes | Ahora |
|---|---|---|
| Barrido al iniciar sesión otro empleado (`AuthContext`) | Conservaba `*_actions`, pero borraba la firma manual pendiente, la última conexión de cada usuario y los borrados seguros pendientes | Conserva todo lo que `isPendingWorkKey` reconoce |
| Limpieza al ingresar (`cleanAsyncStorage`, `MarcarIngresoSalidaScreen`) | Conservaba lo que «termina en `_actions`»; mismo hueco en lo demás | Misma regla común |
| Borrado de archivos al ingresar (`deleteAllFiles`) | Conservaba los archivos que cita la **vista del usuario activo** de una **lista fija** de colas: tras #176 se llevaba los adjuntos de los usuarios desconectados | Siempre suma los archivos que citan las colas de **todos** los usuarios (acceso sin filtrar, todas las `*_actions`, sin lista fija), aunque quien llame no los indique |
| `removeCurrentMarca` / expiración del turno | Ya no tocaba las colas | Sin cambios |
| Cierre de sesión (`clearAuthStorage`) | Solo credenciales | Sin cambios |
| Borrado remoto (`wipe`) | — | Sin cambios: cuenta y borra todo adrede |

**Qué se considera trabajo pendiente:** las colas `*_actions`, las llaves únicas con propietario (hoy `manual_signature_cache`), `marca_cache` heredada, y
los registros `queue_owner_last_seen_v1` y `secure_pending_deletes`. Si una limpieza borrara el registro de última conexión, el plazo de 2 semanas
nunca se cumpliría (cada cambio de usuario lo reiniciaría).

**La firma manual pendiente es de quien la guardó.** `manual_signature_cache` era una llave única global: solo conservarla habría permitido que otro
usuario subiera la firma ajena como suya. Ahora se guarda por dentro como `[{ __owner, value }]` (una entrada por usuario), cada uno ve y borra solo la
suya, lo guardado antes de esta versión (texto plano) lo ve cualquiera y se reemplaza al primer guardado, y la caducidad de 2 semanas también se lleva
la firma pendiente de un usuario caducado junto con su archivo.

**Lo que sigue pudiendo borrarse:** las cachés de pantalla (`visitors_cache`, `vehicles_cache`, catálogos, jerarquía…), que se vuelven a descargar.
Si una fila de esas cachés muestra un adjunto que solo existe en una acción pendiente, el adjunto se conserva (lo protege la acción).

## #170: el token de Planillas ya no se guarda en las colas

El token de Planillas es una credencial de sesión y vive solo en el almacén seguro (`planillas_token`). Se copiaba dentro de las acciones
(`planillasToken`) y quedaba en claro en `AsyncStorage`.

- **Al guardar:** la capa quita toda clave `planillasToken` / `planillas_token` / `Planillas-Token` de cualquier valor JSON que se guarde (colas y
  cachés), sin perder el resto de la acción. El token de la sesión (valor de texto, no JSON) no se toca.
- **Migración:** al abrir la app `scrubStoredQueues` limpia las colas ya guardadas (`*_actions` y `marca_cache`) sin perder ninguna acción. Es idempotente.
- **Al enviar:** cada llamada toma el token vigente del almacén seguro (`readStoredPlanillasToken`). Los ciclos de `App.tsx` ya no leen
  `action.planillasToken`; el checklist (que no tenía respaldo) ahora lo resuelve del almacén. `attachPlanillasTokenToAllPendingActions` quedó como
  limpieza (no copia nada).
- Un token vencido sigue pidiendo revalidación antes de sincronizar (`pendingActionsRequirePlanillasToken`), igual que antes.

## Prueba manual (pendiente, requiere dispositivo)

1. Con la app en modo avión, marcar una salida y guardar una ubicación de puesto como el usuario A. Cerrar sesión.
2. Entrar como el usuario B: no ve nada pendiente de A; hacer una acción sin conexión. Volver a conectar y sincronizar: solo se envía la de B.
3. Volver a entrar como A: sus acciones siguen ahí y se sincronizan con su sesión.
4. Revisar `AsyncStorage` (volcado con `adb run-as` en un equipo de pruebas): ninguna cola contiene `planillasToken`.
5. Actualizar desde una versión anterior con acciones pendientes: no se pierde ninguna y el token desaparece de las colas.
6. Caducidad: con el usuario A con acciones y una foto adjunta sin sincronizar, cerrar sesión y entrar como B. Adelantar la hora del equipo más de 14
   días (o modificar `queue_owner_last_seen_v1` de A en un equipo de pruebas) y sincronizar como B con conexión: las acciones de A y el archivo adjunto
   desaparecen, lo de B queda intacto. Antes de los 14 días no debe borrarse nada, y si A vuelve a conectarse sus acciones se sincronizan.
