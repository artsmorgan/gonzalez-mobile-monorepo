import { divisionPorContrato, ejecutivoPorCorpo, findByIds } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope, type ScopeItem } from "../scope";
import type { GuardifyReportModule } from "../types";

const MAX_TEXT = 500;

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const clip = (v: unknown): string | null => {
    const s = txt(v);
    return s && s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s;
};
/** El reporte rellena el nombre con el id cuando no encuentra el registro (o con "0"): eso no es un nombre. */
const place = (id: unknown, name: unknown): string | null => {
    const s = txt(name);
    return !s || s === String(id ?? "") ? null : s;
};

/** «código - nombre» (solo el nombre si no hay código; solo el código si no hay nombre o el «nombre» es el propio código). */
const conCodigo = (codigo: unknown, nombre: unknown): string | null => {
    const c = txt(codigo);
    const n = txt(nombre);
    if (!c) return n;
    if (!n || n === c || n.startsWith(`${c} - `)) return c;
    return `${c} - ${n}`;
};

/** Datos que no vienen en la fila y se cargan por lote: ejecutivo de la sucursal, código del evaluado y del evaluador, y división del contrato. */
export type EvaluacionExtra = { ejecutivo?: string | null; empleadoCodigo?: string | null; evaluadorCodigo?: string | null; divisionContrato?: string | null };

/** `evaluacion`: `[{ title, questions }]` o `{ questions }` (a veces doblemente codificado) → lista de preguntas. */
function preguntasDe(raw: unknown): any[] {
    let v: any = raw;
    for (let i = 0; i < 2 && typeof v === "string"; i++) {
        try {
            v = JSON.parse(v);
        } catch {
            return [];
        }
    }
    if (v && !Array.isArray(v) && Array.isArray(v.questions)) return v.questions;
    if (!Array.isArray(v)) return [];
    return v.flatMap((sec: any) => (sec && Array.isArray(sec.questions) ? sec.questions : []));
}

/** Cantidad de preguntas y promedio (escala 1 a 10) de las que tienen una calificación numérica. */
export function resumenEvaluacion(raw: unknown): { preguntas: number; promedio: number | null } {
    const qs = preguntasDe(raw);
    const vals: number[] = [];
    for (const q of qs) {
        const a = String(q?.answear ?? "").trim();
        const n = Number(a);
        if (a !== "" && Number.isFinite(n) && n >= 1 && n <= 10) vals.push(n);
    }
    return { preguntas: qs.length, promedio: vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 100) / 100 : null };
}

/**
 * Evaluación de personal (`c_evaluacion_empleado`) a fila plana. Se omiten a propósito las firmas, las imágenes de las
 * preguntas y el detalle de cada respuesta: solo la cantidad de preguntas y el promedio.
 */
export function mapEvaluacionPersonalRow(r: any, x: EvaluacionExtra = {}): OutRow {
    const { preguntas, promedio } = resumenEvaluacion(r.evaluacion);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_evaluacion: fmtDt(r.fecha_evaluacion),
        empresa: place(r.empresa_id, r.empresa_nombre),
        cliente: place(r.cliente_id, r.cliente_nombre),
        division: place(r.division_id, r.division_nombre) ?? txt(x.divisionContrato),
        contrato: place(r.contrato_id, r.contrato_nombre),
        sucursal: place(r.corpo_id, r.corpo_nombre),
        puesto: place(r.puesto_id, r.puesto_nombre),
        tipo: txt(r.tipo),
        empleado: conCodigo(x.empleadoCodigo, r.nombre_empleado),
        cedula: txt(r.cedula_empleado),
        evaluador: conCodigo(x.evaluadorCodigo, r.nombre_evaluador),
        promedio,
        preguntas,
        comentarios: clip(r.comentarios),
        ejecutivo_cuenta: txt(x.ejecutivo),
    };
}

/**
 * Datos por lote (sin consultas por fila): ejecutivo de cuenta de cada sucursal, código de empleado del evaluado y del evaluador (para
 * «código - nombre») y, cuando la evaluación no guardó la división (quedó en 0), la división del contrato.
 */
export async function mapEvaluacionesConExtras(db: any, rows: any[]): Promise<OutRow[]> {
    const ejecutivos = await ejecutivoPorCorpo(db, rows.map((r) => r.corpo_id));
    const empleados = await findByIds<{ codigo?: string | null }>(db, "c_empleado", rows.flatMap((r) => [r.empleado_id, r.evaluador_id]), { codigo: true });
    const sinDivision = rows.filter((r) => !place(r.division_id, r.division_nombre));
    const divisiones = await divisionPorContrato(db, sinDivision.map((r) => r.contrato_id));
    return rows.map((r) =>
        mapEvaluacionPersonalRow(r, {
            ejecutivo: ejecutivos.get(Number(r.corpo_id)) ?? null,
            empleadoCodigo: txt(empleados.get(Number(r.empleado_id))?.codigo),
            evaluadorCodigo: txt(empleados.get(Number(r.evaluador_id))?.codigo),
            divisionContrato: divisiones.get(Number(r.contrato_id)) ?? null,
        }),
    );
}

/** Cada evaluación guarda los ids de empresa/cliente/división/contrato/corpo/puesto: se filtra directo por el alcance. */
export function filterEvaluacionesByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Evaluación de personal. El periodo es sobre la fecha de creación del registro (`created_at`): es la «Fecha» del Excel y el filtro
 * «Creado desde/hasta» de la app (la columna `creado`). «Puesto evaluado» es el puesto (de la estructura) donde se evaluó: la columna `puesto`.
 */
export const evaluacionPersonal: GuardifyReportModule = {
    id: "evaluacion_personal",
    supportsScope: true,
    searchKeys: ["empleado", "cedula", "evaluador", "puesto", "sucursal", "comentarios"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "tipo", "evaluador", "ejecutivo_cuenta"],
    sortKeys: ["creado", "fecha_evaluacion", "empresa", "cliente", "contrato", "sucursal", "puesto", "tipo", "empleado", "cedula", "evaluador", "promedio", "preguntas", "ejecutivo_cuenta"],
    defaultSort: "creado",
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryEvaluacionEmpleadoRows } = await import("../../reports-functions/evaluacionEmpleadoReport");
        const rows = await queryEvaluacionEmpleadoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        return mapEvaluacionesConExtras(db, filterEvaluacionesByScope(rows, p.scope));
    },
};
