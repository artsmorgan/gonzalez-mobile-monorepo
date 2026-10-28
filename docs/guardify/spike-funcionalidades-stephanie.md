# Spike #189: funcionalidades de Stephanie en la app (qué hay y qué falta para Guardify)

Respuestas **leyendo el código** de la app y del servidor (rama `test-soft-001`). Cada afirmación lleva `archivo:línea`; las líneas son de esta rama y una prueba
(`apps/server/utils/spikeDoc.test.ts`) comprueba que cada referencia siga existiendo.

**Lo que este documento NO pudo resolver** (queda marcado `⚠ pendiente` donde aplica):

1. **Datos de testing.** Los valores reales de `estado`/`accion` y las reglas «de último estado» contra datos se confirman en el ambiente de pruebas con datos creados
   desde MonitoreApp; aquí solo está lo que dice el código.
2. **Planillas.** Qué valida Planillas al recibir un token o una acción solo se ve desde su lado.
3. **El PR #190 está fusionado solo en esta rama local** (`test-soft-001`, commit `4b10cbe`), no en el remoto. El contraste de la sección 6 es contra su código ya fusionado y contra el texto del protocolo copiado en el issue.
4. **Rendimiento medido.** Los costos son estimaciones por el diseño de las consultas, no mediciones.

## Resumen

| # | Funcionalidad | ¿Existe en la app? | Qué falta para Guardify | Estimación* |
|---|---|---|---|---|
| 1 | Omisiones de registros | **No existe como concepto**; se puede **calcular** con datos existentes (turnos esperados vs marcas; actividades esperadas vs realizadas) | Definición del cliente de «omisión» y de «liberada» (hoy la visibilidad de módulos es global); un módulo de reporte de solo lectura | 5–7 días |
| 2 | Requisición de productos | **No existe el flujo** (solicitar/atender); sí existen los datos (plan, entrega, último estado) | Consulta/reporte de solo lectura; decisión de si Guardify necesita estado de la requisición | 3 días |
| 3 | Aprobar permisos y mutuos acuerdos | **Sí**, solo desde la app, con token de usuario y **token de Planillas** | Rutas con llave + actor (**ya en el PR #190, fusionado en esta rama**); el token de Planillas se resuelve con el que la app guarda (409 si venció); faltan idempotencia por clave y evidencia (sección 6.2) | 5–6 días + dependencia de Planillas |
| 4 | Carga masiva | **Sí** para artículos (acepta JSON); **no** en lote de actividades distintas | Límites y resultado por fila; corregir el colapso de series repetidas; actividades sin `marca_id` | 3–4 días |
| 5 | Autenticación de Guardify | Existe la llave de servidor (reportes/documentos) | Actor firmado y política compartida **ya en el PR #190**; idempotencia por clave **hecha** (`docs/idempotencia-servidor.md`, base común de 3 y 4) | 2–3 días |

\* Estimaciones gruesas, en días de una persona, sin contar la espera de Planillas ni de decisiones del cliente.

## 1. Omisiones de registros en puestos de funciones ya liberadas

### 1.1 ¿Existe algo que opere como «omisión»?

**No.** No hay ningún flujo que registre «una omisión», ni una marca/registro hecho por un supervisor o administrador **en nombre de** otra persona. Flujos revisados:

| Flujo | Qué hace | Referencia |
|---|---|---|
| Marcar ingreso/salida | Autoservicio: la persona marca su propio turno. Sin conexión conserva la hora real (`horaAccion`) y sincroniza después | `apps/server/app/api/attendance/[id]/route.ts:124` (PUT entrada/salida), `apps/mobile/hooks/attendanceActionsStorage.ts` (cola) |
| Motivo de ausencia | La persona (o su reemplazo) registra por qué se ausentó; escribe `motivo_ausente` | `apps/server/app/api/attendance/[id]/absent-reason/route.ts:9`, `apps/mobile/screens/MarcarIngresoSalidaScreen.tsx:2107` |
| Tiempo de alimentación manual | `es_manual`: la persona registra a mano un almuerzo que no cronometró (tardío, pero del mismo usuario) | `apps/mobile/screens/LunchTimeScreen.tsx:1126` (`handleManualLunchTime`), `apps/mobile/screens/LunchTimeScreen.tsx:1344`, `apps/server/app/api/lunch-time/route.ts:172` |
| Marca de prueba | Crea una marca; **solo desarrollo**, no existe en producción (#181) | `apps/server/app/api/attendance/[id]/dev-create-marca/route.ts` |
| Control de asistencia | Formulario del supervisor con firmas de los colaboradores; **no** es una omisión | `apps/server/app/api/attendance-control/route.ts:185` (`c_control_asistencia`) |
| Apertura/cierre de puesto, checklists, bitácoras | Registran eventos; no tienen «esperado» | `apps/server/app/api/opening-closing-position/route.ts:114` (`c_apertura_cierre_puesto`) |

Conclusión: «omisión» hay que **derivarla** (esperado − registrado), no leerla de una tabla.

### 1.2 «Funciones liberadas/habilitadas»: ¿por puesto o global?

**Global.** `n_app_module_visibility` solo tiene `module_name`, `real_name` e `is_visible`, sin puesto ni estructura (`dynamic-api: app/prisma/schema.prisma:1623`). `GET /api/modules-release` devuelve todas
las filas (`apps/server/app/api/modules-release/route.ts:15`) y la app las aplica a todos (`apps/mobile/hooks/getModulesRelease.ts:35`, `apps/mobile/App.tsx:9612`). **No hay forma de saber qué módulos tiene un puesto**:
si «funciones ya liberadas **en un puesto**» debe ser por puesto, falta el dato (ver decisiones).

### 1.3 ¿De dónde sale «lo esperado» por puesto y día?

| Qué | Tabla (esperado → registrado) | Referencia |
|---|---|---|
| **Turnos** | `c_marca_dia`: una fila por plaza/puesto/día con el **plan** (`hora_inicio`, `hora_fin`, `hora_inicio_plan`, `hora_fin_plan`, `tipo_turno_plan`, `empleadoFijo_id`, `empleadoReemplaza_id`, `is_puesto_no_cubierto`) y lo **registrado** (`hora_entrada_digitada`, `hora_salida_digitada`, `motivo_ausente`, `usuario_marca_entrada/salida`). Las filas las crea Planillas; la app solo las lee y las completa | `apps/server/app/prisma/schema.prisma:2845` |
| **Plan de actividades** | `e_actividades` (con `frecuencia` en JSON) → `e_actividades_puesto` (a qué puestos) → ejecución en `e_actividades_puesto_plaza` (`marcada`, `created_at`, `bitacora`) | `apps/server/app/prisma/schema.prisma:914`, `:926`, `:938`; expansión de la frecuencia: `apps/server/utils/createActivities.ts:6` (`getActivities`) |
| **Plan de artículos** | plan vs entrega vs revisiones (ver sección 2) | `apps/server/app/prisma/schema.prisma:3605`, `:3585`, `:174` |
| Checklists, apertura/cierre, bitácoras | **Sin plan**: no existe una frecuencia esperada | — |

### 1.4 Propuesta: definición de omisión calculable

Tres tipos, todos de **solo lectura** sobre datos que ya existen:

| Tipo | Definición | Datos |
|---|---|---|
| **A. Marca omitida** | Turno con titular (`empleadoFijo_id` o `empleadoReemplaza_id`), `is_puesto_no_cubierto = false`, cuyo fin (`hora_fin` + gracia) ya pasó y que **no tiene** `hora_entrada_digitada` ni `motivo_ausente`. Variante «salida omitida»: con entrada y sin `hora_salida_digitada` pasado el plazo de eliminación de la marca | `c_marca_dia` (`schema.prisma:2845`); gracia: nomencladores `tiempo_gracia_marcar_salida` y horas de eliminación (`apps/mobile/hooks/horasEliminarMarcaStorage.ts`) |
| **B. Actividad omitida** | Para cada actividad asignada al puesto y cada ocurrencia esperada en el periodo según su `frecuencia`, no hay fila `marcada = true` en `e_actividades_puesto_plaza` dentro de su ventana | `e_actividades*` (arriba) |
| **C. Revisión de artículos omitida** | Caso de B con `es_revision_equipo = true` | `e_actividades.es_revision_equipo` |

**Dónde implementarlo:** como un módulo más de `apps/server/utils/guardifyReports/modules/` (hay más de 60 con el mismo patrón y el protocolo de reportes ya define filtros, paginación y `scope`:
`docs/guardify/protocolo-reportes.md`). Así Guardify lo consume por `GET /api/guardify/reports/omisiones` sin protocolo de acciones.

**Costo/rendimiento (estimado):** A es una lectura de `c_marca_dia` por rango de fechas y puesto con un filtro por fecha; B requiere expandir la frecuencia de cada actividad por día (en código, no en SQL), así que su costo crece con
`días × actividades por puesto`; conviene limitar el rango (p. ej. ≤ 31 días) y paginar. Los reportes existentes ya topan en 50.000 filas.

**Si algo no es calculable:** (i) lo «liberado por puesto» (no existe el dato); (ii) la ventana de cada ocurrencia de B depende de cómo se interprete `frecuencia` (`⚠ pendiente`: validar con actividades reales de testing);
(iii) el significado exacto de `teorico` y de `hora_mas_cuatro*` en `c_marca_dia` (vienen de Planillas; `⚠ pendiente` con el proveedor).

## 2. Requisición de productos malos o incompletos

### 2.1 ¿Existe algún flujo de reposición/requisición?

**No existe un flujo de requisición** (solicitar → aprobar → atender). Lo más cercano:

| Flujo | Para qué sirve | Referencia |
|---|---|---|
| Revisión de equipo (actividades) | Se revisa cada artículo del puesto y se marca `Bueno` / `Malo` / `No está` con cantidad real | `apps/mobile/screens/ActivitiesScreen.tsx:50`, `apps/server/app/api/articulo-mantenimiento/route.ts:20` |
| Mantenimiento de equipo | Sobre un artículo: acción **Reemplazar** (marca/modelo/serie nuevos) o **Reparar en taller** (fechas de salida y entrada), con movimientos | `apps/mobile/screens/MantenimientoEquipoScreen.tsx:3412`, `:3418`; `apps/server/app/prisma/schema.prisma:613` (`c_movimientos_articulo_mantenimiento`) |
| Entrega de puestos | Lista plan, entrega y **último mantenimiento** de cada artículo del puesto | `apps/server/app/api/entrega-puestos/route.ts:96` (GET), `:584` plan, `:612` entrega |
| Producto no conforme | Incidente de calidad con descripción y archivos; **no** enlaza con el inventario | `apps/server/app/prisma/schema.prisma:681` |
| Acta de entrega de productos | Acta firmada (`tipo_entrega`, `detalle`, `observaciones`); **no tiene campo de faltantes** (solo texto libre) | `apps/server/app/prisma/schema.prisma:21` |
| Solicitud de uniforme | Cola `uniform_request` → `createUniformRequest`; los planes/entregas de uniforme viven en tablas de Planillas | `apps/mobile/App.tsx:4706`, `apps/mobile/hooks/evaluationFunctions.ts:429`; `schema.prisma:1788`, `:1968`, `:3423`, `:4782` |

### 2.2 Valores de `estado` y `accion`, y regla de «último estado»

- **`estado`**: la app solo ofrece `Bueno`, `Malo` y `No está` (`apps/mobile/screens/ActivitiesScreen.tsx:50`). La columna es texto libre de 55 caracteres (`schema.prisma:174`) y **el servidor no valida el conjunto**: acepta cualquier valor y usa
  `Bueno` por defecto (`apps/server/app/api/articulo-mantenimiento/route.ts:188`).
- **`accion`**: texto libre; la app usa `Reemplazar` y `Reparar en taller` (`apps/mobile/screens/MantenimientoEquipoScreen.tsx:3412`, `:3418`, `:4633`); `Entrada`/`Salida` son de los movimientos.
- **Regla de último estado** (`apps/server/app/api/articulo-mantenimiento/route.ts:185`): sin historial el último estado es `Bueno`; si el nuevo es `Bueno` solo se actualiza el último registro cuando ese no era `Bueno`;
  si no es `Bueno` se crea registro nuevo cuando el último era `Bueno` (o no había), y se actualiza el último si cambia entre estados no buenos; si no hay cambio, se omite (`:290`).
- `⚠ pendiente`: confirmar los valores realmente presentes con datos de testing (el código admite otros).

### 2.3 Plan vs entrega: ¿qué es «incompleto»?

- **Plan** `e_estructura_articulo_corpo_puesto_plan`: `puesto_id`, `articuloCP_id`, **`cantidad`**, `combo_id` (`schema.prisma:3605`). Un artículo puede venir por combo.
- **Entrega** `e_estructura_articulo_corpo_puesto_entrega`: **una fila por unidad física** (`marca`, `serie`, `modelo`, `fechaEntrega`) y **sin columna de cantidad** (`schema.prisma:3585`).
- **Revisión** `c_articulo_mantenimiento`: `estado`, `cantidad_necesaria`, `cantidad_real`, ligada al plan o a la unidad entregada (`schema.prisma:174`).

«Incompleto» se puede calcular de **dos maneras que no son equivalentes**: (a) unidades entregadas (conteo de filas de entrega) < `cantidad` del plan; (b) `cantidad_real < cantidad_necesaria` en la **última revisión**. «No está» es un estado de la última revisión (con `cantidad_real = 0`,
`ActivitiesScreen.tsx:403`). Son tres señales distintas; ver decisión 3.

### 2.4 Propuesta

Módulo de reporte de solo lectura `requisicionArticulos` que devuelva por puesto y artículo: plan, unidades entregadas, estado y cantidades de la última revisión, acción, fecha del último mantenimiento y evidencia (archivos del mantenimiento:
`apps/server/app/api/articulo-mantenimiento/[id]/get-image/[image]/route.ts`), filtrando `estado ∈ {Malo, No está}` o entregadas < plan o `cantidad_real < cantidad_necesaria`. Se **reutiliza** la lógica que ya compone plan + combo + entrega + último mantenimiento
(`apps/server/utils/createActivities.ts:241`, `buildArticlesFromPuesto`, «misma lógica que GET /api/entrega-puestos»). Costo: lecturas por puesto (3 consultas + último mantenimiento); acotado por `scope`. **Basta con eso** para que Guardify arme la requisición;
si debe quedar registro de que ya se pidió, falta un dato nuevo (decisión 3).

## 3. Aprobaciones (permisos y mutuos acuerdos) desde Guardify

> **Nota de ubicación.** Al fusionar el PR #190, la lógica de aprobar y rechazar salió de las rutas y vive en `apps/server/utils/guardifyActions/` (`aprobar-permiso.ts`, `aprobar-mutuo.ts`, `permisos.ts`, `mutuos.ts`). Las rutas de la app (`PUT /api/permit-request/[id]`, `.../reject`, `.../firma-ejecutivo`) solo leen el token y llaman a esas funciones, con los mismos mensajes y estados HTTP. Las referencias de esta sección apuntan a los módulos compartidos.

### 3.1 Quién puede aprobar (reglas del código)

| Acción | Regla | Referencia |
|---|---|---|
| Aprobar/rechazar **permiso** | La persona es el `ejecutivo_cuenta` de la solicitud **o** su `supervisor_id` coincide con ese ejecutivo | `apps/server/utils/guardifyActions/permisos.ts:6`, usada al aprobar en `apps/server/utils/guardifyActions/aprobar-permiso.ts:32` y al rechazar en `apps/server/utils/guardifyActions/permisos.ts:38` |
| Firmar **mutuo acuerdo** | Solo si su `supervisor_id` es el `ejecutivo_cuenta` (**no** vale ser el ejecutivo directamente) | `apps/server/utils/guardifyActions/aprobar-mutuo.ts:61` |
| Rechazar **mutuo acuerdo** | Misma regla, y además los dos empleados ya deben haber aceptado | `apps/server/utils/guardifyActions/mutuos.ts:6`, `apps/server/utils/guardifyActions/mutuos.ts:50` |
| Aceptar mutuo (los dos involucrados) | Primer/segundo turno según empleado | `apps/server/app/api/mutuos-acuerdos/[id]/route.ts:123` |

Fuera de ese alcance la ruta de la app responde **HTTP 400** «No autorizado…» (`apps/server/utils/guardifyActions/aprobar-permiso.ts:34`), no 403; la API de Guardify lo traduce a `403 out_of_scope`. El **ejecutivo de cuenta** sale de la sucursal de la plaza (`schema` `ejecutivoCuenta_id`; `apps/server/app/api/permit-request/route.ts:454`,
`apps/server/app/api/mutuos-acuerdos/route.ts:602`).

**¿Se puede validar el alcance del actor con llave de aplicación + actor en vez del token del usuario? Sí, y el PR #190 ya lo hace.** La ruta de la app toma `payload.id` del JWT (`apps/server/app/api/permit-request/[id]/route.ts:31`); la API de Guardify resuelve al actor a un `c_empleado` (`apps/server/utils/guardifyActions/actor.ts:50`) y aplica **la misma regla**, porque ambas llaman a la misma función.
Queda la diferencia de regla entre permisos y mutuos (defecto 3 de 3.5).

### 3.2 Planillas: qué se toca y si se puede sin el token del usuario

| Aprobación | Llamada a Planillas | Referencia |
|---|---|---|
| Permiso | `POST {PLANILLAS_URL}/acciones/permisos` (uno por turno, o uno solo si todos los reemplazos son iguales), con `Authorization: Bearer <token del aprobador>` | `apps/server/utils/guardifyActions/aprobar-permiso.ts:249`, bucle `:107-108` |
| Mutuo | `POST {PLANILLAS_URL}/cdg` (cambio de guardia tipo `MUT`); guarda `cambio_guardia_id` | `apps/server/utils/guardifyActions/aprobar-mutuo.ts:108`, `:134` |

- **Exige** un token de Planillas: la ruta de la app lo lee del encabezado `Planillas-Token` (`apps/server/app/api/permit-request/[id]/route.ts:18`, `apps/server/app/api/mutuos-acuerdos/[id]/firma-ejecutivo/route.ts:33`) y los módulos lo rechazan si falta (`apps/server/utils/guardifyActions/aprobar-permiso.ts:15`). Ambas llamadas llevan `coordinado_por_id: 3` fijo en el código (`apps/server/utils/guardifyActions/aprobar-permiso.ts:245`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:115`).
- **De dónde sale el token:** inicio de sesión en Planillas con **cédula + contraseña de la persona** (`apps/server/utils/createTokenPlanillas.ts:33`); se guarda **en el servidor**, uno por empleado, en `a_mobile_token_for_planillas` (`apps/server/app/api/auth/login/route.ts:205`, `schema.prisma:1528`).
  Su vigencia es de **60 minutos** (`apps/server/utils/verifyPlanillasToken.ts:6`).
- **¿Cuenta de servicio?** **No hay ninguna en el código**: las únicas variables son `PLANILLAS_URL` y `PLANILLAS_JWT_PUBLIC_KEY`. (`apps/server/utils/getPlanillasToken.ts:44` inicia sesión con contraseña vacía, pero **nadie lo usa**: es código muerto, no una cuenta de servicio.)
- **Por lo tanto, Guardify podría aprobar sin que el aprobador abra la app solo de dos formas:** (1) reutilizando el token guardado del aprobador **si inició sesión en la app en los últimos 60 min** (técnicamente posible, pero es usar su credencial a sus espaldas y
  falla cuando venció); (2) con una **credencial de servicio de Planillas**, que hay que pedir al proveedor. **El protocolo y el PR #190 adoptan la opción 1**: se usa el token guardado de la persona, con `409 planillas_session_required` si no hay uno vigente (sección 6.1). Queda como decisión del cliente aceptar que aprobar desde Guardify exige haber entrado a la app en los últimos 60 min (decisión 4); la opción 2 solo hace falta si la rechaza.
- **Efectos secundarios** de aprobar: crea el permiso/cambio de guardia en Planillas; actualiza el registro local (`estado = aprobado`, firmas) (`apps/server/utils/guardifyActions/aprobar-permiso.ts:128`); auditoría en `c_cambios_apps_modules` (`apps/server/utils/guardifyActions/aprobar-permiso.ts:134`); **notificación push** al solicitante (`apps/server/utils/guardifyActions/aprobar-permiso.ts:190`,
  `apps/server/utils/guardifyActions/aprobar-mutuo.ts:193`). Las marcas las cambia Planillas, no la app.

### 3.3 Firmas

- Aprobar exige **firma digital y firma manual del ejecutivo**, ambas con al menos 10 caracteres y **sin más validación** (`apps/server/utils/guardifyActions/aprobar-permiso.ts:55`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:25`). La digital es el texto que arma la app
  (`sessionId:empleadoId:lat:lng:ts` en base64, ver `apps/server/utils/evidencia.ts:161`); la manual, la imagen del trazo en base64. Se guardan en `c_solicitud_permiso` (`schema.prisma:812`) y `e_mutuos_acuerdos` (`:1187`).
- **Desde una consola web:** la manual se captura con un lienzo y se envía en base64. La digital **no debería aceptarse del cliente**: como hoy cualquier texto de 10 caracteres pasa, para Guardify conviene que el **servidor la genere** con la identidad del actor y la firme con el mecanismo de
  evidencia (`apps/server/utils/evidencia.ts:120`).

### 3.4 Errores tipados que ya existen en el código (con el código del protocolo y el HTTP actual de las rutas de la app)

Los códigos y el HTTP son los de la tabla del protocolo (sección 6.1); las rutas de la app **conservan** sus estados actuales (cada módulo devuelve el código tipado y el estado de la ruta original) y solo la API de Guardify usa los del protocolo.

| Código del protocolo | HTTP del protocolo | HTTP hoy en la app | Referencia |
|---|---|---|---|
| `not_found` | 404 | 404 | `apps/server/utils/guardifyActions/aprobar-permiso.ts:23` |
| `out_of_scope` (fuera de alcance) | 403 | **400** | `apps/server/utils/guardifyActions/aprobar-permiso.ts:34` |
| `already_resolved` (no está pendiente, o ya firmado) | 409 | 400 | `apps/server/utils/guardifyActions/aprobar-permiso.ts:40`, `:45`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:39`, `:44` |
| `invalid_state` (mutuo sin las dos aceptaciones) | 409 | 400 | `apps/server/utils/guardifyActions/aprobar-mutuo.ts:49` |
| `signature_required` | 400 | 400 | `apps/server/utils/guardifyActions/aprobar-permiso.ts:57`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:27` |
| `conflict` (fechas solapadas) | 409 | 400 | `apps/server/app/api/permit-request/route.ts:295`, `apps/server/app/api/mutuos-acuerdos/route.ts:628` |
| `planillas_session_required` (sin token de Planillas vigente) | 409 | 400 | `apps/server/utils/guardifyActions/aprobar-permiso.ts:17` |
| Planillas caída o sin respuesta (502, sin `code`: Guardify lo lee como «no disponible») | 502 | 500 | `apps/server/utils/guardifyActions/aprobar-permiso.ts:249`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:121` |

### 3.5 Defectos que había que corregir **antes** de exponerlo a Guardify

1. **Mutuo: el estado se guardaba antes de llamar a Planillas y no se revertía.** `apps/server/utils/guardifyActions/aprobar-mutuo.ts:96` pone `aprobado` y recién en `:108` se llama a Planillas; si fallaba quedaba aprobado y un reintento recibía «solo se puede aprobar un mutuo pendiente».
   **✅ Corregido en el PR #190:** `revertir` (`apps/server/utils/guardifyActions/aprobar-mutuo.ts:99`) devuelve el mutuo a su estado anterior y sin firmas si Planillas lanza un error (`:121`) o responde que no (`:126`), y se revisa todo lo revisable antes de escribir. Pruebas: `apps/server/utils/guardifyActions/guardifyActions.test.ts` (sección «Planillas dice que no»).
   En permisos el orden ya era el correcto (Planillas antes del registro).
2. **Permiso con varios turnos: creación parcial.** El bucle de `apps/server/utils/guardifyActions/aprobar-permiso.ts:107` crea un permiso por turno; si el segundo falla ya se creó el primero y no hay forma de saberlo ni de reintentar solo lo que falta. El PR lo documenta (`apps/server/docs/guardify-actions-api.md:44`) y su mensaje pide revisar en Planillas antes de reintentar.
3. **Regla de ejecutivo distinta** entre permisos (`apps/server/utils/guardifyActions/permisos.ts:6`) y mutuos (`apps/server/utils/guardifyActions/aprobar-mutuo.ts:61`): en mutuos el ejecutivo directo no puede firmar. Hay que decidir cuál es la regla y centralizarla.
4. **`coordinado_por_id: 3` fijo** (`apps/server/utils/guardifyActions/aprobar-permiso.ts:245`, `apps/server/utils/guardifyActions/aprobar-mutuo.ts:115`). Hay que saber qué representa.

## 4. Carga masiva (inventarios de puesto y actividades)

### 4.1 `bulk-articulos` (contrato real)

`POST /api/mantenimiento-equipo/bulk-articulos` (`apps/server/app/api/mantenimiento-equipo/bulk-articulos/route.ts:26`). Desde el PR #190 la ruta solo lee el token y llama a `cargarInventarioPuesto` (`apps/server/utils/guardifyActions/inventario.ts:158`), la misma función que usa `POST /api/guardify/actions/imports/inventario-puesto`.

- **Entrada JSON** `{ articulos: [{ codigo_puesto, numero_articulo, cantidad, serie, marca, modelo?, fecha_entrega }] }` (`apps/server/app/api/mantenimiento-equipo/bulk-articulos/route.ts:26`). **El servidor ya recibe filas en JSON; no depende de la lectura del Excel del teléfono** (esa lectura es solo del cliente: `apps/mobile/hooks/mantenimientoEquipoPlantillaLocal.ts:240`).
- **Validaciones** (`apps/server/utils/guardifyActions/inventario.ts:50-84`): código de puesto, número > 0, cantidad ≥ 0, serie, marca y fecha `DD-MM-YYYY` (calendario real) obligatorios (400 con la lista `errors`); artículos inexistentes en el catálogo y códigos de puesto inexistentes responden 404 (`apps/server/utils/guardifyActions/inventario.ts:87`, `:98`).
- **Quién lo ejecuta:** cualquier usuario autenticado con token de Planillas; **el servidor no comprueba rol**. `⚠ pendiente`: si Planillas restringe quién puede cargar.
- **Escritura:** no escribe directo; reenvía a Planillas `POST /articulos-puesto/carga-masiva` con el token del usuario (`apps/server/utils/guardifyActions/inventario.ts:175`).
- **Límites:** la ruta de la app no pone tope de filas (en el teléfono se limita a 5.000 desde #175); la API de Guardify rechaza más de 2.000 (`apps/server/utils/guardifyActions/handler.ts:304`).
- **Transaccional:** no. Antes de enviar compara contra lo existente y **omite** lo que ya está (`apps/server/utils/guardifyActions/inventario.ts:113-137`); es **idempotente solo en la práctica** (reenviar el mismo lote omite lo ya cargado) y con una carrera si dos lotes llegan a la vez.
- **Salida:** `{ status, message, created_plans, created_entregas, skipped: [texto] }`: resumen y textos, **no hay resultado por fila**. La API de Guardify la traslada a `{ modo, creados, omitidos, mensaje }` (`apps/server/utils/guardifyActions/handler.ts:336`).

**Defectos (los marcados ✅ ya están corregidos):**

1. **Se pierden unidades:** `formatearParaPlanillas` descarta toda fila cuyo par `codigo_puesto + numero_articulo` ya apareció (`apps/server/utils/guardifyActions/inventario.ts:147`), así que **solo se carga una unidad por artículo y puesto por lote** aunque tengan series distintas, y el mensaje cuenta de más (`apps/server/utils/guardifyActions/inventario.ts:134`).
2. ✅ Si todo se omitía igual se llamaba a Planillas con una lista vacía. Ahora hay una guarda antes de la llamada (`apps/server/utils/guardifyActions/inventario.ts:172`) y responde «Se crearon 0 plan(es) y 0 entrega(s): todo ya existía». Prueba: `apps/server/utils/guardifyActions/guardifyActions.test.ts` («lo que ya existe se omite»).
3. ✅ El error de Planillas decía «Error al actualizar la ubicación del puesto», mensaje copiado de otra ruta. Ahora dice «Error al cargar los artículos en Planillas».

Queda sin corregir el punto 1: arreglarlo cambia lo que se envía a Planillas, y no se sabe si su carga masiva admite varias unidades del mismo artículo por puesto (solicitud al proveedor 3).

### 4.2 Plantilla Excel vigente y `validar-puestos-codigos`

- Columnas de la tabla «Datos a cargar»: **Código del puesto, Número artículo, Cantidad, Serie, Marca, Modelo, Fecha de entrega** (`apps/mobile/hooks/mantenimientoEquipoPlantillaLocal.ts:12`); el catálogo de referencia (número → nombre) va en la columna I desde la fila 9
  (`:22`; generado en el servidor en `apps/server/utils/mantenimientoEquipoPlantilla.ts:21`). Fecha `DD-MM-YYYY`, números como número.
- `POST /api/mantenimiento-equipo/validar-puestos-codigos` recibe `{ codigos: [...] }`, los normaliza sin duplicados y devuelve `{ codigo, id, nombre }` de cada puesto, o **404 con la lista de códigos inexistentes** (`apps/server/app/api/mantenimiento-equipo/validar-puestos-codigos/route.ts:9`, `:41`). El catálogo de artículos sale de
  `GET /api/mantenimiento-equipo/articulos-catalogo`.

### 4.3 Actividades

- **No hay carga masiva de actividades distintas.** `POST /api/activities` crea **una** actividad y la asigna a **varios puestos** de una vez (`puestos_plazas` → un `createMany` en `e_actividades_puesto`: `apps/server/app/api/activities/route.ts:101-115`). No es atómico
  (primero crea la actividad, luego las relaciones) y notifica a las plazas.
- **Para soportar lote desde Guardify cambian dos cosas:** (1) hoy exige **`marca_id`** (la marca del turno de quien la crea) y `firma_responsable` (`:29`); `marca_id` se usa para comprobar la marca y para las notificaciones (`:44-48`), y una consola web no tiene marca;
  (2) el autor sale del token (`auditCreateFields(payload…)`), así que haría falta el actor. Un lote de N actividades se haría con N llamadas o con un endpoint nuevo que repita ese flujo; en ambos casos conviene hacerlo **idempotente** (clave por actividad).

## 5. Autenticación de Guardify hacia estas rutas

**Qué hay hoy.**

- Rutas de la app: `verifyAccessTokenByApi` verifica el JWT en la API dinámica y, con `GUARDIFY_DEVICE_ENFORCE`, el equipo (`apps/server/utils/verifyAccessTokenByApi.ts:11`).
- Rutas de Guardify (reportes, documentos, estructura, evidencia): `verifyGuardifyApiKey` acepta **`Authorization: Bearer <llave>`** o `x-guardify-key` (**no `Basic`**), compara en tiempo constante y deja la API **deshabilitada (503)** si la llave no está configurada o es corta
  (`apps/server/utils/guardifyReports/auth.ts:16`). Cada manejador la llama (`apps/server/utils/documentos/guardifyApi.ts:42`).
- La **identidad de quien actúa** hoy es solo el encabezado `x-guardify-user` (texto libre, máx. 120 caracteres, **sin firma**: `auth.ts:27`). Sirve para bitácora de lectura; **no sirve para aprobar**.

**Qué cambiar, sin debilitar lo existente (no se toca `verifyAccessTokenByApi`):**

1. Un verificador nuevo `verifyGuardifyAction(req)` para rutas nuevas bajo `/api/guardify/actions/*`: (a) `verifyGuardifyApiKey`; (b) **actor firmado** según el protocolo (firma con la llave de Guardify, marca de tiempo con ventana corta y un identificador de uso único contra repetición) — el formato es el del protocolo de acciones y el PR #190 ya lo implementa (`apps/server/utils/guardifyActions/actor.ts:25`; sección 6);
   (c) resolver el actor a un `c_empleado`.
2. **Política compartida:** extraer de las rutas la regla «¿puede esta persona aprobar esto?» a una función pura (`canApprovePermit`, `canSignMutuo`) usada por la app y por Guardify, con pruebas de dos usuarios como en #181 (`apps/server/utils/objectAccess.ts`, `apps/server/utils/backendAudit.test.ts`).
3. **Idempotencia:** guardar la clave de cada acción por (actor, recurso) y devolver el resultado anterior; hoy no existe en estas rutas (#181, sección 5) y el PR #190 la resolvía solo por estado; ahora la clave se guarda y se reserva (sección 6.2, punto 1).
4. **Resolver el token de Planillas** (sección 3.2).
5. Sin cambios para `Authorization: Basic`: el código real y el protocolo usan `Bearer`; el texto del issue #189 dice `Basic`, que es una errata.

Relación con #169/#181: ya existen `authorizeSelfOrAdmin` y `authorizeMarcaAccess` (`apps/server/utils/objectAccess.ts:40`, `:48`) y la tabla de operaciones de reportes (`apps/server/utils/reportesAccess.ts`); la política de aprobación debe seguir ese patrón (denegar por defecto, 403 con código `permission_denied`).

## 6. Contraste con el protocolo de acciones y con el PR #190

**Fuentes.** El protocolo (`docs/protocolo-acciones.md` de guard-desk-nexus) está copiado completo en el comentario del issue #189 y, sincronizado con el commit `f99a520` de Guardify, en `apps/server/docs/protocolo-acciones.md`.
La implementación de la app es el **PR #190** (`guardify/acciones`, commit `2ddc4a6`), **fusionado en `test-soft-001`** (commit `4b10cbe`). Las referencias de esta sección apuntan al código ya fusionado.

**Conclusión corta.** El protocolo **encaja** con lo que la app puede dar: no hay nada que obligue a cambiar su forma. Había **cinco huecos** entre protocolo e implementación (idempotencia por clave —ya cubierta—, evidencia, firma digital, límites y conteos de la carga, y errores sin `code`), una fusión ya resuelta con los cambios de `test-soft-001` (sección 6.3) y **una corrección al issue**: la llave se manda como `Bearer`, no como `Basic`.

### 6.1 Qué encaja

| Punto del protocolo | Estado en el PR #190 | Referencia |
|---|---|---|
| Llave de aplicación | `Authorization: Bearer` (o `x-guardify-key`); **no `Basic`**, como dice el texto del issue. La misma llave de los reportes y 503 si no está configurada | `apps/server/utils/guardifyActions/handler.ts:160` |
| Actor firmado, ligado a método, ruta, consulta y cuerpo; vigencia de 5 min | HMAC-SHA256 comparado en tiempo constante; firma inválida o vencida → **401** (como pide la lista de conformidad) | `apps/server/utils/guardifyActions/actor.ts:25`, `:12`, `apps/server/utils/guardifyActions/handler.ts:164` |
| Resolver al actor (id, cédula, correo) y rechazar baja | Id y cédula que no coinciden → no actúa; empleado con `estado` «BA» → no actúa; sin una coincidencia clara → `403 out_of_scope` | `apps/server/utils/guardifyActions/actor.ts:50`, `:51` |
| Mismas reglas de negocio que la app | Las rutas de la app y las de Guardify llaman a la misma lógica (`utils/guardifyActions/`); reglas de 3.1 sin cambios | `apps/server/docs/guardify-actions-api.md:20` |
| Tabla de errores tipados y HTTP | El mapa coincide **con la tabla del protocolo** (`signature_required` 400, `planillas_session_required` 409, `out_of_scope` 403…). Se descartan los códigos que propuse en 3.4 (`not_authorized`, `already_signed`, 422) | `apps/server/utils/guardifyActions/handler.ts:121` |
| Planillas sin credencial nueva | Usa el token que la app ya guarda (`a_mobile_token_for_planillas`, 60 min); sin uno vigente → `409 planillas_session_required` **sin tocar nada**. **Esto resuelve la decisión 4 del spike** (no hay cuenta de servicio: sección 3.2) | `apps/server/utils/guardifyActions/handler.ts:258`, `apps/server/docs/guardify-actions-api.md:24` |
| Mutuo no queda aprobado si Planillas falla | Vuelve a `pendiente` y se puede reintentar (el defecto 1 de 3.5) | `apps/server/docs/guardify-actions-api.md:44` |
| Reemplazo de un turno | `GET /lookup/empleado?codigo=` devuelve solo id, código y nombre; un código repetido no se adivina | `apps/server/utils/guardifyActions/handler.ts:283` |
| Carga masiva `validar` / `aplicar` | `validar` no escribe ni pide sesión de Planillas; `aplicar` sí; respuesta `{ modo, creados, omitidos, mensaje }` | `apps/server/utils/guardifyActions/handler.ts:312`, `:336` |
| Actividades, omisiones, requisición | Sin carga masiva de actividades (como en 4.3); omisiones y requisición son **reportes de solo lectura**, no acciones | — |

### 6.2 Qué no encaja o falta

| # | Hueco | Qué dice el protocolo | Qué hace el PR #190 | Propuesta |
|---|---|---|---|---|
| 1 | **Idempotencia por clave** | La misma `idempotencyKey` sobre el mismo registro devuelve **el mismo resultado**, aunque el estado ya haya cambiado; la misma clave con otra acción u otro registro → `409 conflict` (`apps/server/docs/protocolo-acciones.md:46`) | ✅ **Implementada** (issues #172 y #181). El PR solo deducía el reintento por estado y no guardaba la clave. Ahora `apps/server/utils/idempotency.ts:75` reserva la clave (SHA-256, nunca en claro) en la tabla `c_clave_idempotencia` de la API dinámica **antes** de ejecutar, y el manejador la usa para toda acción y para `aplicar` (`apps/server/utils/guardifyActions/handler.ts:274`, `:342`): el reintento recibe el resultado original; la misma clave con otra acción, otro registro u otra persona es `409 conflict`; solo se recuerda un resultado 2xx (un `planillas_session_required` libera la clave para reintentar tras abrir la sesión); si el almacén no está disponible no se ejecuta nada (`503` sin `code`) | Aplicar en `gonzalez-mobile-dynamic-api` la migración `20261027120001_clave_idempotencia`, regenerar su cliente y reiniciarla **antes** de desplegar el servidor. Detalle en `docs/idempotencia-servidor.md` |
| 2 | **Candado solo en el proceso** | No lo exige, pero sin él dos aprobaciones simultáneas crearían el permiso dos veces en Planillas | ✅ **Cubierto entre procesos.** La reserva de la clave es el candado (clave única en la base): la segunda petición recibe `409 conflict`. El `Set` en memoria (`apps/server/utils/guardifyActions/handler.ts:150`) queda como primera barrera dentro del proceso. En la carga el candado sigue siendo **uno solo para todas las personas** (`apps/server/utils/guardifyActions/handler.ts:340`), no por persona como dice su comentario | Pendiente solo para peticiones **sin** clave (la carga la acepta opcional): dos aprobaciones sin clave desde procesos distintos no se bloquean entre sí |
| 3 | **Sin evidencia de dispositivo** | «Registra al actor real en su propia auditoría» | Lo hace en `c_cambios_apps_modules`, pero **no genera la fila de `c_evidencia_registro`** que sí deja una acción hecha desde el teléfono (`apps/server/docs/guardify-actions-api.md:40`) | Fila de evidencia con origen «Guardify», el actor resuelto y la huella de la petición firmada, sin datos de dispositivo (`apps/server/utils/evidencia.ts:120`). Decidir con el cliente si basta la bitácora (decisión 5) |
| 4 | **Firma digital** | `signatures` con `role: "digital"` y `role: "manual"`, ambas como imagen `data:` | El servidor solo exige ≥ 10 caracteres a cada una (`apps/server/utils/guardifyActions/aprobar-permiso.ts:55`), así que una imagen **pasa**. Pero en la app la firma digital **no es una imagen**: es el hash de sesión, empleado y ubicación (`apps/mobile/hooks/getCurrentUserDigitalSignature.ts:92`) y los reportes ya la tratan como «no se entrega, solo se informa que firmó» (`apps/server/utils/guardifyReports/modules/mutuosAcuerdosForm.ts:14`) | Que el **servidor genere** la digital a partir del actor y la huella de la petición, y Guardify solo envíe la manual; o aceptar la imagen sabiendo que se guarda en una columna pensada para texto. Es un ajuste del protocolo (Guardify) |
| 5 | **Carga: límite distinto** | El lector de Guardify admite 5.000 filas (`apps/server/docs/protocolo-acciones.md:77`) | La app rechaza más de **2.000** (`apps/server/utils/guardifyActions/handler.ts:304`, `:323`) | Un Excel válido para Guardify fallaría en la app: igualar (bajar Guardify a 2.000 o subir la app) cuando Planillas diga su tope (solicitud 3) |
| 6 | **Carga: se pierden unidades y el conteo miente** | «Omite lo ya cargado» | Cada fila nueva se cuenta como plan y entrega (`apps/server/utils/guardifyActions/inventario.ts:124`, `:132`, `:134`), pero lo que se manda a Planillas descarta toda fila con el mismo puesto y artículo (`apps/server/utils/guardifyActions/inventario.ts:147`): con series distintas el mensaje dice «Se crearon N entregas» y llegan menos. Es el defecto 1 de 4.1, ahora compartido por las dos rutas | Resolver con Planillas (solicitud 3) si admite varias series por puesto y artículo; mientras tanto, informar como omitidas las filas descartadas |
| 7 | **Carga: lista vacía y mensaje** | — | ✅ **Corregido al fusionar.** El PR llamaba a Planillas con `items` vacío si todo ya existía y el error decía «Error al actualizar la ubicación del puesto». Ahora `aplicar` responde sin llamar a Planillas (`apps/server/utils/guardifyActions/inventario.ts:172`) y el error dice «Error al cargar los artículos en Planillas» | Queda el `code: invalid_request` con HTTP 500 de ese error, cuando el protocolo reserva `invalid_request` para 400/422: usar un código propio o `planillas_unavailable` |
| 8 | **Errores sin `code`** | Todo error es `{ code, message }`; un 502/503/504 **sin** cuerpo tipado se muestra como «app no disponible» | El 401 es `{ error, message }` (`apps/server/utils/guardifyActions/handler.ts:164`) y el 502 de Planillas es `{ error: "planillas_unavailable" }` (`apps/server/utils/guardifyActions/handler.ts:133`) | El 502 así es coherente con el protocolo (Guardify lo lee como no disponible). El 401 conviene tiparlo: agregar `unauthorized` a la tabla o decir que se trata como configuración errónea |

### 6.3 Fusión con `test-soft-001` (hecha)

El PR #190 se fusionó en `test-soft-001` (commit `4b10cbe`, sin conflictos sobre el último commit de la rama) y después se reaplicaron encima los cambios de las issues #169–#189. Hubo conflicto en tres archivos:

| Archivo | Resolución |
|---|---|
| `apps/server/app/api/mutuos-acuerdos/[id]/firma-ejecutivo/route.ts` | Se quedó la versión del PR: delega en `aprobar-mutuo.ts`, que ya revierte el mutuo si Planillas falla. Se descartó `rollbackApproval` |
| `apps/server/app/api/mantenimiento-equipo/bulk-articulos/route.ts` | Se quedó la versión del PR (delega en `inventario.ts`); la guarda de lista vacía y el mensaje corregido pasaron a `apps/server/utils/guardifyActions/inventario.ts:172` |
| `apps/server/utils/reportError.ts` | Combinados: no pide JWT en peticiones internas (PR) **y** guarda la fila sin secretos y sin lanzar error (`apps/server/utils/errorLogRow.ts`) |

Las pruebas de texto fuente de `auditCloseout.test.ts` sobre esas rutas se sustituyeron por comprobar que siguen usando la lógica compartida; el comportamiento lo prueban `apps/server/utils/guardifyActions/guardifyActions.test.ts` (87 pruebas) y las citas de las secciones 3 y 4 se rehicieron hacia `utils/guardifyActions/`.
No hubo choque con el alcance por objeto (`objectAccess.ts`, rutas de asistencia, `check-permissions`) ni con la app móvil: el PR solo toca el servidor.

### 6.4 Resultado

- Sin cambios al protocolo: `Bearer`, errores y Planillas ya coinciden (solo se corrige el texto del issue).
- A ajustar en el **protocolo**: firma digital (punto 4), tope de filas (5), tipar el 401 (8).
- A ajustar en la **implementación**: evidencia (3) y conteo de la carga (6). La idempotencia por clave y el candado entre procesos (1, 2) y la lista vacía con su mensaje (7) ya están hechos.
- Estimación de lo que falta para cerrar la conformidad: **1,5–2 días** (0,5–1 de evidencia, 0,5 de carga y pruebas contra datos creados desde MonitoreApp), más aplicar la migración de la tabla de claves.

## 7. Tabla de flujos (resumen)

```
Aprobar permiso desde Guardify (propuesto)
  Guardify ──llave + actor firmado──▶ /api/guardify/actions/permisos/{id}/approve
        1. verifyGuardifyApiKey ─▶ 2. verificar actor firmado (ventana + id único) ─▶ 3. actor → c_empleado
        4. política compartida (¿es el ejecutivo o su supervisor?) ──no──▶ 403 out_of_scope
        5. ¿estado = pendiente y sin firmas? ──no──▶ 409 already_resolved (o invalid_state)
        6. token de Planillas guardado del aprobador (≤ 60 min) ──no──▶ 409 planillas_session_required
        7. POST Planillas /acciones/permisos (por turno) ──falla──▶ 502 (sin tocar el registro)
        8. registro local: estado=aprobado + firmas + auditoría ─▶ 9. notificación push ─▶ 200
```

## 8. Decisiones que solo puede tomar el cliente

1. **¿Qué es una «omisión»?** Opciones: (a) marca de ingreso/salida no hecha; (b) actividad programada no realizada; (c) ambas; y **cuánto es la gracia** antes de contarla (¿minutos tras el fin del turno?).
2. **¿«Funciones liberadas» por puesto o globales?** Hoy es global (sección 1.2). Si debe ser por puesto, hay que decidir dónde se guarda y quién lo mantiene (Guardify o la app).
3. **Requisición: ¿basta con un reporte o debe quedar un estado (solicitada/atendida)?** Y, para «incompleto», cuál señal vale: unidades entregadas < plan, última revisión con cantidad real < necesaria, o ambas.
4. **Aprobar desde Guardify: ¿se acepta que el aprobador deba haber entrado a la app en los últimos 60 min?** Es lo que implementa el PR #190 (si no, `409 planillas_session_required` y debe abrir la app). Si no es aceptable, la única salida es una credencial de servicio de Planillas (a pedir al proveedor, sección 9).
5. **Firma del aprobador en la consola web:** la manual (dibujada) es obligatoria en el protocolo; ¿la digital la genera el servidor con la identidad del actor (propuesta, sección 6.2 punto 4) o se acepta una imagen? Y: ¿basta la bitácora como rastro o se exige además la fila de evidencia (punto 3)?
6. **¿Qué representa `coordinado_por_id: 3`** y cuál se usa cuando aprueba Guardify?
7. **Carga masiva:** ¿tope de filas por lote? ¿Se permite cargar varias unidades (series) del mismo artículo para un puesto en un lote? (hoy se colapsan en una). ¿Qué rol puede cargar?

## 9. Solicitudes al proveedor (Planillas)

1. Solo si el cliente rechaza la decisión 4: credencial de servicio con permiso para crear permisos (`/acciones/permisos`) y cambios de guardia (`/cdg`) a nombre de un ejecutivo, con rastro de quién los originó.
2. Qué valida Planillas del token (¿que pertenezca al ejecutivo de la solicitud?) y qué códigos de error devuelve.
3. Contrato de `/articulos-puesto/carga-masiva`: límites, si es transaccional/idempotente, respuesta por fila y quién puede invocarlo.
4. Significado de `teorico` y de `hora_mas_cuatro*` en `c_marca_dia`, y de `coordinado_por_id`.
