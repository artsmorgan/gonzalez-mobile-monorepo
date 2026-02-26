import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type VehicleImageInput = {
  extension: string;
  file_base64: string;
  original_name?: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

export async function PUT(
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
      empresa_id,
      cliente_id,
      corpo_id,
      placa,
      tipo,
      estado,
      kilometraje,
      prox_cambio_aceite,
      modelo,
      anno,
      descripcion,
      titulo_propiedad,
      rtv,
      marchamo,
      firma_responsable,
      imagenes,
    } = body || {};

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: vehiculoId },
        include: { c_imagenes_vehiculos_corporativos: true },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }
    const existingObj = existing as any;

    const updateData: any = {};
    if (empresa_id !== undefined) updateData.empresa_id = Number(empresa_id);
    if (cliente_id !== undefined) updateData.cliente_id = Number(cliente_id);
    if (corpo_id !== undefined) updateData.sucursal_id = Number(corpo_id);
    if (placa !== undefined) updateData.placa = String(placa ?? "");
    if (tipo !== undefined) updateData.tipo = String(tipo ?? "");
    if (estado !== undefined) updateData.estado = String(estado ?? "");
    if (kilometraje !== undefined) updateData.kilometraje = Number(kilometraje ?? 0);
    if (prox_cambio_aceite !== undefined) updateData.prox_cambio_aceite = Number(prox_cambio_aceite ?? 0);
    if (modelo !== undefined) updateData.modelo = String(modelo ?? "");
    if (anno !== undefined) updateData.anno = Number(anno ?? 0);
    if (descripcion !== undefined) updateData.descripcion = String(descripcion ?? "");
    if (titulo_propiedad !== undefined) updateData.titulo_propiedad = Boolean(titulo_propiedad);
    if (rtv !== undefined) updateData.rtv = Boolean(rtv);
    if (marchamo !== undefined) updateData.marchamo = Boolean(marchamo);
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable ?? "");

    // Registrar cambios (solo campos actualizados)
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
      // No registramos imágenes: esas vienen en `imagenes` y se guardan aparte.
      if (k === "imagenes") continue;

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
        table: "c_vehiculos_corporativos",
        operation: "update",
        where: { id: vehiculoId },
        data: updateData,
        include: { c_imagenes_vehiculos_corporativos: true },
      },
    });
    const updatedObj = updated as any;

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_vehiculos_corporativos",
            registro_id: vehiculoId,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    // Imágenes: si el cliente manda `imagenes`, hacemos reemplazo total
    if (imagenes !== undefined) {
      const imagesParsed = safeParseJson<VehicleImageInput[]>(imagenes, []);
      const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${updatedObj.id}`);

      await callDynamicPrisma({
        req,
        data: {
          action: "DELETE",
          table: "c_imagenes_vehiculos_corporativos",
          operation: "deleteMany",
          where: { vehiculo_id: updatedObj.id },
        },
      });
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }

      if (imagesParsed.length > 0) {
        const uploadResp = await uploadDynamicFiles({
          req,
          folderPath: `corporate-vehicles/${updatedObj.id}`,
          files: imagesParsed
            .filter((img) => img?.file_base64 && img?.extension)
            .map((img) => ({
              type: "image",
              extension: String(img.extension).replace(".", "").trim() || "jpg",
              original_name: img.original_name,
              file_base64: img.file_base64,
            })),
        });

        const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
        for (const uploaded of uploadedFiles) {
          await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "c_imagenes_vehiculos_corporativos",
              operation: "create",
              data: { name: uploaded.name, vehiculo_id: updatedObj.id },
            },
          });
        }
      }
    }

    const full = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: updatedObj.id },
        include: { c_imagenes_vehiculos_corporativos: true },
      },
    });

    const fullObj = full as any;
    const imagenesArray = Array.isArray(fullObj?.c_imagenes_vehiculos_corporativos) ? fullObj.c_imagenes_vehiculos_corporativos : [];
    const baseUrlPut = req.nextUrl.origin;
    return NextResponse.json(
      {
        status: true,
        message: "Vehículo corporativo actualizado correctamente",
        data: {
          ...(fullObj ?? updatedObj),
          id_local: "",
          corpo_id: fullObj?.sucursal_id ?? updatedObj.sucursal_id,
          images: imagenesArray.map((i: any) => ({
            id: i.id,
            name: i.name,
            url: baseUrlPut ? `${baseUrlPut}/api/corporate-vehicles/${fullObj?.id}/get-image/${i.name}` : "",
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(
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

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_vehiculos_corporativos",
        operation: "findUnique",
        where: { id: vehiculoId },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const existingObj = existing as any;
    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_vehiculos_corporativos",
        operation: "delete",
        where: { id: vehiculoId },
      },
    });

    // Registrar cambio de eliminación
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_vehiculos_corporativos",
          registro_id: vehiculoId,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              placa: existingObj.placa,
              tipo: existingObj.tipo,
              modelo: existingObj.modelo,
              anno: existingObj.anno,
            },
            after: null,
          }]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${vehiculoId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Vehículo corporativo eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


