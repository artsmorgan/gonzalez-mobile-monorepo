# Plan de implementación: aprobar y rechazar dispositivos de MonitoreApp desde Guardify

Estado: **plan, sin ejecutar** · 2026-10-19 · Se apoya en [la auditoría](auditoria-monitoreapp-dispositivos.md) (qué hay y qué falta). Alcance de esta fase: **dispositivos**. Permisos y roles de la app (Guardify como fuente) quedan para una fase posterior.

## 1. Objetivo y criterio de éxito

Un equipo con MonitoreApp, antes de mostrar el login, **se registra en Guardify con el código de empresa y queda pendiente**. Un administrador lo **aprueba o rechaza** desde Guardify → Dispositivos. Solo un equipo aprobado puede usar la app. Un equipo **bloqueado o retirado deja de operar** (en ≤ 1 minuto en el servidor, al instante si recibe el comando).

Éxito = todos estos son ciertos en staging y luego en González:
1. Equipo nuevo → pantalla «Esperando aprobación» → el admin aprueba → aparece el login.
2. Equipo rechazado → pantalla con el motivo, sin forma de avanzar.
3. Admin bloquea un equipo en uso → su siguiente petición recibe `403 device_not_approved` y la app cierra sesión.
4. Una app **sin** la integración (versión vieja) o un cliente que llame a la API a mano **no pasa** cuando el servidor está en modo `on`.
5. Los equipos que ya estaban instalados quedaron registrados y revisados, sin que nadie en campo se quede sin servicio.

## 2. Decisiones de diseño

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Estado de aprobación solo en Guardify.** Nada se escribe en la base de Planillas ni en `refresh_token`. | Regla del proyecto (base del tercero intocable) y es la fuente única de verdad. |
| D2 | La app usa el **SDK de Guardify** (`@guardify/sdk`, clase `GuardifyDevice`), no HTTP a mano. | Ya trae registro, espera de aprobación, latidos, comandos, reloj monótono y política sin conexión. |
| D3 | El login sigue siendo **Planillas** (cédula + contraseña, como hoy). Después del login, la app llama `access/verify` del SDK con la cédula. | Guardify no ve contraseñas; permite sesión de Guardify atada al equipo (`dev`, `sid`). |
| D4 | El servidor de MonitoreApp **mete `gdev` y `gsid` (equipo y sesión de Guardify) en su JWT** al hacer login, y `verifyAccessTokenByApi` los comprueba contra la lista de revocación de Guardify (`GET /api/v1/revocations`, caché 30–60 s). | Un solo punto de cambio (~680 llamadas, ~210 rutas) y no exige reescribir la verificación de tokens. |
| D5 | **Interruptor por entorno** `GUARDIFY_DEVICE_ENFORCE = off | observe | on`. | Permite desplegar sin riesgo, medir y luego exigir. Sin variable = `off` (hoy). |
| D6 | **Código de empresa fijo en la variante `prod`** (los guardas no escriben nada); en `lite`/`full` se escribe. | Menos errores en campo; coherente con las tres variantes de compilación. *(Recomendación; falta tu confirmación.)* |
| D7 | Migración de equipos instalados con **código de registro por sucursal** (permanente, con vigencia) y revisión posterior, en lugar de auto-aprobación abierta. | Mantiene el control (se sabe por sucursal quién entró) sin que un código filtrado abra todo. *(Recomendación.)* |

## 3. Requisitos previos (antes de escribir código)

- [ ] **Guardify staging:** instalación `monitoreapp` del tenant `corporacion-gonzalez` con `deviceQuota` suficiente, `autoApprove` apagado, un **rol por defecto** con los permisos que hoy tiene cualquiera que inicia sesión (si no, `access/verify` puede negar a usuarios sin rol), y un **código de registro por sucursal** (o uno por la ventana de migración).
- [ ] **Credenciales de aplicación** (`clientId:secreto`) para que el servidor de MonitoreApp consulte `/api/v1/revocations`. Se guardan como variables del servicio en Railway (**requiere tu permiso explícito**).
- [ ] **SMTP en el worker de Guardify** (hoy falta) para el correo de «equipo pendiente de aprobación».
- [ ] **Confirmar con el desarrollador** si el servicio dinámico recibe tráfico directo del móvil (cambia el alcance de WS-C).
- [ ] Decisiones D6 y D7, y qué hacer con equipos **personales** (ver §8).

## 4. Frentes de trabajo

### WS-A · App móvil (`apps/mobile`) — requiere versión nueva
| Tarea | Detalle y archivos | Criterio de aceptación |
|---|---|---|
| A1 Identidad del equipo | Instalar `expo-secure-store`. Generar un UUID con `expo-crypto` la primera vez y guardarlo en SecureStore (sobrevive a cerrar sesión; se pierde al desinstalar). | El mismo equipo devuelve siempre el mismo `deviceUid`. |
| A2 Almacenamiento seguro | Adaptador `Storage` del SDK sobre SecureStore. Mover tokens/roles de `AsyncStorage` (`contexts/AuthContext.tsx`, `hooks/authTokenStorage.ts`) a SecureStore con migración al abrir. | No quedan tokens en `AsyncStorage` tras actualizar; la sesión existente no se pierde. |
| A3 Cliente Guardify | Instanciar `GuardifyDevice` (`baseUrl`, `appKey: "monitoreapp"`, `deviceUid`, plataforma/modelo/SO/versión desde `expo-device`/`expo-constants`). Un `GuardifyProvider` junto a `AuthProvider`. | `init()` al arrancar; estado disponible en toda la app. |
| A4 Pantalla de código | Primera pantalla si no hay registro. En `prod` el código va fijo (variable de compilación), en `lite`/`full` se teclea. | Sin código válido no se avanza; errores claros (`invalid_code`, `code_expired`, `tenant_suspended`). |
| A5 Pantallas de estado | Pendiente (con «Reintentar», se refresca sola), rechazado (con motivo), bloqueado, retirado (borra datos locales), versión obligatoria (`FORCE_UPDATE`). Reutilizar el estilo de `app/_layout.tsx`. | Cada estado del SDK (`pending`, `rejected`, `blocked`, `retired`, `locked`) tiene su pantalla; ninguna deja llegar al login. |
| A6 Puerta antes del login | Mostrar el login solo si el estado es `signed_out` u `operational`. Tras el login con Planillas, `login(cédula)` del SDK (`access/verify`). | Equipo no aprobado nunca ve el login. |
| A7 Identificar al servidor | Enviar `deviceId` y credencial al login (`/api/auth/login`) y el `gsid` en cada petición (`hooks/authedFetch.ts`, un solo lugar). | El servidor recibe el equipo en todas las peticiones. |
| A8 Manejo de 403 | En `authedFetch`, distinguir `device_not_approved` de un 401/403 normal: mostrar la pantalla del estado en lugar de volver al login sin explicación. | Bloqueo en caliente muestra «Equipo bloqueado». |
| A9 Latidos y comandos | `heartbeat()` periódico (batería, versión) y canal de comandos (`LOGOUT_ALL`, `LOGOUT_USER`, `FORCE_UPDATE`, `WIPE`, `PING`). | Un comando desde la consola se aplica en segundos con la app abierta. |
| A10 Unir push | Relacionar el token FCM (`hooks/pushNotificationsService.ts`) con el equipo para avisar al aprobarse (opcional). | — |

*Notas:* `expo-secure-store` es nativo → **nueva compilación EAS** (variantes `lite`, `full`, `prod`) y nuevo APK en `mobile_versions.json`. No se puede entregar por OTA.

### WS-B · Servidor de MonitoreApp (`apps/server`)
| Tarea | Detalle y archivos | Criterio de aceptación |
|---|---|---|
| B1 Cliente Guardify | `utils/guardifyDevices.ts`: llamada autenticada de aplicación a `/api/v1/revocations?since=…`, caché en memoria 30–60 s, tolerante a fallos (si Guardify no responde, usa la última lista y nunca abre por defecto). | Con Guardify caído, no cae el servicio. |
| B2 Login | `app/api/auth/login/route.ts`: recibir `deviceId`/`gsid`; verificar con Guardify que el equipo está `ACTIVE`; agregarlos al JWT (`gdev`, `gsid`). | JWT trae `gdev`. Equipo no activo → 403 `device_not_approved`. |
| B3 Refresh | `refresh-token`: conservar `gdev`/`gsid`; negarlo si el equipo dejó de estar activo. | Un equipo bloqueado no renueva. |
| B4 Verificación central | `utils/verifyAccessTokenByApi.ts`: tras validar el JWT, según `GUARDIFY_DEVICE_ENFORCE`: `off` nada; `observe` registra en log estructurado (`guardify_device`) las peticiones sin `gdev` o con equipo revocado; `on` responde 403 `device_not_approved`. | Modo `observe` no cambia ninguna respuesta. Modo `on` corta equipos revocados en ≤ 1 minuto. |
| B5 Error distinguible | Código `device_not_approved` con el estado (`BLOCKED`, `REJECTED`, `RETIRED`, `PENDING`) y motivo, para que A8 muestre la pantalla correcta. | El móvil recibe el estado. |
| B6 Pruebas | Pruebas unitarias del verificador con Guardify simulado (activo, bloqueado, caído, sin `gdev`) en los tres modos. | Pasan junto a las 590 existentes. |

### WS-C · Servicio dinámico (`gonzalez-mobile-dynamic-api`, repo del desarrollador)
- **C1** Confirmar si recibe tráfico directo del móvil. Si sí, replicar la comprobación de B4 (o dejar que solo el servidor principal sea accesible desde fuera). Si no, no hay cambios.
- **C2** Si firma el JWT, aceptar los claims nuevos sin romper la validación actual.

### WS-D · Guardify
| Tarea | Detalle | Criterio |
|---|---|---|
| D1 Aviso de pendientes | Al registrarse un equipo, notificar a quienes tienen `dispositivos:aprobar` en el alcance (correo por la cola existente + notificación en la consola). Hoy el registro (`/api/v1/devices/register`) no avisa a nadie. | Llega un correo y una campana en la consola al registrarse un equipo. |
| D2 Bandeja de pendientes | En Dispositivos, filtro y contador «Pendientes» destacado; ordenar por antigüedad. | Un admin ve primero lo que espera. |
| D3 Aprobación en lote | Seleccionar varios pendientes y aprobar/rechazar con una sucursal y propiedad comunes; respeta cupo y alcance; una sola entrada de auditoría por lote con el detalle. | 100 equipos se aprueban en una acción. |
| D4 Códigos por sucursal / QR | Los códigos de registro **ya se crean, listan y revocan** en Apps → MonitoreApp (`/api/tenant/apps/:key/registration-codes`). Falta: verificar que se pueden atar a una sucursal, mostrarlos como QR imprimible y ver cuántos equipos entraron con cada uno. | Se imprime un QR por sucursal y se ve su uso. |
| D5 Revisión de lo registrado | Exportar la lista de equipos (modelo, versión, último contacto, sucursal, quién lo usó) a CSV/Excel para la revisión de la migración. | Descargable con permisos. |
| D6 Configuración del tenant | Cupo, `autoApprove`, atestación y modo sin conexión de `monitoreapp` editables en la consola. | Sin tocar la base. |
| D7 Auditoría | Confirmar que aprobar/rechazar/bloquear/retirar/lote quedan en la bitácora con quién, cuándo y motivo (ya existe; probar el lote). | Visible en Auditoría. |

### WS-E · Operación y comunicación
- **E1** Mensaje a supervisores y guardas: qué cambia, fecha de corte, cómo actualizar el APK.
- **E2** Guion para quien aprueba: qué mirar (modelo, sucursal, versión) y qué rechazar.
- **E3** Responsable de la bandeja de pendientes y tiempo máximo de respuesta (propuesta: 1 hora laboral).

## 5. Fases y orden

| Fase | Qué se entrega | Dependencias | Esfuerzo orientativo | Cómo se valida |
|---|---|---|---|---|
| **0 · Acuerdos y preparación** | Decisiones D6/D7, requisitos de §3, credenciales de aplicación | Tú | 1–2 días | Lista de §3 completa |
| **1 · Servidor en `observe`** | WS-B completo con interruptor apagado/observando; WS-C confirmado | Fase 0 | 3–4 días | Pruebas unitarias; en staging, el log muestra qué peticiones llegan sin equipo |
| **2 · Guardify listo para operar** | D1, D2, D3, D4, D5 (D6/D7 mínimos) | SMTP del worker | 4–6 días | e2e de Guardify (registro → aviso → lote); prueba manual en staging |
| **3 · App nueva en pruebas** | WS-A completo en variante `lite`, contra el staging de Guardify | Fase 1 (B2/B3 para el login) | 8–10 días | Matriz de equipos (§6); flujos 1–3 de §1 |
| **4 · Piloto** | Variante `prod` en 1 sucursal con código de registro propio; servidor en `observe` | Fase 3 | 1 semana | Todos los equipos de la sucursal registrados, 0 bloqueos erróneos |
| **5 · Migración general** | Distribución del APK nuevo, código por sucursal, ventana de ~2 semanas; revisión semanal de la lista | Fase 4 + E1/E2 | 2 semanas | Informe D5: equipos registrados vs. esperados |
| **6 · Exigir (`on`)** | Servidor en `on` tras la fecha de corte; versiones viejas rechazadas | Fase 5 con ≥ 95 % de equipos registrados | 2–3 días + monitoreo | Flujo 4 de §1; 48 h de monitoreo sin incidentes |
| **7 · Endurecimiento (opcional)** | Atestación Play Integrity, política sin conexión, permisos desde Guardify | Fase 6 | a definir | — |

Esfuerzo total de construcción orientativo: **~3–4 semanas** de trabajo (mayor parte en app móvil y migración), más la ventana de migración. Son estimaciones sin haber medido el código en detalle; se ajustan al cerrar la Fase 1.

## 6. Pruebas

- **Unitarias:** verificador del servidor (3 modos, Guardify caído, equipo revocado, sin `gdev`); adaptador de almacenamiento y estados del SDK en la app.
- **e2e de Guardify** (ya existen suites de dispositivos): ampliar con aprobación en lote, aviso de pendientes y revocación visible en `/revocations`.
- **Integración en staging:** app `lite` + Guardify staging + servidor de pruebas (`fortunate-amazement`): los flujos 1, 2, 3 y 4 de §1.
- **Matriz de equipos:** al menos Android 10, 12 y 14; un equipo con poca memoria; uno **sin conexión** al arrancar; uno **compartido** con dos usuarios por turno; un equipo con reloj manipulado (el SDK usa reloj monótono).
- **Regresión de la app:** las pruebas existentes del servidor (590) y un recorrido de los módulos principales (marcas, incidentes, visitas) con el equipo aprobado.
- **Prueba de bloqueo en caliente:** con la app abierta, bloquear en Guardify y medir el tiempo hasta el corte (objetivo ≤ 1 minuto en servidor, segundos con comando).

## 7. Despliegue y reversa

1. Servidor: se despliega con `GUARDIFY_DEVICE_ENFORCE=off`. Nada cambia para nadie.
2. `observe` en staging y luego en González: solo se mide.
3. App nueva por variante y sucursal; el servidor acepta equipos con y sin registro mientras esté en `observe`.
4. `on` solo con la fecha de corte comunicada.
- **Reversa inmediata:** `GUARDIFY_DEVICE_ENFORCE=off` (variable del servicio; efecto al reiniciar). La app nueva con el servidor en `off` funciona igual que hoy.
- **Si Guardify cae:** el servidor usa la última lista en caché; los equipos nuevos no pueden registrarse hasta que vuelva, los ya aprobados siguen.
- **Equipo mal rechazado/bloqueado:** se desbloquea o reaprueba en Guardify y la app lo recoge en el siguiente latido.

## 8. Riesgos y decisiones abiertas

| Riesgo | Mitigación |
|---|---|
| Actualización del APK es voluntaria y manual | Fecha de corte comunicada, descarga destacada en la pantalla de inicio, ventana de migración, `FORCE_UPDATE` desde la consola para equipos ya integrados |
| Código de registro filtrado | Vigencia, uno por sucursal, revocable, revisión de la lista (D5) y tope de pendientes |
| Equipos compartidos en garita | Modo `SHARED` de Guardify; probar la limpieza de caché al cambiar de usuario |
| Depender de Guardify para registrar | Caché de lista de revocación; nunca abrir por defecto; monitoreo |
| Usuarios sin rol en Guardify negados por `verify` | Rol por defecto con permisos equivalentes a hoy (requisito de §3) |
| El servicio dinámico recibe tráfico directo | Confirmar en WS-C; si es así, mismo control o cerrar acceso externo |
| Un equipo con la app modificada se salta la pantalla | El control real es el del servidor (B4); más adelante, atestación (Fase 7) |

**Decisiones que siguen pendientes:** D6 (código fijo en `prod`), D7 (código por sucursal en vez de auto-aprobación), **equipos personales** (¿misma aprobación o revisión adicional?), responsable de la bandeja (E3), y quién del equipo de MonitoreApp toma WS-A y WS-B.

## 9. Propuesta de issues (se crean cuando apruebes el plan)

- **Repo `gonzalez-mobile-monorepo`:** una épica «Dispositivos con Guardify» y un issue por A1–A10 y B1–B6, etiqueta `guardify-dispositivos`, asignados a Abraham.
- **Repo `gonzalez-mobile-dynamic-api`:** C1/C2.
- **Repo `guard-desk-nexus`:** D1–D7 (los construye Guardify).
