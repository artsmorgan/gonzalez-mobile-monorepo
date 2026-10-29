# API de acciones para Guardify

Contrato completo (autenticación, errores, idempotencia): [`protocolo-acciones.md`](./protocolo-acciones.md), copia del que mantiene Guardify (guard-desk-nexus). Aquí, lo que implementa esta app.

## Rutas (servidor a servidor)
```
GET  /api/guardify/actions/{tipo}/{id}            → { id, estado, campos: [], adjuntos: [], firmas: [], acciones, datos, historial }
POST /api/guardify/actions/{tipo}/{id}/{accion}   → { estado, ref, message }   (cabecera Idempotency-Key obligatoria)
GET  /api/guardify/actions/lookup/empleado?codigo= → { id, codigo, nombre }    (para elegir el reemplazo de un turno)
```
Tipos: `permisos` (`c_solicitud_permiso`) y `mutuos-acuerdos` (`e_mutuos_acuerdos`). Acciones: `aprobar` y `rechazar`.
Los campos, adjuntos y firmas del registro los dibuja Guardify con el formulario del reporte (`/api/guardify/reports/{modulo}/forms`); el detalle trae el estado, las acciones que ESTE actor puede ejecutar, el historial y, en `permisos`, `datos.turnos` (id, etiqueta y reemplazo actual de cada turno).

## Autenticación
`Authorization: Bearer <GUARDIFY_REPORTS_API_KEY>` (la misma llave de los reportes) **y** la identidad del actor firmada (`x-guardify-actor` + `x-guardify-actor-sig`, HMAC-SHA256 con esa misma llave, vigencia de 5 minutos). El actor se resuelve a un empleado por `externalId` (id), `cedula` o correo; si no hay UNA coincidencia clara → `403 out_of_scope`. Si Guardify manda id y cédula y no coinciden, no se actúa; un empleado dado de baja (`estado` «BA») no actúa. Quien es **parte** del registro (el solicitante de un permiso, o quien se ausenta o reemplaza en un mutuo) no lo resuelve. Quien no tiene nada que resolver ve solo el estado (sin turnos, nombres ni historial).

## Qué reglas aplica (las de la app, sin cambios)
- **Permisos:** puede resolver el ejecutivo de cuenta de la solicitud o su supervisor, solo si está `pendiente`.
- **Mutuos acuerdos:** puede resolver quien tiene como supervisor al ejecutivo de cuenta del acuerdo, solo si está pendiente y **ambos empleados ya aceptaron**.
- La lógica es la **misma** que la de las rutas de la app: `PUT /api/permit-request/[id]` (aprobar), `.../reject`, `PUT /api/mutuos-acuerdos/[id]/firma-ejecutivo` (aprobar) y `.../reject` ahora llaman a `utils/guardifyActions/` (`aprobar-permiso.ts`, `aprobar-mutuo.ts`, `permisos.ts`, `mutuos.ts`) con los mismos mensajes y estados HTTP. Cambios de estado, bitácora (`c_cambios_apps_modules`, con el empleado actor y el origen «Guardify (correo)») y notificaciones push son idénticos.
- El **motivo** se guarda en la bitácora (`motivo_rechazo` al rechazar, `observacion_guardify` al aprobar).

## Aprobar y Planillas
Aprobar un permiso crea el permiso en **Planillas** (`POST {PLANILLAS_URL}/acciones/permisos`, uno por turno o uno solo si el reemplazo es el mismo) y aprobar un mutuo crea el cambio de guardia (`POST {PLANILLAS_URL}/cdg`), con el token de Planillas **del ejecutivo**. Para no pedir nada nuevo a Planillas se usa el que la propia app ya guarda cuando la persona entra con su contraseña de Planillas: `a_mobile_token_for_planillas` (`utils/createTokenPlanillas.ts`), el mismo que la app reenvía hoy al sincronizar lo pendiente.
- Si hay un token **vigente** (se compara con la hora «de pared» de Costa Rica, igual que se calculó `expires_at`), se usa.
- Si no hay, o venció: `409 planillas_session_required` **sin tocar nada**; la persona debe abrir MonitoreApp y escribir su contraseña de Planillas, y reintentar.
- Se comprueba **antes** de llamar. Heredado de la ruta original del mutuo: el acuerdo queda `aprobado` antes de crear el cambio de guardia, así que si Planillas lo rechaza queda aprobado sin cambio de guardia; por eso importa no llegar ahí con un token vencido.
- `aprobar` pide **solo la firma manual** del ejecutivo (`signatures: [{ role: "manual", image: "data:image/png|jpeg;base64,…" }]`, hasta 1.000.000 caracteres; sin ella `400 signature_required`, si no es imagen o pasa del tope `400 invalid_request`). **La firma digital la genera el servidor** (`firmaDigitalDeActor`: `base64(guardify-<huella>:<actor>:::<marca de tiempo del actor firmado>)`, la forma de la que arma la app, determinista para la misma petición) y **no se acepta del cliente** (`role: "digital"` → `400 invalid_request`). En permisos, además, `params`: `{ turnos: [{ id, reemplazoId }], reemplazoObligatorio, observaciones }`.

## Cargas masivas
```
POST /api/guardify/actions/imports/inventario-puesto   { modo: "validar" | "aplicar", filas: [{ codigo_puesto, numero_articulo, cantidad, serie, marca, modelo?, fecha_entrega }] }
  → 200 { modo, creados: { planes, entregas }, omitidos: ["Fila N: motivo", …], filas: [{ fila, estado: "creada" | "omitida" | "error", motivo }], resumen: { recibidas, creadas, omitidas, errores }, mensaje, evidencia? }
  → 400 { code, message, errores: ["Artículo 3: serie obligatoria.", …], filas, resumen }      409 { code: "planillas_session_required" }      502 { code: "planillas_unavailable" }
```
**Resultado por fila y conteo honesto (#195).** `creadas + omitidas + errores = recibidas`. Planillas recibe una sola fila por (puesto, artículo): con series distintas viaja una y las demás se informan como **omitidas** (con el número de la fila que sí viaja); una fila repetida igual en la misma carga sale «Repetida en la carga». `creados` cuenta lo que llega a Planillas. Tope: `INVENTARIO_MAX_FILAS = 2000` (`utils/guardifyActions/inventario.ts`). `aplicar` **exige** `Idempotency-Key` (#197); el error de Planillas sale `502 planillas_unavailable`.
Misma lógica que `POST /api/mantenimiento-equipo/bulk-articulos` (esa ruta ahora llama a `utils/guardifyActions/inventario.ts`): valida cada fila (fecha `DD-MM-YYYY`), comprueba que los artículos y los códigos de puesto existan, **omite lo ya cargado** (plan o entrega repetidos: repetir una carga no duplica) y manda el resto a Planillas (`POST {PLANILLAS_URL}/articulos-puesto/carga-masiva`) con el token de Planillas guardado de la persona. `validar` hace todo menos el envío (no escribe nada y no pide la sesión de Planillas); `aplicar` lo envía. Máximo 2000 filas por carga. La plantilla de Excel y su lectura son de Guardify (la app recibe filas en JSON ya leídas y validadas).
Las **actividades** no tienen carga masiva en la app (se crean una a una en `/api/activities/created`) y no hay plantilla definida: pendiente.

## Evidencia (#193)
Aprobar, rechazar y la carga `aplicar` dejan en `c_evidencia_registro` la misma fila que deja la acción hecha desde el teléfono, con **origen «Guardify»**: `ubicacion_origen = "guardify"`, `usuario_id` y `cedula` del actor ya resuelto, `sesion_id` = SHA-256 de la firma de la petición (`x-guardify-actor-sig`: la huella de lo que Guardify firmó) y **sin datos de dispositivo ni ubicación** (null; Guardify muestra «-»). Una fila por acción (en la carga, una por puesto que recibió algo, en una sola escritura). El reintento con la misma `Idempotency-Key` no crea otra. La respuesta trae `evidencia: "registrada" | "pendiente"`.
**Si no se puede escribir** la acción **no se revierte** (ya se aplicó, p. ej. en Planillas, y deshacerla no es seguro): se reintenta una vez, el error queda en `error_logs` con lo necesario para reconstruir la fila, y la respuesta dice `evidencia: "pendiente"`. El rastro de bitácora (`c_cambios_apps_modules`) no se pierde.

## Lo que NO hace
- **Idempotencia por clave** (tabla `c_clave_idempotencia`, ver `docs/idempotencia-servidor.md`): la misma `Idempotency-Key` sobre la misma acción devuelve el resultado original sin repetir el efecto, aunque el estado ya haya cambiado; con otra acción, otro registro u otra persona es `409 conflict`. Además, si el mismo actor repite `rechazar` o `aprobar` con una clave nueva sobre un registro que él ya resolvió, devuelve el mismo resultado sin escribir; otro actor recibe `409 already_resolved`.

## Fallos y garantías
- **Si Planillas falla al aprobar un mutuo, el acuerdo vuelve a pendiente y sin firmas** (se revisa todo lo revisable antes de escribir, se reserva el acuerdo, se llama a Planillas y, si falla, se revierte): no queda «aprobado» sin cambio de guardia y se puede reintentar. Esto cambia el comportamiento heredado de la ruta de la app (que lo dejaba aprobado). En permisos, Planillas se llama antes de escribir; si falla a la mitad de varios turnos, los ya creados allá quedan: por eso el error de Planillas pide revisar en Planillas antes de reintentar.
- **Errores tipados (#196):** todo 4xx lleva `code` de la tabla del protocolo; el 401 es `{ code: "unauthorized", message }` (con `error: "unauthorized"` como alias por una versión). Las excepciones son de infraestructura y van sin `code`: `502` de Planillas sin respuesta y `503` (API sin configurar o almacén de claves caído), que Guardify lee como «app no disponible».
- Errores de Planillas: `401` → `409 planillas_session_required`; `403` → `403 out_of_scope`; otro `4xx` → `400 invalid_request`; `5xx` o sin respuesta (plazo de 30 s) → `502 planillas_unavailable`. Un fallo de servidor conserva su estado `500`.
- **Candado por registro (#197), entre procesos:** dos peticiones sobre el mismo registro —aunque traigan claves distintas— no se ejecutan a la vez (reserva atómica en `c_clave_idempotencia`, además del candado en memoria). La segunda **espera** (hasta 2 s) a que se libere y entonces su comprobación de estado responde `409 already_resolved`; si sigue ocupado, `409 conflict`. En la carga el candado es **por persona y tipo de carga**. Si el almacén no responde, no se ejecuta nada (`503` sin `code`).
- La hora de la acción es la del servidor; la que mande el cliente no se usa.
- Cuerpos de más de ~2,5 MB → `413`. Reemplazos y reemplazo obligatorio deben ser enteros; un permiso sin turnos se rechaza.
- Las llamadas internas de una acción (notificaciones, push y registro de errores) van con el token móvil del servidor y sin JWT de usuario (`utils/internalRequests.ts`); `reportError` dejó de fallar sin JWT y ahora guarda el mensaje real del error.
- Carga: fechas con calendario real (`31-02` es inválida), `numero_articulo` y `cantidad` solo número o texto numérico, y textos acotados.
