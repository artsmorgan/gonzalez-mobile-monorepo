import { queryProductoNoConformeRows } from "../../reports-functions/productoNoConformeReport";
import { ejecutivoPorCorpo, findByIds } from "../enrich";
import type { OutRow } from "../listing";
import { fmtDt } from "../mappers";
import { addDays } from "../params";
import { buildNombre } from "../names";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { productoNoConformeForm } from "./productoNoConformeForm";

const MAX_TEXT = 500;

/** ¿Parece una imagen incrustada (data URI o base64 largo)? */
function esImagen(s: string): boolean {
    if (/^data:[a-z]+\/[^;,]+[;,]/i.test(s) || /^(iVBORw0KGgo|\/9j\/|R0lGOD|UklGR|PHN2Zy)/.test(s)) return true;
    const head = s.slice(0, 200);
    return s.length > 1000 && /^[A-Za-z0-9+/=_-]+$/.test(head) && /[A-Z]/.test(head) && /[a-z]/.test(head) && /\d/.test(head);
}

/** Texto libre recortado a 500 caracteres; descarta lo que parezca una imagen/base64. */
function text(v: unknown, max = MAX_TEXT): string | null {
    const s = String(v ?? "").trim();
    if (!s) return null;
    if (esImagen(s)) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Nombre de un nodo de la estructura (la consulta devuelve el id como texto si no lo encuentra: eso no es un nombre). */
function nodo(nombre: unknown, id: unknown): string | null {
    if (!(Number(id) > 0)) return null;
    const t = text(nombre, 200);
    return t === String(id).trim() ? null : t;
}

/** Datos de la última modificación de un registro (ver `modificacionesPorRegistro`). */
export type Modificacion = { cuando: string | null; quien: string | null };

/**
 * Última modificación de cada registro: la entrada más reciente de su historial de cambios (`c_cambios_apps_modules`, `nombre_tabla` =
 * `c_producto_no_conforme`) que no sea el alta (`__created__`). La tabla no tiene `updated_at`. Si nunca se editó, no hay entrada (null).
 * Una consulta por bloque de 1000 ids (sin traer el contenido de `cambios`, que puede llevar firmas) + un lote de empleados
 * («código - nombre»). Si el historial no se puede leer, el reporte sigue con las columnas en null.
 */
export async function modificacionesPorRegistro(db: any, tabla: string, ids: unknown[]): Promise<Map<number, Modificacion>> {
    const out = new Map<number, Modificacion>();
    const unicos = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    if (!unicos.length) return out;
    try {
        const pedidos = new Set(unicos);
        const ultimo = new Map<number, { id: number; by: number; at: unknown }>();
        for (let i = 0; i < unicos.length; i += 1000) {
            const filas: any[] = await db.c_cambios_apps_modules.findMany({
                where: { nombre_tabla: tabla, registro_id: { in: unicos.slice(i, i + 1000) }, NOT: { cambios: { contains: "__created__" } } },
                select: { id: true, registro_id: true, created_by: true, created_at: true },
                orderBy: { id: "desc" },
            });
            for (const f of filas) {
                const rid = Number(f.registro_id);
                const prev = ultimo.get(rid);
                if (pedidos.has(rid) && (!prev || Number(f.id) > prev.id)) ultimo.set(rid, { id: Number(f.id), by: Number(f.created_by), at: f.created_at });
            }
        }
        const emps = await findByIds<{ codigo?: string | null; nombre?: string | null; primer_apellido?: string | null; segundo_apellido?: string | null }>(db, "c_empleado", [...ultimo.values()].map((u) => u.by), { codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true });
        for (const [rid, u] of ultimo) {
            const e = emps.get(u.by);
            const nombre = e ? buildNombre(e) : "";
            const codigo = text(e?.codigo, 50);
            out.set(rid, { cuando: fmtDt(u.at as any), quien: e ? (codigo ? (nombre ? `${codigo} - ${nombre}` : codigo) : nombre || null) : null });
        }
    } catch (e) {
        console.warn("[guardifyReports] historial de cambios no disponible; modificado y modificado_por quedan vacíos", (e as Error)?.message);
        return new Map();
    }
    return out;
}

/**
 * Fila de `queryProductoNoConformeRows` → fila plana. Se omiten a propósito las firmas (`firma_responsable`,
 * `firma_persona_identifico_pnc`, `firma_persona_origino_pnc` y sus `*_data_uri`): son imágenes.
 * `ejecutivo`: ejecutivo de cuenta de la sucursal y `modificacion`: último cambio del historial (null si nunca se editó); ambos se cargan por lote en `load`.
 */
export function mapProductoNoConformeRow(r: any, ejecutivo?: string | null, modificacion?: Modificacion | null): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        fecha_identificacion: fmtDt(r.fecha_identificacion),
        empresa: nodo(r.empresa_nombre, r.empresa_id),
        cliente: nodo(r.cliente_nombre, r.cliente_id),
        division: nodo(r.division_nombre, r.division_id),
        contrato: nodo(r.contrato_nombre, r.contrato_id),
        sucursal: nodo(r.corpo_nombre, r.corpo_id),
        puesto: nodo(r.puesto_nombre, r.puesto_id),
        tipo_servicio: text(r.tipo_servicio_no_conforme, 200),
        responsable_cuenta: text(r.responsable_cuenta, 200),
        persona_identifico: text(r.persona_identifico_pnc, 200),
        persona_origino: text(r.persona_origino_pnc, 200),
        descripcion: text(r.descripcion),
        accion_implementada: text(r.accion_implementada),
        fecha_solucion: fmtDt(r.fecha_solucion),
        responsable_aprobar: text(r.responsable_aprobar, 200),
        creado_por: text(r.created_by_nombre, 200),
        ejecutivo_cuenta: text(ejecutivo, 200),
        modificado: modificacion?.cuando ?? null,
        modificado_por: modificacion?.quien ?? null,
    };
}

/**
 * Producto no conforme (`c_producto_no_conforme`). Cada fila trae sus ids de empresa/cliente/división/contrato/corpo/puesto. El periodo
 * (`from`/`to`) se aplica a `creado` (`created_at`, la fecha de registro, igual que el filtro de fechas de la app: «Fecha inicio/fin»
 * del Excel «Producto no conforme»); `fecha_identificacion` (solo fecha) queda como columna. `creado_por` («código - nombre») es el
 * «Usuario inserta».
 */
export const productoNoConforme: GuardifyReportModule = {
    id: "producto_no_conforme",
    supportsScope: true,
    searchKeys: ["descripcion", "accion_implementada", "tipo_servicio", "persona_identifico", "persona_origino", "responsable_cuenta", "creado_por", "puesto", "sucursal", "modificado_por"],
    filterKeys: ["empresa", "cliente", "division", "contrato", "sucursal", "puesto", "tipo_servicio", "ejecutivo_cuenta", "creado_por", "modificado_por"],
    sortKeys: ["creado", "fecha_identificacion", "fecha_solucion", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "tipo_servicio", "responsable_cuenta", "creado_por", "ejecutivo_cuenta", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: productoNoConformeForm,
    async load(db, p) {
        const rows = await queryProductoNoConformeRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "fecha_identificacion");
        const scope = p.scope;
        const visibles = rows
            .filter((r: any) => {
                const d = fmtDt(r.created_at)?.slice(0, 10);
                return !!d && d >= p.from && d < p.to;
            })
            .filter(
                (r: any) =>
                    !scope ||
                    matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope),
            );
        const ejecutivos = await ejecutivoPorCorpo(db as any, visibles.map((r: any) => r.corpo_id));
        const modificaciones = await modificacionesPorRegistro(db, "c_producto_no_conforme", visibles.map((r: any) => r.id));
        return visibles.map((r: any) => mapProductoNoConformeRow(r, ejecutivos.get(Number(r.corpo_id)) ?? null, modificaciones.get(Number(r.id)) ?? null));
    },
};
