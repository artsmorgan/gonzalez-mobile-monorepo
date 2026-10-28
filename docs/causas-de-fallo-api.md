# Causas de un fallo de la API: qué cierra la sesión y qué no (issue #174, H07)

Antes, `authedFetch` cerraba la sesión con **cualquier** 401/403 y, ante un error de red, devolvía `null` sin decir por qué. Ahora clasifica la
causa con `apps/mobile/hooks/apiFailure.ts` (módulo puro, probado en `apps/server/utils/apiFailure.test.ts`) y la deja en
`getLastAuthedFailure()`.

| Causa | Respuesta | ¿Cierra la sesión? | Qué ve la persona |
|---|---|---|---|
| `session_expired` | 401 | Sí | Vuelve al inicio de sesión |
| `forbidden` | otro 403 (token inválido) | Sí | Vuelve al inicio de sesión |
| `permission_denied` | 403 `{ code: "permission_denied" }` | **No** | La pantalla recibe la respuesta y muestra «No tienes permiso…» |
| `device_not_approved` | 403 `device_not_approved\|ESTADO\|motivo` | **No** | Pantalla de estado del equipo (como antes) |
| `session_revoked` | 403 `session_revoked\|motivo` (o `{ code: "session_revoked" }`) | Sí | Aviso «Un administrador cerró tu sesión» con el motivo, y luego inicio de sesión |
| `server_error` | 5xx | **No** | La pantalla recibe la respuesta |
| `timeout` / `network` | la petición no obtuvo respuesta | **No** | `null` + causa en `getLastAuthedFailure()` |

## Cambio en el servidor (Guardify)

Cuando lo revocado es **solo la sesión** (`gsid`) y el equipo sigue activo, `guardifyDeviceGate` ahora responde `session_revoked|motivo` en lugar de
`device_not_approved|BLOCKED|…`: antes la persona veía «Equipo bloqueado» aunque su equipo estaba bien. Si el equipo también está revocado manda el
equipo (más grave). Solo aplica con `GUARDIFY_DEVICE_ENFORCE=on`; en `off` y `observe` no cambia nada. Quien consuma estos mensajes fuera de la
app debe aceptar el nuevo formato.

## Plazos y reintentos (issue #172, H06)

`authedFetch` no tenía plazo y serializa todas las peticiones con un mutex: una colgada dejaba la app cargando para siempre. Ahora cada petición usa un
`AbortController` (`apps/mobile/hooks/fetchDeadline.ts`, probado en `apps/server/utils/fetchDeadline.test.ts`):

| Tipo | Plazo | Reintentos automáticos |
|---|---|---|
| Lectura (GET/HEAD) | 20 s | 1, tras 500 ms, ante red / tiempo agotado / 5xx |
| Escritura (POST/PUT/PATCH/DELETE) | 30 s | **Ninguno**, salvo `idempotent: true` (entonces 1) |
| Subida de archivos (`FormData`) | 120 s | Igual que una escritura |

- `timeoutMs` permite fijar otro plazo (máximo 5 min). El plazo cubre hasta recibir la respuesta; leer el cuerpo después es de quien llama.
- Una escritura **no se repite sola** porque, si la primera sí llegó al servidor, repetirla duplicaría el registro. La acción en cola se conserva y
  se reintenta en la siguiente sincronización (como ya hacían las colas cuando `authedFetch` devolvía `null`).
- `idempotent: true` solo debe usarlo quien sepa que el servidor lo garantiza. `idempotencyKey` viaja en `Idempotency-Key` para que el servidor
  pueda deduplicar; **hoy ningún endpoint la usa**: la idempotencia del lado servidor está pendiente de la revisión del backend (issue #181).
- El tiempo agotado y la red caída se distinguen (`timeout` / `network`) y no cierran la sesión.

## Prueba manual (pendiente)

1. Con un usuario sin permiso de «Ingresos de usuario», abrir esa vista: mensaje de permiso, la sesión sigue abierta.
2. Modo avión durante una operación: no se cierra la sesión; al volver la conexión todo sigue.
3. (Requiere Guardify en `on`) Revocar solo la sesión de un guarda desde Guardify: la app avisa «Un administrador cerró tu sesión» y vuelve al inicio.
