import { parseInformacionRevision, queryRevisionVehiculosRows } from "../../reports-functions/revisionVehiculosReport";
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

/** Nombre de la estructura; la consulta original devuelve el id como texto si no encontró el nombre: eso no es un nombre. */
const place = (name: unknown, id: unknown): string | null => {
    const s = txt(name);
    if (s === null || s === "0") return null;
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

/** Valor de texto de un campo de «información general» (no firmas: esas son imágenes). */
function infoValue(items: any[], key: string): string | null {
    const it = items.find((x) => x && typeof x === "object" && x.kind !== "signature" && String(x.key ?? "").toLowerCase() === key);
    if (!it) return null;
    const v = String(it.value ?? "");
    // Un valor con aspecto de imagen o de archivo no se expone nunca.
    if (v.startsWith("data:") || /\.(png|jpe?g|gif|webp)$/i.test(v)) return null;
    return clip(v, 200);
}

/** Total de fotos adjuntas (solo el conteo; los nombres de archivo y las imágenes no se exponen). */
function countFotos(...lists: any[][]): number {
    let n = 0;
    for (const list of lists) for (const it of list) if (it && typeof it === "object" && Array.isArray(it.images)) n += it.images.length;
    return n;
}

/**
 * Revisión de vehículos (`c_bitacora_vehiculo_detenido`). Se omiten fotos, firmas (`firma_responsable` y las de los
 * oficiales) y los nombres de archivo; de las fotos queda el conteo.
 */
export function mapRevisionVehiculoRow(r: any): OutRow {
    const general = parseArr(r.informacion_general);
    const revision = parseInformacionRevision(r.informacion_revision);
    const vehiculo = r.vehiculo_id ? txt(r.vehiculo_txt) : null;
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        tipo: txt(r.tipo),
        vehiculo: vehiculo && vehiculo !== "—" && vehiculo !== String(r.vehiculo_id) ? vehiculo : null,
        placa: infoValue(general, "numero_placa"),
        marca: infoValue(general, "marca"),
        color: infoValue(general, "color"),
        kilometraje: infoValue(general, "km"),
        combustible: infoValue(general, "combustible"),
        empresa: place(r.empresa_txt, r.empresa_id),
        cliente: place(r.cliente_txt, r.cliente_id),
        division: place(r.division_txt, r.division_id),
        contrato: place(r.contrato_txt, r.contrato_id),
        sucursal: place(r.corpo_txt, r.sucursal_id),
        puesto: place(r.puesto_txt, r.puesto_id),
        observaciones: clip(r.observaciones),
        puntos_revisados: revision.filter((it: any) => it && typeof it === "object" && it.kind !== "heading" && it.kind !== "signature").length,
        movimientos: Number(r.movimientos_count) || 0,
        fotos: countFotos(general, revision),
    };
}

/**
 * Revisión de vehículos. Cada fila trae su ubicación completa en la estructura (empresa, cliente, división, contrato,
 * sucursal y puesto).
 */
export const revisionVehiculos: GuardifyReportModule = {
    id: "revision_vehiculos",
    supportsScope: true,
    searchKeys: ["vehiculo", "placa", "marca", "contrato", "sucursal", "puesto", "cliente", "observaciones"],
    filterKeys: ["tipo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "tipo", "vehiculo", "placa", "marca", "empresa", "cliente", "contrato", "sucursal", "puesto", "puntos_revisados", "movimientos", "fotos"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryRevisionVehiculosRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.sucursal_id, puesto: r.puesto_id }, scope));
        return kept.map(mapRevisionVehiculoRow);
    },
};
