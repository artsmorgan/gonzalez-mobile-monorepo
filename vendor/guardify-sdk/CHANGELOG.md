# Cambios del SDK

## 0.2.0 — 2026-10-20
- `latestApk(variant)` y `authorizationHeader()`: la app consulta el catálogo de APK de Guardify y baja la versión nueva.
- `Policy.support`: texto y contacto de soporte que define la empresa para las pantallas de pendiente, rechazado y bloqueado.
- Verificador del servidor: `device_not_approved` para equipos bloqueados, rechazados o retirados (`refreshRevocations()` los trae; uno que vuelve a activo se quita).

## 0.1.0
- Registro del equipo, estados, acceso (`verify`/`login`), renovación, comandos a distancia, latidos, política sin conexión con reloj monótono y cola de eventos.
