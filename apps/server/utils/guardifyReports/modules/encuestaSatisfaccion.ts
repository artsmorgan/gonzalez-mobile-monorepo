import { ejecutivoPorCorpo, findByIds } from "../enrich";
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
/** El reporte rellena el nombre con el id cuando no encuentra el registro: eso no es un nombre. */
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

/** Datos que no vienen en la fila de la encuesta y se cargan por lote: ejecutivo de cuenta de la sucursal y código del responsable. */
export type EncuestaExtra = { ejecutivo?: string | null; responsableCodigo?: string | null };

/** En la app, `apply` ausente significa que la pregunta aplica. */
function applies(raw: unknown): boolean {
    if (raw === undefined || raw === null) return true;
    if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        return !(s === "false" || s === "0");
    }
    return Boolean(raw);
}

/** JSON de `evaluaciones`: `{ form: [{ questions }], know_process }` o legado `[{ question, value|result }]` (a veces doblemente codificado). */
function parseEvaluaciones(raw: unknown): unknown {
    let v: unknown = raw;
    for (let i = 0; i < 2 && typeof v === "string"; i++) {
        try {
            v = JSON.parse(v);
        } catch {
            return null;
        }
    }
    return v;
}

const asBool = (v: unknown): boolean => (typeof v === "string" ? ["true", "1", "sí", "si"].includes(v.trim().toLowerCase()) : Boolean(v));

/** Promedio (1 a 5) de las preguntas que aplican, y si la persona conoce el procedimiento de quejas (solo formato nuevo). */
export function resumenEvaluaciones(raw: unknown): { promedio: number | null; conoceQuejas: "Sí" | "No" | null } {
    const d: any = parseEvaluaciones(raw);
    const vals: number[] = [];
    const take = (v: unknown) => {
        const n = Number(v);
        if (v !== null && v !== "" && v !== undefined && Number.isFinite(n) && n >= 1 && n <= 5) vals.push(n);
    };
    let conoce: "Sí" | "No" | null = null;
    if (d && !Array.isArray(d) && Array.isArray(d.form)) {
        conoce = asBool(d.know_process) ? "Sí" : "No";
        for (const sec of d.form) {
            const qs = Array.isArray(sec?.questions) ? sec.questions : [];
            for (const q of qs) if (q && applies(q.apply)) take(q.value);
        }
    } else if (Array.isArray(d)) {
        for (const it of d) if (it && typeof it === "object") take((it as any).result ?? (it as any).value);
    }
    return { promedio: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null, conoceQuejas: conoce };
}

/**
 * Encuesta de satisfacción del cliente (`c_encuesta_cliente`) a fila plana. Se omiten a propósito las firmas, el correo, el
 * teléfono y la cédula de la persona evaluada (es personal del cliente) y el detalle de las preguntas: solo el promedio.
 */
export function mapEncuestaRow(r: any, x: EncuestaExtra = {}): OutRow {
    const { promedio, conoceQuejas } = resumenEvaluaciones(r.evaluaciones);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha: fmtDt(r.fecha),
        empresa: place(r.empresa_id, r.empresa_nombre),
        cliente: place(r.cliente_id, r.cliente_nombre),
        division: place(r.division_id, r.division_nombre),
        contrato: place(r.contrato_id, r.contrato_nombre),
        sucursal: place(r.corpo_id, r.corpo_nombre),
        puesto: place(r.puesto_id, r.puesto_nombre),
        responsable: conCodigo(x.responsableCodigo, place(r.responsable_id, r.responsable_nombre) ?? txt(r.nombre_responsable)),
        cedula_responsable: txt(r.cedula_responsable),
        evaluado: txt(r.nombre_evaluado),
        promedio,
        conoce_quejas: conoceQuejas,
        observaciones: clip(r.observaciones),
        ejecutivo_cuenta: txt(x.ejecutivo),
    };
}

/**
 * Datos por lote (sin consultas por fila): ejecutivo de cuenta de cada sucursal (`ejecutivoPorCorpo`) y código de cada responsable
 * (`c_empleado.codigo`, para mostrar «código - nombre»). Devuelve cada fila ya mapeada.
 */
export async function mapEncuestasConExtras(db: any, rows: any[]): Promise<OutRow[]> {
    const ejecutivos = await ejecutivoPorCorpo(db, rows.map((r) => r.corpo_id));
    const responsables = await findByIds<{ codigo?: string | null }>(db, "c_empleado", rows.map((r) => r.responsable_id), { codigo: true });
    return rows.map((r) => mapEncuestaRow(r, { ejecutivo: ejecutivos.get(Number(r.corpo_id)) ?? null, responsableCodigo: txt(responsables.get(Number(r.responsable_id))?.codigo) }));
}

/** Cada encuesta guarda los ids de empresa/cliente/división/contrato/corpo/puesto: se filtra directo por el alcance. */
export function filterEncuestasByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/**
 * Encuestas de satisfacción. El periodo es sobre la fecha de creación del registro (`created_at`): es la «Fecha» del Excel y el filtro
 * «Creado desde/hasta» de la app (la columna `creado`).
 */
export const encuestaSatisfaccion: GuardifyReportModule = {
    id: "encuesta_satisfaccion",
    supportsScope: true,
    searchKeys: ["evaluado", "responsable", "cedula_responsable", "cliente", "sucursal", "puesto", "observaciones"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "conoce_quejas", "responsable", "ejecutivo_cuenta"],
    sortKeys: ["creado", "fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "evaluado", "promedio", "ejecutivo_cuenta"],
    defaultSort: "creado",
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryEncuestaSatisfaccionRows } = await import("../../reports-functions/encuestaSatisfaccionReport");
        const rows = await queryEncuestaSatisfaccionRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        return mapEncuestasConExtras(db, filterEncuestasByScope(rows, p.scope));
    },
};
