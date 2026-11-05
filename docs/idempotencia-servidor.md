# Idempotencia del servidor (issues #172 y #181, protocolo de acciones de Guardify)

**Qué garantiza.** La misma `Idempotency-Key` sobre la misma acción devuelve **el mismo resultado sin repetir el efecto**, aunque el estado del registro ya haya cambiado por esa acción.
La misma clave con otra acción, otro registro u otra persona es `409 conflict`. Sin la cabecera, todo funciona como antes.

## Cómo funciona

1. La petición trae `Idempotency-Key` (16 a 128 caracteres visibles, sin espacios; en la API de acciones también puede ir como `idempotencyKey` en el cuerpo).
2. El servidor **reserva** la clave en la tabla `c_clave_idempotencia` **antes** de ejecutar. La clave se guarda como SHA-256 (nunca en claro) y su unicidad es el candado **entre procesos**: solo una petición reserva. La tabla vive en la base de la **API dinámica** (donde se aplican las migraciones) y se usa por esa API, igual que la evidencia (`c_evidencia_registro`): este servidor no la ve con su Prisma directo ni necesita un modelo propio.
3. Resultado:

| Situación | Respuesta |
|---|---|
| Primera vez | Se ejecuta; si el resultado es 2xx se guarda junto con su estado HTTP y su cuerpo |
| Misma clave, misma acción, ya terminada | El **resultado original** (mismo estado y cuerpo), con la cabecera `Idempotent-Replay: true`; no se ejecuta nada |
| Misma clave mientras la primera sigue ejecutándose | `409 conflict` («hay otra petición en curso») |
| Misma clave con otra acción, otro registro u otra persona | `409 conflict` |
| La acción devolvió un error (4xx/5xx) o lanzó una excepción | La clave **se libera**: el mismo reintento vuelve a ejecutarse (p. ej. tras abrir la sesión de Planillas cuando hubo `planillas_session_required`) |
| Clave mal formada | `400 invalid_request`; sin clave en una ruta que la exige, `400` |

- Un resultado se recuerda **30 días** (lo que puede tardar una cola sin conexión). Una reserva «en curso» de más de **10 minutos** se considera abandonada (el proceso murió) y se retoma.
- Si el almacén falla **al guardar el resultado** de una acción que ya se hizo, se informa el éxito y se deja constancia en el log: no se convierte en error una acción hecha.

## Dónde se aplica

| Ruta | Clave | Si el almacén no está disponible |
|---|---|---|
| `POST /api/guardify/actions/{tipo}/{id}/{accion}` (aprobar, rechazar) | **Obligatoria** | `503` sin `code` y **no se ejecuta nada** («nada se da por hecho»); Guardify lo lee como «app no disponible» |
| `POST /api/guardify/actions/imports/inventario-puesto` (`aplicar`) | Opcional; `validar` nunca reserva | Igual que arriba cuando la clave viene |
| `PUT /api/attendance/[id]` (marcar ingreso o salida) | Opcional; la app la manda | La ruta sigue **sin** idempotencia (como antes): primero la disponibilidad |

En `PUT /api/attendance/[id]` la deduplicación va **después** del control de alcance: una repetición nunca salta la autorización.

### En el teléfono
`saveMarca` manda `idempotencyKey = actionIdempotencyKey('marca', marcaId, tipo, horaAccion)` (`apps/mobile/hooks/idempotencyKey.ts`) y marca la escritura como `idempotent: true`. La clave se arma con lo que identifica a la acción (no es aleatoria), así que la **misma marca reintentada lleva la misma clave** y una marca distinta nunca la comparte. Con eso, un reintento tras agotarse el plazo con la respuesta perdida es seguro: el servidor devuelve el resultado ya guardado en lugar de marcar dos veces.

## Despliegue (orden obligatorio)

1. En `gonzalez-mobile-dynamic-api` aplicar la migración **`20261027120001_clave_idempotencia`** (crea `c_clave_idempotencia`) y regenerar su cliente Prisma (`prisma generate`): la API dinámica solo atiende tablas que su cliente conoce.
2. Reiniciar la API dinámica.
3. Desplegar este servidor. **No hace falta `db pull` ni cambiar `schema.prisma` aquí**: la tabla se accede por la API dinámica.

Si se despliega el servidor **antes** de la migración: las rutas de la app siguen funcionando (sin idempotencia, y quedan registradas en el log), pero la API de acciones de Guardify responde `503` hasta que la API dinámica conozca la tabla.

Limpieza opcional de filas vencidas (también se retiran al reutilizar su clave): `DELETE FROM c_clave_idempotencia WHERE expira < NOW();`

## Qué queda fuera (y por qué)
- Las demás altas (incidentes, actas, bitácoras…) **no** envían clave todavía: cada una necesita decidir qué la identifica. La infraestructura (`conIdempotencia`) ya está; añadir una ruta son tres líneas y una clave estable en su pantalla.
- `revert-leaving` y `absent-reason` conservan su protección por estado.
- Peticiones **sin** clave de la API de acciones no existen (se exigen); en la carga `aplicar` sin clave solo rige el candado en memoria del proceso.

## Pruebas
- `apps/server/utils/idempotency.test.ts`: la lógica (resultado repetido, conflicto, concurrencia, errores que liberan, reservas abandonadas y vencidas, almacén que falla), el envoltorio HTTP, el almacén sobre Prisma, la clave del teléfono y el cableado de las rutas.
- `apps/server/utils/guardifyActions/guardifyActions.test.ts` (bloque «idempotencia por clave»): a nivel de manejador, que el reintento no escribe ni llama a Planillas dos veces, que otra acción o registro es 409 y que un `planillas_session_required` no consume la clave.

## Prueba manual (en el ambiente de pruebas, con datos creados desde MonitoreApp)
1. Con la migración aplicada y la API dinámica reiniciada, marcar una entrada con conexión: la fila de `c_clave_idempotencia` queda con estado `completada`.
2. Repetir la misma petición `PUT /api/attendance/{marca}` con la misma `Idempotency-Key` (por ejemplo con el cliente HTTP de pruebas): responde igual con `Idempotent-Replay: true` y la marca no cambia otra vez.
3. Servidor lento: hacer que la respuesta tarde más del plazo de escritura (30 s) en una marca; el teléfono reintenta una vez y no se crea una segunda marca.
4. Aprobar un permiso desde la consola de Guardify con un ejecutivo sin sesión de Planillas vigente: `409 planillas_session_required`; abrir la app, y repetir **con la misma clave**: se ejecuta.
5. Repetir la clave de una aprobación ya hecha: mismo resultado, sin una segunda llamada a Planillas.
