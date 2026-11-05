# Firma digital y evidencia de cada acción

Issues #151 (especificación), #152 (captura en la app) y #153 (tabla central). **Para revisión de Guardify.**

## Qué se guarda

Por cada **alta o edición** de un registro de la app se inserta una fila en `c_evidencia_registro` (base del servicio dinámico, **solo inserción**: el servicio rechaza UPDATE y DELETE sobre ella):

| Campo | Qué es |
|---|---|
| `tabla`, `registro_id`, `accion` | Qué registro y si fue `CREATE` o `UPDATE` |
| `cedula`, `usuario_id`, `sesion_id` | Quién actuó y en qué sesión |
| `dispositivo_id` | `deviceUid` del teléfono (UUID guardado en el almacén seguro; ver issue #144) |
| `latitud`, `longitud` (texto) y `ubicacion_origen` | Dónde: `firma` (GPS del momento de la acción), `cabecera` (último GPS de la app), `denegada` (permiso negado) o `sin_datos` |
| `capturado_en` | Cuándo ocurrió la acción (hora de reloj de Costa Rica, como el resto del sistema) |
| `firma`, `sello`, `firma_version`, `firma_kid` | La huella SHA-256, el sello opcional, la versión del formato y el id de la clave del sello |
| `creado` | Cuándo se insertó la fila |

Los reportes de Guardify muestran, de cada registro, la evidencia **más reciente** (la de su última alta o edición) en cinco columnas fijas: `dispositivo`, `latitud`, `longitud`, `firma` y `cedula`. Los registros anteriores a esta función salen con las cinco en `null` (no se pueden reconstruir). En «Cambios de ubicación del puesto» `latitud`/`longitud` siguen siendo las del puesto (issue #137).

## Algoritmo de la firma

Sigue el **contrato compartido con Guardify** (`docs/guardify/protocolo-reportes.md`, «Evidencia»; decisión del cliente N3: la huella, tal como queda en el hash, es suficiente por ahora):

> `firma` = **SHA-256 (hexadecimal en minúscula) del JSON canónico del contenido firmado.** JSON canónico = llaves ordenadas alfabéticamente en todos los niveles, sin espacios, UTF-8; `undefined` no cuenta y `null` sí.

**Contenido firmado** (diez campos; `latitud` y `longitud` como número):

```json
{"accion":"CREATE","cedula":"1-0555-0666","dispositivo":"dev-uuid","fecha":"2026-10-21T08:15:30","latitud":9.9341,"longitud":-84.0877,"registro_id":12,"sesion_id":"ses-1","tabla":"c_incidente","usuario_id":77}
```

Incluye todo lo pedido (cédula, ID de usuario, latitud, longitud, dispositivo, fecha y hora, sesión) más tabla, registro y acción, para que la huella no se pueda trasladar a otro registro. Lo vacío entra como `null`. `fecha` es la hora de la acción (`AAAA-MM-DDTHH:mm:ss`, hora de reloj de Costa Rica).

**Reutiliza el hash que ya usa la app.** La app genera la *firma de captura* (`firma_responsable`) como `base64(sesión:empleado:latitud:longitud:marcaDeTiempo)`. Ese formato **no cambia** (lo leen decenas de pantallas, reportes y versiones anteriores de la app) y sigue siendo la fuente de la ubicación y la hora de la acción; el servidor le suma cédula y dispositivo y calcula la huella de arriba.

### Sello opcional (clave del servidor)
Una huella sin clave la puede recalcular cualquiera, incluso quien fabrique una fila. Por eso, si el servidor tiene `EVIDENCE_SIGNING_KEY` (mínimo 24 caracteres, aleatoria), cada fila lleva además un **sello** = HMAC-SHA256 del mismo JSON canónico con esa clave (`EVIDENCE_SIGNING_KEY_ID`, por defecto `k1`). Sin clave la evidencia se registra igual, solo con la huella, y el sello queda vacío.
- Rotación: la clave nueva con otro id (`k2`) y la anterior en `EVIDENCE_SIGNING_KEYS_OLD=k1:<secreto>`; el `firma_kid` de cada fila dice con cuál se selló.

### Cómo se verifica
- **Guardify (sin clave):** con el `contenido` que entrega la API recalcula el SHA-256 del JSON canónico y lo compara con `firma` (pantalla *Reportes → Verificar firma*).
- **MonitoreApp (con clave):** además recalcula el sello. Cualquier campo cambiado → la huella no coincide; una fila fabricada con huella consistente pero sin el sello correcto → `sello_ok = false`.

**API para Guardify** (misma llave que la API de reportes, `GUARDIFY_REPORTS_API_KEY`):

```
GET /api/guardify/evidence?tabla=<tabla>&registro_id=<id>
→ { rows: [{ id, accion, dispositivo, latitud, longitud, ubicacion_origen, capturado_en, cedula, usuario_id, sesion_id,
             firma, contenido, sello, firma_kid, firma_ok, sello_ok, valida }] }      // de la más reciente a la más antigua
```
`firma_ok`: la huella coincide con el `contenido`. `sello_ok`: `true` / `false`, o `null` si no hay sello o falta la clave. `valida` = `firma_ok` y `sello_ok !== false`.

## Cómo llega la evidencia (sin tocar cada módulo)

- **Servidor:** todas las altas y ediciones pasan por `callDynamicPrisma`; ahí, tras guardar con éxito en una tabla con evidencia (`TABLAS_CON_EVIDENCIA`, los módulos con auditoría propia), se inserta la fila. Si falla, la acción del usuario **ya está guardada** y solo se registra el error en el log.
- **App:** todas las peticiones a la API llevan `X-Device-Uid` y, si guardan datos (POST/PUT/PATCH/DELETE), `X-Evidence-Lat`, `X-Evidence-Lng`, `X-Evidence-At` (hora de `getHoraAccion`) y, si el permiso de ubicación está negado, `X-Evidence-Perm: denied` (la acción se guarda igual y queda marcada).
- **Sin conexión:** la ubicación y la hora de la acción son las del momento en que se hizo, no las de la sincronización:
  - Si el registro lleva firma de captura (`firma_responsable`), el servidor usa la que viaja dentro del registro.
  - Si no, la app **sella la acción al guardarla en la cola** (`*_actions`): ubicación, hora de `getHoraAccion` y estado del permiso, dentro del cuerpo de la acción (`payload`, `requestData`, `data` o `body`) bajo `__evidencia`. Al reenviarla, el `fetch` global quita ese sello del cuerpo (el servidor nunca lo recibe) y lo manda como cabeceras `X-Evidence-*`. Código: `apps/mobile/hooks/evidenceQueue.ts`, `installEvidenceQueue.ts` e `installEvidenceFetch.ts`.
  - La ubicación que se sella es la última lectura del GPS de la app; si tiene más de 10 minutos se toma una lectura nueva en ese momento (con tope de 3 s para no demorar el guardado). El sello no se copia a las cachés locales: se quita de todo lo que no sea una cola `*_actions`.
  - Quedan con las cabeceras del momento de sincronizar (`ubicacion_origen = cabecera`, lo deja visible) las acciones que estaban en la cola antes de esta versión, las que no tienen un cuerpo objeto (p. ej. `attendance_actions`) y las peticiones que no son JSON (subida de archivos).

## Limitaciones conocidas
- Las tablas de Planillas (`c_accion_personal`, `v_vacacion_solicitud`, artículos del puesto) no se escriben desde `callDynamicPrisma`; su evidencia, cuando se agregue, irá solo en esta tabla central. La solicitud de permiso sí deja evidencia (`c_solicitud_permiso`).
- Los datos anteriores a esta función no tienen firma y no se pueden reconstruir.
