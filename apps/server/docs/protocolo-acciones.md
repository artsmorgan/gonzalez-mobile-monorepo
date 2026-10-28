> **Copia del contrato.** El original vive en el repo de Guardify (`artsmorgan/guard-desk-nexus`, `docs/protocolo-acciones.md`, commit f99a520) y MonitoreApp no puede verlo; por eso este repo guarda su propia copia. Si el contrato cambia en Guardify, se actualiza aquí en el mismo cambio. Lo que implementa esta app, ruta por ruta, está en [`guardify-actions-api.md`](./guardify-actions-api.md).

# Protocolo de acciones (Guardify → app)

Para traer a Guardify funciones de la app que **actúan** sobre un registro (aprobar un permiso, rechazar un mutuo acuerdo, atender una requisición). Guardify **define** los tipos de bandeja, los estados y las acciones; la app **implementa** los endpoints y aplica sus propias reglas de negocio. Guardify nunca escribe en la base de la app ni en la de terceros (Planillas): **llama a la acción que la app ya tiene**.

Esquemas (zod, fuente de verdad): `packages/contracts/src/actions.ts`. Cliente: `apps/console/lib/actions/`. Issue: guard-desk-nexus#25.

**Dos documentos, uno por lado.** Este es el contrato (lo que Guardify define y espera). Lo que la app implementa, ruta por ruta, está en `apps/server/docs/guardify-actions-api.md` del repo de MonitoreApp (`artsmorgan/gonzalez-mobile-monorepo`). MonitoreApp no ve este repo, así que guarda una copia de este contrato en `apps/server/docs/protocolo-acciones.md`. **Regla:** todo cambio a este documento se copia a MonitoreApp en el mismo trabajo, y la cabecera de la copia anota el commit de origen.

## Reglas
1. **Los datos salen de la app.** Guardify no inventa ni siembra registros; si la app no entrega un dato, es `null` y Guardify muestra **«-»**. Las pruebas de integración usan datos creados en MonitoreApp (ambiente de pruebas).
2. **Guardify decide quién puede** (permiso por acción, concedido por rol y alcance); **la app decide si procede** (estado, alcance del actor sobre el objeto, conflictos). Las dos validaciones son obligatorias: una no sustituye a la otra.
3. **Nada se da por hecho.** Si la app no responde o no tiene la función, no se cambió nada y se dice así. Una acción ya enviada no se reintenta sola.
4. **Sin rastro no hay acción:** Guardify registra el intento en su bitácora **antes** de llamar y el resultado **después**.
5. **Credencial de aplicación + actor firmado,** nunca el token de la persona.

## Conexión
Es la misma de los reportes (misma llave, mismas reglas de red: sin direcciones internas ni redirecciones). La ruta base es la de los reportes cambiando `/reports` por `/actions` (`/api/guardify/actions`). Todas las llamadas llevan:

| Cabecera | Para qué |
|---|---|
| `Authorization: Bearer <llave>` (o la cabecera de la conexión) | Autentica a Guardify |
| `x-guardify-user: <correo>` | Quién pidió (informativo) |
| `x-guardify-actor` + `x-guardify-actor-sig` | Identidad del actor firmada (abajo) |
| `Idempotency-Key: <clave>` (solo `POST`) | La app no repite el efecto si Guardify reintenta |

### Identidad del actor
`x-guardify-actor` = `base64url(JSON { actor: { email, name, externalId?, cedula? }, ts, tenant })` y `x-guardify-actor-sig` = `hex(HMAC-SHA256(llave, "<x-guardify-actor>\n<MÉTODO>\n<ruta con consulta>\n<sha256 hex del cuerpo>"))`. **La firma queda ligada a la petición** (método, ruta, consulta y cuerpo; el cuerpo vacío en un `GET`): un par de cabeceras capturado no sirve para otra acción, otro registro ni otro cuerpo. La app **debe**: recalcular el HMAC con su copia de la llave y comparar en tiempo constante; rechazar si `ts` difiere más de **5 minutos** de su reloj; y **resolver al actor a una persona de la app** (por `externalId`, `cedula` o correo; si Guardify manda id **y** cédula y no coinciden, no se actúa; un empleado dado de baja no actúa) y aplicar **sus** reglas de alcance. Si no puede resolverlo: `403 out_of_scope`. Referencia: `lib/actions/signature.ts` (`bindingOf`, `verifyActor`).
**Límite conocido:** la firma usa la misma llave que autentica a Guardify, así que quien la tenga puede fabricar un actor. Mitigaciones hoy: cada acción exige que el actor resuelto sea quien le toca resolver ese registro, y `aprobar` además exige que esa persona tenga una sesión de Planillas vigente. Mejora pendiente: un secreto distinto solo para firmar al actor.

## Endpoints
```
GET  {base}/{tipo}?page&pageSize&sort&dir&q&scope&estado=<estado>&f.<col>…
                                           → 200 { rows: [{ id, estado, <columnas…> }], total }
GET  {base}/{tipo}/{id}?scope               → 200 { id, estado, campos:[{etiqueta,valor|null}], adjuntos:[{id,nombre,tipo}],
                                                     firmas:[{etiqueta,presente}], acciones:[<id de acción>], datos:{…}, historial:[{accion,por,en,motivo}] }
GET  {base}/lookup/empleado?codigo=         → 200 { id, codigo, nombre|null }     (para elegir un reemplazo; solo esos tres datos)
POST {base}/{tipo}/{id}/{accion}?scope      → 200 { estado, ref?, message? }
  cuerpo = { idempotencyKey, actor:{email,name,externalId?,cedula?}, reason?, signatures:[{role,method:"digital"|"manual",image?}], params?, requestedAt }
```
- `scope`, paginación, filtros `f.<col>` y orden: **igual que los reportes** (`docs/protocolo-reportes.md`); el alcance falla cerrado.
- `acciones` del detalle son las que **el actor** puede ejecutar ahora (la app valida su alcance y el estado). Guardify solo muestra esos botones.
- `datos` trae lo propio del registro que la pantalla necesita para pedir una acción (en `permisos`: `turnos: [{ id, etiqueta, reemplazoId, reemplazoNombre }]`).
- `params` son los parámetros propios de la acción (en `aprobar` de `permisos`: `{ turnos: [{ id, reemplazoId }], reemplazoObligatorio, observaciones }`); la app valida lo que le toca. Las `signatures` de `aprobar` son dos imágenes (`role: "digital"` y `role: "manual"`, `data:` URL).
- **Idempotencia:** la misma `idempotencyKey` sobre el mismo registro devuelve el **mismo resultado** sin repetir el efecto (aunque el estado ya haya cambiado por esa misma acción). Una clave igual con otra acción o registro: `409 conflict`.
- Los adjuntos se piden con el mecanismo que ya usan los formularios (enlaces firmados por Guardify); este protocolo solo los lista.

## Errores tipados
La app responde `{ "code": "<código>", "message"?: "…" }` con el estado HTTP que corresponda:

| `code` | Cuándo | HTTP sugerido |
|---|---|---|
| `not_found` | El registro no existe | 404 |
| `already_resolved` | Ya estaba aprobado, rechazado o cerrado | 409 |
| `invalid_state` | La acción no aplica al estado actual | 409 |
| `conflict` | Choca con otro registro (p. ej. fechas que se solapan) | 409 |
| `out_of_scope` | El actor no tiene alcance sobre el registro (o no se pudo resolver) | 403 |
| `reason_required` / `signature_required` | Falta el motivo o la firma que la app exige | 400 |
| `planillas_session_required` | La acción escribe en Planillas con el token de la persona y no hay uno vigente: debe abrir la app y entrar a Planillas. **No se cambió nada** | 409 |
| `invalid_request` | Cuerpo mal formado | 400 / 422 |

**Importante:** un `404` **sin** el cuerpo tipado significa «la app todavía no tiene esta API» (Guardify lo muestra como no disponible, sin tocar nada); un registro inexistente **debe** responder `404 { "code": "not_found" }`. Lo mismo para `501/502/503/504` sin cuerpo tipado.

## Qué define Guardify por tipo (`ActionTypeDef`)
`id`, nombre, **`app` y `report`** (el reporte de Guardify cuyos registros admiten las acciones), `remote` (nombre del tipo en la app; por defecto el `id`), **estados** (`id` y etiqueta) y **acciones**: cada una con su **permiso** (`modulo:accion`), los estados donde se ofrece, si exige **motivo**, qué **roles de firma** exige y si es **destructiva** (pide confirmación). Guardify valida permiso, motivo y firmas **antes** de llamar.

**Un tipo se apoya en un reporte.** La lista, los filtros, el periodo y el detalle del registro (formulario con firmas y adjuntos) ya los da el reporte; las acciones se ofrecen **en el detalle del registro** (`/reportes/{app}/{reporte}/{id}`). Por eso la app **no necesita** implementar `GET {base}/{tipo}` (la lista) para esos tipos: solo el detalle de acciones y la ejecución. La lista queda como opción para un tipo que no tenga reporte. El «detalle» de la app devuelve el estado, **las acciones que ESE actor puede ejecutar** y el historial; `campos`, `adjuntos` y `firmas` pueden ir vacíos (los dibuja el reporte).

**Qué botones se ven** = permiso en Guardify **∩** acción que la app dice que puede ejecutar el actor **∩** estado del registro que la acción admite. Antes de hablar con la app, Guardify comprueba que el registro está **dentro del alcance** de la persona (como el resto de los reportes): un id suelto no da acceso.

**Implementados hoy** (MonitoreApp, PR #190, `apps/server/docs/guardify-actions-api.md`): `permisos` y `mutuos-acuerdos`, acciones **`aprobar`** y **`rechazar`**. Los permisos de Guardify son `aprobaciones:aprobar-permisos`, `aprobaciones:aprobar-mutuos`, `aprobaciones:rechazar-permisos` y `aprobaciones:rechazar-mutuos` (migraciones f33 y f34).

**Aprobar y Planillas.** Aprobar un permiso crea el permiso en Planillas, y aprobar un mutuo crea el cambio de guardia, con el token de Planillas **del ejecutivo**. La app ya guarda ese token cuando la persona entra con su contraseña de Planillas (`a_mobile_token_for_planillas`); las acciones de Guardify usan **ese mismo token** y no piden credencial nueva a Planillas. Con un token vigente funciona; si no hay o venció, `409 planillas_session_required` sin tocar nada y la pantalla indica abrir MonitoreApp y escribir la contraseña de Planillas. Guardify nunca ve ni guarda ese token ni esa contraseña.

## Cargas masivas (inventario de puesto)
La consola lee el Excel y la app valida y carga. **Guardify** (`lib/xlsx-reader.ts`, `lib/imports/inventario.ts`): lector propio de `.xlsx` con límites duros (5 MB, 5000 filas, 60 columnas, descompresión acotada; sin la biblioteca con CVE), revisión fila por fila con el número de fila de la hoja, plantilla vacía descargable (solo encabezados e instrucciones, sin ejemplos inventados) y dos pasos: **revisar** (la app valida sin escribir nada) y **cargar** (se vuelve a leer y revisar el mismo archivo). No guarda el archivo ni los datos; la bitácora deja quién, cuántas filas y el resultado (`app_import.requested`, `.previewed`, `.applied`, `.failed`).
```
POST {base}/imports/inventario-puesto   { modo: "validar" | "aplicar", filas: [{ codigo_puesto, numero_articulo, cantidad, serie, marca, modelo|null, fecha_entrega: "DD-MM-YYYY" }] }
  → 200 { modo, creados: { planes, entregas }, omitidos: [...], mensaje }
  → 400/404 { code, message, errores: ["Artículo 3: serie obligatoria.", …] }       409 { code: "planillas_session_required" }
```
La app comprueba que los artículos y los códigos de puesto existan, **omite lo ya cargado** (repetir la carga no duplica) y, en `aplicar`, lo manda a Planillas con el token de Planillas guardado de la persona (igual que las aprobaciones). `validar` no escribe ni pide esa sesión. Máximo 2000 filas por carga. Permiso de Guardify: `cargas:inventario-puesto` (migración f35). Las **actividades** no tienen carga masiva en la app ni plantilla definida: pendiente.

## Bitácora (Guardify)
`app_action.requested` (antes de llamar), `app_action.completed` o `app_action.failed` (después), con app, tipo, registro, acción, clave de idempotencia, alcance, motivo, roles de firma que viajaron, estado resultante o código de error. El actor es quien inició sesión en Guardify.

## Qué debe cumplir la app (lista de conformidad)
- [ ] Valida la llave **y** la firma del actor (HMAC, vigencia de 5 min); sin firma válida → `401`.
- [ ] Resuelve al actor a una persona de la app y valida su alcance sobre **cada objeto** (no confía en el `scope` de Guardify para decidir si procede).
- [ ] Reutiliza la lógica de negocio existente de la pantalla de la app (no la duplica) y registra al **actor real** en su propia auditoría.
- [ ] Idempotencia por `idempotencyKey`.
- [ ] Errores tipados de la tabla; nunca `200` con un cuerpo de error.
- [ ] Datos ausentes como `null`.
- [ ] Pruebas automáticas de cada acción y de cada error contra datos creados desde la app.
