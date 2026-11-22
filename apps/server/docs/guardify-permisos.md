# Permisos de Guardify en el servidor (fase 3 de roles)

Desde la fase 2 el menú de la app muestra las pantallas según el rol y las condiciones de Guardify. En la fase 3 el **servidor** hace cumplir los
mismos permisos: una app modificada podría mostrar una pantalla, pero no saltarse la API. Código: `utils/guardifyPermissions.ts`.

Guardify calcula en el momento los permisos de cada persona (`GET {GUARDIFY_URL}/api/v1/access/grants?externalId=<cédula>`, con la misma
credencial de aplicación que `/revocations`). Un cambio de rol en Guardify rige en menos de `GUARDIFY_GRANTS_TTL_SECONDS`, sin que la persona
vuelva a iniciar sesión.

## Variables de entorno (servidor)

| Variable | Qué hace | Por defecto |
|---|---|---|
| `GUARDIFY_PERMISSIONS` | `off` / `observe` / `on` (ver abajo) | `off` (todo como hoy) |
| `GUARDIFY_GRANTS_TTL_SECONDS` | Cuánto se guardan en memoria los permisos de cada persona (15 a 300) | `60` |
| `GUARDIFY_URL`, `GUARDIFY_APP_CLIENT_ID`, `GUARDIFY_APP_CLIENT_SECRET` | Las mismas del control de equipos (`guardify-devices.md`) | — |

> Escribir estas variables en Railway requiere permiso explícito del dueño del proyecto.

## Modos

- **off**: no consulta a Guardify; todo sigue como hoy.
- **observe**: responde como siempre y deja un log estructurado (`{"guardify_permission": {...}}` con `kind`, `permission`, `empleado`, `route`, `role`)
  cada vez que Guardify habría decidido distinto. Sirve para revisar el mapa de rutas antes de encender.
- **on**: decide Guardify.

Si Guardify no tiene a la persona (`governed: false`), no hay cédula, o Guardify no responde y no hay una respuesta anterior guardada, rige la
regla de siempre. Una caída de Guardify nunca deja a nadie sin servicio.

## Qué cambia con `on`

1. **«¿Es súper admin?»** (`n_employees_superadmin`) pasa a ser un permiso de Guardify (`isAdminFor` en `utils/isSuperAdminEmpleado.ts`):

   | Dónde | Permiso de Guardify |
   |---|---|
   | Asistencia de otras personas (`attendance/*`, `lunch-time/[id]/test-ending-time`, `check-permissions`), editar documentos ajenos (`job-manuals/[id]/edit`, `files`), mantenimiento de reportes (`purgeOldReports`, `previewUserLoginRefreshTokens`) | `administracion.registros-de-otros` |
   | Súper administradores (`nomenclators/super-admins`) | `administracion.super-admins` |
   | Visibilidad de módulos (`modules-release/[id]`) | `administracion.visibilidad-de-modulos` |

   El rol «Súper administrador» de Guardify trae los tres. Los demás roles, ninguno.

2. **Escrituras de cada pantalla** (POST/PUT/PATCH/DELETE): `utils/verifyAccessTokenByApi.ts` exige el permiso de la pantalla dueña de la ruta
   (`SCREEN_WRITE_ROUTES`). Sin permiso responde `403` con `message = permission_denied|<permiso>`. La app lo clasifica como falta de permiso
   (`hooks/apiFailure.ts`) y **no cierra la sesión**. Las lecturas no se tocan.

   Quedan fuera las rutas que usa más de una pantalla: `activities`, `lunch-time`, `corporate-vehicles` (las usa el marcado de ingreso),
   `attendance` y `job-manuals` (los documentos que firma el guarda). Los nomencladores solo los escribe su pantalla
   (`administracion.nomencladores`).

## Límites

- Las condiciones de las pantallas (marca vigente, división) las evalúa la app con sus datos; el servidor solo exige el permiso.
- La respuesta de una ruta denegada trae el mensaje técnico `permission_denied|<permiso>`. Cada pantalla debería mostrar «No tienes permiso
  para realizar esta acción» (`failureUserMessage('permission_denied')`), y la cola sin conexión no debería reintentar para siempre un 403 de
  permiso.

## Orden recomendado

`observe` en el servidor de pruebas → revisar los logs `guardify_permission` con el APK de pruebas → ajustar el mapa si hace falta → `on` en
pruebas → prueba E2E → producción.
