# Importación de Excel: SheetJS corregido y límites (issues #171 H05 y #175 H09)

## #171: SheetJS ≥ 0.20.2

`xlsx 0.18.5` (la última publicada en npm) tiene CVE-2023-30533 (prototype pollution al leer archivos) y CVE-2024-22363 (ReDoS). La corrección solo se
publica en el CDN oficial de SheetJS, no en npm. `apps/mobile/package.json` ahora apunta a
`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` y `package-lock.json` fija el origen **y el hash `sha512`** del paquete, así que `npm ci` verifica
la integridad. La 0.20.x no tiene dependencias, por eso el lock pierde `adler-32`, `cfb`, `codepage`, `frac`, `ssf`, `wmf` y `word` (eran de la 0.18).

La API que usa la app (`read`, `utils.encode_cell`, `utils.decode_range`, `SSF.format`, `SSF.parse_date_code`) no cambió; `tsc` queda igual.

Para actualizar en el futuro: `npm install "xlsx@https://cdn.sheetjs.com/xlsx-<versión>/xlsx-<versión>.tgz" -w gonzalez-mobile-app`. La prueba
`excelImportLimits.test.ts` exige ≥ 0.20.2 en `package.json`, hash en el lock y versión instalada.

## #175: límites antes de cargar el Excel

Reglas en `apps/mobile/hooks/excelImportLimits.ts` (puro, probado en `apps/server/utils/excelImportLimits.test.ts`); el lector es
`hooks/mantenimientoEquipoPlantillaLocal.ts`.

| Límite | Valor | Dónde se aplica |
|---|---|---|
| Tamaño del archivo | 5 MB | Con el tamaño que informa el selector (antes de leer), con `Content-Length` y con los bytes reales |
| Hojas | 5 | Tras abrir el libro (solo se procesa la primera) |
| Filas / columnas de la hoja | 5.000 / 50 | Sobre el rango **declarado** (`!fullref`), antes de recorrerla |
| Caracteres por celda | 2.000 | Fila de datos y catálogo; la fila se reporta como error |

Además: `XLSX.read` se llama con `sheets: 0` y `sheetRows: 5001` (solo la primera hoja y nunca más de 5.001 filas), el recorrido cede el hilo cada 250 filas y
revisa la cancelación (`AbortSignal`), y la pantalla cancela la lectura al salir o al elegir otro archivo. Un rango de 1.048.576 filas declarado en una
hoja casi vacía ya no se recorre.

**Riesgo residual:** un `.xlsx` es un ZIP; un archivo de 5 MB comprimido puede expandirse mucho al descomprimirse (zip bomb) y SheetJS no expone un
límite del tamaño descomprimido. El límite de 5 MB y el procesamiento de una sola hoja lo reducen, pero no lo eliminan; hacerlo exigiría leer el
directorio central del ZIP antes de abrirlo (queda como mejora si el auditor lo pide).

## Prueba manual (pendiente, requiere dispositivo)

1. Plantilla oficial de mantenimiento de equipo con pocos registros: debe importar igual que antes.
2. Archivo `.xlsx` de más de 5 MB: debe rechazarse de inmediato con el mensaje del máximo, sin congelar la app.
3. Plantilla con una celda de más de 2.000 caracteres: la fila se reporta como error con su número.
4. Elegir un archivo e inmediatamente salir de la pantalla (o elegir otro): no debe aparecer ningún mensaje del primero.
