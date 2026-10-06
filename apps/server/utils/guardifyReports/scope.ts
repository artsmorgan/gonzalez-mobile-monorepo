import { ParamError } from "./errors";

/**
 * Alcance por estructura. Guardify manda los nodos de la estructura de González que la persona puede ver como
 * `nivel:id` separados por coma (p. ej. `contrato:12,puesto:340`). Es la UNIÓN de esos nodos.
 */
export const NIVELES = ["empresa", "cliente", "division", "contrato", "corpo", "puesto"] as const;
export type Nivel = (typeof NIVELES)[number];
export type ScopeItem = { nivel: Nivel; id: number };

/** Ancestros de un registro, por nivel (lo que cada fila de reporte sabe de su ubicación). */
export type Hierarchy = Partial<Record<Nivel, number | null | undefined>>;

export function parseScope(raw: string): ScopeItem[] {
    const out: ScopeItem[] = [];
    for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        const m = /^([a-z]+):(\d{1,10})$/.exec(part);
        if (!m || !(NIVELES as readonly string[]).includes(m[1]!)) throw new ParamError(`Alcance inválido: «${part}».`);
        out.push({ nivel: m[1] as Nivel, id: Number(m[2]) });
    }
    return out;
}

/** ¿Algún nodo del alcance coincide con la ubicación del registro? Un alcance vacío no deja ver nada. */
export function matchesScope(h: Hierarchy, scope: ScopeItem[]): boolean {
    return scope.some((s) => Number(h[s.nivel] ?? 0) === s.id);
}

type Db = { [table: string]: { findMany: (args?: any) => Promise<any[]> } };

/**
 * Ubicación completa de cada puesto (puesto → sucursal → contrato → cliente/empresa/división), para los reportes
 * que solo guardan `puesto_id`.
 */
export async function loadPuestoHierarchy(db: Db, puestoIds: number[]): Promise<Map<number, Hierarchy>> {
    const ids = [...new Set(puestoIds.filter((n) => Number.isFinite(n) && n > 0))];
    const out = new Map<number, Hierarchy>();
    if (!ids.length) return out;
    const puestos = await db.e_estructura_puesto!.findMany({ where: { id: { in: ids } }, select: { id: true, sucursal_id: true } });
    const corpoIds = [...new Set(puestos.map((p) => Number(p.sucursal_id)).filter((n) => n > 0))];
    const corpos = corpoIds.length ? await db.e_estructura_sucursal!.findMany({ where: { id: { in: corpoIds } }, select: { id: true, contrato_id: true } }) : [];
    const contratoIds = [...new Set(corpos.map((c) => Number(c.contrato_id)).filter((n) => n > 0))];
    const contratos = contratoIds.length
        ? await db.e_estructura_contrato!.findMany({ where: { id: { in: contratoIds } }, select: { id: true, cliente_id: true, empresa_id: true, division_id: true } })
        : [];
    const corpoById = new Map(corpos.map((c) => [Number(c.id), c]));
    const contratoById = new Map(contratos.map((c) => [Number(c.id), c]));
    for (const p of puestos) {
        const corpo = corpoById.get(Number(p.sucursal_id));
        const contrato = corpo ? contratoById.get(Number(corpo.contrato_id)) : undefined;
        out.set(Number(p.id), {
            puesto: Number(p.id),
            corpo: corpo ? Number(corpo.id) : null,
            contrato: contrato ? Number(contrato.id) : null,
            cliente: contrato?.cliente_id != null ? Number(contrato.cliente_id) : null,
            empresa: contrato?.empresa_id != null ? Number(contrato.empresa_id) : null,
            division: contrato?.division_id != null ? Number(contrato.division_id) : null,
        });
    }
    return out;
}
