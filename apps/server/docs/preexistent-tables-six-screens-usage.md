# Tablas preexistentes usadas por 6 pantallas móviles

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `ActaEntregaProductosScreen`
- `ActivitiesScreen`
- `ApreciacionVulnerabilidadScreen`
- `AttendanceControlScreen`
- `BitacoraVehiculosDetenidosScreen`
- `ChecklistSupervisionScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_empleado` | `/api/empleados/[id]`, `/api/puestos/corpo/[id]`, `/api/attendance-control/marcas`, jerarquía (`main-structure`) | G, U, D | **Prisma** |
| `c_empleado_plaza` | `/api/puestos/corpo/[id]`, jerarquía | G | **Prisma** |
| `c_marca_dia` | `/api/activities/marca/[id]`, `/api/attendance-control/marcas`, `createActivities` | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_entrega` | `createActivities`, `/api/articulo-mantenimiento/puesto/[id]`, jerarquía | G | **Prisma** (en helpers de actividades) |
| `e_estructura_articulo_corpo_puesto_plan` | `createActivities`, jerarquía | G | **Prisma** |
| `e_estructura_cliente` | jerarquía, `/api/attendance-control/marcas` (include) | G | **Prisma** |
| `e_estructura_combo_articulo_cp` | `createActivities`, jerarquía | G | **Prisma** |
| `e_estructura_contrato` | jerarquía | G | **Prisma** |
| `e_estructura_empresa` | jerarquía | G | **Prisma** |
| `e_estructura_plazas` | `/api/activities/marca/[id]`, `/api/puestos/corpo/[id]`, jerarquía | G | **Prisma** |
| `e_estructura_puesto` | `/api/activities/marca/[id]`, `/api/puestos/corpo/[id]`, `/api/puestos/[id]/ubicacion`, jerarquía | G, U | **Prisma** |
| `e_estructura_sucursal` | `/api/puestos/corpo/[id]`, jerarquía | G | **Prisma** |
| `n_articulo_corpo_puesto` | `createActivities`, jerarquía | G | **Prisma** |
| `n_division` | jerarquía | G | **Prisma** |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas (solo indirectamente vía otros módulos):  
`c_accion_personal`, `c_cambio_guardia`, `c_horario`, `c_salida_anticipada`, `c_tipo_accion`, `n_ejecutivo_cuenta`, `pg_categoria_empleado`, `pg_categoria_salarial`.

---

## Por pantalla

### ActaEntregaProductosScreen

| Endpoint | Tablas creadas (callDynamicPrisma) | Tablas preexistentes (Prisma) |
|----------|-----------------------------------|-------------------------------|
| `GET/POST/PUT/DELETE /api/acta-entrega-productos` | `c_acta_entre_producto`, `c_imagenes_acta_entrega_producto` | — |
| `GET /api/cambios-apps-modules` | `c_cambios_apps_modules` | — |
| Jerarquía local | — | `e_estructura_*`, `n_division`, `c_empleado`, `n_articulo_corpo_puesto` (vía `/api/main-structure` POST → fragmentos) |

**Jerarquía móvil:** `loadMainStructureTreeMerged()` una vez al entrar; filtros solo en memoria.

---

### ActivitiesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `GET /api/activities/marca/:id` | `e_actividades`, `e_actividades_puesto`, `e_actividades_puesto_plaza` | `c_marca_dia`, `e_estructura_puesto`, `e_estructura_plazas` |
| `PUT /api/activities/:id` | `e_actividades_puesto_plaza` | — |
| `GET /api/puestos/corpo/:id` | — | `e_estructura_sucursal`, `e_estructura_puesto`, `e_estructura_plazas`, `c_empleado_plaza`, `c_empleado` |
| `GET /api/empleados/:id` | — | `c_empleado` |
| `GET /api/articulo-mantenimiento/puesto/:id` | `c_articulo_mantenimiento`, `c_movimientos_articulo_mantenimiento` | `e_estructura_*`, `n_articulo_corpo_puesto` (lectura en servidor) |
| CRUD `/api/activities/created/*` | `e_actividades`, `e_actividades_puesto`, … | — |

**Jerarquía móvil:** una carga por focus (`useLocalMainStructureTree`); sin re-merge al cambiar pickers.

---

### ApreciacionVulnerabilidadScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/apreciacion-vulnerabilidad` | `c_boleta_apreciacion_vulnerabilidad`, `c_imagenes_boleta_apreciacion_vulnerabilidad` | — |
| `GET /api/cambios-apps-modules` | `c_cambios_apps_modules` | — |

**Jerarquía móvil:** local; sin GET `/api/main-structure` en esta pantalla.

---

### AttendanceControlScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/attendance-control` | `c_control_asistencia`, `c_imagenes_control_asistencia`, `c_control_asistencia_empleado_firmas` | — |
| `GET /api/attendance-control/marcas` | — | `c_marca_dia`, `c_empleado`, `e_estructura_cliente`, `e_estructura_sucursal`, `e_estructura_puesto` |
| `GET /api/empleados/:id` | — | `c_empleado` |

**Jerarquía móvil:** local; lista de controles depende de filtros (no re-lee jerarquía por filtro).

---

### BitacoraVehiculosDetenidosScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/bitacora-vehiculo-detenido` | `c_bitacora_vehiculo_detenido` | — |
| `/api/corporate-vehicles/*` | `c_vehiculos_corporativos`, `c_usos_vehiculos_corporativos`, `c_mantenimiento_vehiculos_corporativos` | — |
| Jerarquía (fragmentos) | vehículos/bitácoras en fragmentos | árbol `e_estructura_*` en merge |

**Jerarquía móvil:** una carga por sesión de lista; prefill reutiliza árbol en memoria.

---

### ChecklistSupervisionScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/checklist-supervision` | `c_checklist_supervision`, `c_imagenes_checklist_supervision` | — |
| `GET /api/articulo-mantenimiento/puesto/:id` | `c_articulo_mantenimiento` | lectura `e_estructura_*`, `n_articulo_corpo_puesto` en servidor |

**Jerarquía móvil:** patrón referencia (focus → merge una vez → pickers).

---

## Jerarquía (`/api/main-structure`)

| Parte | Motor | Notas |
|-------|--------|--------|
| POST genera fragmentos | Prisma para `e_estructura_*`, `n_division`, `c_empleado`, nomencladores | |
| POST fragmentos dinámicos | `callDynamicPrisma` / queries Prisma para `c_vehiculos_corporativos`, `c_bitacora_*`, `e_llave`, `c_articulo_mantenimiento`, etc. | |
| GET móvil (descarga opcional) | Devuelve `structure` mergeada | |
| Lectura en app | **Solo local** `loadMainStructureTreeMerged()` | Sin conversión de formato en pickers |

---

## Tablas creadas (84) usadas por estas pantallas

`c_acta_entre_producto`, `c_imagenes_acta_entrega_producto`, `e_actividades`, `e_actividades_puesto`, `e_actividades_puesto_plaza`, `c_boleta_apreciacion_vulnerabilidad`, `c_imagenes_boleta_apreciacion_vulnerabilidad`, `c_control_asistencia`, `c_imagenes_control_asistencia`, `c_control_asistencia_empleado_firmas`, `c_bitacora_vehiculo_detenido`, `c_vehiculos_corporativos`, `c_usos_vehiculos_corporativos`, `c_checklist_supervision`, `c_imagenes_checklist_supervision`, `c_articulo_mantenimiento`, `c_movimientos_articulo_mantenimiento`, `c_cambios_apps_modules`, `c_ubicacion_puesto_registro_cambios` (ubicación puesto, indirecto).

Todas permanecen en **`callDynamicPrisma`** salvo lecturas auxiliares de estructura en helpers compartidos.

---

## Utilidades compartidas migradas

| Utilidad | Tablas preexistentes → Prisma | Tablas creadas → callDynamicPrisma |
|----------|------------------------------|-------------------------------------|
| `utils/sendNotification.ts` | `e_estructura_plazas`, `e_estructura_sucursal`, `e_estructura_puesto`, `c_marca_dia`, `pg_categoria_salarial`, `pg_categoria_empleado` | `c_notifications`, `c_plaza_notification`, `c_empleado_notification` |
| `utils/createReporteArticuloMantenimiento.ts` | `e_estructura_puesto`, `e_estructura_articulo_corpo_puesto_entrega`, `e_estructura_articulo_corpo_puesto_plan` | `c_articulo_mantenimiento` (create/update) |
| `utils/createActivities.ts` | `c_marca_dia`, `e_estructura_*`, `n_articulo_corpo_puesto` en `buildArticlesFromPuesto` | `e_actividades*`, `e_actividades_puesto_plaza`, `c_articulo_mantenimiento` |
| `utils/getRoleDivision.ts` | `n_division`, `pg_categoria_salarial`, `pg_categoria_empleado` | — (solo preexistentes) |
| `checklist-supervision/articulosMantenimiento.ts` | `e_estructura_puesto`, `c_empleado`, `e_estructura_sucursal` | `c_articulo_mantenimiento`, reportes |

Usado por las 6 pantallas vía: `sendNotificationByRole`, `sendNotificationByPlaza`, `fetchActivePlazaIdsForPuestos`, `createReport`, `resolveMarcaModeloSerieFromArticuloEstructura`, `getActivities`.

---
