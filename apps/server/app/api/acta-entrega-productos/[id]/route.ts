import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenByApi } from '../../../../utils/verifyAccessTokenByApi';
import { callDynamicPrisma } from '../../../../utils/callDynamicPrisma';
import { toZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { uploadDynamicFiles } from '../../../../utils/callDynamicFilesApi';
import { mapActaEntregaImagesForClient } from '../mapActaEntregaImagesForClient';

export const runtime = 'nodejs';

type ActaImageInput = {
  file_base64: string;
  extension?: string;
  original_name?: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === 'string') {
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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const {
      tipo_entrega,
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      puesto_id,
      mensual,
      detalle,
      observaciones,
      nombre_entrega,
      cedula_entrega,
      fecha_entrega,
      firma_entrega,
      nombre_recibe,
      cedula_recibe,
      fecha_recibe,
      firma_recibe,
      firma_responsable,
      imagenes,
    } = await req.json();

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findUnique",
        where: { id: actaId },
      },
    });
    if (!existing) return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });
    const existingObj = existing as any;

    const updateData: any = {};
    if (empresa_id !== undefined) updateData.empresa_id = Number(empresa_id);
    if (cliente_id !== undefined) updateData.cliente_id = Number(cliente_id);
    if (division_id !== undefined) updateData.division_id = Number(division_id);
    if (contrato_id !== undefined) updateData.contrato_id = Number(contrato_id);
    if (corpo_id !== undefined) updateData.corpo_id = Number(corpo_id);
    if (puesto_id !== undefined) updateData.puesto_id = Number(puesto_id);
    if (tipo_entrega !== undefined) updateData.tipo_entrega = String(tipo_entrega ?? '');
    if (mensual !== undefined) updateData.mensual = String(mensual ?? '');
    if (detalle !== undefined) updateData.detalle = String(detalle ?? '');
    if (observaciones !== undefined) updateData.observaciones = String(observaciones ?? '');
    if (nombre_entrega !== undefined) updateData.nombre_entrega = String(nombre_entrega ?? '');
    if (cedula_entrega !== undefined) updateData.cedula_entrega = String(cedula_entrega ?? '');
    if (fecha_entrega !== undefined) updateData.fecha_entrega = new Date(String(fecha_entrega)).toISOString();
    if (firma_entrega !== undefined) updateData.firma_entrega = (firma_entrega != null && String(firma_entrega).trim() !== '') ? String(firma_entrega) : null;
    if (nombre_recibe !== undefined) updateData.nombre_recibe = String(nombre_recibe ?? '');
    if (cedula_recibe !== undefined) updateData.cedula_recibe = String(cedula_recibe ?? '');
    if (fecha_recibe !== undefined) updateData.fecha_recibe = new Date(String(fecha_recibe)).toISOString();
    if (firma_recibe !== undefined) updateData.firma_recibe = (firma_recibe != null && String(firma_recibe).trim() !== '') ? String(firma_recibe) : null;
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable ?? '');

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
        table: "c_acta_entre_producto",
        operation: "update",
        where: { id: actaId },
        data: updateData,
        include: { c_imagenes_acta_entrega_producto: true },
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
            nombre_tabla: "c_acta_entre_producto",
            registro_id: actaId,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    // Agregar imágenes nuevas (si viene `imagenes`), sin borrar las existentes.
    let imagesParsed: ActaImageInput[] = [];
    if (imagenes !== undefined) imagesParsed = safeParseJson<ActaImageInput[]>(imagenes, []);

    if (imagenes !== undefined) {
      if (imagesParsed.length > 0) {
        const uploadResp = await uploadDynamicFiles({
          req,
          folderPath: `acta-entrega-productos/${updatedObj.id}`,
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
              table: "c_imagenes_acta_entrega_producto",
              operation: "create",
              data: { name: uploaded.name, acta_id: updatedObj.id },
            },
          });
        }
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findUnique",
        where: { id: updatedObj.id },
        include: { c_imagenes_acta_entrega_producto: true },
      },
    });

    const baseUrl = req.nextUrl.origin;
    const fullRecordObj = fullRecord as any;
    const aid = Number(fullRecordObj?.id ?? updatedObj?.id ?? actaId);
    const { c_imagenes_acta_entrega_producto: _cimg, ...actaRest } = (fullRecordObj ?? updatedObj) || {};
    return NextResponse.json(
      {
        status: true,
        message: 'Acta actualizada correctamente',
        data: {
          ...actaRest,
          id_local: '',
          images: mapActaEntregaImagesForClient(aid, fullRecordObj?.c_imagenes_acta_entrega_producto, baseUrl),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findUnique",
        where: { id: actaId },
      },
    });
    if (!existing) return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });

    const existingObj = existing as any;
    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
    const fechaEntregaValue = existingObj.fecha_entrega instanceof Date ? existingObj.fecha_entrega.toISOString() : (typeof existingObj.fecha_entrega === 'string' ? existingObj.fecha_entrega : null);
    const fechaRecibeValue = existingObj.fecha_recibe instanceof Date ? existingObj.fecha_recibe.toISOString() : (typeof existingObj.fecha_recibe === 'string' ? existingObj.fecha_recibe : null);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_acta_entre_producto",
          registro_id: actaId,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              empresa_id: existingObj.empresa_id,
              cliente_id: existingObj.cliente_id,
              division_id: existingObj.division_id,
              contrato_id: existingObj.contrato_id,
              corpo_id: existingObj.corpo_id,
              fecha: fechaValue,
              tipo_entrega: existingObj.tipo_entrega,
              mensual: existingObj.mensual,
              detalle: existingObj.detalle,
              observaciones: existingObj.observaciones,
              nombre_entrega: existingObj.nombre_entrega,
              cedula_entrega: existingObj.cedula_entrega,
              fecha_entrega: fechaEntregaValue,
              nombre_recibe: existingObj.nombre_recibe,
              cedula_recibe: existingObj.cedula_recibe,
              fecha_recibe: fechaRecibeValue,
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
        table: "c_acta_entre_producto",
        operation: "update",
        where: { id: actaId },
        data: { isActive: false },
      },
    });

    const dir = path.join(process.cwd(), 'public', 'uploads', 'acta-entrega-productos', `${actaId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: 'Acta eliminada correctamente' }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


