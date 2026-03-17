/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_bitacora_vehiculo_detenido", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      tipo,
      vehiculo_id,
      uso_id,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
      register_vehicle,
    } = body ?? {};

    // Registrar cambios (solo campos actualizados, excluyendo firmas)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];

    // Si no hay vehiculo_id en el registro y se solicita registrar vehículo, crear primero el vehículo corporativo
    let finalVehiculoId: number | null =
      vehiculo_id !== undefined ? (vehiculo_id ? Number(vehiculo_id) : null) : existing.vehiculo_id ?? null;

    if (!finalVehiculoId && register_vehicle) {
      try {
        const {
          placa,
          tipo: vehTipo,
          tipo_autoria,
          kilometraje,
          prox_cambio_aceite,
          modelo,
          anno,
          titulo_propiedad,
          rtv,
          marchamo,
        } = register_vehicle as any;

        const newVehicle = await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_vehiculos_corporativos",
            operation: "create",
            data: {
              empresa_id: existing.empresa_id,
              cliente_id: existing.cliente_id,
              sucursal_id: existing.sucursal_id,
              placa: String(placa ?? ""),
              tipo: String(vehTipo ?? tipo ?? existing.tipo ?? ""),
              tipo_autoria: String(tipo_autoria ?? existing.tipo_autoria ?? ""),
              estado: "Activo",
              kilometraje: Number(kilometraje ?? 0),
              prox_cambio_aceite: Number(prox_cambio_aceite ?? 0),
              modelo: String(modelo ?? ""),
              anno: Number(anno ?? 0),
              descripcion: "-",
              titulo_propiedad: Boolean(titulo_propiedad ?? true),
              rtv: Boolean(rtv ?? true),
              marchamo: Boolean(marchamo ?? true),
              firma_responsable: typeof firma_responsable === "string" && firma_responsable.trim().length > 0
                ? firma_responsable
                : String(existing.firma_responsable ?? ""),
            },
          },
        });

        if (newVehicle && (newVehicle as any).id) {
          finalVehiculoId = Number((newVehicle as any).id);
        }
      } catch (vehError) {
        console.error("Error creando vehículo corporativo desde bitácora (PUT):", vehError);
      }
    }
    const updateData: any = {
      tipo: typeof tipo === "string" ? tipo : existing.tipo,
      vehiculo_id: finalVehiculoId,
      uso_id: uso_id !== undefined ? (uso_id ? Number(uso_id) : null) : existing.uso_id ?? null,
      informacion_general: informacion_general !== undefined ? normalizeToStringifiedJson(informacion_general) : existing.informacion_general,
      informacion_revision: informacion_revision !== undefined ? normalizeToStringifiedJson(informacion_revision) : existing.informacion_revision,
      movimientos_vehiculos: movimientos_vehiculos !== undefined ? normalizeToStringifiedJson(movimientos_vehiculos) : existing.movimientos_vehiculos,
      observaciones: typeof observaciones === "string" ? observaciones ?? "-" : existing.observaciones,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
      created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
      created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
    };

    // Comparar cambios (excluir firma_responsable)
    for (const [k, v] of Object.entries(updateData)) {
      if (k === "firma_responsable") continue; // Excluir firmas
      const before = (existing as any)[k];
      const after = v;
      if (!eq(before, after)) {
        cambiosArr.push({
          prop: k,
          before: before instanceof Date ? before.toISOString() : before,
          after: after instanceof Date ? after.toISOString() : after,
        });
      }
    }

    // Convertir fechas a ISO strings para la API dinámica
    const updateDataForApi: any = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (v instanceof Date) {
        updateDataForApi[k] = v.toISOString();
      } else {
        updateDataForApi[k] = v;
      }
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_bitacora_vehiculo_detenido",
        where: { id },
        data: updateDataForApi
      }
    });

    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "c_bitacora_vehiculo_detenido",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    // Si se setea `uso_id`, actualizamos el uso con `bitacora_id`
    if (uso_id) {
      try {
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_usos_vehiculos_corporativos",
            where: { id: Number(uso_id) },
            data: { bitacora_id: id }
          }
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Bitácora actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_bitacora_vehiculo_detenido", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_bitacora_vehiculo_detenido", where: { id } }
    });

    // Registrar cambio de eliminación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_bitacora_vehiculo_detenido",
          registro_id: id,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existing.id,
              tipo: existing.tipo,
              observaciones: existing.observaciones,
            },
            after: null,
          }]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        }
      }
    });

    return NextResponse.json({ status: true, message: "Bitácora eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


