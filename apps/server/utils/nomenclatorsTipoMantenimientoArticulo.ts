import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const TIPO_MANTENIMIENTO_ARTICULO_SLUG = "tipos-mantenimiento-articulos";
export const TIPO_MANTENIMIENTO_ARTICULO_TABLE = "n_tipo_mantenimiento_articulo";
export const ARTICULO_CORPO_PUESTO_TABLE = "n_articulo_corpo_puesto";

export type TipoMantenimientoArticuloRow = {
    id: number;
    nombre: string;
    articulo_id: number;
    articulo_nombre: string;
};

type IdNombre = { id: number; nombre: string };

function mapIdNombre(row: unknown): IdNombre | null {
    if (!row || typeof row !== "object") return null;
    const r = row as { id?: unknown; nombre?: unknown };
    const id = Number(r.id);
    const nombre = String(r.nombre ?? "").trim();
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;
    return { id, nombre };
}

export async function fetchArticuloCorpoPuestoOptions(req: NextRequest): Promise<IdNombre[]> {
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: ARTICULO_CORPO_PUESTO_TABLE,
            operation: "findMany",
            orderBy: { nombre: "asc" },
        },
    });

    return (Array.isArray(rows) ? rows : [])
        .map(mapIdNombre)
        .filter((row): row is IdNombre => row !== null);
}

async function fetchArticuloNombreMap(req: NextRequest, ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const unique = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0)));
    if (!unique.length) return map;

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: ARTICULO_CORPO_PUESTO_TABLE,
            operation: "findMany",
            where: { id: { in: unique } },
        },
    });

    for (const row of Array.isArray(rows) ? rows : []) {
        const mapped = mapIdNombre(row);
        if (mapped) map.set(mapped.id, mapped.nombre);
    }

    return map;
}

export async function mapTipoMantenimientoArticuloRow(
    req: NextRequest,
    row: unknown,
    articuloNombreById?: Map<number, string>,
): Promise<TipoMantenimientoArticuloRow | null> {
    if (!row || typeof row !== "object") return null;
    const r = row as { id?: unknown; nombre?: unknown; articulo_id?: unknown };
    const id = Number(r.id);
    const nombre = String(r.nombre ?? "").trim();
    const articuloId = Number(r.articulo_id);
    if (!Number.isFinite(id) || id <= 0 || !nombre) return null;
    if (!Number.isFinite(articuloId) || articuloId <= 0) return null;

    let articuloNombre = articuloNombreById?.get(articuloId) ?? "";
    if (!articuloNombre) {
        const map = await fetchArticuloNombreMap(req, [articuloId]);
        articuloNombre = map.get(articuloId) ?? "";
    }

    return {
        id,
        nombre,
        articulo_id: articuloId,
        articulo_nombre: articuloNombre,
    };
}

export async function fetchTipoMantenimientoArticuloList(
    req: NextRequest,
    articuloId?: number | null,
): Promise<TipoMantenimientoArticuloRow[]> {
    const where =
        articuloId != null && Number.isFinite(articuloId) && articuloId > 0
            ? { articulo_id: articuloId }
            : undefined;

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: TIPO_MANTENIMIENTO_ARTICULO_TABLE,
            operation: "findMany",
            ...(where ? { where } : {}),
            orderBy: { nombre: "asc" },
        },
    });

    const list = Array.isArray(rows) ? rows : [];
    const articuloIds = list
        .map((row) => Number((row as { articulo_id?: unknown })?.articulo_id))
        .filter((id) => Number.isFinite(id) && id > 0);
    const articuloNombreById = await fetchArticuloNombreMap(req, articuloIds);

    const mapped: TipoMantenimientoArticuloRow[] = [];
    for (const row of list) {
        const item = await mapTipoMantenimientoArticuloRow(req, row, articuloNombreById);
        if (item) mapped.push(item);
    }

    return mapped;
}

export function parseTipoMantenimientoArticuloPayload(
    body: unknown,
): { articulo_id: number; nombre: string } | null {
    if (!body || typeof body !== "object") return null;
    const b = body as { articulo_id?: unknown; nombre?: unknown };
    const articulo_id = Number(b.articulo_id);
    const nombre = String(b.nombre ?? "").trim();
    if (!Number.isFinite(articulo_id) || articulo_id <= 0 || !nombre) return null;
    return { articulo_id, nombre };
}

export async function articuloCorpoPuestoExists(req: NextRequest, articuloId: number): Promise<boolean> {
    const row = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: ARTICULO_CORPO_PUESTO_TABLE,
            operation: "findUnique",
            where: { id: articuloId },
        },
    });
    return row != null;
}
