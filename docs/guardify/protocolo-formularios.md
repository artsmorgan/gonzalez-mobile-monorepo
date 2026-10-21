# Formularios por registro (borrador del contrato)

Un reporte puede salir como **formulario**: un documento por registro que reproduce el formato impreso del cliente (encabezado, secciones, casillas y firmas), en PDF o Excel. Es la misma lógica para todos los formularios de todas las apps. Piloto: **Revisión de vehículos** completa (bicicleta, motocicleta y vehículo).

## Quién hace qué

- **La app** entrega el registro **estructurado** (los valores, no un archivo ya dibujado).
- **Guardify** tiene la **definición** de cada formulario (cómo se ve) y lo dibuja en PDF y Excel. Así cada cliente puede tener su propio formato sin tocar la app.
- Las **firmas** son datos sensibles: se piden aparte, con su propio permiso, y cada vez que se ven o exportan queda en la bitácora.

## Definición de un formulario (vive en Guardify)

```jsonc
{
  "id": "revision-de-vehiculos",
  "titulo": "BITÁCORA DE {{variante}} DETENIDA",
  "codigo": "SEG-F-017 · V1 · 30/10/2015",          // lo pone el cliente; null si no hay
  "variante": { "campo": "tipo", "valores": ["Bicicleta", "Motocicleta", "Vehículo"] },
  "cabecera": ["cliente", "sociedad"],                 // de la estructura del registro
  "secciones": [
    { "tipo": "campos",    "titulo": "INFORMACIÓN OFICIAL", "campos": [ { "clave": "oficial", "etiqueta": "Nombre oficial" }, { "clave": "firma_oficial", "etiqueta": "Firma", "firma": true } ] },
    { "tipo": "checklist", "titulo": "ACCESORIOS", "opciones": ["Bueno", "Malo", "No existe"], "items": "revision", "solo": ["Bicicleta"] },
    { "tipo": "tabla",     "titulo": "MOVIMIENTOS", "columnas": ["Movimiento", "Fecha", "Hora", "Realizado por", "Autorizado por"], "filas": "movimientos", "minimo": 6 },
    { "tipo": "texto",     "titulo": "OBSERVACIONES", "clave": "observaciones" }
  ],
  "firmas": ["Oficial de corporación", "Oficial de tránsito"],
  "fotos": false
}
```

- Cada sección puede limitarse a ciertas variantes (`solo`), y las listas de chequeo cambian de tamaño según la variante (24, 34 u 49 ítems).
- Tipos de sección: `campos`, `checklist` (opciones y marcas por ítem), `tabla` (filas repetibles con un mínimo), `texto`.
- Una firma es un campo marcado `firma: true`; el documento la dibuja si el registro la trae y la persona tiene permiso.

## Protocolo con la app

Mismo conector, llave y alcance que los reportes. Un reporte es formulario cuando su definición en Guardify trae `form`; la app lo implementa con dos rutas:

```
GET {base}/api/guardify/reports/{modulo}/forms/ids?from&to&<f.*>&q&sort&dir&scope   → { ids, total }   (los mismos filtros que la tabla; hasta 5000 ids)
GET {base}/api/guardify/reports/{modulo}/forms?ids=1,2,3&firmas=1&scope             → { records }       (hasta 50 por llamada)
```

- Si la app no tiene el formulario de ese módulo responde `501 form_unavailable`.
- El `scope` se aplica también a `?ids=`: un id suelto fuera del alcance simplemente no vuelve (Guardify nunca da acceso por id).
- Las filas de la tabla traen su `id` (en Guardify como `__id`) para poder pedir el formulario de una fila.

Cada registro (`FormRecord`, en `packages/contracts/src/forms.ts`):

```jsonc
{
  "id": 123, "variante": "Bicicleta", "creado": "2026-04-20T09:30:00",
  "estructura": { "empresa": "…", "cliente": "…", "division": null, "contrato": "…", "sucursal": "…", "puesto": "…" },
  "valores": { "nombre_oficial_corporacion": "…", "observaciones": "…" },
  "listas": {
    "revision": [ { "item": "Llantas", "valor": "Bueno", "observacion": null } ],
    "movimientos": [ { "movimiento": "Ingreso a taller", "fecha": "2026-04-20", "hora": "09:30", "realizado_por": "…", "autorizado_por": "…" } ]
  },
  "firmas": { "firma_oficial_corporacion": null },        // data URL solo con firmas=1; si no, null
  "firmasPresentes": ["firma_oficial_corporacion"]          // las que el registro SÍ tiene
}
```

- Las imágenes de firma solo viajan con `firmas=1`. En Guardify piden el permiso `reportes:firmas`, y cada vez queda en la bitácora de reportes (`kind = FORM`, `params.firmas`). El Excel nunca las baja (no las lleva).
- En Guardify: ejecutar el reporte permite la vista previa; descargar PDF/Excel pide además `reportes:exportar`.

### Evidencia y adjuntos del registro (opcionales)

El `FormRecord` puede traer además:

```jsonc
"evidencia": { "dispositivo": "Equipo 12", "latitud": 9.9341, "longitud": -84.0877, "firma": "<sha256 hex>", "cedula": "1-2345-6789", "fecha": "2026-10-20T10:00:00",
               "contenido": { /* lo que se firmó, tal cual: Guardify recalcula la huella (ver protocolo-reportes.md) y la compara con `firma` */ } },
"adjuntos": [ { "id": "foto-1", "nombre": "foto.jpg", "tipo": "image/jpeg", "bytes": 48213 } ]
```

Los archivos adjuntos no viajan en el registro. Guardify los pide, solo cuando una persona abre un enlace, a:

```
GET {base}/api/guardify/reports/{modulo}/forms/{registro}/attachments/{adjunto}?scope   → el archivo (Content-Type y Content-Length); 404 si no existe o está fuera del alcance
```

- **Exportación probatoria** (`probatorio: true` en la exportación; pide `reportes:exportar`): cada registro lleva un bloque «Evidencia» (firma, fecha y hora, dispositivo, cédula, coordenadas solo con `reportes:ubicacion`, y si la huella coincide), el PDF imprime la huella del contenido en el pie, queda **protegido contra edición** (se abre y se imprime sin contraseña) y la huella SHA-256 del archivo queda en la bitácora (`report.sealed`). **Reportes → Verificar firma → «Comprobar un archivo exportado»** dice si un archivo es el original o fue alterado.
- **Adjuntos en el Excel**: cada archivo sale como un enlace firmado que caduca a los 7 días. El enlace no basta: quien lo abre necesita sesión de la empresa, poder ejecutar y exportar el reporte, y que el registro esté en su alcance. Cada descarga queda en la bitácora (`attachment.downloaded`).

## Exportación

- Un registro → PDF o Excel al instante.
- Varios registros → **un PDF con una página por formulario** (o un Excel con una hoja por registro); hasta **200** se descargan al instante (Guardify los pide a la app de 50 en 50); por encima de 200 responde `413 too_many_forms` y el segundo plano queda pendiente.
- «Datos (Excel)»: la tabla de siempre, como segunda opción para analizar.

## Lo que ya existe en MonitoreApp y se reutiliza

Los generadores individuales (`build…ExcelIndividual`) saben qué campos lleva cada formulario, así que sirven de fuente para escribir las definiciones. La galería `Galería de formularios` ya tiene la estructura de los 34.

## Estado

Hecho y probado (e2e F22 con una app simulada, más pruebas de la app real): contrato, motor (documento → vista previa, PDF y Excel), rutas `POST /api/tenant/reports/forms`, pantalla (casillas por fila, «Ver», descargar elegidos o todos, con/sin firmas) y el formulario de Revisión de vehículos con sus tres variantes.

## Descargas en segundo plano (F23)

- Hasta **200** formularios se descargan al instante. De **201 a 1000**, o un reporte pesado (la app tarda más de 15 s o hay más de 5 000 filas), se pide en segundo plano: `POST /api/tenant/reports/jobs` (`kind` FORMS o EXPORT).
- La cola es la tabla `report_job` (RLS por empresa). El proceso de la consola toma 2 trabajos a la vez, sin transacciones abiertas durante las llamadas a la app (hasta 170 s por llamada), y va guardando el avance (`progress_done/total`, `stage`).
- El archivo queda **7 días** en la base (tope 80 MB) y solo lo baja quien lo pidió (`GET /api/tenant/reports/jobs/{id}/download`). Al terminar o fallar se manda un correo con el enlace a **Reportes → Mis descargas**.
- El alcance de la persona se resuelve al pedirlo y viaja con el trabajo; el permiso `reportes:firmas` también se comprueba al pedirlo.
- Máximo 3 descargas en proceso por persona. El cron (cada 10 min) reanima lo que quedó colgado más de 30 min (una vez), borra lo vencido y retoma lo pendiente.
- Probado en staging con datos reales: 31 460 filas de acciones de personal en Excel (~100 s, 47 MB) y 61 formularios de vacaciones en PDF.
- **Correo en staging**: el worker necesita `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`; sin ellos ningún correo de Guardify sale (intenta `localhost:1026`).

## Vistas de formulario (constructor)

Cada persona puede armar **vistas** de un formulario: qué secciones, campos y columnas se ven, cómo se llaman y en qué orden, el título, el código, la cabecera y las firmas al pie. No cambia los datos ni la definición que mantiene Guardify; se aplica antes de dibujar (`applyFormView`, `packages/contracts/src/formview.ts`).
- Se guardan en `form_view` (RLS por empresa). Una vista es **personal** (solo quien la creó) o **de la empresa** (la ven todos; publicarla o retirarla pide `reportes:configurar`). Hasta 30 por persona y formulario.
- API: `GET/POST /api/tenant/reports/form-views`, `PATCH/DELETE …/form-views/{id}`, `GET …/form-def` (la definición para armar la vista). La vista se elige con `viewId` (o `viewConfig` suelta para probarla) en `POST /api/tenant/reports/forms` y en los trabajos en segundo plano (el trabajo guarda la vista tal como estaba al pedirlo).
- **Columnas individuales del reporte**: el constructor ofrece, además de las secciones del formulario, cada columna del reporte (la fila del registro: título, jerarquía, auditoría…) para elegirla, nombrarla y ordenarla en una sección «Datos del reporte» (`@columnas`). Esas filas se piden a la app con el filtro estándar `f.id.in` dentro del periodo y el alcance de la persona.
- Una vista tiene que referirse a secciones que existen y dejar al menos una visible. Las secciones que Guardify agregue después salen al final de la vista.
- Pantalla: en el detalle de un registro y en la barra de formularios del reporte: selector «Vista» y «Personalizar».

## Firmas por renglón

En una columna de `tabla` con `firma: true` la celda trae la imagen (data URL, solo con `firmas=1` y permiso) o el texto «Firmada» si existe pero no se pidió o no es imagen (la «firma» digital del móvil, que es sesión + GPS, nunca sale).

## Estado por formulario (staging, 2026-10-08)

`bun e2e/scripts/forms-staging.ts` ejecuta los 34 formularios contra un Guardify real, pide formularios de muestra, los dibuja en PDF y Excel y mide qué campos salen vacíos. Resultado: **34/34 sin error**.
- Con **datos reales** (6): acciones de personal (9 685 registros), artículos del puesto, cambios de ubicación, manuales, inducción y recorrido, vacaciones.
- Sin registros en la base de producción (28): el cargador consulta las tablas reales con ids inexistentes (la sonda) y la guarda `apps/console/lib/forms/defs.test.ts` comprueba que la definición y la muestra del cargador usan las mismas claves, sin campos vacíos.
- Reportes pesados (acciones de personal, mantenimiento): la primera consulta pasa de los 15 s y Guardify responde 503; la app termina y guarda el resultado, así que el reintento responde de inmediato.

## Piloto: Revisión de vehículos

1. Definir los tres formatos (bicicleta, motocicleta, vehículo) con el código y el título reales que dé el cliente.
2. Endpoint de la app para el registro estructurado (datos, marcas por ítem, movimientos, firmas con permiso).
3. Motor de Guardify: dibujar la definición con los datos en PDF y Excel (un registro y lote).
4. Pantalla: vista previa del formulario, descargar uno, descargar el lote.
5. Prueba con el cliente de los tres formatos antes de seguir con los demás.
