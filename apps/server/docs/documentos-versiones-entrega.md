# Documentos: versiones, entrega, nota del quiz y API para Guardify

Issues #154 a #157. Contrato con Guardify: `docs/guardify/protocolo-documentos.md`. Migración: `gonzalez-mobile-dynamic-api` → `20261021140001_documentos_versiones_entrega`.

## Modelo

- **Documento** = `e_manual_puesto` (la fila vigente). Columnas nuevas: `version` (vigente), `externo_documento_id` / `externo_version_id` (ids en Guardify), `sello` (huella de la versión) y `archivo_sha256`.
- **Histórico** = `e_manual_puesto_version`: una fila por versión anterior (título, descripción, quiz, sello…). Nada se borra.
- **Archivos** = `e_archivos_manual_puesto` con `version` (en la que se agregó), `retirado_en_version` (desde cuándo ya no aplica) y `sha256`. Los archivos de una versión son los agregados en ella o antes y no retirados.
- **Firma / visualización** = `e_empleado_visualizacion_manual_puesto` con `version`, `sello_version` (liga la firma a una versión exacta) y la **nota consolidada** (`nota`, `nota_puntos`, `nota_total`, `nota_minimo`, `nota_fecha`, `nota_calificado_por`).
- **Entrega** = `e_empleados_manual_puesto` con `created_at` (primera entrega), `entregado_en` (entrega de la versión), `version` y `origen` (`puesto`, `asignacion`, `guardify`).
- **Asignación vigente** = `e_documento_asignacion` (`audience` `units|app_users|company`, `scope`, `vigente`, quién y cuándo la pidió y la terminó).

Lo existente queda en la versión 1.

## Versiones (#155)

`publicarNuevaVersion` (`utils/documentos/service.ts`): guarda la vigente en el histórico, retira los archivos quitados, agrega los nuevos y sube la versión. **Las firmas y notas de la versión anterior quedan intactas con su versión**; el estatus (no visto / visto / firmado / nota) es por versión, así que quien firmó la v1 aparece «No visto» en la v2 y debe firmarla. Es idempotente por `externo_version_id`; una versión igual o menor a la vigente se rechaza.

- `PUT /api/job-manuals/{id}` con `nueva_version: true` publica una versión nueva (sin ese campo es una corrección menor de la misma versión, como antes).
- `GET /api/job-manuals` devuelve `version`, `sello`, los archivos de la versión vigente, `visualizaciones` solo de la vigente, `mis_versiones_firmadas` y `mi_entrega`.
- `POST …/sign`, `PATCH …/visualizacion` y `PUT …/quiz-result` aceptan `version`: una firma hecha **sin conexión** sobre una versión anterior queda como firma de ESA versión (el empleado deberá firmar la nueva). Sin `version` (app anterior) se usa la vigente.

## Entrega (#154)

Al **marcar el ingreso** (`PUT /api/attendance/{id}`, caso `entrada`) se llama a `entregarDocumentosPendientes`: crea los vínculos con los documentos de su puesto (vínculo o puesto principal) y los de las asignaciones vigentes que lo alcanzan, con la fecha de entrega; si ya lo tenía y hay versión nueva, actualiza la versión entregada y su fecha. No bloquea el ingreso. **No se borra nada**: quien sale del puesto conserva sus vínculos y resultados; terminar una asignación solo deja de asignar a quien entre después.

## Nota del quiz (#156)

Se calcula **una vez**, al calificar, y se guarda (`notaQuiz.ts`): selección única se califica sola; las demás con los puntajes de quien revisa (la app manda `score: { obtained, total }`). Un quiz solo de selección única lo calcula el servidor aunque la app sea anterior. Una vez calificado es inmutable (repetir el mismo resultado es inofensivo; cambiarlo da 409) y no se recalcula si luego cambia el quiz. Los reportes muestran la guardada (`nota` por empleado; `nota_promedio` por documento, de la versión vigente) y, si no hay, la estimación de siempre.

## API para Guardify (#157)

Misma llave que los reportes (`GUARDIFY_REPORTS_API_KEY`).

| Ruta | Qué hace |
|---|---|
| `POST /api/guardify/documents` | multipart `meta` + `file`. Crea el documento (v1) o su versión nueva. Verifica `sha256`, máximo 50 MB. Reintento de la misma versión → 201 sin duplicar; versión no mayor → 409 |
| `POST /api/guardify/documents/preview` | `{ audience, scope }` → `{ recipients }` (empleados activos asignados a los puestos alcanzados) |
| `POST /api/guardify/documents/dispatches` | crea la **asignación vigente**, vincula los puestos y entrega a los empleados de hoy → `{ id, recipients }` |
| `POST /api/guardify/documents/dispatches/{id}/end` | termina la asignación (lo ya entregado y los resultados se conservan) |

`scope` es el mismo lenguaje de los reportes (`division:3,puesto:12`): un código cubre todo lo que cuelga de esa unidad.

## Reportes

«Documentos entregados a personal» (`manuales_puesto`): columnas `version` y `nota_promedio`; el detalle por empleado trae `version`, `fecha_entrega`, `nota` y la lista `visualizacion_anteriores` con las firmas y notas de versiones anteriores.
