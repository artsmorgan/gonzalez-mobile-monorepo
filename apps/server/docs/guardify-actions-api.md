# API de acciones para Guardify

Contrato completo (autenticación, errores, idempotencia): `docs/protocolo-acciones.md` del repo de Guardify (guard-desk-nexus). Aquí, lo que implementa esta app.

## Rutas (servidor a servidor)
```
GET  /api/guardify/actions/{tipo}/{id}            → { id, estado, campos: [], adjuntos: [], firmas: [], acciones, datos, historial }
POST /api/guardify/actions/{tipo}/{id}/{accion}   → { estado, ref, message }   (cabecera Idempotency-Key obligatoria)
GET  /api/guardify/actions/lookup/empleado?codigo= → { id, codigo, nombre }    (para elegir el reemplazo de un turno)
```
Tipos: `permisos` (`c_solicitud_permiso`) y `mutuos-acuerdos` (`e_mutuos_acuerdos`). Acciones: `aprobar` y `rechazar`.
Los campos, adjuntos y firmas del registro los dibuja Guardify con el formulario del reporte (`/api/guardify/reports/{modulo}/forms`); el detalle trae el estado, las acciones que ESTE actor puede ejecutar, el historial y, en `permisos`, `datos.turnos` (id, etiqueta y reemplazo actual de cada turno).

## Autenticación
`Authorization: Bearer <GUARDIFY_REPORTS_API_KEY>` (la misma llave de los reportes) **y** la identidad del actor firmada (`x-guardify-actor` + `x-guardify-actor-sig`, HMAC-SHA256 con esa misma llave, vigencia de 5 minutos). El actor se resuelve a un empleado por `externalId` (id), `cedula` o correo; si no hay UNA coincidencia clara → `403 out_of_scope`.

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

## Lo que NO hace
- **Sin evidencia de dispositivo:** la escritura va por la API dinámica con el token móvil del servidor (`shouldVerifyAccessToken: false`), así que no genera la fila de `c_evidencia_registro` que sí genera una acción hecha desde el teléfono. El rastro queda en la bitácora de la app (`c_cambios_apps_modules`) y en la de Guardify.
- **Idempotencia por estado**, sin tabla de claves: si el mismo actor repite `rechazar` o `aprobar` sobre un registro que él ya resolvió, devuelve el mismo resultado sin escribir; otro actor recibe `409 already_resolved`.
