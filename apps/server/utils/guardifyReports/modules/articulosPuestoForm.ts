import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { ejecutivoPorCorpo, findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Artículos del puesto como formulario: un documento por artículo (la fila de la lista), con sus movimientos de entrega y recibo.
 *
 * Hay dos formatos: «Plan» (lo que el puesto debe tener: cantidad y combo) y «Asignado» (lo entregado: marca, modelo, serie y fecha de
 * entrega). El id de la fila es el del registro en SU tabla (plan o entrega), y las dos tablas numeran por separado: si un id existe
 * en ambas se entregan los dos registros. Las firmas del papel son las del ÚLTIMO movimiento del artículo.
 * Nunca se entrega la firma del responsable (es un código de sesión con ubicación, no una imagen): solo se informa si existe.
 */
const txt = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s ? s : null; };
const ymd = (v: unknown): string | null => { if (v == null || v === "") return null; return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) || null; };
const hhmm = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    const m = /(?:T|^|\s)(\d{2}):(\d{2})/.exec(v instanceof Date ? v.toISOString() : String(v));
    return m ? `${m[1]}:${m[2]}` : null;
};
/** La firma dibujada es una imagen (data URL o base64 pelado); cualquier otra cosa no se entrega. */
const imagen = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{200,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
};

export type ArticuloRaw = {
    origen: "Plan" | "Asignado";
    id: number;
    articulo: string | null;
    cantidad: number | null;
    combo: string | null;
    marca: string | null;
    modelo: string | null;
    serie: string | null;
    fecha_entrega: Date | string | null;
    ejecutivo: string | null;
    /** Movimientos del artículo, del más antiguo al más reciente. */
    movimientos: any[];
    hier: Hierarchy;
};

export function armarRegistro(raw: ArticuloRaw, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const asignado = raw.origen === "Asignado";
    const movimientos = raw.movimientos.map((m) => ({
        persona_entrega: txt(m.nombre_persona_entrega), persona_recibe: txt(m.nombre_persona_recibe), departamento: txt(m.departamento), telefono: txt(m.telefono),
        entrega: txt(m.entrega), recibe: txt(m.recibe), fecha: ymd(m.fecha), hora: hhmm(m.hora),
    }));
    const ultimo = raw.movimientos[raw.movimientos.length - 1];
    const sign: Record<string, string | null> = {};
    if (ultimo) {
        const e = imagen(ultimo.firma_entrega), r = imagen(ultimo.firma_recibe);
        if (e) sign.firma_entrega = e;
        if (r) sign.firma_recibe = r;
        if (txt(ultimo.firma_responsable)) sign.firma_responsable = null; // existe, pero no es una imagen y no se entrega
    }
    return {
        id: raw.id,
        variante: raw.origen,
        // El artículo no guarda cuándo se registró; el asignado tiene su fecha de entrega.
        creado: asignado ? (ymd(raw.fecha_entrega) ? `${ymd(raw.fecha_entrega)}T${hhmm(raw.fecha_entrega) ?? "00:00"}:00` : null) : null,
        estructura: ubic,
        valores: {
            articulo: raw.articulo ?? "Artículo inidentificable",
            origen: raw.origen,
            cantidad: asignado ? null : raw.cantidad,
            combo: asignado ? null : txt(raw.combo),
            marca: asignado ? txt(raw.marca) : null,
            modelo: asignado ? txt(raw.modelo) : null,
            serie: asignado ? txt(raw.serie) : null,
            fecha_entrega: asignado ? ymd(raw.fecha_entrega) : null,
            hora_entrega: asignado ? hhmm(raw.fecha_entrega) : null,
            ejecutivo_cuenta: txt(raw.ejecutivo),
        },
        listas: { movimientos },
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? (sign[k] ?? null) : null])),
        firmasPresentes: Object.keys(sign),
        hier: raw.hier,
    };
}

/** Ubicación por ids de la sucursal (para los artículos que se asignan a la sucursal y no a un puesto). */
async function jerarquiaCorpos(db: any, corpoIds: number[]): Promise<Map<number, Hierarchy>> {
    const out = new Map<number, Hierarchy>();
    if (!corpoIds.length) return out;
    const corpos = await findByIds<any>(db, "e_estructura_sucursal", corpoIds, { contrato_id: true });
    const contratos = await findByIds<any>(db, "e_estructura_contrato", [...corpos.values()].map((c) => c.contrato_id), { cliente_id: true, empresa_id: true, division_id: true });
    for (const [id, c] of corpos) {
        const k = contratos.get(Number(c.contrato_id));
        out.set(id, { corpo: id, contrato: k ? Number(k.id) : null, cliente: k?.cliente_id != null ? Number(k.cliente_id) : null, empresa: k?.empresa_id != null ? Number(k.empresa_id) : null, division: k?.division_id != null ? Number(k.division_id) : null });
    }
    return out;
}

export const articulosPuestoForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const d = db as any;
        const [planes, entregas] = await Promise.all([
            d.e_estructura_articulo_corpo_puesto_plan.findMany({ where: { id: { in: ids } }, select: { id: true, puesto_id: true, corpo_id: true, cantidad: true, articuloCP_id: true, combo_id: true } }),
            d.e_estructura_articulo_corpo_puesto_entrega.findMany({ where: { id: { in: ids } }, select: { id: true, puesto_id: true, corpo_id: true, marca: true, modelo: true, serie: true, fechaEntrega: true, nomencladorArticuloCP_id: true } }),
        ]);
        if (!planes.length && !entregas.length) return [];
        const [nomencladores, combos] = await Promise.all([
            findByIds<any>(d, "n_articulo_corpo_puesto", [...planes.map((p: any) => p.articuloCP_id), ...entregas.map((e: any) => e.nomencladorArticuloCP_id)], { nombre: true }),
            findByIds<any>(d, "e_estructura_combo_articulo_cp", planes.map((p: any) => p.combo_id), { nombre: true }),
        ]);
        // Movimientos de todos los artículos en una sola consulta (sin la firma del responsable: solo si existe).
        const or: any[] = [];
        if (planes.length) or.push({ articulo_plan_id: { in: planes.map((p: any) => Number(p.id)) } });
        if (entregas.length) or.push({ articulo_asignado_id: { in: entregas.map((e: any) => Number(e.id)) } });
        const movs: any[] = await d.c_movimientos_articulo_mantenimiento.findMany({
            where: { OR: or }, orderBy: { id: "asc" },
            select: { id: true, articulo_plan_id: true, articulo_asignado_id: true, nombre_persona_recibe: true, nombre_persona_entrega: true, departamento: true, telefono: true, entrega: true, recibe: true, fecha: true, hora: true, firma_entrega: true, firma_recibe: true, firma_responsable: true },
        });
        const movsPlan = new Map<number, any[]>(), movsEntrega = new Map<number, any[]>();
        for (const m of movs) {
            if (m.articulo_plan_id) movsPlan.set(Number(m.articulo_plan_id), [...(movsPlan.get(Number(m.articulo_plan_id)) ?? []), m]);
            if (m.articulo_asignado_id) movsEntrega.set(Number(m.articulo_asignado_id), [...(movsEntrega.get(Number(m.articulo_asignado_id)) ?? []), m]);
        }
        // Dónde está cada artículo: su puesto o, si es de la sucursal, la sucursal. Un plan de combo sin ninguno no se puede ubicar.
        const todos = [...planes, ...entregas];
        const puestoIds = todos.map((a: any) => Number(a.puesto_id)).filter((n) => n > 0);
        const corpoSueltos = todos.filter((a: any) => !(Number(a.puesto_id) > 0)).map((a: any) => Number(a.corpo_id)).filter((n) => n > 0);
        const [hierPuesto, hierCorpo] = await Promise.all([loadPuestoHierarchy(d, puestoIds), jerarquiaCorpos(d, corpoSueltos)]);
        const hierDe = (a: any): Hierarchy => (Number(a.puesto_id) > 0 ? hierPuesto.get(Number(a.puesto_id)) : hierCorpo.get(Number(a.corpo_id))) ?? {};
        const ubic = await ubicacionTextos(d, todos.map(hierDe));
        const ejecutivos = await ejecutivoPorCorpo(d, todos.map((a: any) => hierDe(a).corpo));

        const base = (a: any) => ({ hier: hierDe(a), ejecutivo: ejecutivos.get(Number(hierDe(a).corpo)) ?? null });
        const out: FormRecord[] = [];
        for (const p of planes) {
            const raw: ArticuloRaw = {
                origen: "Plan", id: Number(p.id), articulo: nomencladores.get(Number(p.articuloCP_id))?.nombre ?? null, cantidad: p.cantidad ?? null,
                combo: combos.get(Number(p.combo_id))?.nombre ?? null, marca: null, modelo: null, serie: null, fecha_entrega: null,
                movimientos: movsPlan.get(Number(p.id)) ?? [], ...base(p),
            };
            out.push(armarRegistro(raw, ubic(raw.hier), firmas));
        }
        for (const e of entregas) {
            const raw: ArticuloRaw = {
                origen: "Asignado", id: Number(e.id), articulo: nomencladores.get(Number(e.nomencladorArticuloCP_id))?.nombre ?? null, cantidad: 1, combo: null,
                marca: e.marca ?? null, modelo: e.modelo ?? null, serie: e.serie ?? null, fecha_entrega: e.fechaEntrega ?? null,
                movimientos: movsEntrega.get(Number(e.id)) ?? [], ...base(e),
            };
            out.push(armarRegistro(raw, ubic(raw.hier), firmas));
        }
        return out;
    },
};
