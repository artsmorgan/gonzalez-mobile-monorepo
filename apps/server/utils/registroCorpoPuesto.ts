/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export async function assertCorpoAllowedForMarca(
    req: NextRequest,
    marcaDia: any,
    corpoIdReq: number
): Promise<{ ok: true } | { ok: false; message: string }> {
    if (Number(marcaDia.corpo_id) === corpoIdReq) {
        return { ok: true };
    }
    const marcaClienteId = marcaDia.cliente_id != null ? Number(marcaDia.cliente_id) : NaN;
    if (!Number.isFinite(marcaClienteId) || marcaClienteId <= 0) {
        return { ok: false, message: "La sucursal no corresponde a la marca indicada" };
    }
    const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoIdReq } }
    });
    if (!sucursal) {
        return { ok: false, message: "Sucursal no encontrada" };
    }
    const contratoId = sucursal.contrato_id != null ? Number(sucursal.contrato_id) : NaN;
    if (!Number.isFinite(contratoId) || contratoId <= 0) {
        return { ok: false, message: "La sucursal no tiene contrato asociado" };
    }
    const contrato = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: contratoId } }
    });
    return { ok: true };
}

async function getClienteIdForSucursal(req: NextRequest, sucursalId: number): Promise<number | null> {
    const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: sucursalId } }
    });
    if (!sucursal?.contrato_id) {
        return null;
    }
    const contrato = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: Number(sucursal.contrato_id) } }
    });
    const cliente_id = contrato?.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    return Number.isFinite(cliente_id) && cliente_id > 0 ? cliente_id : null;
}

async function clienteAndPuestoForCorpo(
    req: NextRequest,
    corpoId: number
): Promise<{ cliente_id: number; puesto_id: number } | null> {
    const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpoId } }
    });
    if (!sucursal?.contrato_id) {
        return null;
    }
    const contrato = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_contrato", operation: "findUnique", where: { id: Number(sucursal.contrato_id) } }
    });
    const cliente_id = contrato?.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    if (!Number.isFinite(cliente_id) || cliente_id <= 0) {
        return null;
    }
    const puestos = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_puesto", operation: "findMany", where: { sucursal_id: corpoId } }
    });
    const list = Array.isArray(puestos) ? puestos : [];
    const puesto_id = list[0]?.id != null ? Number(list[0].id) : NaN;
    if (!Number.isFinite(puesto_id) || puesto_id <= 0) {
        return null;
    }
    return { cliente_id, puesto_id };
}

export async function resolveClienteYPuestoParaAlta(
    req: NextRequest,
    marcaDia: any,
    targetCorpoId: number,
    bodyPuestoId: unknown
): Promise<{ ok: true; cliente_id: number; puesto_id: number } | { ok: false; message: string }> {
    const puestoParsed =
        bodyPuestoId != null && bodyPuestoId !== ""
            ? parseInt(String(bodyPuestoId), 10)
            : NaN;

    if (Number.isFinite(puestoParsed) && puestoParsed > 0) {
        const puesto = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puestoParsed } }
        });
        if (!puesto) {
            return { ok: false, message: "Puesto no encontrado" };
        }
        const sid = puesto.sucursal_id != null ? Number(puesto.sucursal_id) : NaN;
        if (sid !== Number(targetCorpoId)) {
            return { ok: false, message: "El puesto no pertenece a la sucursal indicada" };
        }
        const clienteId = await getClienteIdForSucursal(req, targetCorpoId);
        if (clienteId == null) {
            return { ok: false, message: "No se pudo resolver el cliente para la sucursal indicada" };
        }
        return { ok: true, cliente_id: clienteId, puesto_id: puestoParsed };
    }

    let clienteIdFinal = marcaDia.cliente_id;
    let puestoIdFinal = marcaDia.puesto_id;
    if (Number(targetCorpoId) !== Number(marcaDia.corpo_id)) {
        const cp = await clienteAndPuestoForCorpo(req, targetCorpoId);
        if (!cp) {
            return { ok: false, message: "No se pudo resolver cliente/puesto para la sucursal indicada" };
        }
        clienteIdFinal = cp.cliente_id;
        puestoIdFinal = cp.puesto_id;
    }
    const cid = Number(clienteIdFinal);
    const pid = Number(puestoIdFinal);
    if (!Number.isFinite(cid) || cid <= 0 || !Number.isFinite(pid) || pid <= 0) {
        return { ok: false, message: "Marca o sucursal sin cliente/puesto válido" };
    }
    return { ok: true, cliente_id: cid, puesto_id: pid };
}

/** Cadena empresa/división/contrato/cliente coherente con la sucursal (`e_estructura_sucursal`). */
export async function getRegistroVehiculoLocationAnchors(
    req: NextRequest,
    corpoId: number
): Promise<
    | { ok: true; empresa_id: number; division_id: number; contrato_id: number; cliente_id: number }
    | { ok: false; message: string }
> {
    const cid = Number(corpoId);
    if (!Number.isFinite(cid) || cid <= 0) {
        return { ok: false, message: "Sucursal no válida" };
    }
    const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: cid } },
    });
    if (!sucursal?.contrato_id) {
        return { ok: false, message: "La sucursal no tiene contrato asociado" };
    }
    const contrato = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: "e_estructura_contrato",
            operation: "findUnique",
            where: { id: Number(sucursal.contrato_id) },
        },
    });
    if (!contrato) {
        return { ok: false, message: "Contrato no encontrado" };
    }
    const empresa_id = contrato.empresa_id != null ? Number(contrato.empresa_id) : NaN;
    const divisionRaw = contrato.division_id;
    const division_id = divisionRaw != null ? Number(divisionRaw) : NaN;
    const contrato_id = contrato.id != null ? Number(contrato.id) : NaN;
    const cliente_id = contrato.cliente_id != null ? Number(contrato.cliente_id) : NaN;
    if (!Number.isFinite(empresa_id) || empresa_id <= 0) {
        return { ok: false, message: "El contrato no tiene empresa válida" };
    }
    if (!Number.isFinite(division_id) || division_id <= 0) {
        return { ok: false, message: "El contrato no tiene división asignada" };
    }
    if (!Number.isFinite(contrato_id) || contrato_id <= 0) {
        return { ok: false, message: "Contrato no válido" };
    }
    if (!Number.isFinite(cliente_id) || cliente_id <= 0) {
        return { ok: false, message: "El contrato no tiene cliente válido" };
    }
    return { ok: true, empresa_id, division_id, contrato_id, cliente_id };
}
