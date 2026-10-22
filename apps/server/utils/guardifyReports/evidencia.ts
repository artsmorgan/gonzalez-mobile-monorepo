/**
 * Columnas fijas de evidencia en los reportes de Guardify (issue #153): `dispositivo`, `latitud`, `longitud`, `firma` y `cedula`.
 *
 * Salen de la tabla central `c_evidencia_registro` (ver `utils/evidencia.ts`): de cada registro se muestra la evidencia MÁS RECIENTE
 * (la de su última alta o edición). Los registros anteriores a la evidencia, o los de tablas que no la tienen, salen con las cinco en null.
 * Si el módulo ya devuelve una columna con ese nombre (por ejemplo `latitud` / `longitud` del reporte de cambios de ubicación, que son las
 * del puesto) se respeta la del módulo.
 */
import type { ReportDataAccess } from "../reportDynamicPrisma";
import type { OutRow } from "./listing";
import { camposDeFila, contenidoFirmado, type FilaEvidencia } from "../evidencia";
import type { FormRecord } from "./forms";
import type { GuardifyReportModule } from "./types";

export const EVIDENCIA_COLUMNAS = ["dispositivo", "latitud", "longitud", "firma", "cedula"] as const;

type FilaLeida = FilaEvidencia & { id: number };

const CHUNK = 1000;

const numeroOnull = (v: unknown): number | null => {
    if (v == null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** La evidencia más reciente (id mayor) de cada registro, en tandas de 1000 ids. Si la tabla no existe todavía, devuelve vacío. */
export async function cargarEvidencias(db: ReportDataAccess, tabla: string, ids: readonly number[]): Promise<Map<number, FilaLeida>> {
    const unicos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
    const out = new Map<number, FilaLeida>();
    try {
        for (let i = 0; i < unicos.length; i += CHUNK) {
            const rows: FilaLeida[] = await (db as any).c_evidencia_registro.findMany({
                where: { tabla, registro_id: { in: unicos.slice(i, i + CHUNK) } },
                orderBy: { id: "asc" },
            });
            for (const r of rows) {
                const prev = out.get(Number(r.registro_id));
                if (!prev || Number(r.id) > Number(prev.id)) out.set(Number(r.registro_id), r);
            }
        }
    } catch {
        /* sin tabla de evidencia (migración pendiente): el reporte sigue sin esas columnas */
    }
    return out;
}

/** Agrega las cinco columnas a cada fila (sin pisar las que el módulo ya tenga). */
export function aplicarEvidencia(rows: OutRow[], porTabla: (row: OutRow) => string | null, evidencias: Map<string, Map<number, FilaLeida>>): OutRow[] {
    return rows.map((row) => {
        const tabla = porTabla(row);
        const e = tabla ? evidencias.get(tabla)?.get(Number(row.id)) : undefined;
        const extra: OutRow = {
            dispositivo: e?.dispositivo_id ?? null,
            latitud: numeroOnull(e?.latitud),
            longitud: numeroOnull(e?.longitud),
            firma: e?.firma ?? null,
            cedula: e?.cedula ?? null,
        };
        const out: OutRow = { ...row };
        for (const k of EVIDENCIA_COLUMNAS) if (!(k in out)) out[k] = extra[k] ?? null;
        return out;
    });
}

/**
 * Envuelve un módulo para que sus filas lleven las cinco columnas de evidencia. `tabla` es la tabla del registro (o una función de la fila
 * cuando un mismo reporte mezcla tablas, como los artículos del puesto: plan y entregados).
 */
/** `FormRecord.evidencia` desde una fila guardada (contrato de formularios de Guardify). */
export function evidenciaDeFormulario(f: FilaLeida): NonNullable<FormRecord["evidencia"]> {
    const campos = camposDeFila(f);
    return {
        dispositivo: f.dispositivo_id ?? null,
        latitud: numeroOnull(f.latitud),
        longitud: numeroOnull(f.longitud),
        firma: String(f.firma),
        cedula: f.cedula ?? null,
        fecha: campos.capturadoEn,
        contenido: contenidoFirmado(campos),
    };
}

export function conEvidencia(mod: GuardifyReportModule, tabla: string | ((row: OutRow) => string)): GuardifyReportModule {
    const porTabla = typeof tabla === "string" ? () => tabla : tabla;
    const tablaFija = typeof tabla === "string" ? tabla : "";
    const form = mod.form && tablaFija
        ? {
              ...mod.form,
              // Cada registro del formulario lleva la evidencia más reciente de su registro (si la tiene).
              async loadRecords(db: ReportDataAccess, ids: number[], opts: { firmas: boolean }) {
                  const records = await mod.form!.loadRecords(db, ids, opts);
                  if (!records.length) return records;
                  const evidencias = await cargarEvidencias(db, tablaFija, records.map((r) => Number(r.id)));
                  return records.map((r) => {
                      const e = evidencias.get(Number(r.id));
                      return e ? { ...r, evidencia: evidenciaDeFormulario(e) } : r;
                  });
              },
          }
        : mod.form;
    const agregar = (keys: string[]) => [...keys, ...EVIDENCIA_COLUMNAS.filter((c) => !keys.includes(c))];
    return {
        ...mod,
        form,
        filterKeys: agregar(mod.filterKeys),
        sortKeys: agregar(mod.sortKeys),
        async load(db, p) {
            const rows = await mod.load(db, p);
            if (!rows.length) return rows;
            const idsPorTabla = new Map<string, number[]>();
            for (const r of rows) {
                const t = porTabla(r);
                if (t) (idsPorTabla.get(t) ?? idsPorTabla.set(t, []).get(t)!).push(Number(r.id));
            }
            const evidencias = new Map<string, Map<number, FilaLeida>>();
            for (const [t, ids] of idsPorTabla) evidencias.set(t, await cargarEvidencias(db, t, ids));
            return aplicarEvidencia(rows, porTabla, evidencias);
        },
    };
}
