# Guardify simulado (para probar dispositivos sin la consola real)

`apps/server/scripts/mockGuardify.ts` imita **solo** lo que usan la app (SDK de dispositivo) y el servidor (lista de revocaciones) para probar los issues #145 a #150:
registro del equipo, estado, latidos, órdenes, verificación y renovación de acceso, catálogo de APK y revocaciones. Trae un **panel de control** para aprobar, rechazar o bloquear equipos, mandar órdenes y publicar APK.

No es el contrato completo de Guardify ni lo reemplaza: prueba **nuestro** lado. Se verifica contra el SDK real y contra `utils/guardifyDevices.ts` en `utils/mockGuardify.test.ts`. Limitaciones: estado en memoria (se pierde al reiniciar), sin canal SSE (la app consulta las órdenes), la lista de revocaciones trae el estado pero no el motivo (igual que el contrato real).

## Levantarlo

```bash
cd apps/server
npx tsx scripts/mockGuardify.ts
```

Panel en `http://localhost:4010`. Variables opcionales: `MOCK_GUARDIFY_PORT` (4010), `MOCK_AUTO_APPROVE=1` (los equipos nuevos quedan activos), `MOCK_LEASE_SECONDS` (900; usa 120 para ver la renovación del permiso en minutos), `MOCK_COMPANY_CODE` (`corporacion-gonzalez`), `MOCK_CLIENT_ID` / `MOCK_CLIENT_SECRET` (`mock-id` / `mock-secret`), `MOCK_OFFLINE_MODE`.

## Apuntar el servidor y la app al simulacro

**Servidor** (`apps/server/.env`):

```
GUARDIFY_URL=http://localhost:4010
GUARDIFY_APP_CLIENT_ID=mock-id
GUARDIFY_APP_CLIENT_SECRET=mock-secret
GUARDIFY_DEVICE_ENFORCE=observe
```

**App** (`apps/mobile/.env`). Guardify está **bloqueado por defecto** en la app: hay que encender el interruptor además de poner la URL.

```
EXPO_PUBLIC_GUARDIFY_ENABLED=true
EXPO_PUBLIC_GUARDIFY_URL=<URL del simulacro alcanzable desde el teléfono>
EXPO_PUBLIC_GUARDIFY_COMPANY_CODE=corporacion-gonzalez
```

El teléfono no ve `localhost`. Opciones: un túnel (`ngrok http 4010` → usar la URL `https://…`) o la IP de tu red local con una **compilación de depuración** (Android bloquea `http://` en las compilaciones de release). Hay que recompilar la app después de cambiar el `.env`.

Para volver a no usar Guardify: quita `EXPO_PUBLIC_GUARDIFY_ENABLED` (o ponlo en `false`), recompila, y deja el servidor en `GUARDIFY_DEVICE_ENFORCE=off` u `observe`. Con el interruptor apagado el código se conserva pero la app no lo usa.

## Escenarios

> **Importante con `GUARDIFY_DEVICE_ENFORCE=on`:** una petición cuyo token no trae equipo de Guardify (app sin la integración, o una sesión abierta antes de registrarse) se rechaza con `UNREGISTERED`. Para `on`, primero registra el equipo y **vuelve a iniciar sesión**. Con `observe` solo se registra en el log.

1. **Registro y aprobación (#145).** Abrir la app: pide el código (si no va en el `.env`) → «Esperando aprobación»; el equipo aparece en el panel como PENDIENTE. «Aprobar» → en ≤ 15 s la app muestra el login. «Rechazar» con motivo → la app muestra el rechazo y no avanza.
2. **Sesión y renovación.** Tras iniciar sesión aparece una sesión en el panel. Con `MOCK_LEASE_SECONDS=120` su vencimiento se corre solo (la app renueva a la mitad). «Revocar» → la app abre una sesión nueva sola (vuelve a verificar con la cédula).
3. **Bloqueo en caliente (#146, #149, #150).** Con el servidor en `on` y el equipo registrado (con sesión nueva): «Bloquear» → en ≤ 1 minuto (la lista se refresca cada 45 s) la app muestra «Equipo bloqueado» sin cerrar la sesión. «Aprobar / reactivar» → «Reintentar» vuelve a la normalidad. Con `observe` el log del servidor muestra líneas `guardify_device` y nada se corta.
4. **Órdenes (#147).** `PING`, `LOGOUT_ALL` (la app cierra la sesión), `LOGOUT_USER` (con la cédula de la persona; con otra cédula no hace nada), `FORCE_UPDATE` (consulta el catálogo). Deben aplicarse en ≤ ~15 s con la app abierta y aparecer como ✓ (confirmadas) en el panel.
5. **`WIPE` sin nada pendiente.** La app muestra «Equipo en proceso de borrado» un instante, borra todo lo local y vuelve al login. El equipo sigue registrado en el panel.
6. **`WIPE` con trabajo pendiente.** Con modo avión crea 2 o 3 registros; apaga el modo avión y envía `WIPE` de inmediato: la pantalla muestra «Pendientes por enviar: N», la cola se sincroniza (verifica los registros en la base) y **después** se borra todo.
7. **`WIPE + bloquear`.** Con el servidor en `on`, el bloqueo impide sincronizar: la app queda esperando con lo pendiente. «Aprobar / reactivar» → sincroniza y borra. Para ver el plazo de 72 h sin esperar tres días, cambia temporalmente `WIPE_MAX_WAIT_MS` en `apps/mobile/hooks/guardifyWipe.ts` a unos minutos y **revierte el cambio después**.
8. **Equipo retirado.** «Retirar» → pantalla de retirado y el mismo borrado que `WIPE` (una sola vez).
9. **Ubicación en el latido.** Tras iniciar sesión aparece el aviso una vez. «Aceptar» → el panel muestra la ubicación en el siguiente latido (cada 5 min) y la batería. «No, gracias» → «sin consentimiento».
10. **Catálogo y versión mínima (#148).** Publica un APK `lite` con versión mayor que la instalada y pon la versión mínima igual: la app muestra «Actualiza la app» y bloquea. Con un archivo APK real (ruta en la PC) el botón descarga e instala; sin archivo, el simulacro entrega 1 MB de relleno que no es instalable (sirve para ver la descarga). Quitar la mínima libera la app tras reintentar.
11. **Servidor con versión mínima (#150).** `GUARDIFY_MIN_APP_VERSION` mayor que la instalada y `on`: las peticiones responden `UPDATE_REQUIRED` y la app muestra la misma pantalla.

## Qué no prueba

El contrato real de Guardify (textos de soporte de `policy.support`, reglas de aprobación, permisos de consola, bitácora), la entrega de documentos desde su consola, ni el rendimiento. Eso se prueba cuando estén las credenciales reales.
