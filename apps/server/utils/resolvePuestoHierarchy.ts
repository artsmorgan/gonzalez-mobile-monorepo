import { prisma } from "./prismaClient";

/** Jerarquía de un puesto: sucursal (corpo) → contrato → cliente / empresa / división del contrato. */
export type PuestoHierarchy = {
    empresa_id: number | null;
    cliente_id: number | null;
    division_id: number | null;
    contrato_id: number | null;
    corpo_id: number | null;
};

const EMPTY: PuestoHierarchy = { empresa_id: null, cliente_id: null, division_id: null, contrato_id: null, corpo_id: null };

/**
 * Resuelve la jerarquía de un puesto para guardarla en el propio registro al crearlo (empresa, cliente, división, contrato y
 * sucursal). Usa las tablas de estructura preexistentes (acceso directo). Si el puesto no existe o la cadena está incompleta,
 * los niveles que falten quedan en `null` (nunca lanza: guardar la jerarquía no debe impedir crear el registro).
 */
export async function resolvePuestoHierarchy(puestoId: unknown): Promise<PuestoHierarchy> {
    const id = Number(puestoId);
    if (!Number.isFinite(id) || id <= 0) return { ...EMPTY };
    try {
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id }, select: { sucursal_id: true } });
        if (!puesto?.sucursal_id) return { ...EMPTY };
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: puesto.sucursal_id }, select: { id: true, contrato_id: true } });
        if (!sucursal) return { ...EMPTY };
        const contrato = sucursal.contrato_id
            ? await prisma.e_estructura_contrato.findUnique({ where: { id: sucursal.contrato_id }, select: { id: true, cliente_id: true, empresa_id: true, division_id: true } })
            : null;
        return {
            empresa_id: contrato?.empresa_id ?? null,
            cliente_id: contrato?.cliente_id ?? null,
            division_id: contrato?.division_id ?? null,
            contrato_id: contrato?.id ?? null,
            corpo_id: sucursal.id,
        };
    } catch (e) {
        console.warn("[resolvePuestoHierarchy] no se pudo resolver la jerarquía del puesto", id, (e as Error)?.message);
        return { ...EMPTY };
    }
}
