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
- `aprobar` pide las dos firmas del ejecutivo (`signatures` con `role: "digital"` y `role: "manual"`, imagen como `data:` URL, mínimo 10 caracteres como en la app) y, en permisos, `params`: `{ turnos: [{ id, reemplazoId }], reemplazoObligatorio, observaciones }`.

## Cargas masivas
```
POST /api/guardify/actions/imports/inventario-puesto   { modo: "validar" | "aplicar", filas: [{ codigo_puesto, numero_articulo, cantidad, serie, marca, modelo?, fecha_entrega }] }
  → 200 { modo, creados: { planes, entregas }, omitidos: [...], mensaje }
  → 400 { code, message, errores: ["Artículo 3: serie obligatoria.", …] }      409 { code: "planillas_session_required" }
```
Misma lógica que `POST /api/mantenimiento-equipo/bulk-articulos` (esa ruta ahora llama a `utils/guardifyActions/inventario.ts`): valida cada fila (fecha `DD-MM-YYYY`), comprueba que los artículos y los códigos de puesto existan, **omite lo ya cargado** (plan o entrega repetidos: repetir una carga no duplica) y manda el resto a Planillas (`POST {PLANILLAS_URL}/articulos-puesto/carga-masiva`) con el token de Planillas guardado de la persona. `validar` hace todo menos el envío (no escribe nada y no pide la sesión de Planillas); `aplicar` lo envía. Máximo 2000 filas por carga. La plantilla de Excel y su lectura son de Guardify (la app recibe filas en JSON ya leídas y validadas).
Las **actividades** no tienen carga masiva en la app (se crean una a una en `/api/activities/created`) y no hay plantilla definida: pendiente.

## Lo que NO hace
- **Sin evidencia de dispositivo:** la escritura va por la API dinámica con el token móvil del servidor (`shouldVerifyAccessToken: false`), así que no genera la fila de `c_evidencia_registro` que sí genera una acción hecha desde el teléfono. El rastro queda en la bitácora de la app (`c_cambios_apps_modules`) y en la de Guardify.
- **Idempotencia por estado**, sin tabla de claves: si el mismo actor repite `rechazar` o `aprobar` sobre un registro que él ya resolvió, devuelve el mismo resultado sin escribir; otro actor recibe `409 already_resolved`.

## Fallos y garantías
- **Si Planillas falla al aprobar un mutuo, el acuerdo vuelve a pendiente y sin firmas** (se revisa todo lo revisable antes de escribir, se reserva el acuerdo, se llama a Planillas y, si falla, se revierte): no queda «aprobado» sin cambio de guardia y se puede reintentar. Esto cambia el comportamiento heredado de la ruta de la app (que lo dejaba aprobado). En permisos, Planillas se llama antes de escribir; si falla a la mitad de varios turnos, los ya creados allá quedan: por eso el error de Planillas pide revisar en Planillas antes de reintentar.
- Errores de Planillas: `401` → `409 planillas_session_required`; `403` → `403 out_of_scope`; otro `4xx` → `400 invalid_request`; `5xx` o sin respuesta (plazo de 30 s) → `502 planillas_unavailable`. Un fallo de servidor conserva su estado `500`.
- Dos acciones a la vez sobre el mismo registro (o dos cargas `aplicar`): la segunda recibe `409 conflict` (candado en el proceso; no protege entre procesos distintos).
- La hora de la acción es la del servidor; la que mande el cliente no se usa.
- Cuerpos de más de ~2,5 MB → `413`. Reemplazos y reemplazo obligatorio deben ser enteros; un permiso sin turnos se rechaza.
- Las llamadas internas de una acción (notificaciones, push y registro de errores) van con el token móvil del servidor y sin JWT de usuario (`utils/internalRequests.ts`); `reportError` dejó de fallar sin JWT y ahora guarda el mensaje real del error.
- Carga: fechas con calendario real (`31-02` es inválida), `numero_articulo` y `cantidad` solo número o texto numérico, y textos acotados.
