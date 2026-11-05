# Resumen de issues del repositorio

Repositorio: [artsmorgan/gonzalez-mobile-monorepo](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues)
Generado el 2026-10-13 a partir de la API pública de GitHub.

## Panorama general

- Total de issues: **31** (abiertos: **31**, cerrados: **0**).
- Todos tienen la etiqueta `auditoria-trazabilidad` ("Falta guardar quién/cuándo creó o modificó un registro, o su jerarquía"), fueron creados por `artsmorgan` el 2026-10-13, no tienen comentarios ni responsables asignados.
- Existe además un pull request abierto: [#80 "Servidor"](https://github.com/artsmorgan/gonzalez-mobile-monorepo/pull/80) de `AbrahamUdevs`.

## Contexto común a todos los issues

Guardify (la consola de reportes) exige que **todos los reportes lleven siempre** la jerarquía (empresa, cliente, división, contrato, sucursal, puesto) y las columnas de auditoría y trazabilidad (`id`, `creado`, `creado_por`, `modificado`, `modificado_por`). Donde la tabla no guarda esa información, el issue pide corregir el modelo en lugar de "maquillar" el reporte.

**Propuesta común:**
- Agregar a la tabla las columnas faltantes (`created_at`, `created_by`, `updated_at`, `updated_by`) con migración y relleno inicial razonable.
- Escribirlas en **todas** las rutas que crean o editan el registro (hoy varias editan sin dejar rastro).
- Mientras tanto, el reporte deriva esos datos del historial `c_cambios_apps_modules` cuando existe, o los entrega vacíos; los registros anteriores al historial quedan sin dato.

**Criterios de aceptación comunes:**
- [ ] La tabla guarda quién y cuándo creó y modificó cada registro.
- [ ] Las rutas de alta y edición lo escriben.
- [ ] El módulo de reportes de MonitoreApp (`apps/server/utils/guardifyReports/modules/`) lee las columnas propias en vez de derivarlas.
- [ ] El reporte en Guardify muestra las 5 columnas de auditoría con datos.

## Tabla resumen

| # | Tabla | Reporte(s) de Guardify | Brechas |
|---|-------|------------------------|---------|
| [#106](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/106) | `c_acta_entre_producto` | acta_entrega_productos | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#107](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/107) | `e_actividades` | actividades | `creado`; `creado_por`; `modificado`; `modificado_por`; `empresa/cliente/division/contrato/sucursal/puesto` |
| [#108](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/108) | `c_agenda_minuta` | agenda_minuta | `modificado`; `modificado_por` |
| [#109](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/109) | `c_apertura_cierre_puesto` | apertura_cierre_puesto | `modificado`; `modificado_por` |
| [#110](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/110) | `c_boleta_apreciacion_vulnerabilidad` | apreciacion_vulnerabilidad | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#111](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/111) | `e_estructura_articulo_corpo_puesto_plan` | articulos_puesto | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#112](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/112) | `e_estructura_articulo_corpo_puesto_entrega` | articulos_puesto | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#113](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/113) | `c_puesto_notas` | bitacora_novedades | `creado_por`; `modificado_por` |
| [#114](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/114) | `c_ubicacion_puesto_registro_cambios` | cambios_ubicacion_puesto | `modificado`; `modificado_por`; `empresa/cliente/division/contrato/sucursal` |
| [#115](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/115) | `c_checklist_supervision` | checklist_supervision | `modificado`; `modificado_por` |
| [#116](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/116) | `c_control_asistencia` | control_asistencia | `modificado`; `modificado_por` |
| [#117](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/117) | `e_control_documento_entregado_cliente` | documentos_entregados | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#118](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/118) | `c_encuesta_cliente` | encuesta_satisfaccion | `creado_por`; `modificado`; `modificado_por` |
| [#119](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/119) | `e_registro_entrega_puesto` | entrega_puesto | `modificado`; `modificado_por`; `empresa/contrato/division` |
| [#120](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/120) | `c_evaluacion_empleado` | evaluacion_personal | `creado_por`; `modificado`; `modificado_por` |
| [#121](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/121) | `c_incidente` | incidentes | `modificado`; `modificado_por` |
| [#122](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/122) | `refresh_token` | ingresos_usuario | `creado_por`; `modificado`; `modificado_por`; `empresa/cliente/division/contrato/sucursal/puesto` |
| [#123](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/123) | `e_llavero` | llaveros | `modificado`; `modificado_por` |
| [#124](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/124) | `e_llave` | llaves | `modificado`; `modificado_por` |
| [#125](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/125) | `c_login_marca_almuerzo` | login_marca | `creado`; `creado_por`; `modificado`; `modificado_por`; `empresa/cliente/division/contrato/sucursal/puesto` |
| [#126](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/126) | `c_articulo_mantenimiento` | mantenimiento_articulos | `creado_por`; `modificado_por` |
| [#127](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/127) | `c_notas_voz` | notas_voz | `modificado`; `modificado_por` |
| [#128](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/128) | `e_registro_capacitaciones` | registro_capacitaciones | `creado`; `creado_por`; `modificado`; `modificado_por` |
| [#129](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/129) | `c_vehiculos_corporativos` | registro_vehiculos_corporativos | `modificado`; `modificado_por` |
| [#130](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/130) | `e_registro_personas` | registro_visitas | `creado_por`; `modificado_por` |
| [#131](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/131) | `c_bitacora_vehiculo_detenido` | revision_vehiculos | `modificado`; `modificado_por` |
| [#132](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/132) | `v_vacacion_solicitud` | solicitud_vacaciones | `empresa/cliente/division/contrato/sucursal/puesto` |
| [#133](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/133) | `c_solicitud_permiso` | solicitudes_permiso | `modificado`; `modificado_por` |
| [#134](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/134) | `c_empleado_almuerzo` | tiempo_almuerzo | `creado`; `modificado`; `modificado_por` |
| [#135](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/135) | `e_registro_vehiculos` | visitas_vehiculos | `creado_por`; `modificado_por` |
| [#136](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/136) | `e_manual_puesto` | manuales_puesto | `modificado`; `modificado_por` |

## Detalle por issue

### [#106](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/106) — `c_acta_entre_producto`

- **Reporte(s) afectado(s):** acta_entrega_productos
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at; hoy solo se deduce de la entrada `__created__` del historial (null en registros anteriores al historial). Sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: la tabla no tiene created_by; se deduce del historial (null en registros anteriores). Sugerencia: agregar `created_by INT`
  - **`modificado`**: la tabla no tiene updated_at; se deduce de la última edición del historial (null si nunca se editó o es anterior al historial). Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; se deduce del historial. Sugerencia: agregar `updated_by INT`

### [#107](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/107) — `e_actividades`

- **Reporte(s) afectado(s):** actividades
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at; hoy sale del historial c_cambios_apps_modules (entrada `__created__`), que no existe para actividades anteriores al historial (null); sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: no hay created_by; sale del historial (mismo caveat); sugerencia: agregar `created_by INT`
  - **`modificado`**: no hay updated_at; sale de la última entrada del historial (si nunca se editó coincide con el alta; null si no hay historial); sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: no hay updated_by; sale del historial; sugerencia: agregar `updated_by INT`
  - **`empresa/cliente/division/contrato/sucursal/puesto`**: la actividad no guarda ubicación: se deduce de e_actividades_puesto; una actividad SIN puestos asignados sale con los 6 niveles null (por diseño)

### [#108](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/108) — `c_agenda_minuta`

- **Reporte(s) afectado(s):** agenda_minuta
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no guarda quién modificó; sugerencia: agregar `updated_by VARCHAR/INT` (created_by es texto con el id de empleado)

### [#109](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/109) — `c_apertura_cierre_puesto`

- **Reporte(s) afectado(s):** apertura_cierre_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy se deduce de la última fila de c_cambios_apps_modules (solo hay fila si la edición cambió algo). Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale de c_cambios_apps_modules.created_by de la última fila. Sugerencia: agregar `updated_by INT`

### [#110](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/110) — `c_boleta_apreciacion_vulnerabilidad`

- **Reporte(s) afectado(s):** apreciacion_vulnerabilidad
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at; hoy sale de la fecha de la primera fila del historial (c_cambios_apps_modules, __created__). Sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: la tabla no tiene created_by; hoy sale del autor de la primera fila del historial. Sugerencia: agregar `created_by INT`
  - **`modificado`**: la tabla no tiene updated_at; hoy se deduce de la última fila del historial. Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del autor de la última fila del historial. Sugerencia: agregar `updated_by INT`

### [#111](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/111) — `e_estructura_articulo_corpo_puesto_plan`

- **Reporte(s) afectado(s):** articulos_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at; sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: la tabla no guarda quién la creó; sugerencia: agregar `created_by INT`
  - **`modificado`**: la tabla no tiene updated_at ni historial en c_cambios_apps_modules; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: sugerencia: agregar `updated_by INT`

### [#112](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/112) — `e_estructura_articulo_corpo_puesto_entrega`

- **Reporte(s) afectado(s):** articulos_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla solo tiene `fechaEntrega` (fecha del hecho, ya expuesta como fecha_entrega), no la fecha de registro; sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: no guarda quién registró la entrega; sugerencia: agregar `created_by INT`
  - **`modificado`**: sin updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: sugerencia: agregar `updated_by INT`

### [#113](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/113) — `c_puesto_notas`

- **Reporte(s) afectado(s):** bitacora_novedades
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no tiene created_by; hoy sale del autor de la primera fila del historial (c_cambios_apps_modules, __created__). Sugerencia: agregar `created_by INT`
  - **`modificado_por`**: la tabla tiene updated_at pero no updated_by; hoy sale del autor de la última fila del historial (solo si hubo ediciones). Sugerencia: agregar `updated_by INT`

### [#114](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/114) — `c_ubicacion_puesto_registro_cambios`

- **Reporte(s) afectado(s):** cambios_ubicacion_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla es un registro de eventos sin updated_at ni historial. Sugerencia: agregar `updated_at DATETIME` (o declarar que esta tabla es inmutable)
  - **`modificado_por`**: sin updated_by ni historial. Sugerencia: agregar `updated_by INT` (o declarar que esta tabla es inmutable)
  - **`empresa/cliente/division/contrato/sucursal`**: la tabla solo guarda puesto_id; la jerarquía se deduce de la ubicación ACTUAL del puesto, no de la que tenía al momento del cambio. Sugerencia: agregar `empresa_id`, `cliente_id`, `division_id`, `contrato_id`, `corpo_id`

### [#115](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/115) — `c_checklist_supervision`

- **Reporte(s) afectado(s):** checklist_supervision
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy se deduce de la última fila de c_cambios_apps_modules. Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del autor de la última fila del historial. Sugerencia: agregar `updated_by INT`

### [#116](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/116) — `c_control_asistencia`

- **Reporte(s) afectado(s):** control_asistencia
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no guarda quién modificó; sugerencia: agregar `updated_by INT`

### [#117](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/117) — `e_control_documento_entregado_cliente`

- **Reporte(s) afectado(s):** documentos_entregados
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at; hoy solo se deduce de la entrada `__created__` del historial (null en registros anteriores al historial). Sugerencia: agregar `created_at DATETIME`
  - **`creado_por`**: la tabla no tiene created_by; se deduce del historial (null en registros anteriores). Sugerencia: agregar `created_by INT`
  - **`modificado`**: la tabla no tiene updated_at; se deduce de la última edición del historial (null si nunca se editó o es anterior al historial). Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; se deduce del historial. Sugerencia: agregar `updated_by INT`

### [#118](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/118) — `c_encuesta_cliente`

- **Reporte(s) afectado(s):** encuesta_satisfaccion
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no tiene created_by; hoy se obtiene del historial (c_cambios_apps_modules, entrada __created__) y queda null en encuestas anteriores al historial. Sugerencia: agregar `created_by INT` (id de c_empleado) y rellenarlo desde el historial
  - **`modificado`**: la tabla no tiene updated_at; se obtiene del historial (última entrada que no es __created__) y es null si nunca se editó o se editó antes del historial. Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by; se obtiene del historial. Sugerencia: agregar `updated_by INT`

### [#119](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/119) — `e_registro_entrega_puesto`

- **Reporte(s) afectado(s):** entrega_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial en c_cambios_apps_modules (la app no tiene PUT para entregas ni registra cambios). Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no tiene updated_by ni historial. Sugerencia: agregar `updated_by INT`
  - **`empresa/contrato/division`**: la tabla solo guarda cliente_id, corpo_id y puesto_id (no empresa_id, contrato_id ni division_id); esos niveles se deducen del cliente y de la sucursal actuales, no son el valor histórico del registro. Sugerencia: agregar `empresa_id`, `division_id` y `contrato_id` como en c_apertura_cierre_puesto

### [#120](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/120) — `c_evaluacion_empleado`

- **Reporte(s) afectado(s):** evaluacion_personal
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no tiene created_by y POST /api/evaluation no registra historial en c_cambios_apps_modules. Sugerencia: agregar `created_by INT` (id de c_empleado, del token). evaluador_id es la persona que evalúa pero lo manda la app en el cuerpo, no es el usuario autenticado
  - **`modificado`**: la tabla no tiene updated_at ni historial (PATCH /api/evaluation/[id] edita sin rastro). Sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: no hay updated_by ni historial. Sugerencia: agregar `updated_by INT`

### [#121](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/121) — `c_incidente`

- **Reporte(s) afectado(s):** incidentes
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial: PUT /api/incidents/[id] (solución del incidente) actualiza sin dejar rastro en c_cambios_apps_modules. Sugerencia: agregar `updated_at DATETIME` o registrar el cambio en c_cambios_apps_modules
  - **`modificado_por`**: no hay updated_by ni historial. Sugerencia: agregar `updated_by INT` (id de c_empleado)

### [#122](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/122) — `refresh_token`

- **Reporte(s) afectado(s):** ingresos_usuario
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: no hay created_by; se entrega el propio empleado (la sesión nace de su ingreso), igual que la columna `empleado`
  - **`modificado`**: la tabla no tiene updatedAt ni fecha de revocación (solo `revoked` booleano); sugerencia: agregar `updatedAt DATETIME` (o `revokedAt`)
  - **`modificado_por`**: no se guarda quién revoca; sugerencia: agregar `revokedBy INT`
  - **`empresa/cliente/division/contrato/sucursal/puesto`**: el ingreso no tiene unidad; se usa la plaza ACTUAL del empleado (c_empleado.plazaEmpleado_id -> c_empleado_plaza), no la del momento del ingreso. Empleado sin plaza: los 6 niveles null

### [#123](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/123) — `e_llavero`

- **Reporte(s) afectado(s):** llaveros
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy sale de la última fila de c_cambios_apps_modules (nombre_tabla='e_llavero'), que queda null en registros sin historial. Sugerido: agregar `updated_at DATETIME` a e_llavero
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='e_llavero'), null en registros sin historial. Sugerido: agregar `updated_by INT` a e_llavero

### [#124](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/124) — `e_llave`

- **Reporte(s) afectado(s):** llaves
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy sale de la última fila de c_cambios_apps_modules (nombre_tabla='e_llave'), que queda null en registros sin historial. Sugerido: agregar `updated_at DATETIME` a e_llave
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='e_llave'), null en registros sin historial. Sugerido: agregar `updated_by INT` a e_llave

### [#125](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/125) — `c_login_marca_almuerzo`

- **Reporte(s) afectado(s):** login_marca
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: no existe created_at; se usa `fecha_hora` (el registro nace en el mismo instante del ingreso de la sesión), por eso se renombró fecha -> creado. Sugerencia si se quiere exactitud: agregar `created_at DATETIME`
  - **`creado_por`**: no hay created_by; se entrega el propio empleado del ingreso (nombre_empleado), que es quien crea el registro al iniciar sesión
  - **`modificado`**: la tabla se actualiza al marcar (entrada/salida/almuerzo) pero no guarda cuándo; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: sugerencia: agregar `updated_by INT` (hoy solo se sabe el empleado, igual al creador)
  - **`empresa/cliente/division/contrato/sucursal/puesto`**: la tabla solo guarda `puesto_id` y solo después de marcar (nullable); los ingresos sin marca usan la plaza actual del empleado (c_empleado.plazaEmpleado_id -> c_empleado_plaza, buscado por cédula) y, si tampoco la tiene, los 6 niveles salen null

### [#126](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/126) — `c_articulo_mantenimiento`

- **Reporte(s) afectado(s):** mantenimiento_articulos
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no guarda quién creó el mantenimiento y el alta no deja entrada en c_cambios_apps_modules (solo la edición, PUT /api/articulo-mantenimiento/[id]); sugerencia: agregar `created_by INT` (o registrar un `__created__` en el historial al crear)
  - **`modificado_por`**: parcial: sale del último cambio de c_cambios_apps_modules; la tabla no tiene `updated_by`. Los mantenimientos nunca editados (o editados por rutas que no registran el cambio) quedan null; sugerencia: agregar `updated_by INT`

### [#127](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/127) — `c_notas_voz`

- **Reporte(s) afectado(s):** notas_voz
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial: PATCH /api/voice-notes/[id] edita título/descripción/estructura sin dejar rastro (solo la edita su creador); agregar `updated_at DATETIME`
  - **`modificado_por`**: sin updated_by ni historial; agregar `updated_by INT`

### [#128](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/128) — `e_registro_capacitaciones`

- **Reporte(s) afectado(s):** registro_capacitaciones
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at (solo `fecha` DATE, que es la fecha de la capacitación); agregar `created_at DATETIME`
  - **`creado_por`**: no hay created_by; hoy se usa `responsable_id` (usuario de la sesión que la creó, según el módulo). Sugerencia: agregar `created_by INT` explícito
  - **`modificado`**: la tabla no tiene updated_at ni historial: PUT /api/training/[id] edita sin escribir en c_cambios_apps_modules; agregar `updated_at DATETIME`
  - **`modificado_por`**: sin updated_by ni historial; agregar `updated_by INT`

### [#129](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/129) — `c_vehiculos_corporativos`

- **Reporte(s) afectado(s):** registro_vehiculos_corporativos
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy sale de la última fila de c_cambios_apps_modules (nombre_tabla='c_vehiculos_corporativos'), que queda null en registros sin historial. Sugerido: agregar `updated_at DATETIME` a c_vehiculos_corporativos
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='c_vehiculos_corporativos'), null en registros sin historial. Sugerido: agregar `updated_by INT` a c_vehiculos_corporativos

### [#130](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/130) — `e_registro_personas`

- **Reporte(s) afectado(s):** registro_visitas
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no tiene created_by; se usa responsable_id, que la app llena con el usuario de la sesión que creó la visita. Sugerido: agregar `created_by INT`
  - **`modificado_por`**: la tabla tiene updated_at pero no updated_by; el autor sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='e_registro_personas'), null en registros sin historial. Sugerido: agregar `updated_by INT`

### [#131](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/131) — `c_bitacora_vehiculo_detenido`

- **Reporte(s) afectado(s):** revision_vehiculos
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at; hoy sale de la última fila de c_cambios_apps_modules (nombre_tabla='c_bitacora_vehiculo_detenido'), que queda null en registros sin historial. Sugerido: agregar `updated_at DATETIME` a c_bitacora_vehiculo_detenido
  - **`modificado_por`**: la tabla no tiene updated_by; hoy sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='c_bitacora_vehiculo_detenido'), null en registros sin historial. Sugerido: agregar `updated_by INT` a c_bitacora_vehiculo_detenido

### [#132](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/132) — `v_vacacion_solicitud`

- **Reporte(s) afectado(s):** solicitud_vacaciones
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`empresa/cliente/division/contrato/sucursal/puesto`**: la tabla no guarda estructura propia: se deriva de plaza_id -> e_estructura_plazas.puesto_id; las solicitudes sin plaza o con plaza sin puesto salen con toda la jerarquía null. Sugerencia: guardar puesto_id (o empresa/cliente/division/contrato/corpo/puesto) en la solicitud al crearla

### [#133](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/133) — `c_solicitud_permiso`

- **Reporte(s) afectado(s):** solicitudes_permiso
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no guarda quién modificó (el cambio de estado pendiente/aprobado/rechazado tampoco deja usuario ni fecha); sugerencia: agregar `updated_by INT`

### [#134](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/134) — `c_empleado_almuerzo`

- **Reporte(s) afectado(s):** tiempo_almuerzo
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado`**: la tabla no tiene created_at (solo inicio/fin del almuerzo); sugerencia: agregar `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
  - **`modificado`**: la tabla no tiene updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: la tabla no guarda quién modificó (hay registros manuales, es_manual=true, sin saber quién los capturó); sugerencia: agregar `updated_by INT`

### [#135](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/135) — `e_registro_vehiculos`

- **Reporte(s) afectado(s):** visitas_vehiculos
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`creado_por`**: la tabla no tiene created_by; se usa responsable_id, que la app llena con el usuario de la sesión que creó la visita (no es el «responsable» de la visita). Sugerido: agregar `created_by INT` y dejar responsable_id con su significado
  - **`modificado_por`**: la tabla tiene updated_at pero no updated_by; el autor sale del created_by de la última fila de c_cambios_apps_modules (nombre_tabla='e_registro_vehiculos'), null en registros sin historial. Sugerido: agregar `updated_by INT`

### [#136](https://github.com/artsmorgan/gonzalez-mobile-monorepo/issues/136) — `e_manual_puesto`

- **Reporte(s) afectado(s):** manuales_puesto
- **Estado:** abierto (creado 2026-10-13)
- **Brechas:**
  - **`modificado`**: la tabla no tiene updated_at ni historial; sugerencia: agregar `updated_at DATETIME`
  - **`modificado_por`**: no hay updated_by; sugerencia: agregar `updated_by INT`

## Tablas agrupadas por tipo de brecha

- **`modificado`, `modificado_por`** (12): `c_agenda_minuta` (#108), `c_apertura_cierre_puesto` (#109), `c_checklist_supervision` (#115), `c_control_asistencia` (#116), `c_incidente` (#121), `e_llavero` (#123), `e_llave` (#124), `c_notas_voz` (#127), `c_vehiculos_corporativos` (#129), `c_bitacora_vehiculo_detenido` (#131), `c_solicitud_permiso` (#133), `e_manual_puesto` (#136)

- **`creado`, `creado_por`, `modificado`, `modificado_por`** (6): `c_acta_entre_producto` (#106), `c_boleta_apreciacion_vulnerabilidad` (#110), `e_estructura_articulo_corpo_puesto_plan` (#111), `e_estructura_articulo_corpo_puesto_entrega` (#112), `e_control_documento_entregado_cliente` (#117), `e_registro_capacitaciones` (#128)

- **`creado_por`, `modificado_por`** (4): `c_puesto_notas` (#113), `c_articulo_mantenimiento` (#126), `e_registro_personas` (#130), `e_registro_vehiculos` (#135)

- **`creado`, `creado_por`, `modificado`, `modificado_por`, `empresa/cliente/division/contrato/sucursal/puesto`** (2): `e_actividades` (#107), `c_login_marca_almuerzo` (#125)

- **`creado_por`, `modificado`, `modificado_por`** (2): `c_encuesta_cliente` (#118), `c_evaluacion_empleado` (#120)

- **`modificado`, `modificado_por`, `empresa/cliente/division/contrato/sucursal`** (1): `c_ubicacion_puesto_registro_cambios` (#114)

- **`modificado`, `modificado_por`, `empresa/contrato/division`** (1): `e_registro_entrega_puesto` (#119)

- **`creado_por`, `modificado`, `modificado_por`, `empresa/cliente/division/contrato/sucursal/puesto`** (1): `refresh_token` (#122)

- **`empresa/cliente/division/contrato/sucursal/puesto`** (1): `v_vacacion_solicitud` (#132)

- **`creado`, `modificado`, `modificado_por`** (1): `c_empleado_almuerzo` (#134)
