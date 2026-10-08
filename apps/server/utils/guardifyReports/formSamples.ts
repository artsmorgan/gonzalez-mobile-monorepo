import fs from "node:fs";
import path from "node:path";
import type { FormRecord } from "./forms";

/** PNG de 1×1 para las firmas de las muestras (una imagen real, mínima). */
export const SAMPLE_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Pruebas: guarda el registro que armó el cargador como muestra para Guardify (`FORM_SAMPLES_DIR/<id-del-reporte>.json`, una lista con un
 * registro por variante). Guardify comprueba con ellas que su definición del formulario usa las mismas claves. Sin la variable no hace nada.
 * La muestra debe estar COMPLETA: todos los campos, listas y firmas con valor, para que cualquier clave mal escrita se note.
 */
export function writeFormSample(reportId: string, records: Omit<FormRecord, "hier">[]): void {
    const dir = process.env.FORM_SAMPLES_DIR;
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${reportId}.json`);
    const prev: unknown[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    const byVariant = new Map<string, unknown>(prev.map((r: any) => [String(r.variante ?? ""), r]));
    for (const r of records) { const { hier: _h, ...rest } = r as any; byVariant.set(String(rest.variante ?? ""), rest); }
    fs.writeFileSync(file, JSON.stringify([...byVariant.values()], null, 1));
}
