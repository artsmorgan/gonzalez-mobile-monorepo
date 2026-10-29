# Inventario de rutas de la API (generado)

Generado con `scripts/auditRoutes.ts` (análisis estático, ver `utils/routeAudit.ts`). **No lo edites a mano**: vuelve a generarlo.
«Alcance» = la ruta llama a un control de pertenencia del objeto (`authorizeSelfOrAdmin`, `authorizeMarcaAccess`, `authorizeReportesOperation`, `isSuperAdminEmpleado`).

Total: 286 rutas; con verificación de sesión: 275; con control de alcance: 16.

| Endpoint | Métodos | Autenticación | IDs de objeto (ruta / query / cuerpo) | BD directa | Identidad | Alcance |
|---|---|---|---|---|---|---|
| `acta-entrega-productos` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, division_id, contrato_id, corpo_id / marca_id, empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id | sí | sí | no |
| `acta-entrega-productos/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id | no | sí | no |
| `acta-entrega-productos/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `acta-entrega-productos/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `acta-entrega-productos/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `activities` | GET, POST | verifyAccessTokenByApi | — / — / marca_id | sí | sí | no |
| `activities/[id]` | PUT | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `activities/[id]/get-image` | GET | delegada (API dinámica) | id / — / — | no | no | no |
| `activities/created/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `activities/created/[id]/duplicate` | POST | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `activities/created/[id]/puestos` | POST | verifyAccessTokenByApi | id / — / marca_id | sí | sí | no |
| `activities/created/[id]/puestos/[puestoId]` | DELETE | verifyAccessTokenByApi | id, puestoId / — / — | no | sí | no |
| `activities/created/puesto/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `activities/equipo/[id]` | PUT | verifyAccessTokenByApi | id / — / articulo_id | sí | no | no |
| `activities/equipo/[id]/get-image` | GET | delegada (API dinámica) | id / article_id / — | no | no | no |
| `activities/marca/[id]` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `agenda-minuta` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id | sí | sí | no |
| `agenda-minuta/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `agenda-minuta/[id]/get-image/[name]` | GET | delegada (API dinámica) | id, name / — / — | no | no | no |
| `agenda-minuta/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `agenda-minuta/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `apreciacion-vulnerabilidad` | GET, POST | verifyAccessTokenByApi | — / — / — | sí | sí | no |
| `apreciacion-vulnerabilidad/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `apreciacion-vulnerabilidad/[id]/firma-solicitante` | PUT | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `apreciacion-vulnerabilidad/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `apreciacion-vulnerabilidad/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `articulo-mantenimiento` | POST | verifyAccessTokenByApi | — / — / — | no | no | no |
| `articulo-mantenimiento/[id]` | PUT | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `articulo-mantenimiento/[id]/archivos/[archivoId]` | DELETE | verifyAccessTokenByApi | id, archivoId / — / — | no | no | no |
| `articulo-mantenimiento/[id]/get-audio/[audio]` | GET | verifyAccessTokenByApi | id, audio / — / — | no | no | no |
| `articulo-mantenimiento/[id]/get-file/[file]` | GET | verifyAccessTokenByApi | id, file / — / — | no | no | no |
| `articulo-mantenimiento/[id]/get-image/[image]` | GET | verifyAccessTokenByApi | id, image / — / — | no | no | no |
| `articulo-mantenimiento/[id]/get-video/[video]` | GET | verifyAccessTokenByApi | id, video / — / — | no | no | no |
| `articulo-mantenimiento/asignado/[id]/movimientos` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `articulo-mantenimiento/asignado/[id]/movimientos/[movId]` | PUT, DELETE | verifyAccessTokenByApi | id, movId / — / — | sí | sí | no |
| `articulo-mantenimiento/plan/[id]/movimientos` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `articulo-mantenimiento/plan/[id]/movimientos/[movId]` | PUT, DELETE | verifyAccessTokenByApi | id, movId / — / — | sí | sí | no |
| `articulo-mantenimiento/puesto/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `articulos` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `attendance-control` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, division_id, contrato_id, corpo_id / — | sí | sí | no |
| `attendance-control/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `attendance-control/[id]/employee-signature` | PUT | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `attendance-control/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `attendance-control/[id]/images/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `attendance-control/[id]/refresh-colaboradores` | POST | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `attendance-control/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `attendance-control/marcas` | GET | verifyAccessTokenByApi | — / corpo_id / — | sí | no | no |
| `attendance/[id]` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `attendance/[id]/absent-reason` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `attendance/[id]/dev-create-marca` | POST | verifyAccessTokenByApi | id / — / — | no | sí | sí |
| `attendance/[id]/early-leaving` | GET | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `attendance/[id]/revert-leaving` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `attendance/user/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `attendance/user/[id]/next` | GET | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `auth/[id]/current-company` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `auth/login` | POST | delegada (API dinámica) | — / — / — | sí | no | no |
| `auth/logout` | POST | **ninguna** | — / — / — | no | no | no |
| `auth/permissions` | GET | verifyAccessTokenByApi | — / — / id | no | no | no |
| `auth/planillas-token` | POST | verifyAccessToken | — / — / — | sí | sí | no |
| `auth/refresh-token` | POST | **ninguna** | — / — / guardifyDeviceId, guardifySessionId | sí | sí | no |
| `bitacora-vehiculo-detenido` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, sucursal_id / — | sí | no | no |
| `bitacora-vehiculo-detenido/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | no | no |
| `bitacora-vehiculo-detenido/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `bitacora-vehiculo-detenido/[id]/image/[image]` | DELETE | verifyAccessTokenByApi | id, image / — / — | no | no | no |
| `cambios-apps-modules` | GET | verifyAccessTokenByApi | — / registro_id, id / — | sí | no | no |
| `categoria-mantenimiento` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `categories` | GET | delegada (API dinámica) | — / — / — | no | no | no |
| `check-permissions` | GET | verifyAccessTokenByApi | — / id / — | sí | sí | sí |
| `checklist-supervision` | GET, POST | verifyAccessTokenByApi | — / cliente_id, corpo_id, puesto_id / — | sí | no | no |
| `checklist-supervision/[id]` | GET, PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | no | no |
| `checklist-supervision/[id]/get-image/[name]` | GET | delegada (API dinámica) | id, name / — / — | no | no | no |
| `complaints-master` | POST | verifyAccessTokenByApi | — / — / — | sí | sí | no |
| `complaints-master/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / empresa_id, cliente_id, contrato_id, corpo_id, puesto_id, plaza_id, division_id | no | sí | no |
| `complaints-master/[id]/files/[fileId]` | DELETE | verifyAccessTokenByApi | id, fileId / — / — | no | no | no |
| `complaints-master/[id]/get-audio/[audio]` | GET | delegada (API dinámica) | id, audio / — / — | no | no | no |
| `complaints-master/[id]/get-file/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `complaints-master/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `complaints-master/[id]/get-video/[video]` | GET | delegada (API dinámica) | id, video / — / — | no | no | no |
| `complaints-master/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `complaints-master/tipo-clientes` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `complaints-master/tipo-quejas` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `corporate-vehicles` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, corpo_id / empresa_id, cliente_id, corpo_id, division_id, contrato_id, puesto_id | sí | sí | no |
| `corporate-vehicles/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `corporate-vehicles/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `corporate-vehicles/[id]/get-maintenance-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `corporate-vehicles/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `corporate-vehicles/[id]/maintenances` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `corporate-vehicles/[id]/uses` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `corporate-vehicles/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `corporate-vehicles/maintenances/[maintenance_id]` | PUT, DELETE | verifyAccessTokenByApi | maintenance_id / — / — | no | sí | no |
| `corporate-vehicles/maintenances/[maintenance_id]/image/[slot]` | DELETE | verifyAccessTokenByApi | maintenance_id, slot / — / — | no | no | no |
| `corporate-vehicles/uses/[use_id]` | GET, PUT, DELETE | verifyAccessTokenByApi | use_id / — / — | no | sí | no |
| `digital-signature/generate-signature` | POST | verifyAccessTokenByApi | — / — / — | no | sí | no |
| `digital-signature/manual-signature/[id]` | GET, PUT | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `document-types` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `documentos-entregados` | GET, POST | verifyAccessTokenByApi | — / corpo_id / — | sí | sí | no |
| `documentos-entregados/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / corpo_id, cliente_id / — | no | sí | no |
| `dynamic-prisma` | GET, POST | verifyAccessToken | — / — / — | no | no | no |
| `dynamic-prisma/auth/login` | POST | **ninguna** | — / — / — | sí | no | no |
| `dynamic-prisma/auth/logout` | POST | **ninguna** | — / — / — | sí | no | no |
| `dynamic-prisma/auth/refresh-token` | POST | **ninguna** | — / — / — | sí | no | no |
| `dynamic-prisma/files` | POST, GET, DELETE | verifyAccessToken | — / — / — | no | no | no |
| `dynamic-prisma/reportes` | POST | **ninguna** | — / — / — | no | no | no |
| `empleados` | GET | verifyAccessTokenByApi | — / ids / — | sí | no | no |
| `empleados/[id]` | GET, PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `empleados/[id]/notas/[id-nota]` | DELETE | verifyAccessTokenByApi | id, id-nota / — / — | no | sí | no |
| `empleados/codigo/[codigo]` | GET | verifyAccessTokenByApi | codigo / — / — | sí | no | no |
| `empleados/corpo/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `encuesta-nps` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id / marca_id, empresa_id, cliente_id, division_id, corpo_id, puesto_id, contrato_id | sí | sí | no |
| `encuesta-nps/[id]` | DELETE, PUT, PATCH | verifyAccessTokenByApi | id / — / empresa_id, cliente_id, division_id, corpo_id, puesto_id, contrato_id | sí | sí | no |
| `encuesta-nps/puestos` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `entrega-puestos` | GET, POST | verifyAccessTokenByApi | — / — / — | sí | sí | no |
| `entrega-puestos/[id]/get-image/[image]` | GET | verifyAccessTokenByApi | id, image / — / — | no | no | no |
| `entrega-puestos/puesto/[id]` | GET | verifyAccessTokenByApi | id / empleado_id / — | no | no | no |
| `evaluation` | POST | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `evaluation/[id]` | DELETE, PATCH | verifyAccessTokenByApi | id / — / — | no | no | no |
| `evaluation/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `evaluation/corpo/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `executives` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `general-induction-register` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, corpo_id / empresa_id, cliente_id, corpo_id, division_id, contrato_id, puesto_id | sí | sí | no |
| `general-induction-register/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `general-induction-register/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `general-induction-register/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `general-induction-register/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `guardify/actions/[tipo]/[id]` | GET | guardify-key | tipo, id / — / — | no | no | sí |
| `guardify/actions/[tipo]/[id]/[accion]` | POST | guardify-key | tipo, id, accion / — / — | no | no | sí |
| `guardify/actions/imports/[tipo]` | POST | guardify-key | tipo / — / — | no | no | no |
| `guardify/actions/lookup/empleado` | GET | guardify-key | — / — / — | no | no | no |
| `guardify/db/status` | GET | guardify-key | — / — / — | no | no | no |
| `guardify/documents` | POST | guardify-key | — / — / — | no | no | no |
| `guardify/documents/dispatches` | POST | guardify-key | — / — / — | no | no | no |
| `guardify/documents/dispatches/[id]/end` | POST | guardify-key | id / — / — | no | no | no |
| `guardify/documents/preview` | POST | guardify-key | — / — / — | no | no | no |
| `guardify/evidence` | GET | guardify-key | — / — / — | no | no | no |
| `guardify/reports/[modulo]` | GET | guardify-key | modulo / — / — | no | no | no |
| `guardify/reports/[modulo]/aggregate` | GET | guardify-key | modulo / — / — | no | no | no |
| `guardify/reports/[modulo]/forms` | GET | guardify-key | modulo / — / — | no | no | no |
| `guardify/reports/[modulo]/forms/ids` | GET | guardify-key | modulo / — / — | no | no | no |
| `guardify/reports/[modulo]/options` | GET | guardify-key | modulo / — / — | no | no | no |
| `guardify/structure` | GET | guardify-key | — / — / — | no | no | no |
| `incidents` | GET, POST | verifyAccessTokenByApi | — / corpo_id / — | sí | sí | no |
| `incidents/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `incidents/[id]/contributions` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `incidents/[id]/contributions/[contributionId]` | PUT, DELETE | verifyAccessTokenByApi | id, contributionId / — / — | no | no | no |
| `incidents/[id]/contributions/[contributionId]/files/[fileId]` | DELETE | verifyAccessTokenByApi | id, contributionId, fileId / — / — | no | no | no |
| `incidents/[id]/contributions/[contributionId]/get-audio/[audio]` | GET | delegada (API dinámica) | id, contributionId, audio / — / — | no | no | no |
| `incidents/[id]/contributions/[contributionId]/get-file/[file]` | GET | delegada (API dinámica) | id, contributionId, file / — / — | no | no | no |
| `incidents/[id]/contributions/[contributionId]/get-image/[image]` | GET | delegada (API dinámica) | id, contributionId, image / — / — | no | no | no |
| `incidents/[id]/contributions/[contributionId]/get-video/[video]` | GET | delegada (API dinámica) | id, contributionId, video / — / — | no | no | no |
| `incidents/[id]/files/[fileId]` | DELETE | verifyAccessTokenByApi | id, fileId / — / — | no | no | no |
| `incidents/[id]/get-audio/[audio]` | GET | delegada (API dinámica) | id, audio / — / — | no | no | no |
| `incidents/[id]/get-file/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `incidents/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `incidents/[id]/get-video/[video]` | GET | delegada (API dinámica) | id, video / — / — | no | no | no |
| `incidents/classification` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `induction-tour-record` | GET, POST | verifyAccessTokenByApi | — / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id, plaza_id / marca_id, empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id, plaza_id | sí | sí | no |
| `induction-tour-record/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id, plaza_id | no | sí | no |
| `induction-tour-record/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `job-manuals` | GET, POST | verifyAccessTokenByApi | — / puesto_id, empleado_id / marca_id, empresa_id, cliente_id, corpo_id, division_id, contrato_id | sí | sí | no |
| `job-manuals/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `job-manuals/[id]/edit` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `job-manuals/[id]/empleados` | POST | verifyAccessTokenByApi | id / — / marca_id | sí | sí | no |
| `job-manuals/[id]/files/[fileId]` | DELETE | verifyAccessTokenByApi | id, fileId / marca_id / — | sí | sí | sí |
| `job-manuals/[id]/get-audio/[audio]` | GET | delegada (API dinámica) | id, audio / — / — | no | no | no |
| `job-manuals/[id]/get-file/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `job-manuals/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `job-manuals/[id]/get-video/[video]` | GET | delegada (API dinámica) | id, video / — / — | no | no | no |
| `job-manuals/[id]/puestos` | POST | verifyAccessTokenByApi | id / — / marca_id | sí | sí | no |
| `job-manuals/[id]/quiz-result` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `job-manuals/[id]/sign` | POST | verifyAccessTokenByApi | id / — / marca_id | sí | no | no |
| `job-manuals/[id]/visualizacion` | PATCH | verifyAccessTokenByApi | id / — / marca_id | sí | no | no |
| `job-manuals/[id]/visualizations/[visualizationId]/get-audio/[audio]` | GET | delegada (API dinámica) | id, visualizationId, audio / — / — | no | no | no |
| `job-manuals/[id]/visualizations/[visualizationId]/get-file/[file]` | GET | delegada (API dinámica) | id, visualizationId, file / — / — | no | no | no |
| `job-manuals/[id]/visualizations/[visualizationId]/get-image/[image]` | GET | delegada (API dinámica) | id, visualizationId, image / — / — | no | no | no |
| `job-manuals/[id]/visualizations/[visualizationId]/get-video/[video]` | GET | delegada (API dinámica) | id, visualizationId, video / — / — | no | no | no |
| `llaveros` | GET, POST | verifyAccessTokenByApi | — / corpo_id / — | sí | no | no |
| `llaveros/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `llaveros/[id]/movimientos` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `llaveros/[id]/movimientos/[movId]` | PUT, DELETE | verifyAccessTokenByApi | id, movId / — / — | sí | no | no |
| `llaves` | GET, POST | verifyAccessTokenByApi | — / corpo_id / — | sí | no | no |
| `llaves/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `llaves/[id]/movimientos` | GET, POST | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `llaves/[id]/movimientos/[movId]` | PUT, DELETE | verifyAccessTokenByApi | id, movId / — / — | sí | no | no |
| `lunch-time` | POST | verifyAccessTokenByApi | — / — / empleadoId, marca_id, empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id | sí | no | no |
| `lunch-time/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `lunch-time/[id]/test-ending-time` | GET | verifyAccessTokenByApi | id / — / — | sí | sí | sí |
| `lunch-time/horario/[id]/minutos-almuerzo` | PATCH | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `main-structure` | POST, GET | verifyMainStructureAccess | — / — / — | no | no | no |
| `main-structure/last` | GET | verifyMainStructureAccess | — / — / — | no | no | no |
| `mantenimiento-equipo` | GET | verifyAccessTokenByApi | — / puesto_id / — | sí | no | no |
| `mantenimiento-equipo/articulos-catalogo` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `mantenimiento-equipo/bulk-articulos` | POST | verifyAccessTokenByApi | — / — / — | no | no | no |
| `mantenimiento-equipo/plantilla/get-file` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `mantenimiento-equipo/validar-puestos-codigos` | POST | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `mobile-versions` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `mobile-versions/[version]` | GET | verifyAccessTokenByApi | version / — / — | no | no | no |
| `modules-release` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `modules-release/[id]` | PUT | verifyAccessTokenByApi | id / — / — | no | sí | sí |
| `mutuos-acuerdos` | GET, POST | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `mutuos-acuerdos/[id]` | PATCH | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `mutuos-acuerdos/[id]/firma-ejecutivo` | PUT | verifyAccessTokenByApi | id / — / — | no | no | no |
| `mutuos-acuerdos/[id]/reject` | PUT | verifyAccessTokenByApi | id / — / — | no | no | no |
| `mutuos-acuerdos/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | sí | no | no |
| `mutuos-acuerdos/marcas` | GET | verifyAccessTokenByApi | — / empleado_id / — | sí | no | no |
| `nomenclators/[tipo]` | GET, POST | verifyAccessTokenByApi | tipo / articulo_id / — | no | sí | sí |
| `nomenclators/[tipo]/[id]` | GET, PUT, DELETE | verifyAccessTokenByApi | tipo, id / — / — | no | sí | sí |
| `nomenclators/coordinadores-ejecutivos/options` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `nomenclators/empleados-ejecutivos/options` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `nomenclators/tipos-mantenimiento-articulos/options` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `non-conforming-product` | POST | verifyAccessTokenByApi | — / — / cliente_id, corpo_id, empresa_id, division_id, contrato_id, puesto_id | sí | sí | no |
| `non-conforming-product/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / cliente_id, corpo_id, empresa_id, division_id, contrato_id, puesto_id | no | sí | no |
| `non-conforming-product/[id]/archivo/[archivoId]` | DELETE | verifyAccessTokenByApi | id, archivoId / — / — | no | no | no |
| `non-conforming-product/[id]/get-audio/[audio]` | GET | delegada (API dinámica) | id, audio / — / — | no | no | no |
| `non-conforming-product/[id]/get-file/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `non-conforming-product/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `non-conforming-product/[id]/get-video/[video]` | GET | delegada (API dinámica) | id, video / — / — | no | no | no |
| `non-conforming-product/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `non-conforming-product/types` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `notification` | GET, POST | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `notification/plaza/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `opening-closing-position` | POST | verifyAccessTokenByApi | — / — / marca_id, cliente_id, corpo_id, puesto_id, division_id, empresa_id, contrato_id | sí | sí | no |
| `opening-closing-position/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / cliente_id, corpo_id, puesto_id, division_id, empresa_id, contrato_id | sí | sí | no |
| `opening-closing-position/[id]/get-image/[image]` | GET | delegada (API dinámica) | id, image / — / — | no | no | no |
| `opening-closing-position/[id]/image/[imageId]` | DELETE | verifyAccessTokenByApi | id, imageId / — / — | no | no | no |
| `opening-closing-position/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | sí | no | no |
| `password/check-recovery-password-token` | GET | delegada (API dinámica) | — / — / — | sí | no | no |
| `password/forgot-password` | POST | **ninguna** | — / — / — | sí | no | no |
| `password/recover-password/[token]` | PUT | delegada (API dinámica) | token / — / — | sí | no | no |
| `permit-request` | GET, POST | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `permit-request/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `permit-request/[id]/file` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `permit-request/[id]/get-audio/[audio]` | GET | verifyAccessTokenByApi | id, audio / — / — | sí | no | no |
| `permit-request/[id]/get-file/[file]` | GET | verifyAccessTokenByApi | id, file / — / — | sí | no | no |
| `permit-request/[id]/get-image/[image]` | GET | verifyAccessTokenByApi | id, image / — / — | sí | no | no |
| `permit-request/[id]/get-video/[video]` | GET | verifyAccessTokenByApi | id, video / — / — | sí | no | no |
| `permit-request/[id]/reject` | PUT | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `permit-request/corpo/[corpo_id]` | GET | verifyAccessTokenByApi | corpo_id / — / — | no | no | no |
| `permit-request/plazas` | GET | verifyAccessTokenByApi | — / — / — | sí | no | no |
| `permit-request/turnos` | GET | verifyAccessTokenByApi | — / plaza_id / — | sí | no | no |
| `physical-minute-agenda` | POST | **ninguna** | — / — / — | no | no | no |
| `physical-minute-agenda/[id]` | PUT, DELETE | **ninguna** | id / — / — | no | no | no |
| `physical-minute-agenda/corpo/[corpo_id]` | GET | **ninguna** | corpo_id / — / — | no | no | no |
| `puestos/[id]/notas` | GET, POST | verifyAccessTokenByApi | id / puesto_id / marca_id, empleado_id, categoria_id, empresa_id, cliente_id, division_id, contrato_id, corpo_id | sí | no | no |
| `puestos/[id]/notas/[id-nota]` | GET, PUT, DELETE | verifyAccessTokenByApi | id, id-nota / — / marca_id, categoria_id, empleado_id, empresa_id, cliente_id, division_id, contrato_id, corpo_id | sí | sí | no |
| `puestos/[id]/notas/[id-nota]/changes` | GET | verifyAccessTokenByApi | id, id-nota / — / — | sí | no | no |
| `puestos/[id]/notas/[id-nota]/get-image/[image]` | GET | delegada (API dinámica) | id, id-nota, image / — / — | no | no | no |
| `puestos/[id]/notas/[id-nota]/images/[imageId]` | DELETE | verifyAccessTokenByApi | id, id-nota, imageId / — / — | no | no | no |
| `puestos/[id]/ubicacion` | GET, PUT | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `puestos/corpo/[id]` | GET | verifyAccessTokenByApi | id / — / — | sí | no | no |
| `puestos/notas/[id]/get-image/[image]` | GET | verifyAccessTokenByApi | id, image / — / — | no | no | no |
| `puestos/notas/puesto/[puesto_id]` | GET | verifyAccessTokenByApi | puesto_id / — / — | sí | no | no |
| `puestos/notas/send-email` | POST | verifyAccessTokenByApi | — / — / puesto_id | sí | no | no |
| `push/register` | POST | verifyAccessTokenByApi | — / — / — | no | sí | no |
| `push/send` | POST | verifyAccessTokenByApi | — / — / — | no | no | no |
| `push/unregister` | POST | verifyAccessTokenByApi | — / — / — | no | sí | no |
| `reglas` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `reglas/roles` | GET, POST | verifyAccessTokenByApi | — / — / — | no | no | no |
| `reportes` | GET, POST | verifyAccessToken | — / listEmpleadoIngresoId, listEmpleadoIngresoIds, listLmEmpleadoIds, listAcpCreatedByIds, listIncClasificacionId, listLlvRecibidoPor, listLlrRecibidoPor, listBnvCategoriaId, listRigColaboradorPuestoIds, listIncEjecutivoIds / — | no | no | no |
| `reportes/mobile/[id]/get-file` | GET | delegada (API dinámica) | id / — / — | no | no | no |
| `reportes/mobile/reports-download` | GET | delegada (API dinámica) | — / ids, report_ids / — | no | no | no |
| `roles` | GET, POST | verifyAccessTokenByApi | — / — / — | no | no | no |
| `roles/[id]` | GET, PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | no | no |
| `roles/reglas` | GET | verifyAccessTokenByApi | — / — / — | no | no | no |
| `server-time` | GET | **ninguna** | — / — / — | no | no | no |
| `training` | GET, POST | verifyAccessTokenByApi | — / corpo_id / — | sí | sí | no |
| `training/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / — | no | sí | no |
| `training/[id]/archivo` | DELETE | verifyAccessTokenByApi | id / — / — | no | no | no |
| `training/[id]/get-audio/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `training/[id]/get-file/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `training/[id]/get-image` | GET | delegada (API dinámica) | id / — / — | no | no | no |
| `training/[id]/get-image/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `training/[id]/get-video/[file]` | GET | delegada (API dinámica) | id, file / — / — | no | no | no |
| `traslado-plaza` | GET | verifyAccessTokenByApi | — / — / — | sí | sí | no |
| `traslado-plaza/[id]/get-file/[name]` | GET | delegada (API dinámica) | id, name / — / — | no | no | no |
| `traslado-plaza/[id]/upload-file` | PUT | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `uploads/visitors/[id]/cedula` | GET | delegada (API dinámica) | id / — / — | no | no | no |
| `vehicles` | GET, POST | verifyAccessTokenByApi | — / corpo_id / marca_id, corpo_id, puesto_id, empresa_id, cliente_id, division_id, contrato_id, puesto_salida_id | sí | sí | no |
| `vehicles/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / marca_id, corpo_id, puesto_id, empresa_id, cliente_id, division_id, contrato_id, puesto_salida_id | sí | sí | no |
| `vehicles/[id]/attachment` | DELETE | verifyAccessTokenByApi | id / — / — | no | no | no |
| `vehicles/[id]/get-image` | GET | delegada (API dinámica) | id / — / — | no | no | no |
| `visitors` | GET, POST | verifyAccessTokenByApi | — / corpo_id / marca_id, corpo_id, puesto_id, puesto_salida_id | sí | sí | no |
| `visitors/[id]` | PUT, DELETE | verifyAccessTokenByApi | id / — / corpo_id, puesto_id, puesto_salida_id | sí | sí | no |
| `visitors/categories` | GET | delegada (API dinámica) | — / — / — | no | no | no |
| `voice-notes` | GET, POST | verifyAccessTokenByApi | — / corpo_id, puesto_id / — | sí | sí | no |
| `voice-notes/[id]` | PATCH, DELETE | verifyAccessTokenByApi | id / — / — | sí | sí | no |
| `voice-notes/[id]/get-note` | GET | delegada (API dinámica) | id / — / — | no | no | no |
