import { NextRequest } from "next/server";
import { callDynamicPrisma } from "./callDynamicPrisma";

export const EMPLEADO_EJECUTIVO_SLUG = "empleados-ejecutivos";
export const EMPLEADO_TABLE = "c_empleado";
export const EJECUTIVO_CUENTA_TABLE = "n_ejecutivo_cuenta";

type IdNombre = { id: number; nombre: string };

export type EmpleadoEjecutivoRow = {
    id: number;
    empleado_id: number;
    empleado_codigo: string;
    empleado_nombre: string;
    ejecutivo_cuenta_id: number;
    ejecutivo_nombre: string;
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

function formatEmpleadoNombre(row: {
    nombre?: unknown;
    primer_apellido?: unknown;
    segundo_apellido?: unknown;
    codigo?: unknown;
}): string {
    const parts = [
        String(row.nombre ?? "").trim(),
        String(row.primer_apellido ?? "").trim(),
        String(row.segundo_apellido ?? "").trim(),
    ].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return String(row.codigo ?? "").trim();
}

export function buildEmpleadoEjecutivoLabel(
    empleadoCodigo: string,
    empleadoNombre: string,
    ejecutivoNombre: string
): string {
    const emp = empleadoCodigo ? `${empleadoCodigo} — ${empleadoNombre}` : empleadoNombre;
    return `${emp} → ${ejecutivoNombre}`;
}

async function fetchEjecutivoNombreMap(req: NextRequest, ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!ids.length) return map;

    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EJECUTIVO_CUENTA_TABLE,
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

export async function fetchEjecutivoCuentaOptions(req: NextRequest) {
    const ejecutivosRaw = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EJECUTIVO_CUENTA_TABLE,
            operation: "findMany",
            orderBy: { nombre: "asc" },
        },
    });

    const ejecutivos = (Array.isArray(ejecutivosRaw) ? ejecutivosRaw : [])
        .map(mapIdNombre)
        .filter((row): row is IdNombre => row !== null);

    return { ejecutivos };
}

export async function fetchEmpleadoEjecutivoList(req: NextRequest): Promise<EmpleadoEjecutivoRow[]> {
    const rows = await callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EMPLEADO_TABLE,
            operation: "findMany",
            where: { supervisor_id: { not: null } },
            orderBy: { codigo: "asc" },
        },
    });

    const list = Array.isArray(rows) ? rows : [];
    const ejecutivoIds = [
        ...new Set(
            list
                .map((row: any) => Number(row?.supervisor_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        ),
    ];

    const ejecutivoMap = await fetchEjecutivoNombreMap(req, ejecutivoIds);

    return list
        .map((row: any) => {
            const empleado_id = Number(row?.id);
            const ejecutivo_cuenta_id = Number(row?.supervisor_id);
            if (!Number.isFinite(empleado_id) || empleado_id <= 0) return null;
            if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;

            const empleado_codigo = String(row?.codigo ?? "").trim();
            const empleado_nombre = formatEmpleadoNombre(row);
            const ejecutivo_nombre = ejecutivoMap.get(ejecutivo_cuenta_id) ?? `Ejecutivo #${ejecutivo_cuenta_id}`;

            return {
                id: empleado_id,
                empleado_id,
                empleado_codigo,
                empleado_nombre,
                ejecutivo_cuenta_id,
                ejecutivo_nombre,
                nombre: buildEmpleadoEjecutivoLabel(empleado_codigo, empleado_nombre, ejecutivo_nombre),
            };
        })
        .filter((row): row is EmpleadoEjecutivoRow => row !== null)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function mapEmpleadoEjecutivoRow(
    req: NextRequest,
    empleado: unknown
): Promise<EmpleadoEjecutivoRow | null> {
    if (!empleado || typeof empleado !== "object") return null;
    const row = empleado as {
        id?: unknown;
        codigo?: unknown;
        nombre?: unknown;
        primer_apellido?: unknown;
        segundo_apellido?: unknown;
        supervisor_id?: unknown;
    };

    const empleado_id = Number(row.id);
    const ejecutivo_cuenta_id = Number(row.supervisor_id);
    if (!Number.isFinite(empleado_id) || empleado_id <= 0) return null;
    if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;

    const ejecutivoMap = await fetchEjecutivoNombreMap(req, [ejecutivo_cuenta_id]);
    const empleado_codigo = String(row.codigo ?? "").trim();
    const empleado_nombre = formatEmpleadoNombre(row);
    const ejecutivo_nombre = ejecutivoMap.get(ejecutivo_cuenta_id) ?? `Ejecutivo #${ejecutivo_cuenta_id}`;

    return {
        id: empleado_id,
        empleado_id,
        empleado_codigo,
        empleado_nombre,
        ejecutivo_cuenta_id,
        ejecutivo_nombre,
        nombre: buildEmpleadoEjecutivoLabel(empleado_codigo, empleado_nombre, ejecutivo_nombre),
    };
}

export function parseEmpleadoEjecutivoPayload(
    body: unknown,
    empleadoIdFromUrl?: number
): { empleado_id: number; ejecutivo_cuenta_id: number } | null {
    if (!body || typeof body !== "object") return null;
    const b = body as { empleado_id?: unknown; ejecutivo_cuenta_id?: unknown };

    const empleado_id =
        empleadoIdFromUrl != null && Number.isFinite(empleadoIdFromUrl) && empleadoIdFromUrl > 0
            ? empleadoIdFromUrl
            : Number(b.empleado_id);
    const ejecutivo_cuenta_id = Number(b.ejecutivo_cuenta_id);

    if (!Number.isFinite(empleado_id) || empleado_id <= 0) return null;
    if (!Number.isFinite(ejecutivo_cuenta_id) || ejecutivo_cuenta_id <= 0) return null;

    return { empleado_id, ejecutivo_cuenta_id };
}

async function findEmpleadoById(req: NextRequest, empleadoId: number) {
    return callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EMPLEADO_TABLE,
            operation: "findUnique",
            where: { id: empleadoId },
        },
    });
}

async function findEjecutivoById(req: NextRequest, ejecutivoId: number) {
    return callDynamicPrisma({
        req,
        data: {
            action: "GET",
            table: EJECUTIVO_CUENTA_TABLE,
            operation: "findUnique",
            where: { id: ejecutivoId },
        },
    });
}

export async function assignEmpleadoEjecutivo(
    req: NextRequest,
    empleado_id: number,
    ejecutivo_cuenta_id: number
): Promise<EmpleadoEjecutivoRow> {
    const empleado = await findEmpleadoById(req, empleado_id);
    if (!empleado) {
        throw new Error("Empleado no encontrado");
    }

    const ejecutivo = await findEjecutivoById(req, ejecutivo_cuenta_id);
    if (!ejecutivo) {
        throw new Error("Ejecutivo de cuenta no encontrado");
    }

    const updated = await callDynamicPrisma({
        req,
        data: {
            action: "UPDATE",
            table: EMPLEADO_TABLE,
            operation: "update",
            where: { id: empleado_id },
            data: { supervisor_id: ejecutivo_cuenta_id },
        },
    });

    const mapped = await mapEmpleadoEjecutivoRow(req, updated);
    if (!mapped) {
        throw new Error("No se pudo guardar la relación");
    }

    return mapped;
}

export async function removeEmpleadoEjecutivo(req: NextRequest, empleado_id: number): Promise<void> {
    const empleado = await findEmpleadoById(req, empleado_id);
    if (!empleado) {
        throw new Error("Empleado no encontrado");
    }

    const supervisorId = Number((empleado as { supervisor_id?: unknown }).supervisor_id);
    if (!Number.isFinite(supervisorId) || supervisorId <= 0) {
        throw new Error("El empleado no tiene un ejecutivo de cuenta asignado");
    }

    await callDynamicPrisma({
        req,
        data: {
            action: "UPDATE",
            table: EMPLEADO_TABLE,
            operation: "update",
            where: { id: empleado_id },
            data: { supervisor_id: null },
        },
    });
}
