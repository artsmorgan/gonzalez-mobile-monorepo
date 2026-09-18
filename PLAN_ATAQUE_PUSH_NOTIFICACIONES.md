# Plan de ataque — Notificaciones push (I+D con Firebase)

**Proyecto:** MonitoreApp  
**Estado:** En investigación y desarrollo (I+D)  
**Canal de entrega:** Firebase Cloud Messaging (FCM)  
**Stack:** Expo (React Native) · Next.js · Firebase Admin SDK

---

## 1. Objetivo

Definir y validar la modalidad de **notificaciones push** en MonitoreApp, de modo que el servidor pueda avisar al dispositivo Android **con la app abierta, en segundo plano o cerrada**, sin depender de un proceso activo en el teléfono.

Además, la I+D debe contemplar que **las notificaciones push se envíen desde los diferentes módulos de la aplicación** (no solo desde un endpoint de prueba): cada módulo de negocio que hoy genera un aviso relevante debe poder disparar FCM hacia los destinatarios correctos (empleado y/o plaza).

Este documento es el **plan de ataque de la fase de I+D**: no asume producción cerrada, sino un ciclo de investigación, prototipo, prueba y ajuste hasta confirmar que la modalidad es viable y alineada con la arquitectura offline-first existente.

---

## 2. Hipótesis de trabajo

> Si el dispositivo registra un token FCM asociado al empleado (y a la plaza cuando exista `current_marca`), y el backend envía mensajes mediante Firebase Admin → FCM **desde los distintos módulos de negocio**, entonces el usuario recibirá la notificación en los tres estados de la app y podrá abrir una pantalla concreta al tocarla.

La I+D debe **probar o refutar** esa hipótesis con evidencia en dispositivo físico (full y lite).

---

## 3. Alcance de la modalidad (qué se investiga)

| Área | Qué se valida |
|------|----------------|
| Registro de dispositivo | Permisos, token FCM, envío al backend, múltiples dispositivos por usuario |
| Contexto empleado / plaza | Registro con `empleado_id` + `plaza_id` si hay `current_marca`; solo `empleado_id` si no |
| Envío desde servidor | Firebase Admin → FCM; sin comunicación directa servidor ↔ dispositivo |
| **Envío por módulos** | Cada módulo relevante dispara push al ocurrir su evento de negocio (no solo `/api/push/send`) |
| Primer plano | Captura del evento, actualización de UI / estados, sync |
| Segundo plano | Banner del SO + navegación al tocar |
| App cerrada (killed) | Entrega vía FCM + cold start + deep navigation |
| Tokens inválidos | Marcar inactivo y re-registro en próximo login |
| Offline-first | Encolar registro si no hay red; sincronizar al recuperar conexión |
| Variantes Full / Lite | Mismo proyecto Firebase, packages Android distintos |

**Fuera de alcance de esta I+D (por ahora):** iOS en producción, campañas masivas de marketing, rich media avanzado (imágenes grandes, acciones personalizadas complejas).

---

## 4. Arquitectura objetivo (resumen)

```text
[Evento de negocio en Next.js]
        │
        ▼
[sendNotification* + pushNotifications]
        │
        ▼
[Firebase Admin SDK]
        │
        ▼
[Firebase Cloud Messaging]
        │
        ▼
[Dispositivo Android / Expo]
   ├─ App abierta     → listener en primer plano
   ├─ App minimizada  → notificación del sistema
   └─ App cerrada     → FCM + arranque al tocar
```

**Registro previo:**

```text
Login → permisos → token FCM → POST /api/push/register
         (empleado_id + plaza_id opcional)
         → tabla a_mobile_fcm_device
```

---

## 5. Fases del plan de ataque

### Fase 0 — Preparación (bloqueante)

**Meta:** tener credenciales y entorno listos para experimentar.

| # | Acción | Responsable / aporte |
|---|--------|----------------------|
| 0.1 | Confirmar proyecto Firebase (`monitoreapp-56ad8`) con apps Android full y lite | Equipo móvil |
| 0.2 | Generar **Service Account** y configurar en servidor (`FIREBASE_SERVICE_ACCOUNT_JSON` o variables equivalentes) | DevOps / backend |
| 0.3 | Aplicar migración `a_mobile_fcm_device` | Backend |
| 0.4 | Rebuild nativo (EAS / `expo run:android`) con `google-services` + `expo-notifications` | Móvil |
| 0.5 | Dispositivo físico Android (emulador no es evidencia suficiente para FCM real) | QA / móvil |

**Criterio de salida:** el servidor inicializa Firebase Admin sin error y la app puede solicitar permisos de notificación.

---

### Fase 1 — Registro de dispositivo (I+D)

**Meta:** demostrar que un usuario autenticado deja un token usable en BD.

| # | Acción | Evidencia esperada |
|---|--------|--------------------|
| 1.1 | Login en app full | Registro automático post-sesión |
| 1.2 | Con `current_marca` | Fila con `empleado_id` + `plaza_id` |
| 1.3 | Sin `current_marca` | Fila solo con `empleado_id` (`plaza_id` null) |
| 1.4 | Cambio de plaza | Update del mismo token a nueva `plaza_id` |
| 1.5 | Segundo dispositivo | Segundo token activo para el mismo empleado |
| 1.6 | Offline al registrar | Acción en cola `push_device_actions`; sync al reconectar |
| 1.7 | Logout | Token marcado `activo = false` (o desregistro) |

**Criterio de salida:** al menos un token activo consultable vía BD / dynamic-prisma para un empleado de prueba.

---

### Fase 2 — Envío controlado (smoke FCM)

**Meta:** un mensaje de prueba llega al dispositivo.

| # | Acción | Evidencia esperada |
|---|--------|--------------------|
| 2.1 | `POST /api/push/send` con `empleado_id` | Notificación visible en el teléfono |
| 2.2 | Envío con `empleado_id` + `plaza_id` | Solo llega al contexto plaza correcto |
| 2.3 | Envío por `plaza_ids` | Llega a dispositivos de esa plaza |
| 2.4 | Payload `data` (`type`, `id`, `action`) | Datos legibles en logs / handler |

**Criterio de salida:** al menos 3 envíos exitosos documentados (hora, dispositivo, resultado).

---

### Fase 3 — Comportamiento por estado de la app

**Meta:** validar la modalidad en los tres estados.

| Estado | Prueba | Resultado OK |
|--------|--------|--------------|
| **Abierta** | Enviar push con app en pantalla | Listener recibe evento; se puede refrescar inbox / emitir sync |
| **Segundo plano** | Minimizar y enviar | Banner del SO; al tocar, abre y navega |
| **Cerrada** | Forzar cierre y enviar | Banner; al tocar, cold start + navegación |

Canales Android a verificar: `general`, `procesos`.

**Criterio de salida:** checklist de 3 estados firmado (pass/fail) en full; repetición mínima en lite.

---

### Fase 4 — Navegación y payload interno

**Meta:** el toque de la notificación lleva al lugar correcto.

| `type` (data) | Destino esperado |
|---------------|------------------|
| `notification` / default | `Notifications` |
| `report` | `Reportes` (+ id si aplica) |
| `activity` | `Activities` |
| `incident` | `Incidents` |
| `permit` | `PermitRequest` |
| `mutuos` | `MutuosAcuerdos` |

**Criterio de salida:** al menos 2 tipos de `type` navegando correctamente desde cold start.

---

### Fase 5 — Integración por módulos de la app

**Meta:** las notificaciones push **no quedan aisladas en un endpoint de prueba**; deben **enviarse desde los diferentes módulos** de MonitoreApp cuando ocurra el evento de negocio correspondiente (creación, actualización de estado, asignación, vencimiento, etc.).

Principio:

> Cada módulo que hoy (o en el soft-release) genera un aviso relevante al usuario debe, además del inbox en BD si aplica, disparar FCM con `title`/`body` visibles y `data` (`type`, `id`, `action`) para navegación.

#### 5.A — Módulos prioritarios (soft-release / I+D inmediata)

| Módulo | Eventos típicos a notificar | Destinatario | `type` sugerido |
|--------|----------------------------|--------------|-----------------|
| Monitoreo / marcar ingreso-salida | Recordatorios, salida pendiente, incidencias de marca | Empleado / plaza | `notification` |
| Tiempo de alimentación | Avisos de almuerzo, fin de tiempo | Empleado | `notification` |
| Ubicación del puesto | Confirmación / fallo de actualización GPS (si aplica aviso a terceros) | Rol / plaza | `notification` |
| Entrega de puestos | Nueva entrega, pendiente de firma, cierre | Plaza / empleado | `notification` |
| Nomencladores | Cambios relevantes de catálogo (si se notifica a usuarios) | Empleado / rol | `notification` |
| Solicitud de permiso | Creada, aprobada, rechazada | Empleado / aprobador | `permit` |
| Mutuos acuerdos | Pendiente de firma, aprobado, rechazado | Empleado / ejecutivo | `mutuos` |

#### 5.B — Módulos adicionales a cablear en la misma modalidad

| Módulo | Eventos típicos | `type` sugerido |
|--------|-----------------|-----------------|
| Actividades | Asignación, vencimiento, revisión de equipo | `activity` |
| Incidentes | Nuevo incidente, aporte, cierre | `incident` |
| Reportes | Reporte listo / aprobado / fallido | `report` |
| Checklist de supervisión | Nuevo checklist, pendiente de revisión | `notification` |
| Mantenimiento de equipo | Movimiento, mantenimiento vencido | `notification` |
| Notas / notas de voz | Mención o nota compartida (si aplica) | `notification` |
| Capacitaciones / manuales | Nuevo manual, pendiente de firma/lectura | `notification` |
| Control de asistencia | Registro pendiente, firma requerida | `notification` |
| Traslado de plazas | Solicitud / archivo / resolución | `notification` |
| Visitantes / vehículos / llaves | Eventos operativos relevantes | `notification` |
| Evaluaciones / encuestas | Pendiente de completar | `notification` |
| Inbox general | Cualquier `sendNotificationBy*` existente | `notification` |

#### 5.C — Acciones de la fase

| # | Acción |
|---|--------|
| 5.1 | Inventariar en backend **dónde** cada módulo llama (o debería llamar) a `sendNotificationByRole` / `ByPlaza` / `ByEmployee` o a `pushNotifications` |
| 5.2 | Asegurar que esos puntos **también disparen FCM** (mismo evento = inbox + push, o solo push si el módulo no usa inbox) |
| 5.3 | Definir por módulo el payload `data` (`type`, `id`, `action`) alineado con la navegación de la Fase 4 |
| 5.4 | Probar al menos **un envío real por cada módulo prioritario (5.A)** desde la app/servidor, no solo `/api/push/send` |
| 5.5 | Extender smoke a una muestra de módulos 5.B (mínimo 3 adicionales en I+D) |
| 5.6 | Confirmar que el emisor no se notifica a sí mismo cuando aplique la misma regla del inbox |
| 5.7 | Documentar módulos pendientes de cablear (backlog post–I+D) |

**Criterio de salida:**

- Al menos **todos los módulos prioritarios (5.A)** envían push ante un evento real.
- Al menos **3 módulos adicionales (5.B)** demostrados.
- Lista explícita de módulos aún sin cablear FCM.

---

### Fase 6 — Tokens inválidos y resiliencia

**Meta:** el sistema no insiste en tokens muertos.

| # | Acción |
|---|--------|
| 6.1 | Invalidar token (reinstalar app / revocar permisos) |
| 6.2 | Reenviar push | FCM error → fila `activo = false` |
| 6.3 | Volver a login | Nuevo token activo |

**Criterio de salida:** no hay reintentos infinitos a tokens desactivados.

---

### Fase 7 — Cierre de I+D → decisión

**Meta:** documentar hallazgo y decidir siguiente paso.

Entregables:

1. **Informe corto de I+D** (1–2 páginas): qué funcionó, qué falló, riesgos.
2. **Go / No-Go** para soft-release de la modalidad push.
3. **Backlog residual** (iOS, UX de alerta en foreground, métricas, rate limits, etc.).

---

## 6. Riesgos conocidos (a investigar, no a ignorar)

| Riesgo | Impacto | Mitigación en I+D |
|--------|---------|-------------------|
| Credenciales Firebase ausentes o mal formateadas | Cero envíos | Fase 0 obligatoria |
| Probar solo en emulador / Expo Go | Falsos negativos | Solo build nativo + físico |
| Full vs Lite con packages distintos | Token de un flavor no aplica al otro | Probar ambos flavors |
| Contexto plaza incorrecto | Notificaciones a la plaza equivocada | Casos 1.2–1.4 y 2.2 |
| Cold start race (navegación antes de stack listo) | Deep link fallido | Delay / cola de navegación ya prevista; medir en Fase 4 |
| Service Account en logs / git | Filtración | Solo env / secret manager |

---

## 7. Definición de “éxito” de esta I+D

La modalidad se considera **validada para continuar a integración/productización** si:

1. Registro de token funciona online y offline (con sync).
2. Un push de prueba llega en **abierta / segundo plano / cerrada**.
3. El toque navega al menos a inbox y a un módulo tipado.
4. Tokens inválidos se desactivan.
5. Full y lite demuestran recepción en el mismo proyecto Firebase.
6. **Las notificaciones se envían desde los diferentes módulos** (prioritarios 5.A completos + muestra 5.B), no solo desde el endpoint de prueba.

---

## 8. Cronograma sugerido (sesiones)

> 1 sesión ≈ 4–6 h enfocadas.

| Fase | Sesiones estimadas |
|------|--------------------|
| 0 Preparación | 1 |
| 1 Registro | 1–2 |
| 2 Smoke FCM | 1 |
| 3 Tres estados | 1–2 |
| 4 Navegación | 1 |
| 5 Integración por módulos | 3–5 |
| 6 Tokens inválidos | 0.5–1 |
| 7 Informe + decisión | 0.5 |
| **Total I+D** | **~9–14 sesiones** |

---

## 9. Referencias de implementación actual (código)

| Pieza | Ubicación |
|-------|-----------|
| Registro / handlers móviles | `apps/mobile/hooks/pushNotificationsService.ts` |
| Integración app | `apps/mobile/App.tsx` |
| Firebase Admin | `apps/server/utils/firebaseAdmin.ts` |
| Envío / tokens (via `callDynamicPrisma`) | `apps/server/utils/pushNotifications.ts` |
| APIs | `apps/server/app/api/push/{register,unregister,send}` |
| Enganche negocio | `apps/server/utils/sendNotification.ts` |
| Modelo | `a_mobile_fcm_device` (Prisma + migración) |
| Config Android | `google-services-full.json` / `google-services-lite.json` + `app.config.js` |

---

## 10. Próximo paso inmediato

1. Completar **Fase 0** (service account + migrate + rebuild).  
2. Ejecutar **Fase 1–2** en un dispositivo físico full.  
3. Avanzar **Fase 5**: cablear y probar envío push **desde los módulos** (empezar por soft-release 5.A).  
4. Registrar resultados en el informe de I+D antes de ampliar cobertura al resto de módulos.

---

*Documento de plan de ataque — modalidad push con Firebase · fase de investigación y desarrollo.*
