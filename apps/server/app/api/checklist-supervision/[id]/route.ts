/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

function safeParseJson<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

async function processEvaluationImages(req: NextRequest, evaluation: any, checklistId: number): Promise<any> {
  if (!evaluation || typeof evaluation !== "object") return evaluation;

  const photoInputs: Array<{ input: any; value: string }> = [];
  function collectPhotos(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach(collectPhotos);
      return;
    }
    if (obj.type === "photo" && obj.value && typeof obj.value === "string" && obj.value.startsWith("data:image/")) {
      photoInputs.push({ input: obj, value: obj.value });
    }
    if (obj.subsections) obj.subsections.forEach(collectPhotos);
    if (obj.inputs) obj.inputs.forEach(collectPhotos);
  }
  collectPhotos(evaluation);

  if (photoInputs.length > 0) {
    const getExt = (v: string) => {
      const m = v.match(/data:image\/([^;]+)/);
      return m ? m[1].replace("jpeg", "jpg") : "jpg";
    };
    const uploadResp = await uploadDynamicFiles({
      req,
      folderPath: `checklist-supervision/${checklistId}`,
      files: photoInputs.map(({ value }) => ({ type: "image", extension: getExt(value), file_base64: value })),
    });
    const uploaded = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
    photoInputs.forEach(({ input }, i) => {
      if (uploaded[i]) input.file_name = uploaded[i].name;
    });
  }
  return evaluation;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const row = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findUnique",
        where: { id },
        include: {
          e_estructura_cliente: {
            select: { id: true, nombre: true },
          },
          e_estructura_sucursal: {
            select: { id: true, nombre: true },
          },
          e_estructura_puesto: {
            select: { id: true, nombre: true, codigo: true },
          },
        }
      }
    });

    if (!row) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const mapped = {
      id: row.id,
      cliente_id: row.cliente_id,
      division_id: row.division_id,
      corpo_id: row.corpo_id,
      puesto_id: row.puesto_id,
      fecha: row.fecha,
      ejecutivo_cuenta: row.ejecutivo_cuenta,
      evaluacion: row.evaluacion,
      articulos_puesto: (row as any).articulos_puesto || null,
      firma_supervisor: row.firma_supervisor,
      firma_responsable: row.firma_responsable,
      created_by: row.created_by,
      created_at: row.created_at,
      cliente: row.e_estructura_cliente,
      corpo: row.e_estructura_sucursal,
      puesto: row.e_estructura_puesto,
    };

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/checklist-supervision/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
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

    const body = await req.json();
    const {
      cliente_id,
      division_id,
      corpo_id,
      puesto_id,
      fecha,
      ejecutivo_cuenta,
      evaluacion,
      articulos_puesto,
      firma_supervisor,
      firma_responsable,
    } = body ?? {};

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_checklist_supervision", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

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
    const updateData: any = {};
    if (cliente_id !== undefined) updateData.cliente_id = parseInt(String(cliente_id));
    if (division_id !== undefined) updateData.division_id = parseInt(String(division_id));
    if (corpo_id !== undefined) updateData.corpo_id = parseInt(String(corpo_id));
    if (puesto_id !== undefined) updateData.puesto_id = parseInt(String(puesto_id));
    if (fecha !== undefined) updateData.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    if (ejecutivo_cuenta !== undefined) updateData.ejecutivo_cuenta = String(ejecutivo_cuenta);
    if (articulos_puesto !== undefined) updateData.articulos_puesto = articulos_puesto ? String(articulos_puesto) : '';
    if (firma_supervisor !== undefined) updateData.firma_supervisor = String(firma_supervisor);
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable);

    // Procesar evaluación si se proporciona
    if (evaluacion !== undefined) {
      let evaluationParsed = safeParseJson<any>(evaluacion, []);

      // Procesar imágenes en la evaluación
      try {
        const processedEvaluation = await processEvaluationImages(req, evaluationParsed, id);
        updateData.evaluacion = JSON.stringify(processedEvaluation);
      } catch (error) {
        console.error("Error procesando imágenes en evaluación:", error);
        // Si falla, guardar sin procesar
        updateData.evaluacion = String(evaluacion);
      }
    }

    // Comparar cambios (excluir firmas)
    for (const [k, v] of Object.entries(updateData)) {
      if (k === "firma_supervisor" || k === "firma_responsable") continue; // Excluir firmas
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

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_checklist_supervision",
        where: { id },
        data: updateDataForApi
      }
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "c_checklist_supervision",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: createdAt.toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    return NextResponse.json({ status: true, message: "Checklist actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/checklist-supervision/[id]:", errorMessage);
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
      data: { action: "GET", table: "c_checklist_supervision", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    const fechaExisting = existing.fecha instanceof Date ? existing.fecha.toISOString() : existing.fecha;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_checklist_supervision",
          registro_id: id,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existing.id,
              cliente_id: existing.cliente_id,
              division_id: existing.division_id,
              corpo_id: existing.corpo_id,
              puesto_id: existing.puesto_id,
              fecha: fechaExisting,
              ejecutivo_cuenta: existing.ejecutivo_cuenta,
              evaluacion: existing.evaluacion,
              articulos_puesto: (existing as any).articulos_puesto || null,
              firma_supervisor: existing.firma_supervisor,
              firma_responsable: existing.firma_responsable,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_checklist_supervision", where: { id } }
    });
    return NextResponse.json({ status: true, message: "Checklist eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/checklist-supervision/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

