import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export const runtime = "nodejs";

const normalizeHora = (raw?: any): string | null => {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    const parts = v.split(":");
    const hh = parts[0].padStart(2, "0");
    const mm = (parts[1] || "00").padStart(2, "0");
    const ss = (parts[2] || "00").padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  if (v.includes("T")) {
    const timePart = v.split("T")[1] || "";
    return timePart.substring(0, 8);
  }
  return null;
};

const toIsoSafe = (value: any): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const useToApiShape = (u: any) => {
  const inicioIso = toIsoSafe(u?.inicio || u?.hora_inicio);
  const finIso = toIsoSafe(u?.fin || u?.hora_fin);
  const fechaIso = toIsoSafe(u?.fecha || u?.fecha_inicio || inicioIso);
  const fechaInicioIso = toIsoSafe(u?.fecha_inicio || fechaIso);
  const fechaFinIso = toIsoSafe(u?.fecha_fin || fechaIso);
  return {
    ...u,
    fecha_inicio: fechaInicioIso,
    fecha_fin: fechaFinIso,
    hora_inicio: inicioIso,
    hora_fin: finIso,
  };
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const usos = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_usos_vehiculos_corporativos",
        operation: "findMany",
        where: { vehiculo_id: vehiculoId },
        orderBy: { id: "desc" },
      },
    });

    const usosArray = Array.isArray(usos) ? usos : [];
    // Adjuntamos bitácora vinculada si existe (no hay relación Prisma declarada)
    const bitacoraIds = Array.from(
      new Set(usosArray.map((u: any) => u.bitacora_id).filter((id: any): id is number => typeof id === "number" && Number.isFinite(id)))
    );
    const bitacoras = bitacoraIds.length
      ? await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_bitacora_vehiculo_detenido",
            operation: "findMany",
            where: { id: { in: bitacoraIds } },
          },
        })
      : [];
    const bitacorasArray = Array.isArray(bitacoras) ? bitacoras : [];
    const bitacoraById = new Map(bitacorasArray.map((b: any) => [b.id, b]));

    const mapped = usosArray.map((u: any) => ({
      ...useToApiShape(u),
      bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
    }));

    console.log('mapped', mapped);

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const body = await req.json();
    const {
      nombre_conductor,
      codigo_conductor,
      fecha,
      inicio,
      fin,
      fecha_inicio,
      fecha_fin,
      hora_inicio,
      hora_fin,
      combustible_inicio,
      combustible_fin,
      km_inicio,
      km_fin,
      motivo,
      firma_conductor,
      firma_responsable,
      // bitacora_id: ignorado por solicitud
    } = body || {};

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const fechaValue = fecha
      ? new Date(fecha)
      : (fecha_inicio ? new Date(fecha_inicio) : (fecha_fin ? new Date(fecha_fin) : createdAt));

    const horaInicioNorm = normalizeHora(hora_inicio || inicio);
    const horaFinNorm = normalizeHora(hora_fin || fin);

    const buildDateTimeFromFechaAndHora = (fechaBase: Date, horaNorm: string | null): Date => {
      if (!horaNorm) return fechaBase;
      const [hh, mm, ss] = horaNorm.split(':');
      const d = new Date(fechaBase);
      d.setHours(Number(hh) || 0, Number(mm) || 0, Number(ss) || 0, 0);
      return d;
    };

    const inicioValue = fecha_inicio.split('T')[0] + 'T' + hora_inicio.split('T')[1];
    const finValue = fecha_fin.split('T')[0] + 'T' + hora_fin.split('T')[1];

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_usos_vehiculos_corporativos",
        operation: "create",
        data: {
          vehiculo_id: vehiculoId,
          nombre_conductor: String(nombre_conductor ?? ""),
          codigo_conductor: String(codigo_conductor ?? ""),
          fecha: fechaValue.toISOString(),
          inicio: inicioValue,
          fin: finValue,
          combustible_inicio: String(combustible_inicio ?? ""),
          combustible_fin: String(combustible_fin ?? ""),
          km_inicio: Number(km_inicio ?? 0),
          km_fin: Number(km_fin ?? 0),
          motivo: String(motivo ?? ""),
          firma_conductor:
            firma_conductor != null && String(firma_conductor).trim().length > 0
              ? String(firma_conductor).trim()
              : null,
          firma_responsable: String(firma_responsable ?? ""),
        },
      },
    });
    const createdObj = created as any;

    // Registrar cambio de creación
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_usos_vehiculos_corporativos",
          registro_id: createdObj.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: createdObj.id,
              vehiculo_id: createdObj.vehiculo_id,
              nombre_conductor: createdObj.nombre_conductor,
              codigo_conductor: createdObj.codigo_conductor,
              fecha: fechaValue.toISOString(),
              inicio: inicioValue,
              fin: finValue,
              combustible_inicio: createdObj.combustible_inicio,
              combustible_fin: createdObj.combustible_fin,
              km_inicio: createdObj.km_inicio,
              km_fin: createdObj.km_fin,
              motivo: createdObj.motivo,
              firma_conductor: createdObj.firma_conductor,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    if (createdObj) {
      const vehiculo = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_vehiculos_corporativos",
          operation: "findUnique",
          where: { id: createdObj.vehiculo_id },
        },
      });
      if (vehiculo) {
        const vehiculoObj = vehiculo as any;
        let vehiculoPlaca = vehiculoObj.placa;
        let sucursalNombre = "Desconocida";
        if (vehiculoObj.sucursal_id) {
          const sucursal = await prisma.e_estructura_sucursal.findUnique({
            where: { id: vehiculoObj.sucursal_id },
          });
          if (sucursal) {
            sucursalNombre = sucursal.nombre;
          }
        }
        let empNombre = "Desconocido";
        if (Number(payload?.id ?? "0")) {
          const empleado = await prisma.c_empleado.findUnique({
            where: { id: Number(payload?.id ?? "0") },
          });
          if (empleado) {
            empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
          }
        }
        let fechaRegistro = fechaValue.toISOString().split("T")[0];
        const descriptionNotificacion = "El empleado " + empNombre + " ha registrado el uso del vehículo con la placa " + vehiculoPlaca + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
        await sendNotificationByRole(req, vehiculoObj.sucursal_id, [Number(payload?.id ?? "0")], "Uso de vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
      }
    }

    const shaped = useToApiShape(createdObj) as Record<string, unknown>;
    return NextResponse.json(
      { status: true, data: { id: createdObj?.id, ...shaped } },
      { status: 201 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


