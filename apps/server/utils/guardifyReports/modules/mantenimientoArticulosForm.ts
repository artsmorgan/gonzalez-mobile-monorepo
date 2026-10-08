import type { ReportDataAccess } from "../../reportDynamicPrisma";
import { findByIds, ubicacionTextos } from "../enrich";
import type { FormRecord, GuardifyFormModule } from "../forms";
import { fmtDt } from "../mappers";
import { loadPuestoHierarchy, type Hierarchy } from "../scope";

/**
 * Mantenimiento de artículos como formulario (`c_articulo_mantenimiento`): un documento por mantenimiento. El formato cambia según lo que
 * guarda la pantalla «Actualizar mantenimiento» de la app: artículo general, vehículo (tiene kilometraje) o arma, que además lleva un
 * formulario propio (`mant_armas_form`, JSON) con su lista de chequeo preventiva o correctiva, el diagnóstico, el armero y su firma.
 * Los movimientos de entrega y recibo del artículo NO van aquí: son del reporte «Artículos del puesto».
 * Nunca se entregan fotos, archivos adjuntos ni sus nombres (tampoco `foto_antes_nombre` / `foto_despues_nombre` del arma).
 */
const MAX = 5000;
const txt = (v: unknown, max = MAX): string | null => {
    const s = String(v ?? "").trim();
    if (!s || esImagen(s)) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
/** ¿Parece una imagen incrustada? (nunca debe salir como texto) */
function esImagen(s: string): boolean {
    if (/^data:[a-z]+\/[^;,]+[;,]/i.test(s) || /^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|PHN2Zy)/.test(s)) return true;
    const head = s.slice(0, 200);
    return s.length > 1000 && /^[A-Za-z0-9+/=_-]+$/.test(head) && /[A-Z]/.test(head) && /[a-z]/.test(head) && /\d/.test(head);
}
const ymd = (v: unknown): string | null => { if (v == null || v === "") return null; return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) || null; };
const num = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const siNo = (v: unknown): string | null => (v === true || v === 1 ? "Sí" : v === false || v === 0 ? "No" : null);
/** Firma dibujada: solo si es una imagen (data URL o base64 pelado); una referencia local u otro texto no se entrega. */
const imagen = (v: unknown): string | null => {
    const s = String(v ?? "").trim();
    if (s.startsWith("data:image/")) return s;
    return /^[A-Za-z0-9+/=\s]{200,}$/.test(s) ? `data:image/png;base64,${s.replace(/\s+/g, "")}` : null;
};

export const V_GENERAL = "Artículo general";
export const V_VEHICULO = "Vehículo";
export const V_ARMA_PREV = "Arma (preventivo)";
export const V_ARMA_CORR = "Arma (correctivo)";

/** Las listas de chequeo de armas tal como las muestra la app (`ARMAS_PREVENTIVO_ITEMS` y `ARMAS_CORRECTIVO_ITEMS`): clave guardada → etiqueta. */
export const ARMAS_PREVENTIVO: [string, string][] = [
    ["remocion_corrosion", "Remoción de Corrosión"], ["limpieza_suciedad", "Limpieza de Suciedad"], ["revision_funcionamiento", "Revisión de Funcionamiento"],
    ["revision_func_disparador", "Disparador (Revolver y Pistola)"], ["revision_func_corredera", "Corredera (Pistola)"], ["revision_estetica_externa", "Revisión de Estética Externa"],
    ["revision_est_empunadura", "Empuñadura"], ["revision_est_tornillos", "Tornillos"], ["revision_est_mira_adelante", "Mira Adelante"], ["revision_est_mira_atras", "Mira Atrás"],
    ["revision_est_pasadores", "Pasadores"], ["revision_est_seguro", "Seguro"], ["lubricacion", "Lubricación"],
    ["lubricacion_percutor_extractor_pistola", "Percutor y Extractor (Pistola)"], ["lubricacion_percutor_union_cilindro_revolver", "Percutor y Unión con Cilindro (Revolver)"],
    ["lubricacion_cilindro_revolver", "Lubricación Cilindro (Revolver)"],
];
export const ARMAS_CORRECTIVO: [string, string][] = [
    ["desmontaje_completo_parte_mecanica", "Desmontaje completo Parte Mecánica"], ["disparador", "Disparador"], ["percutor", "Percutor"],
    ["conjuntos_internos_disparador", "Conjuntos Internos del Disparador"], ["pasadores", "Pasadores"], ["resortes", "Resortes"],
    ["conjuntos_empunadura", "Conjuntos de la Empuñadura"], ["pistola", "Pistola"], ["sistema_gas", "Sistema de Gas"], ["externo", "Externo"], ["mira", "Mira"],
];

const parseObj = (raw: unknown): any => {
    if (raw && typeof raw === "object") return raw;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : null; } catch { return null; }
};

/** Formato del registro: la app trata como arma lo que trae `mant_armas_form` válido, y como vehículo lo que tiene kilometraje. */
export function varianteDe(m: { tipo?: unknown; kilometraje?: unknown; mant_armas_form?: unknown }): string {
    const arma = parseObj(m.mant_armas_form);
    if (arma) {
        const tipo = String(m.tipo ?? arma?.mantenimiento?.tipo ?? "").trim().toLowerCase();
        return tipo.startsWith("correctivo") ? V_ARMA_CORR : V_ARMA_PREV;
    }
    return Number(m.kilometraje) > 0 ? V_VEHICULO : V_GENERAL;
}

/** Ítems de la lista de chequeo: los del formato (en orden) con «Realizado» si están marcados, más cualquier clave marcada que la app no conozca. */
function listaChequeo(items: [string, string][], checks: unknown): { clave: string; item: string; valor: string | null }[] {
    const c = checks && typeof checks === "object" ? (checks as Record<string, unknown>) : {};
    const conocidas = new Set(items.map(([k]) => k));
    const out = items.map(([clave, item]) => ({ clave, item, valor: c[clave] ? "Realizado" : null }));
    for (const [k, v] of Object.entries(c)) if (v && !conocidas.has(k)) out.push({ clave: k, item: k, valor: "Realizado" });
    return out;
}

export type MantenimientoRaw = {
    /** Fila de `c_articulo_mantenimiento`. */
    m: any;
    origen: "Plan" | "Asignado";
    articulo: string | null;
    hier: Hierarchy;
};

export function armarRegistro(raw: MantenimientoRaw, ubic: FormRecord["estructura"], firmas: boolean): FormRecord {
    const m = raw.m;
    const variante = varianteDe(m);
    const arma = parseObj(m.mant_armas_form);
    const car = arma?.caracteristicas ?? {};
    const mant = arma?.mantenimiento ?? arma ?? {};
    const creado = fmtDt(m.created_at);
    const actualizado = fmtDt(m.updated_at);
    const valores: FormRecord["valores"] = {
        articulo: raw.articulo ?? "Artículo inidentificable",
        origen: raw.origen,
        actualizado: actualizado ? actualizado.replace("T", " ").slice(0, 16) : null,
        estado: txt(m.estado, 55),
        cantidad_necesaria: num(m.cantidad_necesaria),
        cantidad_real: num(m.cantidad_real),
        observaciones: txt(m.observaciones),
        tipo: txt(m.tipo, 200),
        categoria: txt(m.categoria, 200),
        marca: txt(m.marca, 200),
        modelo: txt(m.modelo, 200),
        serie_placa: txt(m.serie_placa, 200),
        // La app marca «resuelto» cuando hay fecha de solución.
        resuelto: m.fecha_solucion ? "Sí" : "No",
        accion: txt(m.accion, 55),
        fecha_inicio: ymd(m.fecha_inicio),
        fecha_solucion: ymd(m.fecha_solucion),
        boleta_proveeduria: txt(m.numero_boleta_proveeduria, 200),
        tipo_mantenimiento: txt(m.tipo_mantenimiento_art, 200),
        categoria_mantenimiento: txt(m.categoria_mantinimiento, 200),
        marca_nuevo: txt(m.marca_nuevo, 200),
        modelo_nuevo: txt(m.modelo_nuevo, 200),
        serie_placa_nuevo: txt(m.serie_placa_nuevo, 200),
        kilometraje: num(m.kilometraje),
        fecha_salida: ymd(m.fecha_salida),
        fecha_entrada: ymd(m.fecha_entrada),
        detalle: txt(m.detalle),
        numero_fc: txt(m.numero_fc, 200),
        proveedor: txt(m.proveedor, 200),
        costo_mano_obra: num(m.costo_mo),
        costo_insumos: num(m.costo_i),
        iva: num(m.iva),
        costo_total: num(m.costo_total),
        fecha_fin: ymd(m.fecha_fin),
        reincidencia_30_dias: siNo(m.reincidencia_treinta_dias),
        tipo_mantenimiento_reincidencia: txt(m.tipo_mant_art_reincid, 200),
    };
    const listas: FormRecord["listas"] = {};
    const sign: Record<string, string> = {};
    if (arma) {
        Object.assign(valores, {
            arma_tipo: txt(car.tipo_arma, 100), arma_mecanismo: txt(car.mecanismo, 100), arma_marca: txt(car.marca, 200), arma_modelo: txt(car.modelo, 200),
            arma_serie: txt(car.serie, 200), arma_calibre: txt(car.calibre, 100), arma_cargador_adicional: car.cargador_adicional ? "Sí" : "No",
            arma_cargador_cantidad: txt(car.cargador_cantidad, 50), arma_capacidad_balas: txt(car.capacidad_balas, 50),
            arma_diagnostico: txt(arma.diagnostico), armero_nombre: txt(arma.armero_nombre, 200),
        });
        if (variante === V_ARMA_CORR) listas.correctivo = listaChequeo(ARMAS_CORRECTIVO, mant.correctivo);
        else listas.preventivo = listaChequeo(ARMAS_PREVENTIVO, mant.preventivo);
        const f = imagen(arma.firma);
        if (f) sign.firma_armero = f;
    }
    return {
        id: Number(m.id), variante, creado, estructura: ubic, valores, listas,
        firmas: Object.fromEntries(Object.keys(sign).map((k) => [k, firmas ? sign[k]! : null])),
        firmasPresentes: Object.keys(sign),
        hier: raw.hier,
    };
}

/** Ubicación por ids de la sucursal (artículos que se asignan a la sucursal y no a un puesto). */
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

export const mantenimientoArticulosForm: GuardifyFormModule = {
    async loadRecords(db: ReportDataAccess, ids, { firmas }) {
        const d = db as any;
        const mants: any[] = await d.c_articulo_mantenimiento.findMany({
            where: { id: { in: ids } },
            select: {
                id: true, articulo_plan_id: true, articulo_asignado_id: true, estado: true, cantidad_necesaria: true, cantidad_real: true, observaciones: true, fecha_solucion: true, accion: true,
                fecha_inicio: true, numero_boleta_proveeduria: true, tipo: true, marca: true, modelo: true, serie_placa: true, marca_nuevo: true, modelo_nuevo: true, serie_placa_nuevo: true,
                categoria: true, tipo_mantenimiento_art: true, fecha_salida: true, fecha_entrada: true, kilometraje: true, mant_armas_form: true, categoria_mantinimiento: true, detalle: true,
                numero_fc: true, proveedor: true, costo_mo: true, costo_i: true, iva: true, costo_total: true, fecha_fin: true, reincidencia_treinta_dias: true, tipo_mant_art_reincid: true,
                created_at: true, updated_at: true,
            },
        });
        if (!mants.length) return [];
        // El artículo (plan o asignado) de cada mantenimiento, con su nombre y dónde está.
        const planIds = mants.map((m) => m.articulo_plan_id).filter((x) => x != null);
        const entregaIds = mants.map((m) => m.articulo_asignado_id).filter((x) => x != null);
        const [planes, entregas] = await Promise.all([
            findByIds<any>(d, "e_estructura_articulo_corpo_puesto_plan", planIds, { puesto_id: true, corpo_id: true, articuloCP_id: true }),
            findByIds<any>(d, "e_estructura_articulo_corpo_puesto_entrega", entregaIds, { puesto_id: true, corpo_id: true, nomencladorArticuloCP_id: true }),
        ]);
        const nomencladores = await findByIds<any>(d, "n_articulo_corpo_puesto", [...[...planes.values()].map((p) => p.articuloCP_id), ...[...entregas.values()].map((e) => e.nomencladorArticuloCP_id)], { nombre: true });
        const articuloDe = (m: any): { origen: "Plan" | "Asignado"; puesto_id: number; corpo_id: number; nomenclador: number } | null => {
            if (m.articulo_plan_id != null) { const a = planes.get(Number(m.articulo_plan_id)); return a ? { origen: "Plan", puesto_id: Number(a.puesto_id), corpo_id: Number(a.corpo_id), nomenclador: Number(a.articuloCP_id) } : null; }
            const a = entregas.get(Number(m.articulo_asignado_id));
            return a ? { origen: "Asignado", puesto_id: Number(a.puesto_id), corpo_id: Number(a.corpo_id), nomenclador: Number(a.nomencladorArticuloCP_id) } : null;
        };
        const items = mants.map((m) => ({ m, art: articuloDe(m) })).filter((x): x is { m: any; art: NonNullable<ReturnType<typeof articuloDe>> } => x.art !== null);
        // Igual que la lista: un puesto dado de baja deja fuera sus artículos.
        const puestos = await findByIds<any>(d, "e_estructura_puesto", items.map((x) => x.art.puesto_id), { deleted: true });
        const vivos = items.filter((x) => !(x.art.puesto_id > 0) || (puestos.has(x.art.puesto_id) && puestos.get(x.art.puesto_id).deleted == null));
        const [hierPuesto, hierCorpo] = await Promise.all([
            loadPuestoHierarchy(d, vivos.map((x) => x.art.puesto_id).filter((n) => n > 0)),
            jerarquiaCorpos(d, vivos.filter((x) => !(x.art.puesto_id > 0)).map((x) => x.art.corpo_id).filter((n) => n > 0)),
        ]);
        const hierDe = (a: { puesto_id: number; corpo_id: number }): Hierarchy => (a.puesto_id > 0 ? hierPuesto.get(a.puesto_id) : hierCorpo.get(a.corpo_id)) ?? {};
        const ubic = await ubicacionTextos(d, vivos.map((x) => hierDe(x.art)));
        return vivos.map(({ m, art }) => {
            const hier = hierDe(art);
            return armarRegistro({ m, origen: art.origen, articulo: nomencladores.get(art.nomenclador)?.nombre ?? null, hier }, ubic(hier), firmas);
        });
    },
};
