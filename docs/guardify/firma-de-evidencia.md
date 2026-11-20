# Firma de evidencia de cada acción (propuesta de Guardify para el ticket #151)

Decisión del cliente (20 oct 2026): la huella de Guardify, tal como queda en el hash, es suficiente por ahora (sin certificado digital). Cada acción guardada lleva una firma que combina **cédula, usuario, latitud, longitud, dispositivo, fecha y hora y sesión**. Este documento fija qué se firma, cómo, y cómo se verifica; MonitoreApp lo confirma o lo ajusta antes de implementarlo.

## 1. Qué se firma (contenido firmado)
Un objeto con estos campos, todos obligatorios (usa `null` cuando no hay dato, nunca los omitas):

| Campo | Tipo | Qué es |
|---|---|---|
| `cedula` | texto | Cédula de la persona que hizo la acción |
| `usuarioId` | número o texto | Id del usuario en MonitoreApp |
| `latitud`, `longitud` | número o `null` | Ubicación **del momento de la acción** (no la de sincronizar); `null` si no hubo permiso |
| `dispositivo` | texto | Id del equipo en Guardify (`X-Guardify-Device`) |
| `fecha` | texto | Momento de la acción, ISO 8601 en UTC con milisegundos (`2026-10-22T16:05:09.120Z`) |
| `sesion` | texto | Id de la sesión de Guardify |
| `tabla`, `registroId` | texto, número | A qué registro pertenece (liga la firma a UN registro) |
| `datosSha256` | texto | SHA-256 (hex) del JSON canónico de los datos guardados del registro: si alguien cambia el registro, la firma deja de verificar |

## 2. Cómo se firma
`firma = SHA-256 (hex en minúsculas) del JSON canónico del contenido firmado`.

JSON canónico: llaves ordenadas alfabéticamente en todos los niveles, sin espacios, UTF-8, números con la representación mínima de JSON (sin ceros a la izquierda ni `+`). Es el mismo contrato de [protocolo-reportes.md](protocolo-reportes.md) («Evidencia»); Guardify lo implementa en `apps/console/lib/evidence-seal.ts`.

**Vectores de prueba** (misma entrada → misma firma en cualquier lenguaje):

```json
{"cedula":"1-2345-6789","usuarioId":4321,"latitud":9.9341,"longitud":-84.0877,"dispositivo":"dev_8f3a21","fecha":"2026-10-22T16:05:09.120Z","sesion":"ses_77c1","tabla":"c_registro_induccion_recorrido","registroId":15021,"datosSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
→ 444dc392c73c5eabde59db4b295274720d860c1d0b4e5cf32abce3bee7ce1dcc
```
Con `latitud` y `longitud` en `null` (sin permiso de ubicación):
```
→ 79d93dee065f402e460de51b23707b27bf39ca27273d26eda2dc728b445d7041
```

## 3. Hash público o con clave
- **Recomendado: hash público (SHA-256, sin clave).** Es lo que permite que Guardify verifique una firma **sin conocer ningún secreto**: la pantalla Reportes → Verificar firma recalcula la huella con el contenido y la compara.
- Si el algoritmo que MonitoreApp ya usa lleva **clave (HMAC)**, Guardify no puede verificar el contenido por su cuenta. En ese caso guardar **las dos**: `firma` (SHA-256 público, la que muestra y verifica Guardify) y `sello` (HMAC-SHA256 con una clave del servidor, `kid` para rotarla), que prueba que la firma la generó el servidor y no alguien con acceso a la tabla. La clave vive solo en una variable de entorno del servidor; al rotarla se conserva el `kid` de cada fila y se mantienen las claves anteriores para verificar.

## 4. Dónde se guarda y qué se expone
- Tabla central `c_evidencia_registro` (ticket #153), solo inserciones: `tabla`, `registro_id`, `dispositivo_id`, `latitud`, `longitud`, `firma`, `cedula`, `usuario_id`, `sesion_id`, `creado` (+ `sello`, `kid` si se usa HMAC).
- Los reportes devuelven las columnas fijas `dispositivo`, `latitud`, `longitud`, `firma` y `cedula`; en los formularios por registro, el bloque `evidencia` con `contenido` (ver [protocolo-formularios.md](protocolo-formularios.md)). Guardify recalcula `sha256(contenido)` y marca si **coincide** o **no coincide** con `firma`.
- Lo anterior a la implementación **no tiene firma** y no se puede reconstruir: esas columnas salen vacías.

## 5. Funciones que MonitoreApp implementa (`apps/server/utils/`)
- `firmarRegistro(contenido) → { firma, sello? }`
- `verificarFirma(contenido, firma) → boolean`
- Pruebas: los dos vectores de arriba; misma entrada → misma firma; cambiar cualquier campo (incluido `datosSha256`) → no verifica; el orden de las llaves no importa.
