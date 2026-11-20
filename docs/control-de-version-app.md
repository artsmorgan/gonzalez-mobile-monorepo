# Control de versión de la app

El servidor puede exigir que la app tenga **una versión concreta** para atender sus peticiones. Se configura con dos variables del servidor (`apps/server`) y se aplica en [`apps/server/middleware.ts`](../apps/server/middleware.ts) (lógica en `utils/appVersionGate.ts`).

| Variable | Efecto |
|---|---|
| `APP_LAST_VERSION` | La versión exigida (por ejemplo `1.0.5`). También elige qué entrada del catálogo (`mobile_versions_test.json` / `mobile_versions_prod.json`) se ofrece como «última versión» en `/api/mobile-versions`. |
| `FORCE_APP_LAST_VERSION` | `true` (también `1`, `on`, `yes`, `sí`) activa el control. Apagada o sin definir, el servidor no revisa la versión. |

Con el control activo, cada petición a `/api/*` debe declarar su versión y tiene que ser **igual** a `APP_LAST_VERSION`; si no, el servidor responde **HTTP 426** con

```json
{ "status": false, "update_required": true, "required_version": "1.0.5", "current_version": "1.0.4", "message": "Tu versión de la aplicación ya no es compatible. …" }
```

El mensaje se ve en el inicio de sesión (error del login) y, ya dentro de la app, en una alerta «Actualización requerida».

## Cómo declara la app su versión

- **Cabecera `X-App-Version`** en todo `fetch` hacia el servidor: la agrega `apps/mobile/hooks/installEvidenceFetch.ts` (incluye `authedFetch`). Las descargas nativas (`File.downloadFileAsync`) la mandan desde `hooks/downloadReportFileToDevice.ts`.
- **Parámetro `app_version`** en las URLs de archivos que llevan `?token=` (imágenes, audios, videos y enlaces que abre el navegador, que no pueden mandar cabeceras): `appVersionQuery()` en `hooks/appVersionHeader.ts`. El servidor acepta la versión de cualquiera de las dos formas.

## Qué queda fuera del control

- `/api/mobile-versions` (consultar la última versión) y `/api/mobile-versions/{versión}` (descargar el instalador): **públicas, sin token ni versión**. Así una app desactualizada puede actualizarse, también desde el inicio de sesión.
- `OPTIONS` (consulta previa CORS del navegador).
- `/api/dynamic-prisma/*`: llamadas del propio servidor a sí mismo (`callDynamicPrisma`); no vienen de la app.
- `/api/guardify/*`: llamadas de servidor a servidor de Guardify, con su propia llave.

## Antes de encenderlo

1. `APP_LAST_VERSION` debe ser la versión que **ya está instalada** (la de `APP_VERSION_INFO` en `apps/mobile/app.config.js`: lite en el servidor de pruebas, prod en el de producción). Si se pone una versión que nadie tiene instalada, **todos** quedan bloqueados.
2. El instalador `MonitoreApp-{versión}[-{abi}].apk` tiene que estar subido a `/app-versions` antes de exigir esa versión.
3. Para encender o apagar el control no hace falta recompilar: se cambia la variable y se reinicia el servidor.
