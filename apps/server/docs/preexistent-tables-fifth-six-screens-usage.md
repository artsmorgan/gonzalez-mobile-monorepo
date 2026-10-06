# Tablas preexistentes usadas por 6 pantallas móviles (lote 5)

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `PermitRequestScreenV2`
- `PhysicalMinuteAgendaScreen`
- `PuestoUbicacionScreen`
- `ReportesScreen`
- `SatisfactionSurveysScreen`
- `StaffEvaluationsScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_empleado` | `/api/permit-request/*`, `/api/agenda-minuta` POST, `/api/encuesta-nps/*`, `/api/evaluation/*`, `/api/empleados/[id]` | G | **Prisma** |
| `c_empleado_plaza` | `/api/permit-request/plazas`, `/api/permit-request` POST (notificación) | G | **Prisma** |
| `c_marca_dia` | `/api/permit-request/turnos`, `/api/permit-request` POST/PUT, `/api/encuesta-nps/puestos`, `/api/evaluation` POST | G, U | **Prisma** |
| `e_estructura_cliente` | `/api/agenda-minuta`, `/api/encuesta-nps/*`, `/api/evaluation` POST | G | **Prisma** |
| `e_estructura_contrato` | `/api/permit-request/*` | G | **Prisma** |
| `e_estructura_empresa` | `/api/encuesta-nps/*` | G | **Prisma** |
| `e_estructura_plazas` | `/api/permit-request/*`, `/api/evaluation` POST | G | **Prisma** |
| `e_estructura_puesto` | `/api/agenda-minuta`, `/api/encuesta-nps/*`, `/api/evaluation/*`, `/api/puestos/[id]/ubicacion` | G, U | **Prisma** |
| `e_estructura_sucursal` | `/api/permit-request/*`, `/api/agenda-minuta`, `/api/encuesta-nps/*`, `/api/evaluation/*` | G | **Prisma** |
| `n_division` | `/api/encuesta-nps/*` | G | **Prisma** |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas:  
`c_accion_personal`, `c_cambio_guardia`, `c_horario`, `c_salida_anticipada`, `c_tipo_accion`, `e_estructura_articulo_corpo_puesto_*`, `e_estructura_combo_articulo_cp`, `n_articulo_corpo_puesto`, `n_ejecutivo_cuenta`, `pg_categoria_*`.

---

## Por pantalla

### PermitRequestScreenV2

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/permit-request` | `c_solicitud_permiso`, `c_archivos_solicitud_permiso`, `c_cambios_apps_modules` | `c_empleado`, `c_empleado_plaza`, `c_marca_dia`, `e_estructura_*` |
| `/api/permit-request/plazas`, `/turnos` | — | `c_empleado_plaza`, `e_estructura_*`, `c_marca_dia` |
| `/api/permit-request/[id]/reject`, media GET | `c_solicitud_permiso`, `c_archivos_solicitud_permiso` | `c_empleado`, `e_estructura_*` |
| `/api/permit-request/corpo/[corpo_id]` | `c_solicitud_permiso` | — |
| `/api/empleados/[id]`, `/codigo/[codigo]` | — | `c_empleado` |

**Jerarquía móvil:** no usa árbol principal (plazas/turnos vía API dedicada).

---

### PhysicalMinuteAgendaScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/agenda-minuta` | `c_agenda_minuta`, `c_cambios_apps_modules` | `e_estructura_cliente`, `e_estructura_sucursal`, `c_empleado`, `e_estructura_puesto` (include/filtros) |
| `/api/agenda-minuta/corpo/[corpo_id]` | `c_agenda_minuta` | — |
| `/api/empleados/codigo/[codigo]` | — | `c_empleado` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()` (una carga por sesión).

---

### PuestoUbicacionScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| PUT `/api/puestos/[id]/ubicacion` | `c_ubicacion_puesto_registro_cambios` | `e_estructura_puesto`, `e_estructura_plazas`, `c_marca_dia` |
| Jerarquía local | — | `e_estructura_*` |

**Jerarquía móvil:** `structureRef` + fragmentos mergeados; reutiliza árbol en memoria.

---

### ReportesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `/api/reportes`, `/api/reportes/mobile/*` | `e_reportes_mobile` | — (usa `callDynamicReportesApi`, no tablas preexistentes directas) |

**Jerarquía móvil:** no aplica (filtros propios del módulo reportes).

---

### SatisfactionSurveysScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/encuesta-nps` | `c_encuesta_cliente`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_*`, `n_division` |
| `/api/encuesta-nps/puestos` | — | `c_marca_dia`, `e_estructura_puesto` |
| `/api/puestos/corpo/[id]` | — | `e_estructura_*`, `c_empleado_plaza`, `c_empleado` |

**Jerarquía móvil:** `structureRef` + una carga por sesión.

---

### StaffEvaluationsScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| POST `/api/evaluation` | `c_evaluacion_empleado` | `c_marca_dia`, `c_empleado`, `e_estructura_*`, `e_estructura_plazas` |
| GET `/api/evaluation/corpo/[id]` | `c_evaluacion_empleado` | `e_estructura_sucursal`, `c_empleado` |
| DELETE/PUT `/api/evaluation/[id]` | `c_evaluacion_empleado` | — |
| `/api/empleados/*` | — | `c_empleado` |

**Jerarquía móvil:** `structureRef` + `fetchMainStructure()` centralizado.

---

## Notas de migración

1. En `c_solicitud_permiso`, `c_agenda_minuta`, `c_encuesta_cliente` y `c_evaluacion_empleado`, los `include` de relaciones preexistentes permanecen en `callDynamicPrisma` (tabla raíz creada).
2. Lecturas/updates directos sobre tablas preexistentes usan `prisma`.
3. `c_permiso_con_goce` / `c_permiso_sin_goce` en aprobación de permisos siguen en dynamic (no están en listas 84/22).
4. `ReportesScreen` no requirió cambios de Prisma en este lote (API de reportes separada).
