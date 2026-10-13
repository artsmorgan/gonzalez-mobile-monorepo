import { queryRegistroVehiculosCorporativosRows } from "../../reports-functions/registroVehiculosCorporativosReport";
import { ejecutivoPorCorpo, nombresEmpleado, usuarioInserta } from "../enrich";
import { fmtDt } from "../mappers";
import type { OutRow } from "../listing";
import { addDays } from "../params";
import { matchesScope } from "../scope";
import type { GuardifyReportModule } from "../types";
import { registroVehiculosCorporativosForm } from "./registroVehiculosCorporativosForm";

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

const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/**
 * Último cambio de cada registro en el historial (`c_cambios_apps_modules`): cuándo y quién (id de empleado). Una consulta por bloque
 * de 1000 registros; si la base no tiene el historial, ningún registro tiene cambio.
 */
async function ultimosCambios(db: any, tabla: string, ids: unknown[]): Promise<Map<number, { id: number; at: string; by: number }>> {
    const all = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, { id: number; at: string; by: number }>();
    try {
        for (let i = 0; i < all.length; i += 1000) {
            const rows = await db.c_cambios_apps_modules.findMany({ where: { nombre_tabla: tabla, registro_id: { in: all.slice(i, i + 1000) } }, select: { id: true, registro_id: true, created_by: true, created_at: true } });
            for (const c of rows) {
                const at = fmtDt(c.created_at);
                if (!at) continue;
                const prev = out.get(Number(c.registro_id));
                if (!prev || at > prev.at || (at === prev.at && Number(c.id) > prev.id)) out.set(Number(c.registro_id), { id: Number(c.id), at, by: Number(c.created_by) });
            }
        }
    } catch {
        /* sin historial */
    }
    return out;
}

/**
 * Vehículos corporativos: un vehículo por fila; de sus usos y mantenimientos solo se expone el conteo.
 * `ejecutivo_cuenta` (de la sucursal), `creado_por` (quien registró el vehículo) y `modificado`/`modificado_por` (último cambio del
 * historial `c_cambios_apps_modules`) los agrega `load` por lote.
 */
export function mapVehiculoCorporativoRow(r: any): OutRow {
    return {
        id: Number(r.id),
        creado: fmtDt(r.created_at),
        placa: txt(r.placa),
        tipo: txt(r.tipo),
        marca: txt(r.marca),
        modelo: txt(r.modelo),
        anno: num(r.anno),
        kilometraje: num(r.kilometraje),
        prox_cambio_aceite: num(r.prox_cambio_aceite),
        estado: txt(r.estado),
        tipo_autoria: txt(r.tipo_autoria),
        titulo_propiedad: txt(r.titulo_propiedad_txt),
        rtv: txt(r.rtv_txt),
        marchamo: txt(r.marchamo_txt),
        activo: txt(r.activo_txt),
        empresa: txt(r.empresa_txt),
        cliente: txt(r.cliente_txt),
        division: txt(r.division_txt),
        contrato: txt(r.contrato_txt),
        sucursal: txt(r.corpo_txt),
        puesto: txt(r.puesto_txt),
        descripcion: clip(r.descripcion),
        usos: num(r.usos_count) ?? 0,
        mantenimientos: num(r.mantenimientos_count) ?? 0,
        ejecutivo_cuenta: txt(r.ejecutivo_cuenta),
        creado_por: txt(r.creado_por),
        modificado: fmtDt(r.modificado_at),
        modificado_por: txt(r.modificado_por),
    };
}

/**
 * Registro de vehículos corporativos (`c_vehiculos_corporativos`). Cada vehículo guarda su ubicación (puesto, sucursal,
 * contrato, cliente, empresa, división). El periodo (`from`/`to`) y la «hora del día» se aplican a la fecha de creación del
 * vehículo (`creado`, `created_at`), como en la app y como la «Fecha de creación» del Excel.
 */
export const registroVehiculosCorporativos: GuardifyReportModule = {
    id: "registro_vehiculos_corporativos",
    supportsScope: true,
    searchKeys: ["placa", "marca", "modelo", "contrato", "sucursal", "puesto", "cliente"],
    filterKeys: ["tipo", "estado", "tipo_autoria", "activo", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "creado", "placa", "marca", "modelo", "anno", "ejecutivo_cuenta", "creado_por", "modificado", "modificado_por"],
    sortKeys: ["creado", "placa", "tipo", "marca", "modelo", "anno", "kilometraje", "estado", "empresa", "cliente", "division", "contrato", "sucursal", "puesto", "usos", "mantenimientos", "creado_por", "modificado", "modificado_por"],
    defaultSort: "creado",
    form: registroVehiculosCorporativosForm,
    async load(db, p) {
        const rows = await queryRegistroVehiculosCorporativosRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        if (!kept.length) return [];
        // Datos para los filtros, en lote (nunca por fila).
        const cambios = await ultimosCambios(db, "c_vehiculos_corporativos", kept.map((r) => r.id));
        const [ejecutivos, nombres] = await Promise.all([
            ejecutivoPorCorpo(db, kept.map((r) => r.corpo_id)),
            nombresEmpleado(db, [...kept.map((r) => r.created_by), ...[...cambios.values()].map((c) => c.by)]),
        ]);
        return kept.map((r) => {
            const c = cambios.get(Number(r.id));
            return mapVehiculoCorporativoRow({
                ...r,
                ejecutivo_cuenta: ejecutivos.get(Number(r.corpo_id)),
                creado_por: usuarioInserta(r.created_by, nombres),
                modificado_at: c?.at, modificado_por: c ? usuarioInserta(c.by, nombres) : null,
            });
        });
    },
};
