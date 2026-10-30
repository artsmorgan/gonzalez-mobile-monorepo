# Tablas preexistentes usadas por 6 pantallas móviles (lote 4)

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `MutuosAcuerdosScreen`
- `NomencladoresScreen`
- `NonConformingProductScreen`
- `NotesScreen`
- `NotificationsScreen`
- `OpeningClosingPositionScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_empleado` | `/api/mutuos-acuerdos/*`, `/api/non-conforming-product` POST, `/api/opening-closing-position` POST, `/api/puestos/*/notas/*`, `/api/notification`, `/api/nomenclators/empleados-ejecutivos/*`, `/api/empleados/[id]` | G, U | **Prisma** |
| `c_empleado_plaza` | `/api/mutuos-acuerdos` POST (notificación) | G | **Prisma** |
| `c_marca_dia` | `/api/mutuos-acuerdos/*`, `/api/opening-closing-position` POST | G, U | **Prisma** |
| `e_estructura_cliente` | `/api/mutuos-acuerdos/*`, `/api/opening-closing-position` POST, `/api/non-conforming-product` POST | G | **Prisma** |
| `e_estructura_contrato` | `/api/mutuos-acuerdos/*`, `/api/opening-closing-position/*` | G | **Prisma** |
| `e_estructura_empresa` | `/api/mutuos-acuerdos/[id]/firma-ejecutivo`, `/api/opening-closing-position/*` | G | **Prisma** |
| `e_estructura_plazas` | `/api/mutuos-acuerdos` GET/POST, `/api/puestos/*/notas/*` | G | **Prisma** |
| `e_estructura_puesto` | `/api/mutuos-acuerdos/*`, `/api/puestos/notas/*`, `/api/puestos/corpo/[id]` | G | **Prisma** |
| `e_estructura_sucursal` | `/api/mutuos-acuerdos/*`, `/api/opening-closing-position` POST, `/api/non-conforming-product` POST | G | **Prisma** |
| `n_ejecutivo_cuenta` | `/api/nomenclators/empleados-ejecutivos/*` (util `nomenclatorsEmpleadoEjecutivo`) | G, U | **Prisma** |
| `n_division` | `/api/opening-closing-position` (include en lectura de registro creado) | G | **Prisma** (include vía dynamic en raíz creada) |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas:  
`c_accion_personal`, `c_cambio_guardia`, `c_horario`, `c_salida_anticipada`, `c_tipo_accion`, `e_estructura_articulo_corpo_puesto_*`, `e_estructura_combo_articulo_cp`, `n_articulo_corpo_puesto`, `pg_categoria_*`.

---

## Por pantalla

### MutuosAcuerdosScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/mutuos-acuerdos` | `e_mutuos_acuerdos`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `c_empleado_plaza`, `e_estructura_*`, `e_estructura_plazas` |
| `/api/mutuos-acuerdos/marcas` | `e_mutuos_acuerdos` | `c_marca_dia`, `e_estructura_contrato` |
| `/api/mutuos-acuerdos/[id]/firma-ejecutivo`, `/reject` | `e_mutuos_acuerdos`, `c_cambios_apps_modules` | `c_empleado`, `c_marca_dia`, `e_estructura_*` |
| `/api/empleados/[id]`, `/api/empleados/codigo/[codigo]` | — | `c_empleado` |

**Jerarquía móvil:** no usa árbol principal (selects por marcas/API mutuos acuerdos).

---

### NomencladoresScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/nomenclators/*` | `n_ejecutivo_cuenta_coordinador`, `n_tipo_mantenimiento_articulo`, etc. | `c_empleado`, `n_ejecutivo_cuenta` (empleados-ejecutivos) |

**Jerarquía móvil:** no aplica.

---

### NonConformingProductScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/non-conforming-product` | `c_producto_no_conforme`, `e_archivos_producto_no_conforme`, `c_tipos_producto_no_conforme`, `c_cambios_apps_modules` | `c_empleado`, `e_estructura_sucursal` (POST notificación) |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()`.

---

### NotesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/puestos/[id]/notas` | `c_puesto_notas`, `c_imagenes_puesto_notas`, `c_cambios_apps_modules` | `e_estructura_puesto`, `c_empleado`, `e_estructura_plazas` |
| `/api/puestos/notas/puesto/[id]`, `/send-email` | `c_puesto_notas` | `e_estructura_puesto` |
| `/api/puestos/corpo/[id]` | — | `e_estructura_sucursal`, `e_estructura_puesto`, `e_estructura_plazas`, `c_empleado_plaza`, `c_empleado` |
| `/api/categories` | nomenclador novedades | — |

**Jerarquía móvil:** `mainStructureRef` + una carga por sesión.

---

### NotificationsScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `/api/notification`, `/api/notification/plaza/[id]` | `c_notifications`, `c_empleado_notification`, `c_plaza_notification` | `c_marca_dia`, `e_estructura_plazas` |

**Jerarquía móvil:** no aplica (caché local AsyncStorage + sync).

---

### OpeningClosingPositionScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/opening-closing-position` | `c_apertura_cierre_puesto`, `c_imagenes_apertura_cierre_puesto`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_sucursal`, `e_estructura_cliente`, `e_estructura_empresa`, `e_estructura_contrato` |
| `/api/articulos` | catálogo artículos | — |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` (ya presente); reutilización en filtros sin re-merge.

---

## Notas de migración

1. En `e_mutuos_acuerdos` y `c_apertura_cierre_puesto`, los `include` de relaciones preexistentes pueden permanecer en `callDynamicPrisma` (tabla raíz creada).
2. Lecturas directas sobre tablas preexistentes usan `prisma`.
3. Utilidad `nomenclatorsEmpleadoEjecutivo.ts` migrada a Prisma para `c_empleado` y `n_ejecutivo_cuenta`.
