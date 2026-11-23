# Cambios del SDK

## 0.7.0 — 2026-11-23
- URL del servidor de la app desde Guardify: la política trae `serverUrl` cuando la empresa la define en Apps → Configuración → «Servidor de la app». `serverUrl({ allowedHosts, fallback })` (o `pickServerUrl`) la devuelve solo si es https y su dominio está en la lista fija del build; si no, la del build. Si cambia respecto a la última usada, la app cierra su sesión y borra sus datos locales antes de usar la nueva.

## 0.6.0 — 2026-11-22
- Servidor de la app: `createVerifier(...).accessOf(externalId)` consulta `GET /api/v1/access/grants` y trae el rol, los permisos y las condiciones vigentes de una persona (calculados en el momento). Con eso el servidor hace cumplir los mismos permisos que la app muestra en el menú. `governed: false` = Guardify no tiene a esa persona en la app.

## 0.5.0 — 2026-11-21
- Condiciones de pantallas: `access/verify`, `login` y `renew` traen `conditions` (permiso → dato → valores). `allows(permiso, contexto)` dice si la persona puede ver la pantalla con los datos del momento (ej. división y marca vigente); `conditionsMet(...)` evalúa una condición suelta. Las decide Guardify (la empresa puede cambiarlas); la app solo informa sus datos.

## 0.4.0 — 2026-11-05
- Rastreo en vivo: `sendLocation(points)` manda lotes de ubicación a `POST /api/v1/devices/self/location` y el latido responde `liveLocationSeconds` (cada cuántos segundos mandar; 0 = solo en el latido). Solo con consentimiento y si la empresa lo activó.

## 0.3.0 — 2026-10-22
- `GET /api/v1/revocations` trae `minAppVersion` y el verificador del servidor lo expone con `createVerifier(...).minAppVersion()`: el servidor de la app deja de tenerla a mano en una variable de entorno.

## 0.2.0 — 2026-10-20
- `latestApk(variant)` y `authorizationHeader()`: la app consulta el catálogo de APK de Guardify y baja la versión nueva.
- `Policy.support`: texto y contacto de soporte que define la empresa para las pantallas de pendiente, rechazado y bloqueado.
- Verificador del servidor: `device_not_approved` para equipos bloqueados, rechazados o retirados (`refreshRevocations()` los trae; uno que vuelve a activo se quita).

## 0.1.0
- Registro del equipo, estados, acceso (`verify`/`login`), renovación, comandos a distancia, latidos, política sin conexión con reloj monótono y cola de eventos.

## 0.2.1 — 2026-10-22
- Sin cambios de código: se vuelve a publicar junto con el centro de control por app.
