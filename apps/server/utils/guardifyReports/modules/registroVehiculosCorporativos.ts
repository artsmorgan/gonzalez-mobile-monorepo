import { queryRegistroVehiculosCorporativosRows } from "../../reports-functions/registroVehiculosCorporativosReport";
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

const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

/** Vehículos corporativos: un vehículo por fila; de sus usos y mantenimientos solo se expone el conteo. */
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
    };
}

/**
 * Registro de vehículos corporativos (`c_vehiculos_corporativos`). Cada vehículo guarda su ubicación (puesto, sucursal,
 * contrato, cliente, empresa, división). El periodo se aplica a la fecha de creación del vehículo, como en la app.
 */
export const registroVehiculosCorporativos: GuardifyReportModule = {
    id: "registro_vehiculos_corporativos",
    supportsScope: true,
    searchKeys: ["placa", "marca", "modelo", "contrato", "sucursal", "puesto", "cliente"],
    filterKeys: ["tipo", "estado", "tipo_autoria", "activo", "empresa", "cliente", "contrato", "sucursal", "puesto"],
    sortKeys: ["creado", "placa", "tipo", "marca", "modelo", "anno", "kilometraje", "estado", "empresa", "cliente", "contrato", "sucursal", "puesto", "usos", "mantenimientos"],
    defaultSort: "creado",
    async load(db, p) {
        const rows = await queryRegistroVehiculosCorporativosRows(db, { creadoDesde: `${p.from}T00:00:00`, creadoHasta: `${addDays(p.to, -1)}T23:59:59` }, "created_at");
        const scope = p.scope;
        const kept = !scope
            ? rows
            : rows.filter((r) => matchesScope({ empresa: r.empresa_id, cliente: r.cliente_id, division: r.division_id, contrato: r.contrato_id, corpo: r.corpo_id, puesto: r.puesto_id }, scope));
        return kept.map(mapVehiculoCorporativoRow);
    },
};
