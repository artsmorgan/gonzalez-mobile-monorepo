# Escrituras sobre tablas preexistentes

Este documento resume, de forma legible, **qué tablas preexistentes** (de las 22 del proyecto) se **modifican** (crear, actualizar o eliminar registros) y **en cuáles documentos** por lote de pantallas ocurre cada operación.

Solo se listan operaciones de escritura:

- **Crear** = POST (`create`)
- **Actualizar** = PUT/PATCH (`update`)
- **Eliminar** = DELETE (`delete`)

Las lecturas (GET) no se incluyen aquí. Todas estas escrituras usan **Prisma directo**.

Documentos por lote:

- **Lote 1** → `preexistent-tables-six-screens-usage.md` (ActaEntregaProductos, Activities, ApreciacionVulnerabilidad, AttendanceControl, BitacoraVehiculosDetenidos, ChecklistSupervision)
- **Lote 2** → `preexistent-tables-next-six-screens-usage.md` (ComplaintsMaster, CorporateVehicles, DigitalSignature, DocumentosEntregados, EntregaPuestos, GeneralInductionRegister)
- **Lote 3** → `preexistent-tables-third-six-screens-usage.md` (Incidents, InductionTourRecord, JobManuals, Llaves, LunchTime, MantenimientoEquipo)
- **Lote 4** → `preexistent-tables-fourth-six-screens-usage.md` (MutuosAcuerdos, Nomencladores, NonConformingProduct, Notes, Notifications, OpeningClosingPosition)
- **Lote 5** → `preexistent-tables-fifth-six-screens-usage.md` (PermitRequest, PhysicalMinuteAgenda, PuestoUbicacion, Reportes, SatisfactionSurveys, StaffEvaluations)
- **Lote 6** → `preexistent-tables-sixth-six-screens-usage.md` (Trainings, TrasladoPlazas, Vehicles, Visitors, VoiceNotes, Home)
- **Reportes** → `preexistent-tables-reportes-screen-usage.md` (ReportesScreen)

---

## Tablas que se modifican

### `c_empleado`

- **Se actualiza** en los documentos: Lote 1, Lote 2 y Lote 4.
- **Se elimina** en el documento: Lote 1.
- Dónde ocurre: endpoints de empleados (`/api/empleados/[id]`), puestos por sucursal (`/api/puestos/corpo/[id]`), control de asistencia (`/api/attendance-control/marcas`), firma digital (`/api/digital-signature/manual-signature/[id]`), mutuos acuerdos y nomencladores de empleados-ejecutivos.

### `c_marca_dia`

- **Se actualiza** en los documentos: Lote 4 y Lote 5.
- Dónde ocurre: mutuos acuerdos (por ejemplo, la firma del ejecutivo en `/api/mutuos-acuerdos/[id]/firma-ejecutivo`), apertura/cierre de puesto, solicitudes de permiso (`/api/permit-request`) y evaluación de personal.

### `e_estructura_puesto`

- **Se actualiza** en los documentos: Lote 1 y Lote 5.
- Dónde ocurre: actualización de ubicación del puesto (`/api/puestos/[id]/ubicacion`).

### `c_accion_personal`

- **Se actualiza** en el documento: Lote 6.
- Dónde ocurre: traslado de plazas (`/api/traslado-plaza` y `/api/traslado-plaza/[id]/upload-file`).

### `n_ejecutivo_cuenta`

- **Se actualiza** en el documento: Lote 4.
- Dónde ocurre: nomencladores de empleados-ejecutivos (`/api/nomenclators/empleados-ejecutivos/*`, utilidad `nomenclatorsEmpleadoEjecutivo`).

### `e_estructura_articulo_corpo_puesto_entrega`

- **Se crea** en el documento: Lote 3.
- Dónde ocurre: mantenimiento de equipo (`/api/mantenimiento-equipo`, `/api/mantenimiento-equipo/bulk-articulos`, `/api/articulo-mantenimiento/puesto/[id]`).

### `e_estructura_articulo_corpo_puesto_plan`

- **Se crea** en el documento: Lote 3.
- Dónde ocurre: mantenimiento de equipo (`/api/mantenimiento-equipo`, `/api/mantenimiento-equipo/bulk-articulos`, `/api/articulo-mantenimiento/puesto/[id]`).

---

## Tablas que solo se leen (no se modifican)

En ningún documento se crean, actualizan ni eliminan registros de estas tablas preexistentes:

- `c_cambio_guardia`
- `c_empleado_plaza`
- `c_horario`
- `c_salida_anticipada`
- `c_tipo_accion`
- `e_estructura_cliente`
- `e_estructura_combo_articulo_cp`
- `e_estructura_contrato`
- `e_estructura_empresa`
- `e_estructura_plazas`
- `e_estructura_sucursal`
- `n_articulo_corpo_puesto`
- `n_division`
- `pg_categoria_empleado`
- `pg_categoria_salarial`

---

## Nota sobre el documento de Reportes

El documento de **Reportes** no modifica ninguna tabla preexistente: todas se consultan solo en modo lectura. Las escrituras del módulo de reportes (crear y eliminar trabajos) recaen en la tabla `e_reportes_mobile`, que es una tabla **creada**, no preexistente.

---

## Aclaraciones

1. Todas las escrituras sobre tablas preexistentes se hacen con **Prisma directo** (no con `callDynamicPrisma`).
2. Cuando la tabla principal de una operación es una tabla **creada** (por ejemplo `e_mutuos_acuerdos` o `c_apertura_cierre_puesto`), esa escritura va por `callDynamicPrisma`; solo las tablas preexistentes involucradas (como actualizar `c_marca_dia`) usan Prisma.
