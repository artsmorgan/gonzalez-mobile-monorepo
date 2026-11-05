import { NextRequest } from "next/server";
import axios from "axios";
import { prisma } from "./prismaClient";

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

async function fetchEjecutivoNombreMap(_req: NextRequest, ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!ids.length) return map;

    const rows = await prisma.n_ejecutivo_cuenta.findMany({
        where: { id: { in: ids } },
    });

    for (const row of rows) {
        const mapped = mapIdNombre(row);
        if (mapped) map.set(mapped.id, mapped.nombre);
    }

    return map;
}

export async function fetchEjecutivoCuentaOptions(_req: NextRequest) {
    const ejecutivosRaw = await prisma.n_ejecutivo_cuenta.findMany({
        orderBy: { nombre: "asc" },
    });

    const ejecutivos = ejecutivosRaw
        .map(mapIdNombre)
        .filter((row): row is IdNombre => row !== null);

    return { ejecutivos };
}

export async function fetchEmpleadoEjecutivoList(_req: NextRequest): Promise<EmpleadoEjecutivoRow[]> {
    const list = await prisma.c_empleado.findMany({
        where: { supervisor_id: { not: null } },
        orderBy: { codigo: "asc" },
    });

    const ejecutivoIds = [
        ...new Set(
            list
                .map((row) => Number(row?.supervisor_id))
                .filter((id: number) => Number.isFinite(id) && id > 0)
        ),
    ];

    const ejecutivoMap = await fetchEjecutivoNombreMap(_req, ejecutivoIds);

    return list
        .map((row) => {
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

async function findEmpleadoById(_req: NextRequest, empleadoId: number) {
    return prisma.c_empleado.findUnique({ where: { id: empleadoId } });
}

/** Lectura directa de `c_empleado` (sin callDynamicPrisma). */
export async function findEmpleadoEjecutivoById(req: NextRequest, empleadoId: number) {
    return findEmpleadoById(req, empleadoId);
}

async function findEjecutivoById(_req: NextRequest, ejecutivoId: number) {
    return prisma.n_ejecutivo_cuenta.findUnique({ where: { id: ejecutivoId } });
}

export async function assignEmpleadoEjecutivo(
    req: NextRequest,
    empleado_id: number,
    ejecutivo_cuenta_id: number,
    planillasToken: string
): Promise<EmpleadoEjecutivoRow> {
    const empleado = await findEmpleadoById(req, empleado_id);
    if (!empleado) {
        throw new Error("Empleado no encontrado");
    }

    const ejecutivo = await findEjecutivoById(req, ejecutivo_cuenta_id);
    if (!ejecutivo) {
        throw new Error("Ejecutivo de cuenta no encontrado");
    }

    const token = String(planillasToken ?? "").trim();
    if (!token) {
        throw new Error("Token de Planillas requerido");
    }

    const planillasUrl = process.env.PLANILLAS_URL?.trim();
    if (!planillasUrl) {
        throw new Error("PLANILLAS_URL no configurado");
    }

    const planillasResponse = await axios.put(
        `${planillasUrl}/empleados/${empleado_id}/ejecutivo-cuenta`,
        { supervisor_id: ejecutivo_cuenta_id },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );

    if (!planillasResponse.data?.success) {
        throw new Error("Error al actualizar el ejecutivo de cuenta del empleado");
    }

    const empleado_codigo = String(empleado?.codigo ?? "").trim();
    const empleado_nombre = formatEmpleadoNombre(empleado);
    const ejecutivo_nombre = String(ejecutivo?.nombre ?? "").trim() || `Ejecutivo #${ejecutivo_cuenta_id}`;

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

export async function removeEmpleadoEjecutivo(
    req: NextRequest,
    empleado_id: number,
    planillasToken: string
): Promise<void> {
    const empleado = await findEmpleadoById(req, empleado_id);
    if (!empleado) {
        throw new Error("Empleado no encontrado");
    }

    const supervisorId = Number(empleado.supervisor_id);
    if (!Number.isFinite(supervisorId) || supervisorId <= 0) {
        throw new Error("El empleado no tiene un ejecutivo de cuenta asignado");
    }

    const token = String(planillasToken ?? "").trim();
    if (!token) {
        throw new Error("Token de Planillas requerido");
    }

    const planillasUrl = process.env.PLANILLAS_URL?.trim();
    if (!planillasUrl) {
        throw new Error("PLANILLAS_URL no configurado");
    }

    const planillasResponse = await axios.put(
        `${planillasUrl}/empleados/${empleado_id}/ejecutivo-cuenta`,
        { supervisor_id: null },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        }
    );

    if (!planillasResponse.data?.success) {
        throw new Error("Error al eliminar el ejecutivo de cuenta del empleado");
    }
}
