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
export function mapEncuestaRow(r: any): OutRow {
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
        responsable: place(r.responsable_id, r.responsable_nombre) ?? txt(r.nombre_responsable),
        cedula_responsable: txt(r.cedula_responsable),
        evaluado: txt(r.nombre_evaluado),
        promedio,
        conoce_quejas: conoceQuejas,
        observaciones: clip(r.observaciones),
    };
}

/** Cada encuesta guarda los ids de empresa/cliente/división/contrato/corpo/puesto: se filtra directo por el alcance. */
export function filterEncuestasByScope(rows: any[], scope: ScopeItem[] | null): any[] {
    if (!scope) return rows;
    return rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
}

/** Encuestas de satisfacción. El periodo es sobre la fecha de creación del registro (`created_at`), como el filtro «creado» de la app. */
export const encuestaSatisfaccion: GuardifyReportModule = {
    id: "encuesta_satisfaccion",
    supportsScope: true,
    searchKeys: ["evaluado", "responsable", "cedula_responsable", "cliente", "sucursal", "puesto", "observaciones"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "conoce_quejas"],
    sortKeys: ["creado", "fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "evaluado", "promedio"],
    defaultSort: "creado",
    async load(db, p) {
        // Import perezoso: el módulo de consulta arrastra exceljs y Prisma, que no hacen falta para mapear ni para probar.
        const { queryEncuestaSatisfaccionRows } = await import("../../reports-functions/encuestaSatisfaccionReport");
        const rows = await queryEncuestaSatisfaccionRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha");
        return filterEncuestasByScope(rows, p.scope).map(mapEncuestaRow);
    },
};
