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
| `tiempo_almuerzo` | `c_empleado_almuerzo` | sí (columnas de estructura de cada fila) | id, inicio, fin, empleado, cedula, minutos, empresa, cliente, division, contrato, sucursal, puesto, pausas, manual |
| `ingresos_usuario` | `refresh_token` | no | id, creado, expira, empleado, cedula, id_sesion, dispositivos, revocado |

Lo que **no** se expone a propósito: el token de refresco (`ingresos_usuario`), la firma del empleado
(`tiempo_almuerzo`) y el dispositivo y las coordenadas (`login_marca`).

## Agregar un reporte

1. `utils/guardifyReports/modules/<modulo>.ts`: reutiliza la función `queryXxxRows` del reporte (la misma de su Excel)
   y devuelve filas planas (`mappers.ts`). Declara las columnas de búsqueda y si soporta alcance (filtrar y ordenar funciona sobre cualquier columna de las filas).
2. Una línea en `utils/guardifyReports/registry.ts`.
3. La definición del reporte (columnas, filtros) en el manifiesto de MonitoreApp en Guardify, con `source: "api"`.
4. Pruebas en `guardifyReports.test.ts` (`npx tsx --test utils/guardifyReports/guardifyReports.test.ts`).

Los Excel de siempre (`/api/reportes`, con su formato oficial) no cambian.
