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
    &f.<columna>=<valor>    filtro por igualdad (solo columnas de filtro del reporte)
    &scope=nivel:id,nivel:id   alcance por estructura (ver abajo); sin el parámetro = toda la empresa
→ 200 { "rows": [ { "<columna>": texto | número | null, … } ], "total": 123 }

GET /api/guardify/reports/{modulo}/options?dimension=<columna>&from&to&scope
→ 200 { "values": ["…", "…"] }     valores existentes para una lista de filtro
```

Errores (siempre JSON `{ error, message }`): `401 unauthorized`, `503 not_configured`, `404 report_not_found`,
`400 bad_request`, `403 scope_unsupported`, `500 internal`.

- Las fechas con hora son la hora «de pared» de la base, sin zona: `YYYY-MM-DDTHH:mm:ss`.
- El periodo máximo es de 400 días.
- Cada módulo trae como máximo 50 000 filas del periodo (el mismo tope que sus Excel); búsqueda, orden y paginación se
  aplican en memoria sobre ese conjunto.

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
   y devuelve filas planas (`mappers.ts`). Declara columnas de búsqueda, de filtro y de orden, y si soporta alcance.
2. Una línea en `utils/guardifyReports/registry.ts`.
3. La definición del reporte (columnas, filtros) en el manifiesto de MonitoreApp en Guardify, con `source: "api"`.
4. Pruebas en `guardifyReports.test.ts` (`npx tsx --test utils/guardifyReports/guardifyReports.test.ts`).

Los Excel de siempre (`/api/reportes`, con su formato oficial) no cambian.
