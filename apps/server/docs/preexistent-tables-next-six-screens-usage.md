# Tablas preexistentes usadas por 6 pantallas móviles (lote 2)

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `ComplaintsMasterScreen`
- `CorporateVehiclesScreen`
- `DigitalSignatureScreen`
- `DocumentosEntregadosScreen`
- `EntregaPuestosScreen`
- `GeneralInductionRegisterScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_empleado` | `/api/digital-signature/manual-signature/[id]`, `/api/documentos-entregados` POST, `/api/general-induction-register` POST (notificación), `/api/corporate-vehicles/*` (notificaciones), `/api/entrega-puestos`, `/api/empleados/[id]`, `/api/empleados/codigo/[codigo]` | G, U | **Prisma** |
| `c_marca_dia` | `/api/complaints-master` POST, `/api/entrega-puestos` GET/POST | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_entrega` | `/api/entrega-puestos` GET | G | **Prisma** |
| `e_estructura_articulo_corpo_puesto_plan` | `/api/entrega-puestos` GET | G | **Prisma** |
| `e_estructura_cliente` | `/api/documentos-entregados` POST, `/api/general-induction-register` GET (filtros), `/api/corporate-vehicles` GET (filtro empresa), `/api/entrega-puestos` POST, jerarquía local | G | **Prisma** |
| `e_estructura_combo_articulo_cp` | `/api/entrega-puestos` GET | G | **Prisma** |
| `e_estructura_contrato` | `/api/general-induction-register` GET (filtros cliente/empresa), jerarquía local | G | **Prisma** |
| `e_estructura_empresa` | jerarquía local (`/api/main-structure` fragmentos) | G | **Prisma** |
| `e_estructura_plazas` | jerarquía local | G | **Prisma** |
| `e_estructura_puesto` | `/api/entrega-puestos` GET/POST, jerarquía local | G | **Prisma** |
| `e_estructura_sucursal` | `/api/complaints-master` POST, `/api/documentos-entregados` POST, `/api/general-induction-register` GET/POST, `/api/corporate-vehicles/*` (notificaciones), jerarquía local | G | **Prisma** |
| `n_articulo_corpo_puesto` | `/api/entrega-puestos` GET | G | **Prisma** |
| `n_division` | `/api/general-induction-register` GET (filtros), jerarquía local | G | **Prisma** |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas:  
`c_accion_personal`, `c_cambio_guardia`, `c_empleado_plaza`, `c_horario`, `c_salida_anticipada`, `c_tipo_accion`, `n_ejecutivo_cuenta`, `pg_categoria_empleado`, `pg_categoria_salarial`.

Tabla **fuera de las listas 84/22** (sigue en `callDynamicPrisma`):  
`c_empleado_firma_digital` — `/api/digital-signature/manual-signature/[id]`.

---

## Por pantalla

### ComplaintsMasterScreen

| Endpoint | Tablas creadas (callDynamicPrisma) | Tablas preexistentes (Prisma) |
|----------|-----------------------------------|-------------------------------|
| CRUD `/api/complaints-master` | `c_maestro_quejas`, `c_anexos_quejas`, `c_cambios_apps_modules` | `c_marca_dia`, `e_estructura_sucursal` (POST notificación) |
| `GET /api/complaints-master/tipo-clientes` | `n_tipo_cliente_quejas` | — |
| `GET /api/complaints-master/tipo-quejas` | `n_tipo_quejas` | — |
| `GET /api/complaints-master/corpo/:corpo_id` | `c_maestro_quejas` | — |
| `GET /api/empleados/:id` | — | `c_empleado` |
| Jerarquía local | — | `e_estructura_*`, `n_division`, `c_empleado`, `n_articulo_corpo_puesto` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()` una vez por sesión; filtros solo en memoria.

---

### CorporateVehiclesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/corporate-vehicles` | `c_vehiculos_corporativos`, `c_imagenes_vehiculos_corporativos`, `c_usos_vehiculos_corporativos`, `c_mantenimiento_vehiculos_corporativos`, `c_bitacora_vehiculo_detenido`, `c_cambios_apps_modules` | `e_estructura_cliente` (filtro GET), `e_estructura_sucursal`, `c_empleado` (notificaciones) |
| Jerarquía local + caché offline | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` en lectura inicial; actualizaciones de caché local (vehículos/usos/mantenimientos) persisten fragmentos y sincronizan `structureRef`.

---

### DigitalSignatureScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `GET/PUT /api/digital-signature/manual-signature/:id` | `c_empleado_firma_digital` | `c_empleado` |
| `POST /api/digital-signature/generate-signature` | — | — (firma calculada en cliente) |

**Jerarquía móvil:** no aplica (sin selects jerárquicos).

---

### DocumentosEntregadosScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/documentos-entregados` | `e_control_documento_entregado_cliente`, `c_cambios_apps_modules` | `c_empleado`, `e_estructura_cliente`, `e_estructura_sucursal` (POST respuesta) |
| `GET /api/puestos/corpo/:id` | — | `e_estructura_sucursal`, `e_estructura_puesto`, `e_estructura_plazas`, `c_empleado_plaza`, `c_empleado` |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureCache()` con reutilización en memoria.

---

### EntregaPuestosScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/entrega-puestos` | `e_registro_entrega_puesto`, `c_puesto_notas`, `c_incidente`, `c_articulo_mantenimiento`, `e_actividades`, `e_actividades_puesto`, `e_actividades_puesto_plaza`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_puesto`, `e_estructura_cliente`, `e_estructura_combo_articulo_cp`, `e_estructura_articulo_corpo_puesto_plan`, `e_estructura_articulo_corpo_puesto_entrega`, `n_articulo_corpo_puesto` |
| `GET /api/entrega-puestos/puesto/:id` | `e_registro_entrega_puesto` | — |
| Catálogos en GET | `n_novedades_categoria`, `n_clasificacion_incidente` | — |

**Jerarquía móvil:** no usa árbol principal; opera con `current_marca` y APIs de entrega.

---

### GeneralInductionRegisterScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/general-induction-register` | `c_registro_induccion_general`, `c_imagenes_registro_induccion_general`, `c_cambios_apps_modules` | `e_estructura_cliente`, `e_estructura_contrato`, `e_estructura_sucursal`, `n_division`, `c_empleado` (GET filtros / POST notificación) |
| `GET /api/general-induction-register/corpo/:corpo_id` | `c_registro_induccion_general` | — |
| `GET /api/empleados/:id` | — | `c_empleado` |
| Jerarquía local | — | `e_estructura_*`, `n_division` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureCache()` con reutilización en memoria.

---

## Utilidades compartidas

| Utilidad | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| `sendNotification.ts` | `c_notifications`, `c_plaza_notification`, `c_empleado_notification` | `e_estructura_*`, `c_marca_dia`, `pg_categoria_*` (**Prisma**) |

---

## Notas de migración

1. Consultas cuya **tabla raíz es creada** (`c_maestro_quejas`, `c_vehiculos_corporativos`, etc.) permanecen en `callDynamicPrisma` aunque incluyan relaciones de lectura.
2. Lecturas directas sobre tablas de la lista **preexistente** usan `prisma` del cliente compartido.
3. En móvil, los selects jerárquicos leen el árbol mergeado local una vez por sesión de pantalla (`structureRef`); no se vuelve a llamar `loadMainStructureTreeMerged` en cada cambio de filtro salvo caché offline explícita (p. ej. vehículos corporativos tras sync).
