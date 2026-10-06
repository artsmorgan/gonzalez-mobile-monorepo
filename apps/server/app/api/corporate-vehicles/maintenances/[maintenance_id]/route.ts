import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../utils/reportError";

export const runtime = "nodejs";

async function processMaintenanceImages(
  req: NextRequest,
  vehiculoId: number,
  imagenAntes?: string,
  imagenDespues?: string
): Promise<{ imagenAntesFileName: string; imagenDespuesFileName: string }> {
  const result = { imagenAntesFileName: "", imagenDespuesFileName: "" };
  const filesToUpload: { type: string; extension: string; file_base64: string }[] = [];
  if (imagenAntes && imagenAntes.trim().length > 0) {
    filesToUpload.push({ type: "image", extension: "jpg", file_base64: imagenAntes });
  }
  if (imagenDespues && imagenDespues.trim().length > 0) {
    filesToUpload.push({ type: "image", extension: "jpg", file_base64: imagenDespues });
  }
  if (filesToUpload.length === 0) return result;

  const uploadResp = await uploadDynamicFiles({
    req,
    folderPath: `corporate-vehicles/${vehiculoId}/maintenances`,
    files: filesToUpload,
  });
  const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
  let idx = 0;
  if (imagenAntes && imagenAntes.trim().length > 0) {
    result.imagenAntesFileName = uploaded[idx++]?.name || "";
  }
  if (imagenDespues && imagenDespues.trim().length > 0) {
    result.imagenDespuesFileName = uploaded[idx++]?.name || "";
  }
  return result;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ maintenance_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { maintenance_id } = await context.params;
    const maintenanceId = parseInt(String(maintenance_id), 10);
    if (!maintenanceId) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "PUT", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: maintenanceId },
      },
    });
    if (!existing) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "PUT", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }
    const existingObj = existing as any;

    const body = await req.json();
    const {
      fecha,
      imagen_antes,
      tipo,
      mantenimiento,
      diagnostico,
      kilometraje_siguiente_revision,
      imagen_despues,
      nombre_mecanico,
      firma_mecanico,
      firma_responsable,
    } = body || {};

    // Procesar imágenes si se proporcionan
    let imagenAntesFileName = existingObj.imagen_antes;
    let imagenDespuesFileName = existingObj.imagen_despues;

    const hasNewAntes = imagen_antes !== undefined && imagen_antes && String(imagen_antes).trim().length > 0;
    const hasNewDespues = imagen_despues !== undefined && imagen_despues && String(imagen_despues).trim().length > 0;
    if (hasNewAntes || hasNewDespues) {
      const { imagenAntesFileName: newAntes, imagenDespuesFileName: newDespues } = await processMaintenanceImages(
        req,
        existingObj.vehiculo_id,
        hasNewAntes ? String(imagen_antes) : undefined,
        hasNewDespues ? String(imagen_despues) : undefined
      );
      if (hasNewAntes && newAntes) imagenAntesFileName = newAntes;
      if (hasNewDespues && newDespues) imagenDespuesFileName = newDespues;
    }

    const fechaExisting = existingObj.fecha instanceof Date ? existingObj.fecha : (typeof existingObj.fecha === 'string' ? new Date(existingObj.fecha) : new Date());
    const updateData: any = {
      fecha: fecha !== undefined ? (fecha ? new Date(fecha) : new Date()) : fechaExisting,
      imagen_antes: imagen_antes !== undefined ? imagenAntesFileName : existingObj.imagen_antes,
      tipo: tipo !== undefined ? String(tipo ?? "") : existingObj.tipo,
      mantenimiento: mantenimiento !== undefined ? String(mantenimiento ?? "") : existingObj.mantenimiento,
      diagnostico: diagnostico !== undefined ? String(diagnostico ?? "") : existingObj.diagnostico,
      kilometraje_siguiente_revision:
        kilometraje_siguiente_revision !== undefined
          ? Number(kilometraje_siguiente_revision ?? 0)
          : existingObj.kilometraje_siguiente_revision,
      imagen_despues: imagen_despues !== undefined ? imagenDespuesFileName : existingObj.imagen_despues,
      nombre_mecanico: nombre_mecanico !== undefined ? String(nombre_mecanico ?? "") : existingObj.nombre_mecanico,
      firma_mecanico:
        firma_mecanico !== undefined
          ? (firma_mecanico != null && String(firma_mecanico).trim().length > 0
              ? String(firma_mecanico).trim()
              : null)
          : existingObj.firma_mecanico,
      firma_responsable:
        firma_responsable !== undefined ? String(firma_responsable ?? "") : existingObj.firma_responsable,
    };

    // Convertir fecha a ISO string para callDynamicPrisma
    if (updateData.fecha instanceof Date) {
      updateData.fecha = updateData.fecha.toISOString();
    }

    // Registrar cambios (solo campos actualizados, excluyendo firmas e imágenes)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(updateData)) {
      if (k.startsWith("firma_") || k.startsWith("imagen_")) continue; // Excluir firmas e imágenes

      const before = existingObj[k];
      const after = v;
      if (!eq(before, after)) {
        const beforeValue = before instanceof Date ? before.toISOString() : (typeof before === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(before) ? before : before);
        const afterValue = after instanceof Date ? after.toISOString() : (typeof after === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(after) ? after : after);
        cambiosArr.push({
          prop: k,
          before: beforeValue,
          after: afterValue,
        });
      }
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "update",
        where: { id: maintenanceId },
        data: updateData,
      },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_mantenimiento_vehiculos_corporativos",
            registro_id: maintenanceId,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json({ status: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/maintenances/[maintenance_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "PUT", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ maintenance_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { maintenance_id } = await context.params;
    const maintenanceId = parseInt(String(maintenance_id), 10);
    if (!maintenanceId) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "DELETE", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: maintenanceId },
      },
    });
    if (!existing) {
      await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "DELETE", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const existingObj = existing as any;
    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_mantenimiento_vehiculos_corporativos",
          registro_id: maintenanceId,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              vehiculo_id: existingObj.vehiculo_id,
              fecha: fechaValue,
              tipo: existingObj.tipo,
              mantenimiento: existingObj.mantenimiento,
              diagnostico: existingObj.diagnostico,
              kilometraje_siguiente_revision: existingObj.kilometraje_siguiente_revision,
              nombre_mecanico: existingObj.nombre_mecanico,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_mantenimiento_vehiculos_corporativos",
        operation: "delete",
        where: { id: maintenanceId },
      },
    });

    return NextResponse.json({ status: true, message: "Mantenimiento eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/maintenances/[maintenance_id]:", errorMessage);
    await reportError(req, "api/corporate-vehicles/maintenances/[maintenance_id]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

