/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";
import { PREEXISTENT_REPORT_TABLES } from "./reportDynamicPrisma";
import { prisma } from "./prismaClient";

export type PreexistentRelationSpec = {
    relation: string;
    fkField: string;
    select?: Record<string, boolean>;
};

const DEFAULT_FK_BY_RELATION: Record<string, string> = {
    e_estructura_cliente: "cliente_id",
    e_estructura_sucursal: "corpo_id",
    e_estructura_puesto: "puesto_id",
    e_estructura_empresa: "empresa_id",
    e_estructura_contrato: "contrato_id",
    n_division: "division_id",
    n_ejecutivo_cuenta: "ejecutivo_cuenta",
    c_empleado: "empleado_id",
};

export function isPreexistentTable(table: string): boolean {
    return PREEXISTENT_REPORT_TABLES.has(table);
}

function resolveFkField(relation: string): string {
    return DEFAULT_FK_BY_RELATION[relation] ?? `${relation}_id`;
}

function collectNumericIds(rows: any[], fkField: string): number[] {
    return [
        ...new Set(
            rows
                .map((r) => r?.[fkField])
                .filter((id) => id != null && Number.isFinite(Number(id)) && Number(id) > 0)
                .map((id) => Number(id)),
        ),
    ];
}

/** Separa relaciones preexistentes (Prisma directo) del `include` que va a `callDynamicPrisma`. */
export function splitIncludeByTableGroup(include?: Record<string, any>): {
    sameGroupInclude?: Record<string, any>;
    preexistentSpecs: PreexistentRelationSpec[];
} {
    if (!include || typeof include !== "object") {
        return { sameGroupInclude: undefined, preexistentSpecs: [] };
    }

    const sameGroupInclude: Record<string, any> = {};
    const preexistentSpecs: PreexistentRelationSpec[] = [];

    for (const [relation, value] of Object.entries(include)) {
        if (isPreexistentTable(relation)) {
            const spec: PreexistentRelationSpec = {
                relation,
                fkField: resolveFkField(relation),
            };
            if (value === true) {
                preexistentSpecs.push(spec);
            } else if (value && typeof value === "object" && value.select) {
                spec.select = value.select as Record<string, boolean>;
                preexistentSpecs.push(spec);
            } else {
                preexistentSpecs.push(spec);
            }
        } else {
            sameGroupInclude[relation] = value;
        }
    }

    return {
        sameGroupInclude: Object.keys(sameGroupInclude).length > 0 ? sameGroupInclude : undefined,
        preexistentSpecs,
    };
}

/** Hidrata en memoria relaciones preexistentes sobre filas de tablas creadas. */
export async function hydratePreexistentRelations<T extends Record<string, any>>(
    rows: T | T[] | null | undefined,
    specs: PreexistentRelationSpec[],
): Promise<T | T[] | null | undefined> {
    if (rows == null || specs.length === 0) return rows;

    const list = (Array.isArray(rows) ? rows : [rows]) as T[];
    if (list.length === 0) return rows;

    for (const spec of specs) {
        const ids = collectNumericIds(list, spec.fkField);
        const byId = new Map<number, any>();

        if (ids.length > 0) {
            const delegate = (prisma as PrismaClient & Record<string, any>)[spec.relation];
            if (delegate?.findMany) {
                const found = await delegate.findMany({
                    where: { id: { in: ids } },
                    ...(spec.select ? { select: spec.select } : {}),
                });
                for (const row of found) byId.set(Number(row.id), row);
            }
        }

        for (const row of list) {
            const fk = row[spec.fkField as keyof T];
            const key = fk != null ? Number(fk) : NaN;
            (row as any)[spec.relation] = Number.isFinite(key) && byId.has(key) ? byId.get(key) : null;
        }
    }

    return rows;
}

/** Recolecta filas hijas (array o objeto único) de un arreglo de registros padre. */
export function flattenChildRows<T extends Record<string, any>>(rows: T[], childKey: string): any[] {
    return rows.flatMap((r) => {
        const child = r[childKey];
        return Array.isArray(child) ? child : child ? [child] : [];
    });
}

/** Hidrata relaciones preexistentes sobre filas hijas anidadas. */
export async function hydratePreexistentChildRelations(
    rows: any[],
    childKey: string,
    specs: PreexistentRelationSpec[],
): Promise<void> {
    await hydratePreexistentRelations(flattenChildRows(rows, childKey), specs);
}

/** Adjunta `e_estructura_contrato` y `n_division` a objetos `e_estructura_sucursal` ya cargados. */
export async function attachContratoDivisionToSucursales(sucursales: any[]): Promise<void> {
    const list = sucursales.filter(Boolean);
    if (list.length === 0) return;

    const contratoIds = [
        ...new Set(list.map((s) => Number(s.contrato_id)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    if (contratoIds.length === 0) return;

    const contratos = await prisma.e_estructura_contrato.findMany({
        where: { id: { in: contratoIds } },
        select: { id: true, nombre: true, nro_contrato: true, division_id: true },
    });
    const divisionIds = [
        ...new Set(contratos.map((c) => Number(c.division_id)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    const divisiones =
        divisionIds.length > 0
            ? await prisma.n_division.findMany({
                  where: { id: { in: divisionIds } },
                  select: { id: true, nombre: true },
              })
            : [];
    const divisionById = new Map(divisiones.map((d) => [d.id, d]));
    const contratoById = new Map(
        contratos.map((c) => [
            c.id,
            { ...c, n_division: divisionById.get(Number(c.division_id)) ?? null },
        ]),
    );

    for (const sucursal of list) {
        const contratoId = Number(sucursal.contrato_id);
        sucursal.e_estructura_contrato = Number.isFinite(contratoId) && contratoById.has(contratoId)
            ? contratoById.get(contratoId)
            : null;
    }
}

/** Adjunta cadena sucursal → contrato → cliente sobre objetos `e_estructura_puesto`. */
export async function attachLocationChainToPuestos(puestos: any[]): Promise<void> {
    const list = puestos.filter(Boolean);
    if (list.length === 0) return;

    const corpoIds = [
        ...new Set(list.map((p) => Number(p.corpo_id)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    if (corpoIds.length === 0) return;

    const sucursales = await prisma.e_estructura_sucursal.findMany({
        where: { id: { in: corpoIds } },
        select: { id: true, nombre: true, contrato_id: true },
    });
    const sucursalById = new Map(sucursales.map((s) => [s.id, { ...s }]));

    const contratoIds = [
        ...new Set(sucursales.map((s) => Number(s.contrato_id)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    const contratos =
        contratoIds.length > 0
            ? await prisma.e_estructura_contrato.findMany({
                  where: { id: { in: contratoIds } },
                  select: { id: true, nombre: true, empresa_id: true, cliente_id: true },
              })
            : [];
    const contratoById = new Map(contratos.map((c) => [c.id, { ...c }]));

    const clienteIds = [
        ...new Set(contratos.map((c) => Number(c.cliente_id)).filter((n) => Number.isFinite(n) && n > 0)),
    ];
    const clientes =
        clienteIds.length > 0
            ? await prisma.e_estructura_cliente.findMany({
                  where: { id: { in: clienteIds } },
                  select: { id: true, nombre: true },
              })
            : [];
    const clienteById = new Map(clientes.map((c) => [c.id, c]));

    for (const sucursal of sucursalById.values()) {
        const contrato = contratoById.get(Number(sucursal.contrato_id));
        if (contrato) {
            (sucursal as any).e_estructura_contrato = {
                ...contrato,
                e_estructura_cliente: clienteById.get(Number(contrato.cliente_id)) ?? null,
            };
        } else {
            (sucursal as any).e_estructura_contrato = null;
        }
    }

    for (const puesto of list) {
        const corpoId = Number(puesto.corpo_id);
        puesto.e_estructura_sucursal = Number.isFinite(corpoId) ? sucursalById.get(corpoId) ?? null : null;
    }
}
