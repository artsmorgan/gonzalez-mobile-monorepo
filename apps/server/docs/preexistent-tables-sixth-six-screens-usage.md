# Tablas preexistentes usadas por 6 pantallas móviles (lote 6)

Referencia de tablas **preexistentes** (22 del proyecto) tocadas por los endpoints que consumen estas pantallas.  
Las tablas **creadas** (84) siguen usando `callDynamicPrisma`.

Pantallas revisadas:

- `TrainingsScreen`
- `TrasladoPlazasScreen`
- `VehiclesScreen`
- `VisitorsScreen`
- `VoiceNotesScreen`
- `HomeScreen`

Leyenda de acciones: **G** GET, **P** POST, **U** PUT/PATCH, **D** DELETE.

---

## Resumen por tabla preexistente

| Tabla | Pantallas / rutas | Acciones | Motor |
|-------|-------------------|----------|--------|
| `c_accion_personal` | `/api/traslado-plaza`, `/api/traslado-plaza/[id]/upload-file` | G, U | **Prisma** |
| `c_empleado` | `/api/training/*`, `/api/vehicles/*`, `/api/visitors/*`, `/api/voice-notes/*`, `/api/empleados/[id]` | G | **Prisma** |
| `c_marca_dia` | `/api/training/*`, `/api/vehicles/*`, `/api/visitors/*`, `/api/voice-notes/*` | G | **Prisma** |
| `c_tipo_accion` | `/api/traslado-plaza` | G | **Prisma** |
| `e_estructura_cliente` | `/api/training/*`, `/api/visitors/*`, `/api/voice-notes/*`, `/api/traslado-plaza` | G | **Prisma** |
| `e_estructura_contrato` | `/api/visitors/*`, `/api/voice-notes/*`, util `registroCorpoPuesto` | G | **Prisma** |
| `e_estructura_empresa` | `/api/training/*`, `/api/voice-notes/*` | G | **Prisma** |
| `e_estructura_plazas` | `/api/voice-notes` POST (notificación por plaza) | G | **Prisma** |
| `e_estructura_puesto` | `/api/training/*`, `/api/vehicles/*`, `/api/visitors/*`, `/api/voice-notes/*`, `/api/traslado-plaza` | G | **Prisma** |
| `e_estructura_sucursal` | `/api/training/*`, `/api/vehicles/*`, `/api/visitors/*`, `/api/voice-notes/*`, `/api/traslado-plaza` | G | **Prisma** |

Tablas preexistentes **no** usadas directamente por estas 6 pantallas:  
`c_cambio_guardia`, `c_empleado_plaza`, `c_horario`, `c_salida_anticipada`, `e_estructura_articulo_corpo_puesto_*`, `e_estructura_combo_articulo_cp`, `n_articulo_corpo_puesto`, `n_division`, `n_ejecutivo_cuenta`, `pg_categoria_*`.

---

## Por pantalla

### TrainingsScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/training` | `e_registro_capacitaciones`, `e_capacitacion_empleado`, `e_capacitacion_puesto`, `c_archivos_adjuntos_capacitaciones` | `c_marca_dia`, `c_empleado`, `e_estructura_*` |
| Media `/api/training/[id]/get-*` | `e_registro_capacitaciones`, `c_archivos_adjuntos_capacitaciones` | — |
| `/api/empleados/[id]` | — | `c_empleado` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()`.

---

### TrasladoPlazasScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| GET `/api/traslado-plaza` | — | `c_accion_personal`, `c_tipo_accion`, `e_estructura_cliente`, `e_estructura_sucursal`, `e_estructura_puesto` |
| PUT `/api/traslado-plaza/[id]/upload-file` | — | `c_accion_personal` |

**Jerarquía móvil:** no aplica (lista acciones personales del empleado).

---

### VehiclesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/vehicles` | `e_registro_vehiculos`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_*` (util `registroCorpoPuesto`) |
| `/api/vehicles/[id]/get-image` | `e_registro_vehiculos` | — |

**Jerarquía móvil:** `structureRef` + una carga por sesión.

---

### VisitorsScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/visitors` | `e_registro_personas`, `e_activo_visitante`, `c_cambios_apps_modules` | `c_marca_dia`, `c_empleado`, `e_estructura_*` (utils `registroCorpoPuesto`, `visitorsResolveHierarchyFromPuesto`) |
| `/api/visitors/categories` | `n_tipo_activo_visitas` | — |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()`.

---

### VoiceNotesScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| CRUD `/api/voice-notes` | `c_notas_voz` | `c_marca_dia`, `c_empleado`, `e_estructura_*`, `e_estructura_plazas` |
| `/api/voice-notes/[id]/get-note` | `c_notas_voz` | — |
| `/api/empleados/[id]` | — | `c_empleado` |

**Jerarquía móvil:** `structureRef` + `loadMainStructureTreeMerged()` (reemplaza lectura legacy de caché monolítica).

---

### HomeScreen

| Endpoint | Tablas creadas | Tablas preexistentes |
|----------|----------------|----------------------|
| GET `/api/mobile-versions/[id]` | — | — (JSON estático + GitHub releases) |

**Jerarquía móvil:** no aplica.

---

## Notas de migración

1. Utils compartidos migrados: `registroCorpoPuesto.ts` (vehicles/visitors), `visitorsResolveHierarchyFromPuesto.ts`.
2. `visitors/route.ts` reutiliza `assertCorpoAllowedForMarca` y `resolveClienteYPuestoParaAlta` del util (elimina duplicación).
3. Tablas raíz creadas (`e_registro_vehiculos`, `e_registro_personas`, `c_notas_voz`, etc.) permanecen en `callDynamicPrisma`.
4. `c_accion_personal` en traslado-plaza usa Prisma directo (tabla preexistente, raíz de la consulta).
