import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { prisma } from "./prismaClient";

export const SUPER_ADMINS_SLUG = "super-admins";
export const SUPER_ADMINS_TABLE = "n_employees_superadmin";

export type SuperAdminNomenclatorRow = {
  id: number;
  nombre: string;
  employee_cedula: string;
  empleado_id: number | null;
  empleado_codigo: string | null;
  empleado_nombre: string | null;
  created_at: string | null;
};

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

function buildLabel(params: {
  codigo?: string | null;
  nombre?: string | null;
  cedula: string;
}): string {
  const codigo = String(params.codigo ?? "").trim();
  const nombre = String(params.nombre ?? "").trim();
  const cedula = String(params.cedula ?? "").trim();
  if (codigo && nombre) return `${codigo} — ${nombre} (${cedula})`;
  if (nombre) return `${nombre} (${cedula})`;
  if (codigo) return `${codigo} (${cedula})`;
  return cedula || "Sin cédula";
}

export function parseSuperAdminCreatePayload(body: unknown): { empleado_id: number } | null {
  if (!body || typeof body !== "object") return null;
  const empleado_id = Number((body as { empleado_id?: unknown }).empleado_id);
  if (!Number.isFinite(empleado_id) || empleado_id <= 0) return null;
  return { empleado_id };
}

export async function mapSuperAdminRow(
  row: unknown,
  empleadoByCedula?: Map<string, { id: number; codigo: string | null; nombre: string }>
): Promise<SuperAdminNomenclatorRow | null> {
  if (!row || typeof row !== "object") return null;
  const r = row as { id?: unknown; employee_cedula?: unknown; created_at?: unknown };
  const id = Number(r.id);
  const employee_cedula = String(r.employee_cedula ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !employee_cedula) return null;

  let empleado = empleadoByCedula?.get(employee_cedula) ?? null;
  if (!empleado && !empleadoByCedula) {
    const found = await prisma.c_empleado.findFirst({
      where: { cedula: employee_cedula },
      select: { id: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
    });
    if (found) {
      empleado = {
        id: found.id,
        codigo: found.codigo != null ? String(found.codigo) : null,
        nombre: formatEmpleadoNombre(found),
      };
    }
  }

  const createdAtRaw = r.created_at;
  let created_at: string | null = null;
  if (createdAtRaw instanceof Date) {
    created_at = createdAtRaw.toISOString();
  } else if (createdAtRaw != null && String(createdAtRaw).trim()) {
    const d = new Date(String(createdAtRaw));
    created_at = Number.isFinite(d.getTime()) ? d.toISOString() : String(createdAtRaw);
  }

  return {
    id,
    employee_cedula,
    empleado_id: empleado?.id ?? null,
    empleado_codigo: empleado?.codigo ?? null,
    empleado_nombre: empleado?.nombre ?? null,
    created_at,
    nombre: buildLabel({
      codigo: empleado?.codigo,
      nombre: empleado?.nombre,
      cedula: employee_cedula,
    }),
  };
}

export async function fetchSuperAdminsList(req: NextRequest): Promise<SuperAdminNomenclatorRow[]> {
  const rows = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: SUPER_ADMINS_TABLE,
      operation: "findMany",
      orderBy: { id: "desc" },
    },
  });

  const list = Array.isArray(rows) ? rows : [];
  const cedulas = [
    ...new Set(
      list
        .map((r: any) => String(r?.employee_cedula ?? "").trim())
        .filter((c: string) => c.length > 0)
    ),
  ];

  const empleados =
    cedulas.length > 0
      ? await prisma.c_empleado.findMany({
          where: { cedula: { in: cedulas } },
          select: { id: true, cedula: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
        })
      : [];

  const byCedula = new Map<string, { id: number; codigo: string | null; nombre: string }>();
  for (const e of empleados) {
    const cedula = String(e.cedula ?? "").trim();
    if (!cedula) continue;
    byCedula.set(cedula, {
      id: e.id,
      codigo: e.codigo != null ? String(e.codigo) : null,
      nombre: formatEmpleadoNombre(e),
    });
  }

  const mapped: SuperAdminNomenclatorRow[] = [];
  for (const row of list) {
    const m = await mapSuperAdminRow(row, byCedula);
    if (m) mapped.push(m);
  }
  return mapped;
}

export async function createSuperAdmin(
  req: NextRequest,
  empleadoId: number
): Promise<{ ok: true; data: SuperAdminNomenclatorRow } | { ok: false; message: string; status: number }> {
  const empleado = await prisma.c_empleado.findUnique({
    where: { id: empleadoId },
    select: { id: true, cedula: true, codigo: true, nombre: true, primer_apellido: true, segundo_apellido: true },
  });
  if (!empleado) {
    return { ok: false, message: "Empleado no encontrado", status: 404 };
  }

  const employee_cedula = String(empleado.cedula ?? "").trim();
  if (!employee_cedula) {
    return { ok: false, message: "El empleado no tiene cédula registrada", status: 400 };
  }

  const existing = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: SUPER_ADMINS_TABLE,
      operation: "findFirst",
      where: { employee_cedula },
    },
  });
  if (existing) {
    return { ok: false, message: "Este empleado ya es super admin", status: 409 };
  }

  const created_at = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
  const created = await callDynamicPrisma({
    req,
    data: {
      action: "POST",
      table: SUPER_ADMINS_TABLE,
      operation: "create",
      data: {
        employee_cedula,
        created_at,
      },
    },
  });

  const mapped = await mapSuperAdminRow(created);
  if (!mapped) {
    return { ok: false, message: "No se pudo crear el registro", status: 500 };
  }
  return { ok: true, data: mapped };
}

export async function deleteSuperAdmin(
  req: NextRequest,
  id: number
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const existing = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: SUPER_ADMINS_TABLE,
      operation: "findUnique",
      where: { id },
    },
  });
  if (!existing) {
    return { ok: false, message: "Registro no encontrado", status: 404 };
  }

  await callDynamicPrisma({
    req,
    data: {
      action: "DELETE",
      table: SUPER_ADMINS_TABLE,
      operation: "delete",
      where: { id },
    },
  });

  return { ok: true };
}
