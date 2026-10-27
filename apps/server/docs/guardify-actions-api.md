# API de acciones para Guardify

Contrato completo (autenticación, errores, idempotencia): `docs/protocolo-acciones.md` del repo de Guardify (guard-desk-nexus). Aquí, lo que implementa esta app.

## Rutas (servidor a servidor)
```
GET  /api/guardify/actions/{tipo}/{id}            → { id, estado, campos: [], adjuntos: [], firmas: [], acciones, historial }
POST /api/guardify/actions/{tipo}/{id}/{accion}   → { estado, ref, message }   (cabecera Idempotency-Key obligatoria)
```
Tipos: `permisos` (`c_solicitud_permiso`) y `mutuos-acuerdos` (`e_mutuos_acuerdos`). Acción: `rechazar`.
Los campos, adjuntos y firmas del registro los dibuja Guardify con el formulario del reporte (`/api/guardify/reports/{modulo}/forms`); este detalle solo trae el estado, las acciones que ESTE actor puede ejecutar y el historial.

## Autenticación
`Authorization: Bearer <GUARDIFY_REPORTS_API_KEY>` (la misma llave de los reportes) **y** la identidad del actor firmada (`x-guardify-actor` + `x-guardify-actor-sig`, HMAC-SHA256 con esa misma llave, vigencia de 5 minutos). El actor se resuelve a un empleado por `externalId` (id), `cedula` o correo; si no hay UNA coincidencia clara → `403 out_of_scope`.

## Qué reglas aplica (las de la app, sin cambios)
- **Permisos:** puede rechazar el ejecutivo de cuenta de la solicitud o su supervisor, solo si está `pendiente`.
- **Mutuos acuerdos:** puede rechazar quien tiene como supervisor al ejecutivo de cuenta del acuerdo, solo si está pendiente y **ambos empleados ya aceptaron**.
- La lógica es la **misma** que la de las rutas de la app: `PUT /api/permit-request/[id]/reject` y `PUT /api/mutuos-acuerdos/[id]/reject` ahora llaman a `utils/guardifyActions/permisos.ts` y `mutuos.ts` (mismos mensajes y estados HTTP). Cambios de estado, bitácora (`c_cambios_apps_modules`, con el empleado actor y el origen «Guardify (correo)») y notificaciones push son idénticos.
- El **motivo** que mande Guardify se guarda en la bitácora como `motivo_rechazo`.

## Lo que NO hace (y por qué)
- **`aprobar` no existe:** aprobar un permiso crea el permiso en **Planillas** (`createPermisoInPlanillas`) y aprobar un mutuo crea el cambio de guardia (`POST {PLANILLAS_URL}/cdg`), ambos con el token de Planillas del propio ejecutivo. Guardify no lo tiene; hay que pedirle a Planillas cómo autenticar servidor a servidor en nombre de un ejecutivo. Hasta entonces `aprobar` nunca aparece en `acciones`.
- **Sin evidencia de dispositivo:** la escritura va por la API dinámica con el token móvil del servidor (`shouldVerifyAccessToken: false`), así que no genera la fila de `c_evidencia_registro` que sí genera una acción hecha desde el teléfono. El rastro queda en la bitácora de la app (`c_cambios_apps_modules`) y en la de Guardify.
- **Idempotencia por estado**, sin tabla de claves: si el mismo actor repite `rechazar` sobre un registro que él ya rechazó, devuelve el mismo resultado sin escribir; otro actor recibe `409 already_resolved`.
