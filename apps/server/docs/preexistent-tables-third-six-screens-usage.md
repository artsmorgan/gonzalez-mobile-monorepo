# Tablas preexistentes usadas por 6 pantallas móviles (lote 3)

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `IncidentsScreen`
- `InductionTourRecordScreen`
- `JobManualsScreen`
- `LlavesScreen`
- `LunchTimeScreen`
- `MantenimientoEquipoScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_empleado` | `/api/incidents` GET/POST, `/api/incidents/[id]/contributions`, `/api/induction-tour-record` POST, `/api/llaves` POST, `/api/llaveros` POST, `/api/lunch-time`, `/api/job-manuals/[id]/sign`, `/api/empleados/[id]` | G | **Prisma** |
| `c_marca_dia` | `/api/incidents` POST, `/api/incidents/[id]`, `/api/induction-tour-record` POST, `/api/llaves/*`, `/api/llaveros/*`, `/api/lunch-time/*`, `/api/job-manuals/*`, `/api/mantenimiento-equipo` GET | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_entrega` | `/api/mantenimiento-equipo`, `/api/mantenimiento-equipo/bulk-articulos`, `/api/articulo-mantenimiento/puesto/[id]` | G, P | **Prisma** |
| `e_estructura_articulo_corpo_puesto_plan` | `/api/mantenimiento-equipo`, `/api/mantenimiento-equipo/bulk-articulos`, `/api/articulo-mantenimiento/puesto/[id]` | G, P | **Prisma** |
| `e_estructura_cliente` | `/api/incidents` POST, `/api/induction-tour-record` GET/POST | G | **Prisma** |
| `e_estructura_combo_articulo_cp` | `/api/mantenimiento-equipo`, `/api/articulo-mantenimiento/puesto/[id]` | G | **Prisma** |
| `e_estructura_contrato` | `/api/induction-tour-record` GET (filtros) | G | **Prisma** |
| `e_estructura_plazas` | `/api/induction-tour-record` POST (notificación), `/api/job-manuals` POST | G | **Prisma** |
| `e_estructura_puesto` | `/api/mantenimiento-equipo/*`, `/api/job-manuals/*`, `/api/llaves` POST | G | **Prisma** |
| `e_estructura_sucursal` | `/api/incidents/*`, `/api/induction-tour-record` POST, `/api/llaves/*`, `/api/llaveros/*`, `/api/job-manuals/[id]/sign` | G | **Prisma** |
| `n_articulo_corpo_puesto` | `/api/mantenimiento-equipo/plantilla/get-file`, `/api/mantenimiento-equipo/bulk-articulos`, `/api/articulo-mantenimiento/puesto/[id]` (include) | G | **Prisma** |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas:  
`c_accion_personal`, `c_cambio_guardia`, `c_empleado_plaza`, `c_horario`, `c_salida_anticipada`, `c_tipo_accion`, `e_estructura_empresa`, `n_division`, `n_ejecutivo_cuenta`, `pg_categoria_empleado`, `pg_categoria_salarial`.

---

## Por pantalla

### IncidentsScreen

| Endpoint | Tablas creadas (callDynamicPrisma) | Tablas preexistentes (Prisma) |
|----------|-----------------------------------|-------------------------------|
| CRUD `/api/incidents` | `c_incidente`, `c_archivos_incidente`, `c_contribucion_incidente`, `c_archivos_aporte_incidente`, `n_clasificacion_incidente` | `c_empleado`, `c_marca_dia`, `e_estructura_sucursal`, `e_estructura_cliente` |
| `GET /api/incidents/classification` | `n_clasificacion_incidente` | — |
| `GET /api/empleados/codigo/[codigo]` | — | `c_empleado` |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `mainStructureRef` + una carga por sesión.

---

### InductionTourRecordScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/induction-tour-record` | `c_registro_induccion_recorrido`, `c_cambios_apps_modules` | `e_estructura_contrato`, `e_estructura_cliente`, `c_marca_dia`, `c_empleado`, `e_estructura_sucursal`, `e_estructura_plazas` |
| `GET /api/induction-tour-record/corpo/:corpo_id` | `c_registro_induccion_recorrido` | — |
| `GET /api/empleados/:id` | — | `c_empleado` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()`.

---

### JobManualsScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/job-manuals` | `e_manual_puesto`, `e_archivos_manual_puesto`, `e_puestos_manual_puesto`, `e_empleado_visualizacion_manual_puesto`, `c_cambios_apps_modules` | `e_estructura_puesto`, `c_marca_dia`, `e_estructura_plazas` |
| `POST /api/job-manuals/[id]/sign` | visualizaciones | `c_marca_dia`, `c_empleado`, `e_estructura_puesto`, `e_estructura_sucursal` |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()` (sin GET `/api/main-structure` en pantalla).

---

### LlavesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/llaves`, `/api/llaveros` | `e_llave`, `e_llavero`, `e_llave_en_llavero`, `e_movimiento_llave`, `e_movimiento_llavero`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_sucursal`, `e_estructura_puesto` |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + una carga por sesión.

---

### LunchTimeScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/lunch-time` | `c_empleado_almuerzo`, `c_login_marca_almuerzo` | `c_empleado`, `c_marca_dia` |
| `GET /api/lunch-time/[id]/test-ending-time` | — | `c_marca_dia` |

**Jerarquía móvil:** no aplica (sin selects jerárquicos).

---

### MantenimientoEquipoScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `GET /api/mantenimiento-equipo` | `c_articulo_mantenimiento`, `c_movimientos_articulo_mantenimiento`, `n_tipo_mantenimiento_articulo` | `c_marca_dia`, `e_estructura_puesto`, `e_estructura_combo_articulo_cp`, `e_estructura_articulo_corpo_puesto_plan`, `e_estructura_articulo_corpo_puesto_entrega`, `n_articulo_corpo_puesto` |
| CRUD `/api/articulo-mantenimiento/*` | `c_articulo_mantenimiento`, `c_archivos_adjuntos_articulo_mantenimiento`, `c_movimientos_articulo_mantenimiento` | `e_estructura_*`, `c_marca_dia`, `n_articulo_corpo_puesto` |
| `POST /api/mantenimiento-equipo/bulk-articulos` | — | `n_articulo_corpo_puesto`, `e_estructura_puesto`, `e_estructura_articulo_corpo_puesto_plan`, `e_estructura_articulo_corpo_puesto_entrega` |
| `GET /api/categoria-mantenimiento` | `c_categoria_mantenimiento` | — |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + `getMainStructureTree()` reutilizable; caché offline de artículos por puesto sin re-merge en cada filtro.

---

## Notas de migración

1. Consultas cuya **tabla raíz es creada** permanecen en `callDynamicPrisma`.
2. Lecturas/escrituras directas sobre tablas **preexistentes** usan `prisma`.
3. En móvil, selects jerárquicos cargan el árbol mergeado local una vez por sesión (`structureRef`).
