import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";

export const runtime = "nodejs";

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
    const fechaValue = fecha ? new Date(fecha) : createdAt;
    const inicioValue = inicio ? new Date(inicio) : (hora_inicio ? new Date(hora_inicio) : createdAt);
    const finValue = fin ? new Date(fin) : (hora_fin ? new Date(hora_fin) : createdAt);

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
          inicio: inicioValue.toISOString(),
          fin: finValue.toISOString(),
          combustible_inicio: String(combustible_inicio ?? ""),
          combustible_fin: String(combustible_fin ?? ""),
          km_inicio: Number(km_inicio ?? 0),
          km_fin: Number(km_fin ?? 0),
          motivo: String(motivo ?? ""),
          firma_conductor: String(firma_conductor ?? ""),
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
              inicio: inicioValue.toISOString(),
              fin: finValue.toISOString(),
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
          const sucursal = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "e_estructura_sucursal",
              operation: "findUnique",
              where: { id: vehiculoObj.sucursal_id },
            },
          });
          if (sucursal) {
            const sucursalObj = sucursal as any;
            sucursalNombre = sucursalObj.nombre;
          }
        }
        let empNombre = "Desconocido";
        if (Number(payload?.id ?? "0")) {
          const empleado = await callDynamicPrisma({
            req,
            data: {
              action: "GET",
              table: "c_empleado",
              operation: "findUnique",
              where: { id: Number(payload?.id ?? "0") },
            },
          });
          if (empleado) {
            const empleadoObj = empleado as any;
            empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
          }
        }
        let fechaRegistro = fechaValue.toISOString().split("T")[0];
        const descriptionNotificacion = "El empleado " + empNombre + " ha registrado el uso del vehículo con la placa " + vehiculoPlaca + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
        await sendNotificationByRole(req, vehiculoObj.sucursal_id, [Number(payload?.id ?? "0")], "Uso de vehículo corporativo registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
      }
    }

    return NextResponse.json({ status: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles/[id]/uses:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


