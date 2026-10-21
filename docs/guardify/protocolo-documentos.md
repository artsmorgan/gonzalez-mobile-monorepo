# Protocolo de documentos (Guardify → app)

Decisión del cliente (20 oct 2026): los documentos se **suben desde Guardify** (cualquier tipo de archivo), **cada versión se firma** y quien tenga el permiso `documentos:publicar` los **envía** a uno o varios puestos o a una división. La app es quien los reparte a los empleados y guarda el estado por persona (visto, firmado, nota del quiz); el reporte «Documentos entregados a personal» lo muestra.

## Quién hace qué
| Guardify | La app (MonitoreApp) |
|---|---|
| Biblioteca: documentos, versiones (v1, v2…), sello de cada versión, quién y cuándo | Guardar el archivo (reutiliza `e_archivos_manual_puesto`) y asignarlo a los empleados del puesto |
| Elegir destinos y mostrar cuántos empleados lo recibirían | Calcular los destinatarios y repartir |
| Registrar el envío en la bitácora y ver su estado | Estado por empleado (visto, firmado, nota) → reporte |

## Contrato (misma conexión y misma llave que los reportes)
La ruta base es la de los reportes cambiando `/reports` por `/documents` (`/api/guardify/documents`). Todas llevan `Authorization: Bearer <llave>` y `x-guardify-user: <correo de quien publica>`. Si la app todavía no tiene la API responde `404` o `501`: Guardify guarda el envío como **PENDIENTE** y no inventa una entrega.

```
POST {base}                 multipart: meta (JSON) + file     → 201 { id }
  meta = { documentId, versionId, version, title, description, fileName, mime, sha256, seal, publishedBy }
POST {base}/preview         { audience, scope }               → 200 { recipients }
POST {base}/dispatches      { documentId, versionId, externalVersionId, version, audience, scope, standing: true, requestedBy:{name,email} }
                                                              → 201 { id, recipients }
POST {base}/dispatches/{id}/end   { endedBy:{name,email} }    → 200 { ok: true }
```

### Asignaciones vigentes (decisión del cliente)
Una asignación no es un envío de una sola vez: es una **regla vigente** mientras nadie la termine. `audience` dice a quién:

| `audience` | A quién | `scope` |
|---|---|---|
| `units` | Puestos o divisiones (uno o varios) | códigos de la estructura, separados por coma |
| `app_users` | Todas las personas que usan la app del documento | vacío |
| `company` | Toda la empresa | vacío |

Lo que la app debe cumplir:
1. **Quien entra después lo recibe.** Un empleado nuevo en un puesto con documentos asignados los ve en la app para leerlos, firmarlos y hacer los exámenes, sin que nadie vuelva a enviar nada. Lo mismo con `app_users` y `company` para las personas nuevas.
2. **Nada se borra.** Si un empleado sale del puesto (o de la empresa) es una baja lógica: sus resultados (visto, firma, nota, fechas, versión) se conservan siempre y siguen saliendo en «Documentos entregados a personal». Dejar de pertenecer al grupo solo deja de asignarle documentos nuevos.
3. **Terminar la asignación** (`/end`) deja de asignarlo a quien entre después; lo ya entregado y los resultados se conservan.
4. **Nueva versión:** cuando Guardify publica una versión y la asigna, las firmas y notas de las versiones anteriores quedan con su versión.
5. `scope` y `audience=company` o `app_users` solo los manda Guardify cuando la persona que publica tiene permiso sobre toda la empresa.

- `scope` es el mismo lenguaje de los reportes: códigos de la estructura (`division:3`, `puesto:12`, …) separados por coma. **Un código cubre todo lo que cuelga de esa unidad**: enviar a una división alcanza a todos sus puestos.
- El archivo se entrega **una sola vez por versión** (`POST {base}`); los envíos siguientes usan `externalVersionId`.
- `sha256` es la huella del archivo y `seal` la de la versión (SHA-256 del JSON canónico `{ documento, versión, archivo, nombre, publicadoPor, publicadoEn }`); la app debe guardarlas junto al documento para que la firma del empleado quede ligada a una versión exacta.
- Errores: `400/409/422` con `{ message }` → el envío queda `FAILED` con ese mensaje; `401` → llave inválida.

## En Guardify
- Pantalla **Documentos** (permiso `documentos:publicar`): subir, ver versiones con su sello, publicar una versión nueva (las anteriores se conservan), enviar y ver los envíos.
- Tope técnico: **50 MB por archivo** (se guarda en la base de Guardify); siempre se descarga como adjunto, nunca se muestra en línea.
- Enviar a toda la empresa o a las personas de una app pide `documentos:publicar` sobre toda la empresa; a puestos o divisiones, solo unidades dentro del alcance de quien envía, y vinculadas con los códigos de la app (Estructura → vincular).
- Bitácora: `document.created`, `document.version_published`, `document.dispatched`, `document.assignment_ended`, `document.dispatch_failed`, `document.archived`.
