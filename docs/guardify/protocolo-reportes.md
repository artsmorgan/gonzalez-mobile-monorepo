# Protocolo de reportes por API (v2)

Guardify define los reportes (columnas, filtros, permisos). La app **no declara nada**: implementa este protocolo sobre las
columnas que devuelve. Cualquier app nueva se conecta igual.

```
GET {baseUrl}{path}/{reporte}?from&to&page&pageSize&sort&dir&q&scope&<filtros>      → { rows, total }
GET {baseUrl}{path}/{reporte}/options?dimension=<columna>&from&to&scope&q&limit&<filtros> → { values }
GET {baseUrl}/api/guardify/structure                                                 → { puestos: [...] }
```

Autenticación, periodo (`from` inclusivo, `to` exclusivo), `scope`, `page`, `pageSize` (máx. 1000) y la respuesta `{ rows, total }`
no cambian respecto a la v1 (ver `apps/server/docs/guardify-reports-api.md` de MonitoreApp).

## Filtros

Cada filtro es sobre **una columna de las filas** que devuelve el reporte (las claves de cada fila, en minúsculas y con guion
bajo: `^[a-z][a-z0-9_]*$`). Parámetro: `f.<columna>` o `f.<columna>.<operador>`. Varios operadores sobre la misma columna se
combinan con **Y** (así se arma un rango: `ge` + `lt`); filtros de columnas distintas también se combinan con Y.

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

Reglas:
- `ge`, `lt` y `le` comparan como **número** si el valor del filtro y el de la fila son numéricos, y como **texto** si no
  (las fechas `YYYY-MM-DDTHH:mm:ss` se ordenan bien como texto). Una fila con la columna vacía (`null`) **no** cumple ningún
  operador de comparación, rango, hora ni `contains`; solo `f.<col>=` con valor vacío no se manda nunca.
- `tge`/`tle` toman la hora de las posiciones 11 a 15 del texto `YYYY-MM-DDTHH:mm:ss`; son inclusivos. Si la columna no tiene
  formato de fecha y hora, la fila no cumple.
- Guardify convierte «fecha fin» **inclusiva** de la pantalla en `lt` con el día siguiente a las 00:00.
- Una columna que **no existe** en las filas, o un operador que no se conoce, responde **400** `{"error":"unsupported_filter","message":"…"}`.
  Si el resultado está vacío y no hay filas para comprobar las columnas, se responde 200 con cero filas.
- Valores de más de 200 caracteres se recortan; el valor vacío se ignora.

## Orden y búsqueda
- `sort=<columna>`: cualquier columna de las filas (`dir=asc|desc`). Una columna que no existe → 400 `bad_request`.
- `q`: búsqueda de texto sobre las columnas de búsqueda del módulo (sin distinguir mayúsculas ni tildes).

## Opciones (valores de una columna)
`/options?dimension=<columna>` devuelve los valores distintos de esa columna dentro del periodo y el alcance:
- Aplica los filtros recibidos **excepto los de la propia columna** (así el desplegable muestra lo que todavía se puede elegir:
  filtros dinámicos pero independientes).
- `q`: solo valores que contienen ese texto (buscador con autocompletado). `limit`: máximo de valores (por defecto 200; tope 200).
- Una columna que no existe → 400 `unsupported_filter`.

## Columnas estándar (regla para TODOS los reportes)

Todo reporte de una app lleva siempre estas 11 columnas (`packages/contracts/src/standard.ts`); el manifiesto no se acepta sin ellas:

| Grupo | Claves |
|---|---|
| Jerarquía | `empresa`, `cliente`, `division`, `contrato`, `sucursal`, `puesto` (texto «código - nombre»; un nivel que el registro no tenga = `null`) |
| Auditoría y trazabilidad | `id`, `creado` (cuándo se creó el registro, no la fecha del hecho), `creado_por`, `modificado`, `modificado_por` |

Si la tabla de origen no guarda alguna (típico: `modificado*`), la app la entrega con `null` y se abre un issue por tabla: esa información siempre debería existir (hoy están abiertos los de `gonzalez-mobile-monorepo` con la etiqueta `auditoria-trazabilidad`). En los reportes de eventos que guarda Guardify, la jerarquía sale de la unidad del evento y sus ancestros (por la etiqueta de su nivel), `id` es el del evento, `creado` cuándo se recibió y `modificado*` van vacíos (un evento no se modifica). La prueba de conformidad comprueba que las filas traigan todas las columnas declaradas.

### Evidencia (opcional, decisión del cliente del 20 oct 2026)

Además de las 11 anteriores, una app que pueda entregar la **evidencia** de cada registro declara estas 5 (`withEvidenceColumns`; en `scripts/publish-monitoreapp.ts` con `--evidencia`, cuando la app ya las devuelve):

| Clave | Qué es |
|---|---|
| `dispositivo` | Equipo desde el que se hizo el registro (nombre o id que ve Guardify en Dispositivos) |
| `latitud`, `longitud` | Coordenadas de la acción (números). **Datos personales:** solo las ve quien tenga el permiso `reportes:ubicacion`; sin él la columna no existe para esa persona (ni en pantalla, ni en CSV/Excel/PDF, ni en las exportaciones en segundo plano) |
| `firma` | Huella (SHA-256 hex) del contenido firmado, ver abajo |
| `cedula` | Cédula de quien firmó |

**Huella de la firma (contrato compartido):** `firma = SHA-256 (hex minúscula) del JSON canónico del contenido firmado`. JSON canónico = llaves ordenadas alfabéticamente en todos los niveles, sin espacios, UTF-8; `undefined` no cuenta y `null` sí. Guardify lo implementa en `apps/console/lib/evidence-seal.ts`; la pantalla **Reportes → Verificar firma** recalcula la huella de un contenido pegado y dice si coincide.

## Agregados para el tablero (`aggregate`)

Cada reporte lleva arriba un tablero de widgets (KPI, barras, línea de tiempo) calculado con los MISMOS filtros que la tabla. Guardify decide qué widgets lleva (los suyos en `dashboard` del reporte más los estándar de `DEFAULT_WIDGETS`) y la app solo agrega:

```
GET {base}/api/guardify/reports/{modulo}/aggregate?from&to&scope&q&f.<col>…&spec=<JSON>
spec = [{ "id", "metrics": [{ "agg": "count|sum|avg|min|max|distinct", "col"? }], "group"?: col, "bucket"?: "day|week|month", "top"?: n }]
→ { "total": n, "widgets": { "<id>": { "rows": [{ "key", "count", "sum_<col>", … }], "groups": n } } }
```

Sin `group` la respuesta es una sola fila `key = "total"`. Con `group`, las categorías van de mayor a menor por la primera métrica (lo que no entra en `top` se junta en «Otros»; vacío = «Sin dato») y con `bucket` van en orden cronológico. Límites: 16 widgets, 6 métricas por widget, `top` ≤ 50. Errores: 400 `bad_request` (spec inválido), 400 `unsupported_filter` (columna que el reporte no tiene).

## Prueba de conformidad
Guardify trae una prueba que recorre cada reporte y cada filtro definido contra la app (`POST
/api/tenant/apps/<app>/connectors/<id>/conformance`): comprueba que el reporte responde y que cada filtro se acepta con su
operador. «Probar conexión» la resume. Una app que todavía no soporta un operador responde 400 `unsupported_filter` y Guardify
muestra qué filtros faltan, sin fallar el reporte entero.
