import { queryRegistroInduccionGeneralRows } from "../../reports-functions/registroInduccionGeneralReport";
import { getCheckedTemaIds } from "../../reports-functions/registroInduccionGeneralTemas";
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

/** «Nombre (cédula); …», recortado. Nunca incluye la firma de la persona. */
function personas(raw: unknown): { n: number; nombres: string | null } {
    const arr = parseArr(raw);
    const parts = arr
        .map((p: any) => {
            const nombre = txt(p?.nombre ?? p?.nombre_completo);
            const cedula = txt(p?.cedula);
            return nombre && cedula ? `${nombre} (${cedula})` : nombre ?? cedula;
        })
        .filter((x): x is string => !!x);
    return { n: arr.length, nombres: clip(parts.join("; ")) };
}

/** Registro de inducción general. Se omiten `firma_responsable` y las firmas de colaboradores y capacitadores. */
export function mapInduccionGeneralRow(r: any): OutRow {
    const colab = personas(r.colaboradores);
    const cap = personas(r.capacitadores);
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha: fmtDt(r.fecha),
        empresa: place(r.empresa_nombre, r.empresa_id),
        cliente: place(r.cliente_nombre, r.cliente_id),
        division: place(r.division_nombre, r.division_id),
        contrato: place(r.contrato_nombre, r.contrato_id),
        sucursal: place(r.corpo_nombre, r.corpo_id),
        puesto: place(r.puesto_nombre, r.puesto_id),
        responsable: txt(r.empleado_creador_nombre),
        temas_marcados: getCheckedTemaIds(typeof r.temas_a_tratar === "string" ? r.temas_a_tratar : r.temas_a_tratar == null ? null : JSON.stringify(r.temas_a_tratar)).size,
        colaboradores: colab.n,
        nombres_colaboradores: colab.nombres,
        capacitadores: cap.n,
        nombres_capacitadores: cap.nombres,
    };
}

/** Registro de inducción general (`c_registro_induccion_general`). Cada fila trae su ubicación completa en la estructura. */
export const registroInduccionGeneral: GuardifyReportModule = {
    id: "registro_induccion_general",
    supportsScope: true,
    searchKeys: ["responsable", "nombres_colaboradores", "nombres_capacitadores", "contrato", "sucursal", "puesto", "cliente"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "responsable", "temas_marcados", "colaboradores", "capacitadores"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryRegistroInduccionGeneralRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r: any) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        return kept.map(mapInduccionGeneralRow);
    },
};
