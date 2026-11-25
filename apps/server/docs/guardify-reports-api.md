# API de reportes para Guardify

Guardify (consola web de permisos, roles y reportes) construye la pantalla de reportes y pide a MonitoreApp **solo los
datos**. MonitoreApp sigue siendo dueño de ellos: Guardify no los guarda, los consulta cuando alguien ejecuta un reporte.

Es una API **de solo lectura, de servidor a servidor**, aditiva: no toca ninguna ruta, tabla ni pantalla existente, y
queda **deshabilitada** (503) mientras no se defina la variable de entorno.

## Activarla

| Variable | Qué es |
|---|---|
| `GUARDIFY_REPORTS_API_KEY` | Llave compartida con Guardify (mínimo 24 caracteres, aleatoria). Se configura igual en Guardify (Apps → conexión de reportes). Sin ella la API responde 503. |

Guardify la manda en `Authorization: Bearer <llave>` (o en el encabezado `x-guardify-key`) y, además, `x-guardify-user`
con el correo de quien ejecuta (solo para los registros del servidor).

## Contrato

```
GET /api/guardify/reports/{modulo}
    ?from=YYYY-MM-DD        inicio inclusivo
    &to=YYYY-MM-DD          fin EXCLUSIVO (el día siguiente al último que se quiere ver)
    &page=1&pageSize=50     pageSize máximo 1000
    &sort=<columna>&dir=asc|desc
    &q=<texto>              busca en las columnas de búsqueda del reporte
    &f.<columna>[.<op>]=<valor>   filtros sobre cualquier columna de las filas (ver «Filtros (protocolo v2)»)
    &scope=nivel:id,nivel:id   alcance por estructura (ver abajo); sin el parámetro = toda la empresa
→ 200 { "rows": [ { "<columna>": texto | número | null, … } ], "total": 123 }

GET /api/guardify/reports/{modulo}/options?dimension=<columna>&from&to&scope&q&limit&<filtros>
→ 200 { "values": ["…", "…"] }     valores existentes para una lista de filtro
```

Errores (siempre JSON `{ error, message }`): `401 unauthorized`, `503 not_configured`, `404 report_not_found`,
`400 bad_request`, `400 unsupported_filter`, `403 scope_unsupported`, `500 internal`.

- Las fechas con hora son la hora «de pared» de la base, sin zona: `YYYY-MM-DDTHH:mm:ss`.
- El periodo máximo es de 400 días.
- Cada módulo trae como máximo 50 000 filas del periodo (el mismo tope que sus Excel); búsqueda, orden y paginación se
  aplican en memoria sobre ese conjunto.

### Filtros (protocolo v2)

La especificación es el contrato de Guardify (`docs/protocolo-reportes.md` en el repositorio de Guardify); esta app lo
implementa sobre las columnas que devuelve cada reporte, sin declarar nada por módulo. Cada filtro es sobre **una columna
de las filas** (`^[a-z][a-z0-9_]*$`): `f.<columna>` o `f.<columna>.<operador>`. Varios filtros se combinan con **Y**
(así se arma un rango: `ge` + `lt`).

| Parámetro | Significa | Ejemplo |
|---|---|---|
| `f.<col>=v` | igual a (igualdad exacta del texto o número) | `f.estado=Aprobado` |
| `f.<col>.in=v` (repetible) | uno de estos valores (máx. 100) | `f.estado.in=Aprobado&f.estado.in=Pendiente` |
| `f.<col>.ge=v` | mayor o igual | `f.creado.ge=2026-09-01T00:00:00` |
| `f.<col>.lt=v` | menor que (cota superior exclusiva) | `f.creado.lt=2026-10-01T00:00:00` |
| `f.<col>.le=v` | menor o igual (cota superior inclusiva) | `f.minutos.le=45` |
| `f.<col>.tge=HH:MM` | la **hora del día** es mayor o igual | `f.entrada_real.tge=06:00` |
| `f.<col>.tle=HH:MM` | la **hora del día** es menor o igual | `f.entrada_real.tle=14:00` |
| `f.<col>.contains=texto` | contiene (sin distinguir mayúsculas ni tildes) | `f.empleado.contains=ronald` |

- `ge`, `lt` y `le` comparan como número si el valor del filtro y el de la fila son numéricos, y como texto si no.
- Una fila con la columna vacía (`null`) no cumple ninguna comparación, rango, hora ni `contains`.
- `tge`/`tle` usan las posiciones 11 a 15 de `YYYY-MM-DDTHH:mm:ss` (inclusivos); sin ese formato la fila no cumple.
- Una columna que no existe en las filas (se comprueba con la primera fila; sin filas no se valida), una columna mal
  formada o un operador desconocido responden `400 { "error": "unsupported_filter" }`. Valores vacíos se ignoran y los de
  más de 200 caracteres se recortan.
- `sort` acepta cualquier columna de las filas (si no existe, `400 bad_request`); `q` busca en las columnas de búsqueda del módulo.
- `options?dimension=<col>` acepta cualquier columna de las filas (si no, `400 unsupported_filter`), aplica los filtros
  recibidos **excepto los de la propia columna**, y admite `q` (contiene, sin tildes) y `limit` (por defecto y tope 200).
- Los filtros se aplican en memoria después de la caché por (módulo, periodo, alcance).

### Alcance por estructura

`scope` es la **unión** de nodos de la estructura de González: `empresa`, `cliente`, `division`, `contrato`, `corpo`
(sucursal) y `puesto`, p. ej. `scope=contrato:12,puesto:340`. Una fila se ve si coincide con alguno.

- `scope=` (vacío) = la persona tiene restricción pero ningún nodo mapeado: no se ve **nada** (falla cerrado).
- Los módulos que no saben ubicar sus filas en la estructura responden `403 scope_unsupported` si llega un alcance;
  Guardify entonces exige permiso sobre toda la empresa para ese reporte.

## Reportes disponibles (v1)

| `modulo` | Tabla | Alcance | Columnas |
|---|---|---|---|
| `login_marca` | `c_login_marca_almuerzo` | sí (por puesto → sucursal → contrato → cliente/empresa/división) | id, fecha, cedula, empleado, puesto, entrada_teorica, entrada_real, salida_teorica, salida_real, inicio_almuerzo, fin_almuerzo |
| `tiempo_almuerzo` | `c_empleado_almuerzo` | sí (columnas de estructura de cada fila) | id, inicio, fin, empleado, cedula, minutos, empresa, cliente, division, contrato, sucursal, puesto, pausas, **pausas_detalle** (texto JSON `[{inicio, fin, motivo}]`, fechas de pared; `null` si el registro no trae la lista), manual |
| `ingresos_usuario` | `refresh_token` | no | id, creado, expira, empleado, cedula, id_sesion, dispositivos, revocado |

Lo que **no** se expone a propósito: el token de refresco (`ingresos_usuario`), la firma del empleado
(`tiempo_almuerzo`) y el dispositivo y las coordenadas (`login_marca`).

### `solicitudes_permiso` (`c_solicitud_permiso`)

Alcance por la estructura de la cabecera. Además de las columnas estándar (id, creado, creado_por, modificado,
modificado_por, empresa, cliente, division, contrato, sucursal, puesto) trae: empleado («código - nombre»), cedula,
codigo, ejecutivo_cuenta, tipo_salario, estado, fecha_inicio, fecha_fin, dias, turnos (conteo), motivo, observaciones,
**adjuntos** y tipo_turno.

- `adjuntos`: nombres de los archivos de `c_archivos_solicitud_permiso` (el nombre original o, si viene vacío, el
  guardado) separados por «; »; `null` si la solicitud no tiene archivos. Se carga en lote (`solicitud_id in […]`, una
  consulta por cada 1000 solicitudes del periodo, no una por fila). No es columna de búsqueda, filtro declarado ni orden por defecto.
- Las firmas (`firma_*`) no salen nunca.

## Formularios por registro

```
GET /api/guardify/reports/{modulo}/forms/ids?from&to&<filtros>&scope   → { ids, total }
GET /api/guardify/reports/{modulo}/forms?ids=1,2,3&firmas=1&scope       → { records }   (hasta 50)
GET /api/guardify/reports/{modulo}/forms/{id}/attachments/{attachmentId}?scope → el archivo (binario)
```

Cada registro: `{ id, variante, creado, estructura, valores, listas, firmas, firmasPresentes, evidencia?, adjuntos? }`
(Guardify lo dibuja con su propia definición del formulario). `adjuntos` es opcional:
`[{ id: string, nombre: string, tipo?: string | null, bytes?: number | null }]` (`tipo` = MIME, `null` si no se reconoce).

### Solicitudes de permiso (`solicitudes_permiso`)

`valores` (además de las claves de siempre, que se conservan por compatibilidad: `fecha`, `nombre_colaborador`,
`codigo_colaborador`, `permiso_con_goce`, `permiso_sin_goce`, `motivo`, `cantidad_dias`, `fechas_permiso`,
`observaciones`):

| Clave | Valor |
|---|---|
| `cedula_colaborador` | Cédula del empleado (`c_empleado.cedula`) o `null`. |
| `tipo_permiso` | `"Con goce de salario"` / `"Sin goce de salario"` según `tipo`; `null` si no se reconoce. |
| `fecha_creacion` | `created_at` como `YYYY-MM-DDTHH:mm:ss`. |
| `fecha_desde` / `fecha_hasta` | `fecha_inicio` / `fecha_fin` como `YYYY-MM-DD`. |
| `dias_permiso` | Días calendario entre desde y hasta, ambos inclusive (la misma regla que la columna `dias` de la lista); `null` si falta alguna fecha. |
| `cantidad_turnos` | Cuántos turnos tiene la solicitud (igual que `cantidad_dias`, que el papel llama «cantidad de días»). |

`listas.turnos`: una fila por turno del JSON `turnos`:
`{ fecha: "YYYY-MM-DD" | null, horario: "HH:mm – HH:mm" | null, tipo: "Diurno" | "Nocturno" | "Mixto" | texto | null, reemplazo: "código - nombre" | null }`.
Los reemplazos se buscan en lote en `c_empleado` (en la misma consulta que los empleados de las solicitudes).

`adjuntos`: uno por fila de `c_archivos_solicitud_permiso` de la solicitud: `id` (el id de la fila, como texto),
`nombre` (`original_name`, o `name` si viene vacío), `tipo` (MIME por la extensión: jpg/jpeg, png, webp, gif, pdf, mp3,
m4a, mp4; otro → `null`) y `bytes: null` (la tabla no guarda el tamaño).

### Descarga de un adjunto

`GET /api/guardify/reports/{modulo}/forms/{id}/attachments/{attachmentId}` con la misma llave.

- Solo para los reportes cuyo formulario sabe leer adjuntos (hoy `solicitudes_permiso`). Reporte sin adjuntos, registro
  inexistente o inactivo, o un adjunto que no es de ese registro → `404 { "error": "attachment_not_found" }`.
- `scope` (mismo formato que en los demás): si el registro cae fuera del alcance responde el mismo 404 (no se confirma
  que exista). Un reporte sin alcance responde `403 scope_unsupported` si llega `scope`.
- `200`: el binario, con `content-type` del archivo, `content-disposition: attachment; filename*=UTF-8''<nombre>` y
  `cache-control: no-store`. Más de 25 MB → `413 { "error": "attachment_too_large" }`.
- El archivo se lee del almacenamiento de la app igual que `api/permit-request/[id]/get-file/[file]`
  (`permit-request/<id>/<name>`), con `MOBILE_ACCESS_TOKEN` y sin sesión de usuario (la autorización es la llave).

## Rol base de las personas (para Guardify)

`GET /api/guardify/people/roles?cedulas=<c1>,<c2>,…` (hasta 200, misma llave que los reportes) → `{ people: [{ cedula, found, superAdmin, base, byDivision: [{ divisionId, division, role }] }] }`.

- `role` sale de la categoría de empleado de cada plaza, con el mismo mapeo que `/api/check-permissions` y el menú: `ADM` → `ADMINISTRATIVO`; `SUP`/`COO` → `SUPERVISOR`; el resto → `OPERATIVO`.
- `base` es el de mayor alcance entre sus divisiones (Guardify asigna un rol por app); `null` si no tiene plaza con categoría.
- `superAdmin`: figura en `n_employees_superadmin` y la persona está activa. Los empleados de baja (`estado = BA`) y las cédulas desconocidas se devuelven como `found: false`, `superAdmin: false`, `base: null`, aunque sigan en esa tabla.
- Guardify lo usa para **sugerir** el rol al dar acceso (MonitoreApp es la base; Guardify puede sobrescribirlo). No devuelve nombres ni otros datos personales.

## Agregar un reporte

1. `utils/guardifyReports/modules/<modulo>.ts`: reutiliza la función `queryXxxRows` del reporte (la misma de su Excel)
   y devuelve filas planas (`mappers.ts`). Declara las columnas de búsqueda y si soporta alcance (filtrar y ordenar funciona sobre cualquier columna de las filas).
2. Una línea en `utils/guardifyReports/registry.ts`.
3. La definición del reporte (columnas, filtros) en el manifiesto de MonitoreApp en Guardify, con `source: "api"`.
4. Pruebas en `guardifyReports.test.ts` (`npx tsx --test utils/guardifyReports/guardifyReports.test.ts`).

Los Excel de siempre (`/api/reportes`, con su formato oficial) no cambian.
