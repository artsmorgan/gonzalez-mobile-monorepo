# Tablas preexistentes usadas por ReportesScreen (módulo de reportes móviles)

Referencia de tablas **preexistentes** (22 del proyecto) y tablas **creadas** (84) usadas al generar reportes desde `ReportesScreen`.

- **Pantalla móvil:** `apps/mobile/screens/ReportesScreen.tsx` — sin cambios de jerarquía; delega en `/api/reportes`.
- **Enrutamiento de datos:** `apps/server/utils/reportDynamicPrisma.ts` (`createReportPrismaClient`).
  - Tablas preexistentes → **Prisma directo** (`prismaClient.ts`).
  - Tablas creadas → **`callDynamicPrisma`** (`/api/dynamic-prisma`).

Leyenda de acciones: **G** GET (`findMany` / `findFirst` / `findUnique`), **P** POST (`create`), **U** PUT/PATCH (`update`).

---

## Resumen por tabla preexistente

| Tabla | Uso en reportes | Acciones | Motor |
|-------|-----------------|----------|--------|
| `c_accion_personal` | Módulo `acciones_personales` (consulta principal + includes) | G | **Prisma** |
| `c_empleado` | Casi todos los módulos (nombres, búsqueda, relaciones); `searchEmployees`; enriquecer listado | G | **Prisma** |
| `c_horario` | `acciones_personales` (include en `c_accion_personal`) | G | **Prisma** |
| `c_marca_dia` | `mutuos_acuerdos` | G | **Prisma** |
| `c_salida_anticipada` | `acciones_personales` (include) | G | **Prisma** |
| `c_tipo_accion` | `acciones_personales` (include) | G | **Prisma** |
| `e_estructura_empresa` | Jerarquía en casi todos los módulos; `searchActaStructure` | G | **Prisma** |
| `e_estructura_cliente` | Jerarquía en casi todos los módulos; `searchActaStructure` | G | **Prisma** |
| `e_estructura_contrato` | Jerarquía; `searchActaStructure`; resolución en `manuales_puesto`, `mutuos_acuerdos` | G | **Prisma** |
| `e_estructura_sucursal` | Jerarquía (corpo); `searchActaStructure` | G | **Prisma** |
| `e_estructura_puesto` | Jerarquía; `searchActaStructure`; filtros en `actividades`, `manuales_puesto`, artículos | G | **Prisma** |
| `e_estructura_plazas` | `mutuos_acuerdos`, `maestro_quejas`, `registro_induccion_recorrido`; `searchActaStructure` | G | **Prisma** |
| `e_estructura_combo_articulo_cp` | `articulos_puesto`, `mantenimiento_articulos` (`articulosPuestoBatchData`) | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_plan` | `articulos_puesto`, `mantenimiento_articulos` | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_entrega` | `articulos_puesto`, `mantenimiento_articulos` | G | **Prisma** |
| `n_articulo_corpo_puesto` | `articulos_puesto`, `mantenimiento_articulos` | G | **Prisma** |
| `n_division` | Jerarquía en casi todos los módulos; `searchActaStructure` | G | **Prisma** |
| `n_ejecutivo_cuenta` | `solicitudes_permiso`, `mutuos_acuerdos`, `checklist_supervision`; búsqueda en create | G | **Prisma** |
| `pg_categoria_empleado` | `acciones_personales` (include en `c_accion_personal`) | G | **Prisma** |

Tablas preexistentes **no usadas** directamente por el módulo de reportes:

`c_cambio_guardia`, `c_empleado_plaza`, `pg_categoria_salarial`.

---

## Endpoints HTTP (sin cambios de contrato)

| Ruta | Rol |
|------|-----|
| `GET/POST /api/reportes` | Listado, previews, búsquedas auxiliares, encolar jobs |
| `GET /api/reportes/mobile/[id]/get-file` | Descarga del archivo generado |
| Worker interno | `runMobileReportJob` + `createReportServiceRequest` |

**Operaciones auxiliares en `create.ts` (vía `reportDb`):**

| Operación | Tablas preexistentes | Tablas creadas |
|-----------|---------------------|----------------|
| `searchEmployees` | `c_empleado` (G) | — |
| `searchActaStructure` | `e_estructura_*`, `n_division`, `e_estructura_plazas` (G) | — |
| `searchAlmuerzoCedulas` | — | `c_empleado_almuerzo` (G) |
| `searchCorporateVehicles` | — | `c_vehiculos_corporativos` (G) |
| `listReports` | `c_empleado` (G, nombres creador) | `e_reportes_mobile` (G) |
| `createReportJob` | — | `e_reportes_mobile` (P) |
| `purgeOldReports` | — | `e_reportes_mobile` (G, D vía `purgeOldMobileReports` con Prisma directo del worker) |

---

## Por módulo de reporte (`modulo`)

Cada fila indica la tabla **raíz** (creada, dynamic) y tablas **preexistentes** consultadas para enriquecer columnas.

| `modulo` | Tabla raíz (creada) | Tablas preexistentes (Prisma) |
|----------|----------------------|-------------------------------|
| `ingresos_usuario` | `refresh_token` | `c_empleado` (include) |
| `acta_entrega_productos` | `c_acta_entre_producto` | `e_estructura_*`, `n_division` |
| `agenda_minuta` | `c_agenda_minuta` | `e_estructura_*`, `n_division` |
| `apertura_cierre_puesto` | `c_apertura_cierre_puesto`, `c_imagenes_apertura_cierre_puesto` | `e_estructura_*`, `n_division`, `c_empleado` |
| `apreciacion_vulnerabilidad` | `c_boleta_apreciacion_vulnerabilidad` | `e_estructura_*`, `n_division` |
| `actividades` | `e_actividades`, `e_actividades_puesto`, `e_actividades_puesto_plaza` | `e_estructura_puesto`, `e_estructura_sucursal`, `e_estructura_contrato` |
| `control_asistencia` | `c_control_asistencia`, `c_imagenes_control_asistencia` | `e_estructura_*`, `n_division` |
| `documentos_entregados` | `e_control_documento_entregado_cliente` | `e_estructura_*`, `n_division` |
| `encuesta_satisfaccion` | `c_encuesta_cliente` | `e_estructura_*`, `n_division`, `c_empleado` |
| `acciones_personales` | — | `c_accion_personal`, `c_empleado`, `c_horario`, `c_tipo_accion`, `c_salida_anticipada`, `pg_categoria_empleado`, `e_estructura_*`, `n_division` |
| `entrega_puesto` | `e_registro_entrega_puesto` | `e_estructura_empresa` |
| `incidentes` | `c_incidente`, `c_contribucion_incidente`, `c_archivos_incidente` | `e_estructura_*`, `n_division` |
| `llaves` | `e_llave`, `e_llave_en_llavero`, `e_movimiento_llave` | `e_estructura_*`, `n_division` |
| `llaveros` | `e_llavero`, `e_movimiento_llavero` | `e_estructura_*`, `n_division` |
| `bitacora_novedades` | `c_puesto_notas`, `c_imagenes_puesto_notas` | `e_estructura_*`, `n_division` |
| `maestro_quejas` | `c_maestro_quejas`, `c_anexos_quejas` | `e_estructura_*`, `n_division`, `e_estructura_plazas`, `c_empleado` |
| `checklist_supervision` | `c_checklist_supervision`, `c_imagenes_checklist_supervision` | `e_estructura_*`, `n_division`, `n_ejecutivo_cuenta` |
| `mutuos_acuerdos` | `e_mutuos_acuerdos` | `c_marca_dia`, `c_empleado`, `n_ejecutivo_cuenta`, `e_estructura_*`, `e_estructura_plazas`, `n_division` |
| `evaluacion_personal` | `c_evaluacion_empleado` | `e_estructura_*`, `n_division`, `c_empleado` |
| `producto_no_conforme` | `c_producto_no_conforme`, `e_archivos_producto_no_conforme` | `e_estructura_*`, `n_division`, `c_empleado` |
| `registro_induccion_recorrido` | `c_registro_induccion_recorrido`, `c_imagenes_registro_induccion_general` | `e_estructura_*`, `n_division`, `e_estructura_plazas`, `c_empleado` |
| `manuales_puesto` | `e_manual_puesto`, `e_archivos_manual_puesto`, `e_puestos_manual_puesto` | `e_estructura_*`, `n_division` |
| `articulos_puesto` | `c_movimientos_articulo_mantenimiento` | `e_estructura_*`, `n_division`, `e_estructura_combo_articulo_cp`, `e_estructura_articulo_corpo_puesto_plan`, `e_estructura_articulo_corpo_puesto_entrega`, `n_articulo_corpo_puesto` |
| `mantenimiento_articulos` | `c_articulo_mantenimiento`, `c_movimientos_articulo_mantenimiento` | Igual que `articulos_puesto` |
| `registro_vehiculos_corporativos` | `c_vehiculos_corporativos`, `c_imagenes_vehiculos_corporativos`, `c_usos_vehiculos_corporativos` | `e_estructura_*`, `n_division` |
| `revision_vehiculos` | `c_bitacora_vehiculo_detenido`, `c_vehiculos_corporativos` | `e_estructura_*`, `n_division` |
| `registro_visitas` | `e_registro_personas`, `e_activo_visitante` | `e_estructura_empresa`, `n_division`, `e_estructura_contrato` |
| `visitas_vehiculos` | `e_registro_vehiculos` | `e_estructura_empresa`, `n_division`, `e_estructura_contrato` |
| `notas_voz` | `c_notas_voz` | `e_estructura_*`, `n_division`, `c_empleado` |
| `cambios_ubicacion_puesto` | `c_ubicacion_puesto_registro_cambios` | `e_estructura_*`, `n_division`, `c_empleado` |
| `registro_capacitaciones` | `e_registro_capacitaciones`, `e_capacitacion_empleado`, `e_capacitacion_puesto`, `c_archivos_adjuntos_capacitaciones` | `e_estructura_*`, `n_division`, `c_empleado` |
| `registro_induccion_general` | `c_registro_induccion_general`, `c_imagenes_registro_induccion_general` | `e_estructura_*`, `n_division`, `c_empleado` |
| `tiempo_almuerzo` | `c_empleado_almuerzo` | `e_estructura_*`, `n_division` |
| `login_marca` | `c_login_marca_almuerzo` | `c_empleado`, `e_estructura_puesto` |
| `solicitudes_permiso` | `c_solicitud_permiso`, `c_archivos_solicitud_permiso` | `e_estructura_*`, `n_division`, `n_ejecutivo_cuenta`, `c_empleado` |

---

## Archivos de generación (`reports-functions/`)

Todos reciben `ReportDataAccess` (`createReportPrismaClient`); no requieren cambios individuales tras el enrutamiento central.

| Archivo | Módulo |
|---------|--------|
| `userLogin.ts` | `ingresos_usuario` |
| `actaEntregaProductos.ts` | `acta_entrega_productos` |
| `agendaMinutaReport.ts` | `agenda_minuta` |
| `aperturaCierrePuestoReport.ts` | `apertura_cierre_puesto` |
| `vulnerabilidadReport.ts` | `apreciacion_vulnerabilidad` |
| `actividadesReport.ts` | `actividades` |
| `controlAsistenciaReport.ts` | `control_asistencia` |
| `documentosEntregadosReport.ts` | `documentos_entregados` |
| `encuestaSatisfaccionReport.ts` | `encuesta_satisfaccion` |
| `accionesPersonalesReport.ts` | `acciones_personales` |
| `entregaPuestoReport.ts` | `entrega_puesto` |
| `incidentesReport.ts` | `incidentes` |
| `llavesReport.ts` | `llaves` |
| `llaverosReport.ts` | `llaveros` |
| `bitacoraNovedadesReport.ts` | `bitacora_novedades` |
| `maestroQuejasReport.ts` | `maestro_quejas` |
| `checklistSupervisionReport.ts` | `checklist_supervision` |
| `mutuosAcuerdosReport.ts` | `mutuos_acuerdos` |
| `evaluacionEmpleadoReport.ts` | `evaluacion_personal` |
| `productoNoConformeReport.ts` | `producto_no_conforme` |
| `induccionRecorridoReport.ts` | `registro_induccion_recorrido` |
| `manualesPuestoReport.ts` | `manuales_puesto` |
| `articulosPuestoReport.ts` + `articulosPuestoBatchData.ts` | `articulos_puesto` |
| `mantenimientoArticulosReport.ts` | `mantenimiento_articulos` |
| `registroVehiculosCorporativosReport.ts` | `registro_vehiculos_corporativos` |
| `revisionVehiculosReport.ts` (+ individuales) | `revision_vehiculos` |
| `registroVisitasReport.ts` | `registro_visitas` |
| `visitasVehiculosReport.ts` | `visitas_vehiculos` |
| `notasVozReport.ts` | `notas_voz` |
| `cambiosUbicacionPuestoReport.ts` | `cambios_ubicacion_puesto` |
| `registroCapacitacionesReport.ts` | `registro_capacitaciones` |
| `registroInduccionGeneralReport.ts` | `registro_induccion_general` |
| `tiempoAlmuerzoReport.ts` | `tiempo_almuerzo` |
| `loginMarcaReport.ts` | `login_marca` |
| `solicitudesPermisoReport.ts` | `solicitudes_permiso` |

---

## Notas de implementación

1. **`ReportesScreen.tsx` y `reportesFunctions.ts`:** sin cambios; siguen llamando `/api/reportes` con JWT (online/offline según conectividad de la app).
2. **`findContributionIncidents.ts`:** no lo usa el módulo de reportes (solo endpoints de incidentes).
3. **Includes anidados:** cuando una tabla preexistente se consulta con Prisma directo (p. ej. `c_accion_personal` con `include`), las relaciones se resuelven en el motor Prisma del servidor, no vía HTTP dynamic.
4. **Metadatos del job:** `e_reportes_mobile` en `create.ts` (list/create) usa `reportDb` → dynamic; el worker `runMobileReportJob` actualiza estado con `PrismaClient` directo para el mismo registro en BD.
