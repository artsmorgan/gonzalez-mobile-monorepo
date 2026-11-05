# APK de pruebas con Guardify encendido (solo compilar)

Esta guía es para quien compila el APK. **No hay que cambiar código ni variables**: todo está en la rama `servidor` y en el perfil de EAS `guardify-pruebas`.

## Compilar

Desde la rama `servidor` actualizada (`git pull`):

```bash
cd apps/mobile
eas build --platform android --profile guardify-pruebas
```

Es la variante `lite` («MntrApp (Test)»): se instala junto a la app de producción sin pisarla. **No lo subas a `/app-versions` ni lo publiques en producción.**

El perfil (`apps/mobile/eas.json`) ya trae, para esta build y ninguna otra:

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_GUARDIFY_ENABLED` | `true` |
| `EXPO_PUBLIC_GUARDIFY_URL` | `https://guardifyconsole-production.up.railway.app` (Guardify de pruebas) |
| `EXPO_PUBLIC_GUARDIFY_APP_KEY` / `…_COMPANY_CODE` | `monitoreapp` / `corporacion-gonzalez` (el equipo se registra solo, sin escribir código) |
| `EXPO_PUBLIC_GUARDIFY_HEARTBEAT_SECONDS` | `60` (latido cada minuto; por defecto son 5 min) |
| `EXPO_PUBLIC_API_SERVER` | servidor de pruebas de MonitoreApp |

Los perfiles `preview*` y `production*` no cambian: siguen con Guardify **apagado**. Si el perfil `guardify-pruebas` no se usa, la app no habla con Guardify.

## Qué incluye la build (ya estaba en el código)

- **Registro del equipo** al abrir la app: queda «Pendiente» hasta que alguien lo apruebe en la consola de Guardify (Apps → MonitoreApp → Dispositivos).
- **Habilitar / deshabilitar / retirar / bloquear** desde la consola: la app muestra la pantalla de estado correspondiente y deja de funcionar; retirar un equipo borra sus datos locales (primero sincroniza lo pendiente).
- **Cortar acceso**: cierre de sesión remoto y revocación de sesiones; el servidor consulta a Guardify la lista de revocaciones.
- **Sesión del empleado en Guardify** («login del dispositivo»): al entrar a la app se abre su sesión con la cédula; si Guardify no lo autoriza, la app muestra «Acceso no autorizado» y cierra la sesión.
- **Actualización obligatoria** desde el catálogo de APK de Guardify (versión mínima).
- **Ubicación en el mapa de Guardify**: aviso de consentimiento una sola vez; con «Aceptar», el latido manda la última ubicación (y la batería) cada 60 s **mientras la app está abierta**. No hay seguimiento en segundo plano: con la app cerrada no se actualiza.

## Probar (lo mínimo)

1. Instalar el APK en un teléfono e iniciar sesión **con un empleado que ya esté dado de alta en Guardify** (si no, verá «Acceso no autorizado»: pídele a Aletz que lo cree).
2. En Guardify el equipo aparece como «Pendiente»; aprobarlo → la app lo deja pasar.
3. Aceptar el aviso de ubicación → el equipo aparece en el mapa y se mueve a cada latido.
4. Desde Guardify bloquear el equipo → la app muestra «bloqueado» en cuanto consulta su estado (órdenes cada 10 s, latido cada 60 s); habilitarlo → vuelve a funcionar (estando bloqueada, la app vuelve a preguntar cada 60 s).
5. Cerrar sesión de la persona desde Guardify → la app cierra sesión.

## Qué NO tocar

- No cambiar `app.config.js`, `eas.json` ni el código de `hooks/guardify*` para esta build.
- No encender `GUARDIFY_DEVICE_ENFORCE=on` en el servidor: lo hace Aletz cuando los equipos de prueba ya estén registrados (en `on` el servidor rechaza cualquier APK sin equipo registrado, incluida la versión web).
- No usar este perfil para producción: en producción Guardify sigue apagado.

## Servidor de pruebas (ya configurado)

`GUARDIFY_URL`, `GUARDIFY_APP_CLIENT_ID/SECRET` y `GUARDIFY_REPORTS_API_KEY` están puestas; `GUARDIFY_DEVICE_ENFORCE=observe` (solo registra). Se comprobó que la lista de revocaciones de Guardify responde con esas credenciales.
