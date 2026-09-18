/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import {
  buildCorporateVehicleCreateFromBitacora,
  canRegisterCorporateVehicleFromBitacora,
} from "../../../../utils/corporateVehiclePayload";
import { hydrateBitacoraRevisionImagesFromMultipart } from "../../../../utils/bitacoraRevisionImages";
import { reportError } from "../../../../utils/reportError";

type MultipartBody = { get(name: string): string | { arrayBuffer(): Promise<ArrayBuffer> } | null };

async function parseBitacoraPutBody(req: NextRequest): Promise<{
  body: Record<string, any>;
  multipartForm: MultipartBody | null;
}> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = (await req.formData()) as unknown as MultipartBody;
    const rawMeta = formData.get("metadata");
    if (typeof rawMeta !== "string") {
      throw new Error("metadata faltante o inválido");
    }
    return { body: JSON.parse(rawMeta), multipartForm: formData };
  }
  return { body: await req.json(), multipartForm: null };
}

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
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "PUT", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_bitacora_vehiculo_detenido", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "PUT", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    let body: Record<string, any>;
    let multipartForm: MultipartBody | null = null;
    try {
      const parsed = await parseBitacoraPutBody(req);
      body = parsed.body;
      multipartForm = parsed.multipartForm;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : "Cuerpo inválido";
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "PUT", 400, msg);
      return NextResponse.json({ status: false, message: msg }, { status: 400 });
    }
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
      empresa_id,
      cliente_id,
      sucursal_id,
      division_id,
      contrato_id,
      puesto_id,
      isActive,
    } = body ?? {};

    const oldUsoId = existing.uso_id != null ? Number(existing.uso_id) : null;

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
        const reg = { ...(register_vehicle as Record<string, unknown>) };
        if (!reg.tipo && tipo) reg.tipo = tipo;
        if (canRegisterCorporateVehicleFromBitacora(reg)) {
          const createdAtPut = toZonedTime(new Date(), "America/Costa_Rica") as Date;
          const createdByPut = parseInt(String((payload as any)?.id ?? 0)) || 0;
          const createData = buildCorporateVehicleCreateFromBitacora(reg, {
            empresa_id: existing.empresa_id,
            cliente_id: existing.cliente_id,
            sucursal_id: existing.sucursal_id,
            firma_responsable:
              typeof firma_responsable === "string" && firma_responsable.trim().length > 0
                ? firma_responsable
                : String(existing.firma_responsable ?? ""),
            created_by: createdByPut,
            created_at: createdAtPut.toISOString(),
          });
          const newVehicle = await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "c_vehiculos_corporativos",
              operation: "create",
              data: createData,
            },
          });

          if (newVehicle && (newVehicle as any).id) {
            finalVehiculoId = Number((newVehicle as any).id);
          }
        }
      } catch (vehError) {
        console.error("Error creando vehículo corporativo desde bitácora (PUT):", vehError);
      }
    }
    let revisionForUpdate =
      informacion_revision !== undefined
        ? normalizeToStringifiedJson(informacion_revision)
        : existing.informacion_revision;

    if (informacion_revision !== undefined && multipartForm) {
      try {
        revisionForUpdate = await hydrateBitacoraRevisionImagesFromMultipart(
          req,
          id,
          revisionForUpdate,
          multipartForm
        );
      } catch (imgErr) {
        console.error("Error subiendo imágenes de revisión (bitácora PUT):", imgErr);
        const msg = imgErr instanceof Error ? imgErr.message : "Error al subir imágenes";
        await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "PUT", 400, msg);
        return NextResponse.json({ status: false, message: msg }, { status: 400 });
      }
    }

    const updateData: any = {
      tipo: typeof tipo === "string" ? tipo : existing.tipo,
      vehiculo_id: finalVehiculoId,
      uso_id: uso_id !== undefined ? (uso_id ? Number(uso_id) : null) : existing.uso_id ?? null,
      informacion_general: informacion_general !== undefined ? normalizeToStringifiedJson(informacion_general) : existing.informacion_general,
      informacion_revision: revisionForUpdate,
      movimientos_vehiculos: movimientos_vehiculos !== undefined ? normalizeToStringifiedJson(movimientos_vehiculos) : existing.movimientos_vehiculos,
      observaciones: typeof observaciones === "string" ? observaciones ?? "-" : existing.observaciones,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
      created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
      created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
      empresa_id: empresa_id !== undefined ? Number(empresa_id) || existing.empresa_id : existing.empresa_id,
      cliente_id: cliente_id !== undefined ? Number(cliente_id) || existing.cliente_id : existing.cliente_id,
      sucursal_id: sucursal_id !== undefined ? Number(sucursal_id) || existing.sucursal_id : existing.sucursal_id,
      division_id: division_id !== undefined ? Number(division_id) || existing.division_id : existing.division_id,
      contrato_id: contrato_id !== undefined ? Number(contrato_id) || existing.contrato_id : existing.contrato_id,
      puesto_id: puesto_id !== undefined ? Number(puesto_id) || existing.puesto_id : existing.puesto_id,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
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

    const newUsoId = updateData.uso_id != null ? Number(updateData.uso_id) : null;
    if (oldUsoId && oldUsoId !== newUsoId) {
      try {
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_usos_vehiculos_corporativos",
            where: { id: oldUsoId },
            data: { bitacora_id: null },
          },
        });
      } catch {
        // ignore
      }
    }

    await callDynamicPrisma({
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

    if (newUsoId) {
      try {
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_usos_vehiculos_corporativos",
            where: { id: newUsoId },
            data: { bitacora_id: id },
          },
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Bitácora actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/bitacora-vehiculo-detenido/[id]:", errorMessage);
    await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "PUT", 500, errorMessage);
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
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "DELETE", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_bitacora_vehiculo_detenido", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "DELETE", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const usoOnRecord = existing.uso_id != null ? Number(existing.uso_id) : null;
    if (usoOnRecord) {
      try {
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_usos_vehiculos_corporativos",
            where: { id: usoOnRecord },
            data: { bitacora_id: null },
          },
        });
      } catch {
        // ignore
      }
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
    await reportError(req, "api/bitacora-vehiculo-detenido/[id]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


