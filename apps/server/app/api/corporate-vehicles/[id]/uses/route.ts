import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const usos = await prisma.c_usos_vehiculos_corporativos.findMany({
      where: { vehiculo_id: vehiculoId },
      orderBy: { id: "desc" },
    });

    // Adjuntamos bitácora vinculada si existe (no hay relación Prisma declarada)
    const bitacoraIds = Array.from(
      new Set(usos.map((u: any) => u.bitacora_id).filter((id: any): id is number => typeof id === "number" && Number.isFinite(id)))
    );
    const bitacoras = bitacoraIds.length
      ? await prisma.c_bitacora_vehiculo_detenido.findMany({ where: { id: { in: bitacoraIds } } })
      : [];
    const bitacoraById = new Map(bitacoras.map((b: any) => [b.id, b]));

    const mapped = usos.map((u: any) => ({
      ...u,
      bitacora: u.bitacora_id ? bitacoraById.get(u.bitacora_id) ?? null : null,
    }));

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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const body = await req.json();
    const {
      nombre_conductor,
      fecha,
      hora_inicio,
      hora_fin,
      combustible_inicio,
      combustible_fin,
      km_inicio,
      km_fin,
      motivo,
      firma_responsable,
      // bitacora_id: ignorado por solicitud
    } = body || {};

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;

    const created = await prisma.c_usos_vehiculos_corporativos.create({
      data: {
        vehiculo_id: vehiculoId,
        nombre_conductor: String(nombre_conductor ?? ""),
        fecha: fecha ? new Date(fecha) : createdAt,
        hora_inicio: hora_inicio ? new Date(hora_inicio) : createdAt,
        hora_fin: hora_fin ? new Date(hora_fin) : createdAt,
        combustible_inicio: Number(combustible_inicio ?? 0),
        combustible_fin: Number(combustible_fin ?? 0),
        km_inicio: Number(km_inicio ?? 0),
        km_fin: Number(km_fin ?? 0),
        motivo: String(motivo ?? ""),
        firma_responsable: String(firma_responsable ?? ""),
      },
    });

    // Registrar cambio de creación
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_usos_vehiculos_corporativos",
        registro_id: created.id,
        cambios: JSON.stringify([{
          prop: "__created__",
          before: null,
          after: {
            id: created.id,
            vehiculo_id: created.vehiculo_id,
            nombre_conductor: created.nombre_conductor,
            fecha: created.fecha.toISOString(),
            hora_inicio: created.hora_inicio.toISOString(),
            hora_fin: created.hora_fin.toISOString(),
            combustible_inicio: created.combustible_inicio,
            combustible_fin: created.combustible_fin,
            km_inicio: created.km_inicio,
            km_fin: created.km_fin,
            motivo: created.motivo,
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    if (created) {
      const vehiculo = await prisma.c_vehiculos_corporativos.findUnique({ where: { id: created.vehiculo_id } });
      if (vehiculo) {
        let vehiculoPlaca = vehiculo.placa;
        let sucursalNombre = "Desconocida";
        if (vehiculo.sucursal_id) {
          const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: vehiculo.sucursal_id } });
          if (sucursal) {
            sucursalNombre = sucursal.nombre;
          }
        }
        let empNombre = "Desconocido";
        if (Number(payload?.id ?? "0")) {
          const empleado = await prisma.c_empleado.findUnique({ where: { id: Number(payload?.id ?? "0") } });
          if (empleado) {
            empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
          }
        }
        let fechaRegistro = created.fecha.toISOString().split("T")[0];
        const descriptionNotificacion = "El empleado " + empNombre + " ha registrado el uso del vehículo con la placa " + vehiculoPlaca + " en la sucursal " + sucursalNombre + " el día " + created.fecha.toISOString().split("T")[0];
        sendNotificationByRole(vehiculo.sucursal_id, [Number(payload?.id ?? "0")], "Uso de vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
      }
    }

    return NextResponse.json({ status: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


