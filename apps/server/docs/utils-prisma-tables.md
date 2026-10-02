# Tablas invocadas por Prisma directo — `apps/server/utils`

Lista de tablas de la base de datos invocadas mediante `prisma.<tabla>.<método>(...)` (Prisma directo, sin pasar por `callDynamicPrisma`) en todos los archivos de `apps/server/utils/`, incluyendo la subcarpeta `utils/reports-functions/`.

## Tablas

- `a_mobile_token_for_planillas`
- `c_accion_personal`
- `c_acta_entre_producto`
- `c_agenda_minuta`
- `c_apertura_cierre_puesto`
- `c_articulo_mantenimiento`
- `c_bitacora_vehiculo_detenido`
- `c_boleta_apreciacion_vulnerabilidad`
- `c_checklist_supervision`
- `c_configuracion`
- `c_control_asistencia`
- `c_empleado`
- `c_empleado_almuerzo`
- `c_empleado_plaza`
- `c_encuesta_cliente`
- `c_evaluacion_empleado`
- `c_imagenes_apertura_cierre_puesto`
- `c_incidente`
- `c_login_marca_almuerzo`
- `c_maestro_quejas`
- `c_marca_dia`
- `c_movimientos_articulo_mantenimiento`
- `c_notas_voz`
- `c_producto_no_conforme`
- `c_puesto_notas`
- `c_registro_induccion_general`
- `c_registro_induccion_recorrido`
- `c_solicitud_permiso`
- `c_ubicacion_puesto_registro_cambios`
- `c_vehiculos_corporativos`
- `e_actividades`
- `e_control_documento_entregado_cliente`
- `e_estructura_articulo_corpo_puesto_entrega`
- `e_estructura_articulo_corpo_puesto_plan`
- `e_estructura_cliente`
- `e_estructura_combo_articulo_cp`
- `e_estructura_contrato`
- `e_estructura_empresa`
- `e_estructura_plazas`
- `e_estructura_puesto`
- `e_estructura_sucursal`
- `e_llave`
- `e_llavero`
- `e_manual_puesto`
- `e_mutuos_acuerdos`
- `e_registro_capacitaciones`
- `e_registro_entrega_puesto`
- `e_registro_personas`
- `e_registro_vehiculos`
- `n_articulo_corpo_puesto`
- `n_coordinador`
- `n_division`
- `n_ejecutivo_cuenta`
- `n_novedades_categoria`
- `pg_categoria_empleado`
- `pg_categoria_salarial`
- `refresh_token`

**Total: 55 tablas.**

## Notas

- Esta carpeta introduce varias tablas "raíz" de reporte (`c_incidente`, `c_encuesta_cliente`, `c_evaluacion_empleado`, `c_maestro_quejas`, `c_vehiculos_corporativos`, `e_llave`, `e_llavero`, `e_registro_personas`, etc.) que **no aparecían** en el análisis previo de rutas de `apps/server/app/api/` — esas rutas suelen leer/escribir esas mismas tablas a través de `callDynamicPrisma`, mientras que las funciones de `utils/reports-functions/` las consultan con Prisma directo para generar los reportes de solo lectura.
- **Advertencia sobre `utils/reports-functions/`:** casi todas sus funciones reciben el cliente de base de datos como un parámetro llamado `prisma`, pero ese parámetro no siempre es el singleton global de `prismaClient.ts`. En el flujo real (`runMobileReportJob.ts` → `reportDynamicPrisma.ts` → `createReportPrismaClient`), ese `prisma` puede ser un objeto `ReportDataAccess` que, según la tabla, enruta internamente hacia el cliente Prisma real **o hacia `callDynamicPrisma`** para tablas clasificadas como "creadas". Es decir: aunque el código fuente escriba literalmente `prisma.c_incidente.findMany(...)`, en tiempo de ejecución esa llamada podría terminar pasando por `callDynamicPrisma` de todos modos. Esta lista se basa en la sintaxis literal del código (`prisma.<tabla>.<método>(`), igual que en el resto de este documento de tablas, no en el enrutamiento real en tiempo de ejecución.
- `e_actividades` es una tabla distinta de `e_actividad_corpo` (vista en las rutas de `api/activities`) — ambas coexisten en el proyecto para módulos diferentes.
- No se encontraron invocaciones directas a `c_horario` dentro de `apps/server/utils` (sí aparecía en las rutas de `apps/server/app/api/attendance` y `lunch-time`); se deja fuera de esta lista.
