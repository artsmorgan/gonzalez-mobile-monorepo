import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

/**
 * Resuelve empresa, división, contrato y cliente a partir de un puesto y su sucursal (corpo).
 * Usado al persistir e_registro_personas (todos los FK de jerarquía).
 */
export async function visitorsResolveHierarchyFromPuestoId(
    req: NextRequest,
    puestoId: number,
    corpoId: number
): Promise<
    | { ok: true; cliente_id: number; empresa_id: number; division_id: number; contrato_id: number }
    | { ok: false; message: string }
> {
    const puesto = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoId } }
    });
    if (!puesto) {
        return { ok: false, message: "Puesto no encontrado" };
    }
    const puestoSucursal = puesto.sucursal_id != null ? Number(puesto.sucursal_id) : NaN;
    if (Number(puestoSucursal) !== Number(corpoId)) {
        return { ok: false, message: "El puesto no pertenece a la sucursal indicada" };
    }
    const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoId } }
    });
    if (!sucursal?.contrato_id) {
        return { ok: false, message: "Sucursal sin contrato" };
    }
    const contrato = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: Number(sucursal.contrato_id) } }
    });
    if (!contrato) {
        return { ok: false, message: "Contrato no encontrado" };
    }
    const contratoId = Number(contrato.id);
    const clienteId = contrato.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
        return { ok: false, message: "Contrato sin cliente" };
    }
    const divisionId = contrato.division_id != null ? Number(contrato.division_id) : NaN;
    if (!Number.isFinite(divisionId) || divisionId <= 0) {
        return { ok: false, message: "Contrato sin división" };
    }
    let empresaId = contrato.empresa_id != null ? Number(contrato.empresa_id) : NaN;
    if (!Number.isFinite(empresaId) || empresaId <= 0) {
        const cli = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_cliente", operation: "findUnique", where: { id: clienteId } }
        });
        empresaId = cli?.empresa_id != null ? Number(cli.empresa_id) : NaN;
    }
    if (!Number.isFinite(empresaId) || empresaId <= 0) {
        return { ok: false, message: "No se pudo resolver empresa" };
    }
    return { ok: true, cliente_id: clienteId, empresa_id: empresaId, division_id: divisionId, contrato_id: contratoId };
}
