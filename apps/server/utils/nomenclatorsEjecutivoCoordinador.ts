import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const EJECUTIVO_COORDINADOR_SLUG = "coordinadores-ejecutivos";
export const EJECUTIVO_COORDINADOR_TABLE = "n_ejecutivo_cuenta_coordinador";

type IdNombre = { id: number; nombre: string };

export type EjecutivoCoordinadorRow = {
    id: number;
    ejecutivo_cuenta_id: number;
    coordinador_id: number;
    ejecutivo_nombre: string;
    coordinador_nombre: string;
    nombre: string;
};

function mapIdNombre(row: unknown): IdNombre | null {
    if (!row || typeof row !== "object") return null;
    const r = row as { id?: unknown; nombre?: unknown };
    const id = Number(r.id);
    const nombre = String(r.nombre ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;
    return { id, nombre };
}

export async function fetchEjecutivoCoordinadorOptions(req: NextRequest) {
    const [ejecutivosRaw, coordinadoresRaw] = await Promise.all([
        callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_ejecutivo_cuenta",
                operation: "findMany",
                orderBy: { nombre: "asc" },
            },
        }),
        callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "n_coordinador",
                operation: "findMany",
                where: { coordinadoPor_id: 3, activo: true },
                orderBy: { nombre: "asc" },
            },
        }),
    ]);

    const ejecutivos = (Array.isArray(ejecutivosRaw) ? ejecutivosRaw : [])
        .map(mapIdNombre)
        .filter((row): row is IdNombre => row !== null);

    const coordinadores = (Array.isArray(coordinadoresRaw) ? coordinadoresRaw : [])
        .map(mapIdNombre)
        .filter((row): row is IdNombre => row !== null);

    return { ejecutivos, coordinadores };
}

async function fetchNombreMap(req: NextRequest, table: string, ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!ids.length) return map;

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table,
            operation: "findMany",
            where: { id: { in: ids } },
        },
    });

    for (const row of Array.isArray(rows) ? rows : []) {
        const mapped = mapIdNombre(row);
        if (mapped) map.set(mapped.id, mapped.nombre);
    }

    return map;
}

export function buildEjecutivoCoordinadorLabel(ejecutivoNombre: string, coordinadorNombre: string): string {
    return `${ejecutivoNombre} — ${coordinadorNombre}`;
}

export async function fetchEjecutivoCoordinadorList(req: NextRequest): Promise<EjecutivoCoordinadorRow[]> {
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EJECUTIVO_COORDINADOR_TABLE,
            operation: "findMany",
            orderBy: { id: "asc" },
        },
    });

    const list = Array.isArray(rows) ? rows : [];
    const ejecutivoIds = [
        ...new Set(
            list
                .map((row: any) => Number(row?.ejecutivo_cuenta_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        ),
    ];
    const coordinadorIds = [
        ...new Set(
            list
                .map((row: any) => Number(row?.coordinador_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        ),
    ];

    const [ejecutivoMap, coordinadorMap] = await Promise.all([
        fetchNombreMap(req, "n_ejecutivo_cuenta", ejecutivoIds),
        fetchNombreMap(req, "n_coordinador", coordinadorIds),
    ]);

    return list
        .map((row: any) => {
            const id = Number(row?.id);
            const ejecutivo_cuenta_id = Number(row?.ejecutivo_cuenta_id);
            const coordinador_id = Number(row?.coordinador_id);
            if (!Number.isFinite(id) || id <= 0) return null;
            if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;
            if (!Number.isFinite(coordinador_id) || coordinador_id <= 0) return null;

            const ejecutivo_nombre = ejecutivoMap.get(ejecutivo_cuenta_id) ?? `Ejecutivo #${ejecutivo_cuenta_id}`;
            const coordinador_nombre = coordinadorMap.get(coordinador_id) ?? `Coordinador #${coordinador_id}`;

            return {
                id,
                ejecutivo_cuenta_id,
                coordinador_id,
                ejecutivo_nombre,
                coordinador_nombre,
                nombre: buildEjecutivoCoordinadorLabel(ejecutivo_nombre, coordinador_nombre),
            };
        })
        .filter((row): row is EjecutivoCoordinadorRow => row !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function findEjecutivoCoordinadorConflict(
    req: NextRequest,
    field: "ejecutivo_cuenta_id" | "coordinador_id",
    value: number,
    excludeId?: number
) {
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EJECUTIVO_COORDINADOR_TABLE,
            operation: "findMany",
            where: { [field]: value },
        },
    });

    const list = Array.isArray(rows) ? rows : [];
    return (
        list.find((row: any) => {
            const rowId = Number(row?.id);
            if (!Number.isFinite(rowId) || rowId <= 0) return false;
            if (excludeId != null && rowId === excludeId) return false;
            return true;
        }) ?? null
    );
}

/** Cada ejecutivo y cada coordinador solo puede pertenecer a un registro a la vez. */
export async function validateEjecutivoCoordinadorAssignment(
    req: NextRequest,
    ejecutivo_cuenta_id: number,
    coordinador_id: number,
    excludeId?: number
): Promise<{ valid: true } | { valid: false; message: string }> {
    const [ejecutivoConflict, coordinadorConflict] = await Promise.all([
        findEjecutivoCoordinadorConflict(req, "ejecutivo_cuenta_id", ejecutivo_cuenta_id, excludeId),
        findEjecutivoCoordinadorConflict(req, "coordinador_id", coordinador_id, excludeId),
    ]);

    if (ejecutivoConflict) {
        const ejecutivoMap = await fetchNombreMap(req, "n_ejecutivo_cuenta", [ejecutivo_cuenta_id]);
        const nombre = ejecutivoMap.get(ejecutivo_cuenta_id) ?? "ese ejecutivo de cuenta";
        return {
            valid: false,
            message: `El ejecutivo de cuenta "${nombre}" ya está asignado en otro registro`,
        };
    }

    if (coordinadorConflict) {
        const coordinadorMap = await fetchNombreMap(req, "n_coordinador", [coordinador_id]);
        const nombre = coordinadorMap.get(coordinador_id) ?? "ese coordinador";
        return {
            valid: false,
            message: `El coordinador "${nombre}" ya está asignado en otro registro`,
        };
    }

    return { valid: true };
}

export async function mapEjecutivoCoordinadorRow(
    req: NextRequest,
    row: unknown
): Promise<EjecutivoCoordinadorRow | null> {
    if (!row || typeof row !== "object") return null;
    const r = row as { id?: unknown; ejecutivo_cuenta_id?: unknown; coordinador_id?: unknown };
    const id = Number(r.id);
    const ejecutivo_cuenta_id = Number(r.ejecutivo_cuenta_id);
    const coordinador_id = Number(r.coordinador_id);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;
    if (!Number.isFinite(coordinador_id) || coordinador_id <= 0) return null;

    const [ejecutivoMap, coordinadorMap] = await Promise.all([
        fetchNombreMap(req, "n_ejecutivo_cuenta", [ejecutivo_cuenta_id]),
        fetchNombreMap(req, "n_coordinador", [coordinador_id]),
    ]);

    const ejecutivo_nombre = ejecutivoMap.get(ejecutivo_cuenta_id) ?? `Ejecutivo #${ejecutivo_cuenta_id}`;
    const coordinador_nombre = coordinadorMap.get(coordinador_id) ?? `Coordinador #${coordinador_id}`;

    return {
        id,
        ejecutivo_cuenta_id,
        coordinador_id,
        ejecutivo_nombre,
        coordinador_nombre,
        nombre: buildEjecutivoCoordinadorLabel(ejecutivo_nombre, coordinador_nombre),
    };
}

export function parseEjecutivoCoordinadorPayload(body: unknown): {
    ejecutivo_cuenta_id: number;
    coordinador_id: number;
} | null {
    if (!body || typeof body !== "object") return null;
    const b = body as { ejecutivo_cuenta_id?: unknown; coordinador_id?: unknown };
    const ejecutivo_cuenta_id = Number(b.ejecutivo_cuenta_id);
    const coordinador_id = Number(b.coordinador_id);
    if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;
    if (!Number.isFinite(coordinador_id) || coordinador_id <= 0) return null;
    return { ejecutivo_cuenta_id, coordinador_id };
}
