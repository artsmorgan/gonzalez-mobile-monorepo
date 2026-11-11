import type { NextRequest } from "next/server";
import { actorFromRequest, auditUpdateFields } from "./auditFields";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

type Nivel = "empresa_id" | "cliente_id" | "division_id" | "contrato_id" | "corpo_id";
const NIVELES: Nivel[] = ["empresa_id", "cliente_id", "division_id", "contrato_id", "corpo_id"];

/** Jerarquía común de un conjunto de puestos: cada nivel solo se llena si TODOS los puestos coinciden en él; `puesto_id` solo con un único puesto. */
export type JerarquiaActividad = Record<Nivel | "puesto_id", number | null>;

const VACIA: JerarquiaActividad = { empresa_id: null, cliente_id: null, division_id: null, contrato_id: null, corpo_id: null, puesto_id: null };

/** Cadena puesto → sucursal → contrato (cliente, empresa y división del contrato) de varios puestos, en 3 consultas. */
export async function cadenasDePuestos(puestoIds: number[]): Promise<Map<number, Record<Nivel, number | null>>> {
    const out = new Map<number, Record<Nivel, number | null>>();
    const puestos = await prisma.e_estructura_puesto.findMany({ where: { id: { in: puestoIds } }, select: { id: true, sucursal_id: true } });
    const sucursalIds = [...new Set(puestos.map((p) => p.sucursal_id).filter((n): n is number => !!n))];
    const sucursales = sucursalIds.length ? await prisma.e_estructura_sucursal.findMany({ where: { id: { in: sucursalIds } }, select: { id: true, contrato_id: true } }) : [];
    const contratoIds = [...new Set(sucursales.map((s) => s.contrato_id).filter((n): n is number => !!n))];
    const contratos = contratoIds.length ? await prisma.e_estructura_contrato.findMany({ where: { id: { in: contratoIds } }, select: { id: true, cliente_id: true, empresa_id: true, division_id: true } }) : [];
    const sucursalById = new Map(sucursales.map((s) => [s.id, s]));
    const contratoById = new Map(contratos.map((c) => [c.id, c]));
    for (const p of puestos) {
        const s = p.sucursal_id ? sucursalById.get(p.sucursal_id) : undefined;
        const c = s?.contrato_id ? contratoById.get(s.contrato_id) : undefined;
        out.set(p.id, {
            empresa_id: c?.empresa_id ?? null,
            cliente_id: c?.cliente_id ?? null,
            division_id: c?.division_id ?? null,
            contrato_id: c?.id ?? null,
            corpo_id: s?.id ?? null,
        });
    }
    return out;
}

/** Función pura (probada aparte): jerarquía común de las cadenas de varios puestos. */
export function jerarquiaComun(puestoIds: number[], cadenas: Map<number, Record<Nivel, number | null>>): JerarquiaActividad {
    if (puestoIds.length === 0) return { ...VACIA };
    const out: JerarquiaActividad = { ...VACIA, puesto_id: puestoIds.length === 1 ? puestoIds[0] : null };
    for (const nivel of NIVELES) {
        const valores = puestoIds.map((id) => cadenas.get(id)?.[nivel] ?? null);
        out[nivel] = valores.every((v) => v != null && v === valores[0]) ? valores[0] : null;
    }
    return out;
}

/**
 * Recalcula y guarda en `e_actividades` la jerarquía propia de la actividad a partir de sus puestos vinculados
 * (`e_actividades_puesto`). Se llama cada vez que cambian los puestos de la actividad (alta, duplicado, agregar o quitar puestos).
 * `registrarModificacion`: agregar/quitar puestos modifica una actividad existente (deja `updated_at`/`updated_by`); en el alta no.
 * Nunca lanza: guardar la jerarquía no debe impedir la operación principal.
 */
export async function syncActividadHierarchy(req: NextRequest, actividadId: number, opts: { registrarModificacion?: boolean } = {}): Promise<JerarquiaActividad | null> {
    try {
        const links = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto", operation: "findMany", where: { actividad_id: actividadId }, select: { puesto_id: true } },
        });
        const puestoIds = [...new Set((Array.isArray(links) ? links : []).map((l: { puesto_id?: number }) => Number(l.puesto_id)).filter((n) => Number.isFinite(n) && n > 0))];
        const cadenas = puestoIds.length ? await cadenasDePuestos(puestoIds) : new Map();
        const jerarquia = jerarquiaComun(puestoIds, cadenas);
        await callDynamicPrisma({
            req,
            data: {
                action: "UPDATE",
                table: "e_actividades",
                operation: "update",
                where: { id: actividadId },
                data: { ...jerarquia, ...(opts.registrarModificacion ? auditUpdateFields(actorFromRequest(req), ["updated_at", "updated_by"]) : {}) },
            },
        });
        return jerarquia;
    } catch (e) {
        console.warn("[syncActividadHierarchy] no se pudo guardar la jerarquía de la actividad", actividadId, (e as Error)?.message);
        return null;
    }
}
