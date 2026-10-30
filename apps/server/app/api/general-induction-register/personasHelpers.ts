import { NextRequest } from "next/server";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";

/**
 * `c_registro_induccion_general.colaboradores`/`.capacitadores` (LongText JSON) fueron reemplazados
 * por las tablas `c_colaboradores_induccion_general`/`c_capacitadores_induccion_general` (una fila
 * por persona, FK a `registro_id`, ON DELETE CASCADE). Estos helpers mantienen el contrato de la API
 * sin cambios: el cliente sigue enviando y recibiendo `colaboradores`/`capacitadores` como strings
 * JSON de `PersonaItem[]` (`{ id_local, nombre, cedula, puesto_text?, puesto_id?, firma }`).
 */

/**
 * Columnas reales de `c_registro_induccion_general` (sin `colaboradores`/`capacitadores`, que ya no
 * existen en la base externa). Cualquier `findMany`/`findUnique`/`create`/`update`/`delete` sobre esta
 * tabla vía `callDynamicPrisma` debe usar este `select` explícito — un `select`/`include` ausente hace
 * que Prisma pida todas las columnas del modelo, incluidas las eliminadas, y la consulta falla con
 * "column ... does not exist".
 */
export const GENERAL_INDUCTION_SAFE_SELECT = {
    id: true,
    empresa_id: true,
    cliente_id: true,
    corpo_id: true,
    division: true,
    fecha: true,
    temas_a_tratar: true,
    firma_responsable: true,
    created_at: true,
    created_by: true,
    division_id: true,
    contrato_id: true,
    puesto_id: true,
    isActive: true,
} as const;
export type ColaboradorRow = {
    id_local: string;
    nombre: string;
    cedula: string;
    puesto_text: string;
    puesto_id: number;
    firma: string;
};

export type CapacitadorRow = {
    id_local: string;
    nombre: string;
    cedula: string;
    firma: string;
};

function parsePersonasInput(raw: unknown): any[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.trim().length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            /* noop */
        }
    }
    return [];
}

export function parseColaboradoresInput(raw: unknown): ColaboradorRow[] {
    return parsePersonasInput(raw)
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
            id_local: p.id_local != null ? String(p.id_local) : "",
            nombre: p.nombre != null ? String(p.nombre) : "",
            cedula: p.cedula != null ? String(p.cedula) : "",
            puesto_text: p.puesto_text != null ? String(p.puesto_text) : "",
            // Columna INT NOT NULL sin FK: 0 representa "sin puesto".
            puesto_id: p.puesto_id != null && Number.isFinite(Number(p.puesto_id)) ? Number(p.puesto_id) : 0,
            firma: p.firma != null ? String(p.firma) : "",
        }));
}

export function parseCapacitadoresInput(raw: unknown): CapacitadorRow[] {
    return parsePersonasInput(raw)
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
            id_local: p.id_local != null ? String(p.id_local) : "",
            nombre: p.nombre != null ? String(p.nombre) : "",
            cedula: p.cedula != null ? String(p.cedula) : "",
            firma: p.firma != null ? String(p.firma) : "",
        }));
}

export async function createColaboradoresForRegistro(
    req: NextRequest,
    registroId: number,
    raw: unknown
): Promise<ColaboradorRow[]> {
    const parsed = parseColaboradoresInput(raw);
    for (const c of parsed) {
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_colaboradores_induccion_general",
                operation: "create",
                data: { registro_id: registroId, ...c },
            },
        });
    }
    return parsed;
}

export async function createCapacitadoresForRegistro(
    req: NextRequest,
    registroId: number,
    raw: unknown
): Promise<CapacitadorRow[]> {
    const parsed = parseCapacitadoresInput(raw);
    for (const c of parsed) {
        await callDynamicPrisma({
            req,
            data: {
                action: "POST",
                table: "c_capacitadores_induccion_general",
                operation: "create",
                data: { registro_id: registroId, ...c },
            },
        });
    }
    return parsed;
}

export async function replaceColaboradoresForRegistro(
    req: NextRequest,
    registroId: number,
    raw: unknown
): Promise<ColaboradorRow[]> {
    await callDynamicPrisma({
        req,
        data: {
            action: "DELETE",
            table: "c_colaboradores_induccion_general",
            operation: "deleteMany",
            where: { registro_id: registroId },
        },
    });
    return createColaboradoresForRegistro(req, registroId, raw);
}

export async function replaceCapacitadoresForRegistro(
    req: NextRequest,
    registroId: number,
    raw: unknown
): Promise<CapacitadorRow[]> {
    await callDynamicPrisma({
        req,
        data: {
            action: "DELETE",
            table: "c_capacitadores_induccion_general",
            operation: "deleteMany",
            where: { registro_id: registroId },
        },
    });
    return createCapacitadoresForRegistro(req, registroId, raw);
}

/** Adjunta `colaboradores`/`capacitadores` (strings JSON) a cada registro, como esperaba el cliente antes de la migración. */
export async function hydratePersonasForRecords(req: NextRequest, records: any[]): Promise<any[]> {
    const ids = [...new Set(records.map((r) => Number(r.id)).filter((n) => Number.isFinite(n)))];
    if (ids.length === 0) {
        return records.map((r) => ({ ...r, colaboradores: "[]", capacitadores: "[]" }));
    }

    const [colabRows, capRows] = await Promise.all([
        callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_colaboradores_induccion_general",
                operation: "findMany",
                where: { registro_id: { in: ids } },
            },
        }),
        callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "c_capacitadores_induccion_general",
                operation: "findMany",
                where: { registro_id: { in: ids } },
            },
        }),
    ]);

    const colabByRegistro = new Map<number, ColaboradorRow[]>();
    for (const c of (Array.isArray(colabRows) ? colabRows : []) as any[]) {
        const rid = Number(c.registro_id);
        if (!colabByRegistro.has(rid)) colabByRegistro.set(rid, []);
        colabByRegistro.get(rid)!.push({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            puesto_text: c.puesto_text,
            puesto_id: c.puesto_id,
            firma: c.firma,
        });
    }

    const capByRegistro = new Map<number, CapacitadorRow[]>();
    for (const c of (Array.isArray(capRows) ? capRows : []) as any[]) {
        const rid = Number(c.registro_id);
        if (!capByRegistro.has(rid)) capByRegistro.set(rid, []);
        capByRegistro.get(rid)!.push({
            id_local: c.id_local,
            nombre: c.nombre,
            cedula: c.cedula,
            firma: c.firma,
        });
    }

    return records.map((r) => ({
        ...r,
        colaboradores: JSON.stringify(colabByRegistro.get(Number(r.id)) ?? []),
        capacitadores: JSON.stringify(capByRegistro.get(Number(r.id)) ?? []),
    }));
}
