/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { prisma } from "../../../../utils/prismaClient";

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
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
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      cliente_id,
      empresa_id,
      division_id,
      contrato_id,
      corpo_id,
      puesto_id,
      fecha,
      enlace,
      nombre_solicitante,
      boleta,
      metricas_vulnerablidad,
      observaciones,
      firma_solicitante,
      firma_responsable,
      imagenes,
    } = body ?? {};

    const fechaDate = fecha ? parseDateTime(fecha) : null;
    if (fecha && !fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    // Validar IDs si vienen
    if (cliente_id) {
      const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } });
      if (!cliente) return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 200 });
    }
    if (corpo_id) {
      const corpo = await prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } });
      if (!corpo) return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 200 });
    }
    if (puesto_id) {
      const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } });
      if (!puesto) return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });
    }

    const existingObj = existing as any;
    const updateData: any = {
      cliente_id: cliente_id ? parseInt(String(cliente_id)) : existingObj.cliente_id,
      empresa_id: empresa_id != null ? (Number(empresa_id) > 0 ? parseInt(String(empresa_id)) : 0) : existingObj.empresa_id,
      division_id: division_id != null ? (Number(division_id) > 0 ? parseInt(String(division_id)) : 0) : existingObj.division_id,
      contrato_id: contrato_id != null ? (Number(contrato_id) > 0 ? parseInt(String(contrato_id)) : 0) : existingObj.contrato_id,
      corpo_id: corpo_id ? parseInt(String(corpo_id)) : existingObj.corpo_id,
      puesto_id: puesto_id ? parseInt(String(puesto_id)) : existingObj.puesto_id,
      fecha: fechaDate ? fechaDate.toISOString() : (existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : existingObj.fecha),
      enlace: typeof enlace === "string" ? enlace : existingObj.enlace,
      nombre_solicitante: typeof nombre_solicitante === "string" ? nombre_solicitante : existingObj.nombre_solicitante,
      boleta: typeof boleta === "string" ? boleta : existingObj.boleta,
      metricas_vulnerablidad:
        typeof metricas_vulnerablidad === "string" ? metricas_vulnerablidad : existingObj.metricas_vulnerablidad,
      observaciones: typeof observaciones === "string" ? observaciones : existingObj.observaciones,
      firma_solicitante: typeof firma_solicitante === "string" ? firma_solicitante : existingObj.firma_solicitante,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existingObj.firma_responsable,
    };

    // Registrar cambios (solo campos actualizados, incluyendo firmas)
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
      const before = existingObj[k];
      const after = v;
      if (!eq(before, after)) {
        cambiosArr.push({
          prop: k,
          before: before instanceof Date ? before.toISOString() : (typeof before === 'string' && before.match(/^\d{4}-\d{2}-\d{2}T/) ? before : before),
          after: after instanceof Date ? after.toISOString() : (typeof after === 'string' && after.match(/^\d{4}-\d{2}-\d{2}T/) ? after : after),
        });
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "update",
        where: { id },
        data: updateData,
      },
    });

    let imagesParsed: Array<{ file_base64: string; extension?: string; original_name?: string }> = [];
    if (imagenes) {
      try {
        imagesParsed = typeof imagenes === "string" ? JSON.parse(imagenes) : imagenes;
      } catch {
        imagesParsed = [];
      }
    }
    if (Array.isArray(imagesParsed) && imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `apreciacion-vulnerabilidad/${id}`,
        files: imagesParsed
          .filter((img) => img?.file_base64)
          .map((img) => ({
            type: "image",
            extension: String(img.extension || "jpg").replace(".", "").trim() || "jpg",
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
            table: "c_imagenes_boleta_apreciacion_vulnerabilidad",
            operation: "create",
            data: {
              name: uploaded.name,
              original_name: uploaded.original_name || uploaded.name,
              boleta_id: id,
            },
          },
        });
      }
    }

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json({ status: true, message: "Registro actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
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
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const existingObj = existing as any;
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
          registro_id: id,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              cliente_id: existingObj.cliente_id,
              corpo_id: existingObj.corpo_id,
              puesto_id: existingObj.puesto_id,
              fecha: existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : existingObj.fecha,
              enlace: existingObj.enlace,
              nombre_solicitante: existingObj.nombre_solicitante,
              boleta: existingObj.boleta,
              metricas_vulnerablidad: existingObj.metricas_vulnerablidad,
              observaciones: existingObj.observaciones,
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
        action: "UPDATE",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "update",
        where: { id },
        data: {
          isActive: false,
        },
      },
    });
    return NextResponse.json({ status: true, message: "Registro eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/apreciacion-vulnerabilidad/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


