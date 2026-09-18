# Tablas invocadas por Prisma directo — rutas API

Lista de tablas de la base de datos invocadas mediante `prisma.<tabla>.<método>(...)` (Prisma directo, sin pasar por `callDynamicPrisma`) en las siguientes rutas de `apps/server/app/api/`:

- `acta-entrega-productos`
- `activities`
- `agenda-minuta`
- `apreciacion-vulnerabilidad`
- `articulo-mantenimiento`
- `articulos`
- `attendance`
- `attendance-control`
- `auth`
- `bitacora-vehiculo-detenido`
- `cambios-apps-modules`
- `categoria-mantenimiento`
- `categories`
- `check-permissions`
- `checklist-supervision`
- `complaints-master`
- `corporate-vehicles`
- `digital-signature`
- `document-types`
- `documentos-entregados`
- `dynamic-prisma`
- `empleados`
- `encuesta-nps`
- `entrega-puestos`
- `evaluation`
- `executives`
- `general-induction-register`
- `incidents`
- `induction-tour-record`
- `job-manuals`
- `llaveros`
- `llaves`
- `lunch-time`
- `main-structure`
- `mantenimiento-equipo`
- `mobile-versions`
- `modules-release`
- `mutuos-acuerdos`
- `nomenclators`
- `non-conforming-product`
- `notification`
- `opening-closing-position`
- `password`
- `permit-request`
- `physical-minute-agenda`
- `puestos`
- `push`
- `reglas`
- `reportes`
- `roles`
- `server-time`
- `training`
- `traslado-plaza`
- `uploads`
- `vehicles`
- `visitors`
- `voice-notes`

## Tablas

- `c_accion_personal`
- `c_cambio_guardia`
- `c_configuracion`
- `c_empleado`
- `c_empleado_datos_adjuntos_rrhh`
- `c_empleado_plaza`
- `c_horario`
- `c_marca_dia`
- `c_tipo_accion`
- `e_estructura_articulo_corpo_puesto_entrega`
- `e_estructura_articulo_corpo_puesto_plan`
- `e_estructura_cliente`
- `e_estructura_combo_articulo_cp`
- `e_estructura_contrato`
- `e_estructura_empresa`
- `e_estructura_plazas`
- `e_estructura_puesto`
- `e_estructura_sucursal`
- `e_licencia`
- `n_articulo_corpo_puesto`
- `n_coordinador`
- `n_division`
- `n_ejecutivo_cuenta`
- `n_tipo_dato_adjunto_rrhh`
- `n_tipo_licencia`
- `pg_categoria_empleado`
- `pg_categoria_salarial`

**Total: 26 tablas.**

## Notas

- `categoria-mantenimiento`, `categories`, `document-types`, `mobile-versions`, `modules-release`, `nomenclators`, `push`, `reglas`, `roles`, `server-time` y `uploads` no invocan Prisma directamente en sus rutas (solo `callDynamicPrisma`, o no acceden a base de datos).
- `reportes` tampoco invoca Prisma directamente **en el código de sus rutas**: delega la consulta y generación de reportes en utilidades de `apps/server/utils/` (p. ej. `reportDynamicPrisma.ts` y las funciones de `utils/reports-functions/`), que sí usan Prisma extensamente pero no forman parte de esta carpeta de rutas.
- En `dynamic-prisma/route.ts` el acceso es genérico y dinámico (`(prisma as any)[table]`, con `table` resuelto en tiempo de ejecución para las tablas "creadas"); no se cuenta como invocación literal de una tabla específica y se excluye de la lista. Las tablas listadas para `dynamic-prisma` (`refresh_token`, `c_login_marca_almuerzo`) provienen de las subrutas `auth/login`, `auth/logout` y `auth/refresh-token`, que sí llaman a Prisma con nombres de tabla fijos.
- En `password/recover-password/[token]`, el token de recuperación (`a_recovery_password_token`) se consulta vía `callDynamicPrisma` y se excluye; solo `c_empleado` se invoca con Prisma directo en esa ruta.
