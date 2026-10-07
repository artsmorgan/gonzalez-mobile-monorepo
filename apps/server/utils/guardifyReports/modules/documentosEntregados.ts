import { normalizeDocumentosEntregadosFilters, queryDocumentosEntregadosRows } from "../../reports-functions/documentosEntregadosReport";
import type { OutRow } from "../listing";
import { ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";

const txt = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    return s ? s : null;
};
const short = (v: unknown, max = 500): string | null => {
    const s = txt(v);
    return s ? s.slice(0, max) : null;
};
/** La consulta original rellena con el id cuando no encuentra el nombre (y los registros viejos traen 0): se expone como vacío. */
const nameOrNull = (v: unknown, id: unknown): string | null => {
    const s = txt(v);
    return !s || s === "0" || s === String(id) ? null : s;
};
const day = (d: unknown): string | null => {
    const s = fmtDt(d as any);
    return s ? `${s.slice(0, 10)}T00:00:00` : null;
};

/**
 * Documentos entregados al cliente. Nunca expone las firmas (`firma_representante_cliente`, `firma_responsable`).
 * `ejecutivo` es el ejecutivo de cuenta de la sucursal; `usuario` quien registró el documento (ver `usuariosQueRegistraron`).
 */
export function mapDocumentoEntregadoRow(r: any, ejecutivo?: string | null, usuario?: string | null): OutRow {
    return {
        id: Number(r.id),
        fecha: day(r.fecha),
        empresa: nameOrNull(r.empresa_nombre, r.empresa_id),
        cliente: nameOrNull(r.cliente_nombre, r.cliente_id),
        division: nameOrNull(r.division_nombre, r.division_id),
        contrato: nameOrNull(r.contrato_nombre, r.contrato_id),
        sucursal: nameOrNull(r.corpo_nombre, r.corpo_id),
        puesto: nameOrNull(r.puesto_nombre, r.puesto_id),
        tipo_documento: txt(r.tipo_documento),
        oficial_entrega: txt(r.nombre_oficial_entrega),
        oficial_recibe: txt(r.nombre_oficial_recibe),
        descripcion: short(r.descripcion),
        ejecutivo_cuenta: txt(ejecutivo),
        usuario_inserta: txt(usuario),
    };
}

const TABLA = "e_control_documento_entregado_cliente";

/**
 * Quién registró cada documento. La tabla no guarda `created_by`: el alta queda en el historial de cambios (`c_cambios_apps_modules`,
 * entrada `__created__`, con `created_by` = empleado que lo registró). Los documentos anteriores al historial no lo tienen (null).
 * Una consulta por bloque de 1000 ids (sin traer el contenido de `cambios`, que incluye las firmas) + un lote de empleados.
 */
async function usuariosQueRegistraron(db: any, ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    const unicos = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
    if (!unicos.length) return out;
    const creador = new Map<number, unknown>();
    try {
        for (let i = 0; i < unicos.length; i += 1000) {
            const filas = await db.c_cambios_apps_modules.findMany({
                where: { nombre_tabla: TABLA, registro_id: { in: unicos.slice(i, i + 1000) }, cambios: { contains: "__created__" } },
                select: { registro_id: true, created_by: true, created_at: true },
                orderBy: { created_at: "asc" },
            });
            for (const f of filas) if (!creador.has(Number(f.registro_id))) creador.set(Number(f.registro_id), f.created_by);
        }
        const nombres = await nombresEmpleado(db, [...creador.values()]);
        for (const [id, raw] of creador) {
            const nombre = usuarioInserta(raw, nombres);
            if (nombre) out.set(id, nombre);
        }
    } catch (e) {
        // El historial es un dato complementario: si no se puede leer, el reporte sigue sin la columna `usuario_inserta`.
        console.warn("[guardifyReports] documentos_entregados: no se pudo leer el historial de altas", (e as Error)?.message);
        return new Map();
    }
    return out;
}

/**
 * Documentos entregados (`e_control_documento_entregado_cliente`). Las filas traen los ids de su ubicación en la estructura. El periodo
 * se aplica a `fecha` (la «Fecha» del Excel, solo fecha).
 */
export const documentosEntregados: GuardifyReportModule = {
    id: "documentos_entregados",
    supportsScope: true,
    searchKeys: ["cliente", "sucursal", "puesto", "tipo_documento", "oficial_entrega", "oficial_recibe", "descripcion", "usuario_inserta"],
    filterKeys: ["tipo_documento", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "ejecutivo_cuenta", "usuario_inserta"],
    sortKeys: ["fecha", "empresa", "cliente", "contrato", "sucursal", "puesto", "tipo_documento", "oficial_entrega", "oficial_recibe", "ejecutivo_cuenta", "usuario_inserta"],
    defaultSort: "fecha",
    async load(db, p) {
        const filters = normalizeDocumentosEntregadosFilters({ creadoDesde: `${addDays(p.from, -1)}T00:00:00`, creadoHasta: `${p.to}T23:59:59` });
        const rows = await queryDocumentosEntregadosRows(db, filters, "fecha");
        const scope = p.scope;
        const kept = rows
            .filter((r: any) => {
                const d = day(r.fecha)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter((r: any) => !scope || matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        const [ejecutivos, usuarios] = await Promise.all([ejecutivoPorCorpo(db, kept.map((r: any) => r.corpo_id)), usuariosQueRegistraron(db, kept.map((r: any) => Number(r.id)))]);
        return kept.map((r: any) => mapDocumentoEntregadoRow(r, ejecutivos.get(Number(r.corpo_id)), usuarios.get(Number(r.id))));
    },
};
