import { queryInduccionRecorridoRows } from "../../reports-functions/induccionRecorridoReport";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};

/** Texto libre largo: máximo 500 caracteres. */
const clip = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    if (s === null) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/** Nombre de la estructura; si la consulta original no lo encontró devuelve el id como texto (o «0»/vacío): eso no es un nombre. */
const place = (name: unknown, id: unknown): string | null => {
    const s = txt(name);
    if (s === null || s === "0" || s === "undefined" || s === "null") return null;
    if (id != null && s === String(id)) return null;
    return s;
};

function parseArr(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

const joinTxt = (items: unknown[]): string | null => clip(items.map((x) => txt(x)).filter(Boolean).join("; "));

/**
 * Registro de inducción y recorrido. Nunca se exponen las firmas (`firma_supervisor`, `firma_responsable` ni la de
 * cada participante).
 */
export function mapInduccionRecorridoRow(r: any): OutRow {
    const temas = parseArr(r.temas_desarrollados);
    const aspectos = parseArr(r.aspectos_especificos);
    const participantes = parseArr(r.participantes);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_visita: fmtDt(r.fecha),
        empresa: place(r.empresa_nombre, r.empresa_id),
        cliente: place(r.cliente_nombre, r.cliente_id),
        division: place(r.division_nombre, r.division_id),
        contrato: place(r.contrato_nombre, r.contrato_id),
        sucursal: place(r.corpo_nombre, r.corpo_id),
        puesto: place(r.puesto_nombre, r.puesto_id),
        plaza: place(r.plaza_nombre, r.plaza_id),
        renglon_edificio: clip(r.renglon_edificio),
        supervisor_cliente: clip(r.supervisor_cliente),
        supervisor_corporacion: clip(r.supervisor_corporacion),
        responsable: txt(r.created_by_nombre),
        temas: joinTxt(temas.map((t: any) => t?.tema)),
        aspectos: joinTxt(aspectos.map((a: any) => a?.aspecto)),
        participantes: participantes.length,
        nombres_participantes: joinTxt(
            participantes.map((p: any) => {
                const n = txt(p?.nombre_completo);
                const c = txt(p?.cedula);
                return n && c ? `${n} (${c})` : n ?? c;
            }),
        ),
    };
}

/** Registro de inducción y recorrido (`c_registro_induccion_recorrido`). Cada fila trae su ubicación completa en la estructura. */
export const registroInduccionRecorrido: GuardifyReportModule = {
    id: "registro_induccion_recorrido",
    supportsScope: true,
    searchKeys: ["responsable", "nombres_participantes", "supervisor_cliente", "supervisor_corporacion", "contrato", "sucursal", "puesto", "cliente"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "fecha_visita", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "participantes"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryInduccionRecorridoRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        return kept.map(mapInduccionRecorridoRow);
    },
};
