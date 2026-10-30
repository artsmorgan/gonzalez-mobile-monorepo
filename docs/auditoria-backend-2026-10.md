# Auditoría del servidor e Integra (issue #181)

Revisión del servidor (`apps/server`) pedida por la auditoría externa «MonitoreApp 1.0.2» (26 oct 2026), que no pudo ver el servidor ni Integra.
Aplica la decisión del 23 de oct: **lo que dependa de Planillas o Integra se pide al proveedor, no se cubre desde este repo.**

**Método y límites.** Es una revisión **estática del código** (más la API dinámica `gonzalez-mobile-dynamic-api` cuando el flujo la cruza), no una prueba
de penetración ni una revisión de la infraestructura. Los puntos que dependen de la base de datos real, de la red o de variables de entorno de
producción están marcados «requiere infraestructura / proveedor» con la solicitud redactada al final. El inventario de las 286 rutas está en
[`auditoria-backend-2026-10-inventario.md`](auditoria-backend-2026-10-inventario.md) (generado con `apps/server/scripts/auditRoutes.ts`).

## Estado de cada punto

| # | Punto | Estado | Resumen |
|---|---|---|---|
| 1 | Autorización por objeto (BOLA/IDOR) | **Parcial** | Se corrigieron 9 rutas y la de reportes (#169); quedan **210 rutas con IDs de objeto sin control de alcance** (113 de escritura, 55 descargas de archivos). Falta una decisión de negocio: ver §1. |
| 2 | Cuenta de BD y permisos | **Requiere infraestructura / proveedor** | Del código sale que el servidor **escribe** en la BD (no es de solo lectura). Los *grants* reales no se ven desde el repo. Se retiró una escritura peligrosa. |
| 3 | SQL y rendimiento | **Hallazgos documentados** | SQL crudo solo con texto fijo (sin inyección). Casi todas las listas se leen sin `take`/paginación. |
| 4 | Validez de la sesión | **Hallazgos documentados** | Access JWT de 1 día sin consulta de revocación; refresh rotado pero no atómico. |
| 5 | Sincronización | **Parcial** | Autoría corregida (#176 y evidencia); idempotencia por clave en marcas y en la API de acciones de Guardify (`docs/idempotencia-servidor.md`); las demás altas siguen sin clave. |
| 6 | Red API–BD | **Requiere infraestructura / proveedor** | Sin datos en el repo. Se comprobó que los logs y `reportError` no guardan secretos. |
| 7 | Evidencia y firmas | **Corregido el autor; límites documentados** | El autor ya no lo decide el cliente. Ubicación y hora siguen siendo declaradas por el cliente. |

## Correcciones hechas en este issue

Todas con pruebas automáticas que fallaban antes (`apps/server/utils/backendAudit.test.ts`, `evidencia.test.ts`).

| Hallazgo | Corrección |
|---|---|
| `check-permissions?id=` devolvía los roles de **cualquier** empleado a cualquier usuario autenticado. | Solo la propia persona o un administrador (`authorizeSelfOrAdmin`). La app lo llama siempre con su propio id. |
| `attendance/user/[id]` y `/next` devolvían las marcas de cualquier empleado. | Mismo control. La app siempre pasa el id propio. |
| `PUT attendance/[id]` (entrada/salida), `revert-leaving` y `absent-reason` actuaban sobre **cualquier marca** por ID (revert-leaving ni miraba quién llamaba). | La marca debe ser del titular (`empleadoFijo_id`), de quien lo reemplaza (`empleadoReemplaza_id`) o de un administrador (`authorizeMarcaAccess`). |
| `attendance/[id]/early-leaving` y `lunch-time/[id]/test-ending-time` leían marcas **sin autenticación** (Prisma directo). | Exigen sesión y alcance; `test-ending-time` además solo existe fuera de producción. |
| `attendance/[id]/dev-create-marca` creaba marcas con IDs de negocio fijos para cualquier `id` de la URL. | Solo fuera de producción (`APP_MODE=production` devuelve 404), con sesión y solo para la propia persona. El botón de «marca de prueba» de la app sigue funcionando en pruebas. |
| `POST /api/empleados` hacía `prisma.c_empleado.create({ data })` con el cuerpo de la petición (asignación masiva sobre una tabla de **Planillas**). La app nunca lo usó. | Se retiró el `POST` (queda el `GET`). El alta de empleados es de Planillas. |
| `reportError` guardaba el mensaje de la **verificación del token** en vez del error real, no guardaba el código HTTP, y reventaba con un token inválido (`payload.id` sobre `null`). | Guarda el error real con secretos redactados (`Bearer`, `Basic`, JWT, `password=`, `token=`…), el código y el usuario; nunca lanza. 1.426 llamadas lo usan. |
| La evidencia tomaba el `empleadoId` de `firma_responsable` (lo manda el cliente) por encima del del token. | El autor es siempre la persona autenticada. |
| Una ruta nueva podía tocar la BD sin verificar la sesión. | Prueba que lo impide (`routeAudit.ts`): toda ruta con Prisma directo verifica sesión; toda ruta sin verificación está en una lista cerrada de públicas por diseño. |
| Mutuo acuerdo: se guardaba `aprobado` **antes** de llamar a Planillas y no se revertía; si Planillas fallaba el mutuo quedaba aprobado sin cambio de guardia y un reintento era imposible. | Ante cualquier fallo posterior (marcas, coordinador, error de Planillas o de red) vuelve a `pendiente` con sus firmas anteriores (`revertir` en `apps/server/utils/guardifyActions/aprobar-mutuo.ts`, incorporado al fusionar el PR #190). |
| Carga masiva de artículos: llamaba a Planillas con una lista vacía cuando todo ya existía, y su error hablaba de «ubicación del puesto». | Responde «Se crearon 0 plan(es) y 0 entrega(s): todo ya existía» sin llamar a Planillas (`apps/server/utils/guardifyActions/inventario.ts`); el error dice «Error al cargar los artículos en Planillas». |
| Revocar los refresh tokens al desplegar #169 no tenía herramienta. | `apps/server/scripts/revokeRefreshTokens.ts`: por defecto solo cuenta (simulacro); revoca solo con `--confirm`. Ver `docs/auditoria-pruebas-manuales.md`. |

## 1. Autorización por objeto (BOLA/IDOR)

**Cómo está hoy.** El servidor autentica (JWT de la API dinámica, y el equipo con Guardify si `GUARDIFY_DEVICE_ENFORCE=on`) pero **no tiene un modelo
general de alcance**. «Alcance» de una persona en este sistema son sus plazas (`c_empleado_plaza`: división, contrato, sucursal, puesto), y esa
información vive en tablas de Planillas. Casi todas las rutas reciben un ID (`corpo_id`, `puesto_id`, `empleado_id`, `marcaId`…) y lo usan tal cual.

Cifras del inventario (análisis estático): **286 rutas**, 275 verifican la sesión, 226 reciben algún ID de objeto y **16 tienen control de alcance**
(las 9 de arriba más `reportes`, los controles previos de super administrador las dos rutas de acciones de Guardify, que comprueban al actor contra el registro, y las dos de edición de documentos, que comprueban el rol y la marca). Las 210 restantes con IDs, por familia (entre paréntesis, las que escriben):

`job-manuals` 15 (7) · `incidents` 14 (6) · `activities` 11 (8) · `articulo-mantenimiento` 11 (6) · `corporate-vehicles` 11 (8) · `puestos` 10 (5) ·
`permit-request` 9 (2) · `attendance-control` 8 (5) · `non-conforming-product` 8 (3) · `training` 8 (3) · `complaints-master` 7 (2) ·
`acta-entrega-productos`, `agenda-minuta`, `empleados`, `general-induction-register`, `mutuos-acuerdos`, `opening-closing-position` 5 c/u ·
`apreciacion-vulnerabilidad`, `bitacora-vehiculo-detenido`, `llaveros`, `llaves`, `vehicles` 4 c/u · y 30 familias más pequeñas.

**Descargas de archivos (55 rutas `get-image/get-file/get-audio/get-video`).** No verifican nada en la ruta: reenvían a la API dinámica de archivos con el
token del usuario, que **sí exige un usuario autenticado**, pero no que tenga alcance sobre el objeto. Quien conozca (o adivine, son enteros
consecutivos) el ID de un incidente, acta o capacitación puede descargar sus archivos.

**Por qué no se cerró todo aquí.** Aplicar un control a 210 rutas exige definir, por familia, quién puede ver o modificar qué (¿un supervisor ve los
incidentes de todas sus sucursales?, ¿un operativo solo los suyos?). Eso es una decisión del cliente y depende de datos de Planillas; hacerlo por
suposición rompería flujos legítimos (por ejemplo, `empleados/[id]` lo consultan supervisores sobre otros empleados). Lo que sí se cerró son las rutas
cuyo dueño es inequívoco (la propia persona o su marca).

**Cómo se prueba cada ruta corregida** (`backendAudit.test.ts`, «dos usuarios de distinto alcance»): `authorizeSelfOrAdmin` y `authorizeMarcaAccess`
se prueban con el usuario A, el usuario B y un administrador (A→A permitido, B→A 403 `permission_denied`, administrador permitido, error al
consultar al administrador = denegado), y por código se comprueba que cada ruta llama al control **antes** de la primera operación sobre la BD. Con
`code: "permission_denied"` la app no cierra la sesión (ver `docs/causas-de-fallo-api.md`).
**Límite:** no son pruebas de integración contra la BD (las rutas necesitan Prisma y Planillas); la prueba manual contra el ambiente de pruebas con dos
usuarios reales está pendiente.

### Tabla endpoint → validación → prueba (rutas corregidas)

| Endpoint | Validación ahora | Prueba |
|---|---|---|
| `GET check-permissions?id=` | sesión + propia persona o administrador | `backendAudit.test.ts` («check-permissions») |
| `GET attendance/user/[id]` | sesión + propia persona o administrador | idem |
| `GET attendance/user/[id]/next` | idem | idem |
| `PUT attendance/[id]` (entrada/salida) | sesión + marca propia o administrador | idem |
| `PUT attendance/[id]/revert-leaving` | idem | idem |
| `PUT attendance/[id]/absent-reason` | idem | idem |
| `GET attendance/[id]/early-leaving` | sesión + propia persona o administrador | idem |
| `GET lunch-time/[id]/test-ending-time` | no existe en producción; sesión + marca propia | idem |
| `POST attendance/[id]/dev-create-marca` | no existe en producción; sesión + propia persona | idem |
| `POST /api/reportes` (45 operaciones) | tabla operación→rol con denegación por defecto | `reportesAccess.test.ts` (#169) |

### Propuesta: un issue por familia (pendientes, no creados)

Prioridad por riesgo: (1) **escrituras sobre objetos de otras personas**: `activities`, `corporate-vehicles`, `llaves`, `llaveros`,
`attendance-control`, `articulo-mantenimiento`, `job-manuals`, `incidents`, `puestos`; (2) **descargas de archivos** con el mismo criterio que el
objeto padre; (3) lecturas. Cada issue necesita primero la regla de alcance del cliente (qué plazas/sucursales ve cada rol) y su prueba con dos usuarios.

## 2. Cuenta de BD

- El servidor se conecta **directamente** con Prisma (`DATABASE_URL`, `utils/prismaClient.ts`) a las tablas preexistentes de Planillas (`c_*`, `e_*`,
  `n_*`, `pg_*`) y, para las tablas propias de MonitoreApp, pasa por la API dinámica (`callDynamicPrisma`, 820 llamadas) que usa su propia conexión.
  Hay ~872 lecturas directas y **escrituras directas** en rutas: `refresh_token` y `c_login_marca_almuerzo` (login/refresh, API dinámica) y
  `e_actividad_corpo_revision_equipo` (`activities/marca/[id]`). Por tanto **la cuenta no puede ser de solo lectura** para las tablas de MonitoreApp.
- Se retiró la única escritura directa sobre `c_empleado` (tabla de Planillas): el `POST /api/empleados` (ver arriba).
- **No se puede comprobar desde el repo:** los *grants* reales, si la cuenta de Prisma directo es la misma que la de la API dinámica, si tiene `DROP`,
  `ALTER` o acceso a otros esquemas. Se pide al proveedor (solicitud 1).

## 3. Consultas y rendimiento SQL

- **Parametrización:** el único SQL crudo (`$queryRawUnsafe`) son 4 consultas de **texto fijo** (`SELECT DATABASE()`, `information_schema`,
  `_prisma_migrations`, `SHOW TABLES LIKE …`) sin datos del usuario. El resto es Prisma, que parametriza. Sin hallazgo de inyección.
- **Límites y paginación:** hay 99 `findMany` en rutas y solo 5 archivos usan `take`. Las listas se leen completas (necesario para las cachés
  sin conexión de la app, pero sin tope en el servidor). Los reportes usan `take: 50_000`; el de ingresos de usuario (`refresh_token`) es solo para
  administrador desde #169 y se limita por rango de fechas. **Recomendación:** tope por defecto en las listas que no alimentan una caché, e índice por
  `createdAt` en `refresh_token`.
- **N+1:** `check-permissions` consulta división, plaza, categoría salarial y categoría de empleado **dentro de un bucle por plaza**. Es el ejemplo
  claro; no se cambió porque la salida depende de Planillas y no hay prueba de equivalencia. Recomendación: una consulta con `include`/`in`.
- **Tiempos máximos:** no hay plazo por consulta en el servidor (la app ya tiene plazos, #172). Recomendación: `connect_timeout`/`pool_timeout` y límite
  de ejecución en la cadena de conexión (proveedor).

## 4. Validez de la sesión

| Aspecto | Hoy | Hallazgo |
|---|---|---|
| Expiración | Access JWT 1 día, refresh JWT 7 días (`auth/refresh-token`); el refresh se guarda como SHA-256 en `refresh_token` (#169) | Correcto. |
| Rotación | Cada refresh revoca el anterior y crea uno nuevo con nuevo `sessionId` | Correcto. |
| Credenciales antiguas | Un refresh revocado, de otro empleado, de otra sesión o vencido se rechaza (401/403) | Correcto. |
| Verificación del access token | **Solo firma y expiración** (`verifyAccessToken`): no consulta `refresh_token` ni la revocación | **Un access token sigue válido hasta 1 día después de cerrar sesión o de revocar la sesión**, salvo que Guardify esté en `on` (revoca por `gsid`). |
| Reuso de un refresh revocado | Se rechaza, pero **no revoca el resto de la familia** | Si lo roban y lo usan primero, el usuario legítimo queda fuera y el ladrón conserva la sesión nueva. |
| Atomicidad | `findFirst` → `update revoked` → `create` sin transacción | Dos refrescos simultáneos con el mismo token pueden pasar ambos (carrera). Cambio propuesto en la API dinámica: `updateMany({ where: { id, revoked: false } })` y exigir `count === 1`. No se aplicó porque ese repo no tiene pruebas automáticas. |
| Logout sin red | La app borra sus credenciales locales y el servidor no se entera hasta que haya red | La sesión del servidor sigue viva hasta vencer; mitigación: cola de «cerrar sesión pendiente» (propuesta). |

## 5. Sincronización

- **Idempotencia de escrituras** (#172): el servidor ahora acepta `Idempotency-Key`, la guarda (SHA-256) en `c_clave_idempotencia` y devuelve el resultado original al
  reintento (`docs/idempotencia-servidor.md`). Está aplicada en `PUT /api/attendance/[id]` (marcas) y en la API de acciones de Guardify. Las demás altas (`POST` de
  incidentes, actas, bitácoras…) **todavía no deduplican**: un reintento tras un tiempo agotado puede duplicar el registro, así que la app no las reintenta sola
  (`docs/causas-de-fallo-api.md`). Añadir una ruta es envolverla con `conIdempotencia` y mandar una clave estable desde su pantalla.
- **Conflictos:** la última escritura gana; no hay versión ni `If-Match` en las ediciones.
- **Autoría de acciones sin conexión:** corregida en dos puntos. En el equipo, cada acción lleva su propietario y no se sincroniza con otra sesión
  (`docs/colas-propietario-y-token.md`, #176). En el servidor, la evidencia toma el autor del token (arriba).

## 6. Red API–BD

No verificable desde el repo. Lo que sí se comprobó:

- **Credenciales solo en el servidor:** la app no recibe contraseñas de BD. **Excepción a revisar:** `MOBILE_ACCESS_TOKEN` es un secreto compartido que
  viaja **dentro del APK** (`extra.MOBILE_ACCESS_TOKEN`) y, en `main-structure`, **en la URL** (`?mobileAccessToken=`). Quien extraiga el APK lo tiene,
  y las URLs quedan en registros de acceso. Recomendación: que la autorización de esas rutas descanse en el JWT del usuario y retirar el secreto del
  cliente y de las URLs.
- **Registros sin secretos:** `reportError` ya los redacta y una prueba recorre todos los `console.*` del servidor para impedir que se impriman
  cabeceras, contraseñas o tokens como variable.
- TLS con validación, acceso privado, rotación y registros de la BD: solicitud 2.

## 7. Evidencia y firmas

- **Quién envía qué.** Del cliente vienen: `X-Device-Uid`, ubicación, hora y permiso de GPS (cabeceras `X-Evidence-*`, o la firma de captura
  `firma_responsable`). Del servidor: huella SHA-256 canónica y sello HMAC (si hay `EVIDENCE_SIGNING_KEY`), `cedula`, `sesion_id` y ahora el **autor**.
- **Corregido:** el autor ya no puede ser otra persona (antes lo decidía el `empleadoId` de la firma).
- **Límites que quedan (por diseño, documentados):**
  - Ubicación, hora y dispositivo son **declarados por el cliente**; el servidor los sella pero no puede comprobar que sean ciertos. Un cliente
    modificado puede declarar otra posición u hora. La mitigación real es la atestación del equipo (Guardify/Play Integrity), fuera de este repo.
  - **Repetición:** no hay un tope de antigüedad ni de futuro para la hora declarada (la acción sin conexión puede ser de días atrás, así que un tope
    estricto rompería casos legítimos). Propuesta: rechazar horas > 5 min en el futuro y marcar las de más de 72 h.
  - La evidencia es una fila por registro y acción; no hay restricción única que impida duplicarla si el registro se reenvía.

## Pruebas

```bash
cd apps/server
npx tsx --test utils/backendAudit.test.ts utils/evidencia.test.ts utils/reportesAccess.test.ts
npx tsx --test $(find utils app -name "*.test.ts" -not -path "*/node_modules/*")
```

`backendAudit.test.ts`: política de alcance con dos usuarios, orden «control antes de la BD» en las 9 rutas, rutas de desarrollo apagadas en
producción, invariantes del inventario (ninguna ruta con Prisma directo sin sesión; ninguna sin sesión fuera de la lista de públicas; ninguna
asignación masiva), llave de Guardify en cada manejador, redacción de secretos y barrido de `console.*`.

## Solicitudes al proveedor (Planillas / Integra)

1. **Cuenta de base de datos.** Enviar (sin contraseñas): usuario, host y esquema(s) a los que accede la cuenta que usa el servidor de MonitoreApp con
   Prisma directo; salida de `SHOW GRANTS FOR '<usuario>'@'<host>'`; si es la misma cuenta que usa la API dinámica; y confirmar que no tiene `DROP`, `ALTER`,
   `CREATE USER`, `FILE` ni acceso a otros esquemas. Pedir una cuenta de solo lectura para las tablas de Planillas (`c_*`, `e_*`, `n_*`, `pg_*`) y otra
   con escritura solo sobre las tablas propias de MonitoreApp.
2. **Red.** Confirmar: TLS en la conexión API–BD con validación del certificado (`sslmode`/`ssl-mode=VERIFY_IDENTITY` o equivalente); que la BD no
   tiene acceso público (red privada o lista de IP); política y fecha de la última rotación de credenciales; y que los registros de la BD y de los
   proxys no guardan contraseñas ni tokens (en particular las URLs con `?token=` y `?mobileAccessToken=`).
3. **Rendimiento.** Plan de ejecución (`EXPLAIN`) y existencia de índices para las consultas por `empleadoFijo_id`/`empleadoReemplaza_id`/`fecha` en
   `c_marca_dia` y por `empleado_id` en `c_empleado_plaza`; y límites de conexión/ejecución del lado del servidor de BD.
4. **Alcance por rol.** Definición oficial de qué sucursales, puestos y empleados puede ver y modificar cada rol (supervisor, coordinador, operativo,
   ejecutivo de cuenta), necesaria para cerrar los 210 endpoints pendientes de §1.
