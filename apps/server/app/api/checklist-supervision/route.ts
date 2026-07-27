/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { mapChecklistSupervisionPublicRow } from "./mapPublicRow";
import { processChecklistSupervisionArticulosMantenimiento } from "./articulosMantenimiento";
import {
  sanitizeArticulosPuestoForPersistence,
  stripMantenimientoFilesFromArticulosPuesto,
} from "../../../utils/sanitizeArticulosPuestoForPersistence";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";

const CHECKLIST_SUPERVISION_INCLUDE = {
  e_estructura_cliente: { select: { id: true, nombre: true } },
  e_estructura_sucursal: { select: { id: true, nombre: true } },
  e_estructura_puesto: { select: { id: true, nombre: true, codigo: true } },
  c_imagenes_checklist_supervision: { select: { id: true, name: true, original_name: true } },
};

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

    // Asociar nombres de archivo a los inputs y registrar en c_imagenes_checklist_supervision
    for (let i = 0; i < photoInputs.length; i++) {
      const { input } = photoInputs[i];
      const file = uploaded[i];
      if (!file) continue;

      // Guardar referencia en el JSON de evaluación
      input.file_name = file.name;
      if (typeof input.value === "string" && input.value.startsWith("data:image/")) {
        input.value = null;
      }

      // Registrar en la tabla c_imagenes_checklist_supervision (nombre + checklist_id + original_name)
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_imagenes_checklist_supervision",
          operation: "create",
          data: {
            name: file.name,
            checklist_id: checklistId,
            original_name: file.original_name || file.name,
          },
        },
      });
    }
  }
  return evaluation;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");

    const where: any = { isActive: true };
    if (clienteIdStr) where.cliente_id = parseInt(clienteIdStr);
    if (corpoIdStr) where.corpo_id = parseInt(corpoIdStr);
    if (puestoIdStr) where.puesto_id = parseInt(puestoIdStr);

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(CHECKLIST_SUPERVISION_INCLUDE);

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findMany",
        where,
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
        orderBy: { id: "desc" }
      }
    });
    await hydratePreexistentRelations(rows, preexistentSpecs);

    const baseUrl = req.nextUrl.origin;
    const rowsArray = (Array.isArray(rows) ? rows : []).filter((r: any) => r?.isActive !== false);
    const mapped = rowsArray.map((r: any) => mapChecklistSupervisionPublicRow(r, baseUrl));

    console.log("mapped", mapped.length);

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/checklist-supervision:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const body = await req.json();
    const {
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      puesto_id,
      division,
      fecha,
      ejecutivo_cuenta,
      evaluacion,
      articulos_puesto,
      firma_supervisor,
      firma_responsable,
      created_at,
      hora_accion,
    } = body ?? {};

    if (
      empresa_id == null ||
      !cliente_id ||
      !division_id ||
      contrato_id == null ||
      !corpo_id ||
      !puesto_id ||
      !division ||
      !fecha ||
      !evaluacion ||
      !firma_responsable ||
      !created_at
    ) {
      const errorMessage = "Datos incompletos: " +
        (empresa_id == null ? "empresa_id, " : "") +
        (!cliente_id ? "cliente_id, " : "") +
        (!division_id ? "division_id, " : "") +
        (contrato_id == null ? "contrato_id, " : "") +
        (!corpo_id ? "corpo_id, " : "") +
        (!puesto_id ? "puesto_id, " : "") +
        (!division ? "division, " : "") +
        (!fecha ? "fecha, " : "") +
        (!evaluacion ? "evaluacion, " : "") +
        (!firma_responsable ? "firma_responsable, " : "") +
        (!created_at ? "created_at" : "");
      return NextResponse.json({ status: false, message: errorMessage }, { status: 200 });
    }

    const createdAt = new Date(created_at);
    /** Instante de la acción en el cliente; si no viene, coincide con created_at del checklist. */
    const accionAt =
      hora_accion != null && String(hora_accion).trim()
        ? new Date(hora_accion)
        : createdAt;
    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);

    // Parsear evaluación para procesar imágenes
    let evaluationParsed = safeParseJson<any>(evaluacion, []);

    // Buscar imágenes en la evaluación antes de procesar (como StaffEvaluationsScreen)
    let imageCount = 0;
    const countImages = (obj: any) => {
      if (Array.isArray(obj)) {
        obj.forEach(item => countImages(item));
      } else if (obj && typeof obj === 'object') {
        // Buscar imágenes en value (data URI) como StaffEvaluationsScreen
        if (obj.type === 'photo' && obj.value && typeof obj.value === 'string' && obj.value.startsWith('data:image/')) {
          imageCount++;
          console.log(`Imagen encontrada #${imageCount}:`, { id: obj.id, hasValue: true, valueLength: obj.value.length, imageOrientation: obj.imageOrientation });
        }
        Object.values(obj).forEach(value => countImages(value));
      }
    };
    countImages(evaluationParsed);
    console.log(`Total de imágenes encontradas en evaluación: ${imageCount}`);

    const sucursal = await prisma.e_estructura_sucursal.findUnique({
      where: { id: parseInt(String(corpo_id)) },
    });

    if (!sucursal) {
      return NextResponse.json({ status: false, message: "Sucursal no encontrada" }, { status: 200 });
    }


    // Crear el registro primero para obtener el ID
    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_checklist_supervision",
        operation: "create",
        data: {
          empresa_id: parseInt(String(empresa_id)),
          cliente_id: parseInt(String(cliente_id)),
          division_id: parseInt(String(division_id)),
          contrato_id: parseInt(String(contrato_id)),
          corpo_id: parseInt(String(corpo_id)),
          puesto_id: parseInt(String(puesto_id)),
          isActive: true,
          fecha: fechaDate.toISOString(),
          ejecutivo_cuenta: String(sucursal.ejecutivoCuenta_id ?? 0),
          evaluacion: '[]', // Temporal, se actualizará después
          articulos_puesto: sanitizeArticulosPuestoForPersistence(articulos_puesto),
          firma_supervisor:
            firma_supervisor != null && typeof firma_supervisor === "string" && firma_supervisor.trim().length > 0
              ? firma_supervisor.trim()
              : null,
          firma_responsable: String(firma_responsable),
          created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
          created_at: createdAt.toISOString(),
        }
      }
    });

    // Procesar imágenes en la evaluación y actualizar
    let processedEvaluation: any = null;
    try {
      console.log("Procesando imágenes para checklist ID:", created.id);
      processedEvaluation = await processEvaluationImages(req, evaluationParsed, created.id);
      console.log("Evaluación procesada, guardando...");

      console.log("Processed evaluation:", processedEvaluation);

      await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "c_checklist_supervision",
          where: { id: created.id },
          data: {
            evaluacion: JSON.stringify(processedEvaluation),
          }
        }
      });
      console.log("Evaluación actualizada correctamente");
    } catch (error) {
      console.error("Error procesando imágenes en evaluación:", error);
      // Continuar aunque falle el procesamiento de imágenes
    }

    if (created) {
      await processChecklistSupervisionArticulosMantenimiento({
        req,
        articulos_puesto,
        accionAt,
        corpo_id: parseInt(String(corpo_id)),
        puesto_id: parseInt(String(puesto_id)),
        payload,
        notifySenderIds: [created.created_by],
        fechaNotificacion: createdAt,
        isUpdate: false,
      });

      const articulosStored = stripMantenimientoFilesFromArticulosPuesto(
        sanitizeArticulosPuestoForPersistence(articulos_puesto),
      );
      await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "c_checklist_supervision",
          where: { id: created.id },
          data: { articulos_puesto: articulosStored },
        },
      });
      (created as any).articulos_puesto = articulosStored;
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "c_checklist_supervision",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              empresa_id: (created as any).empresa_id,
              cliente_id: created.cliente_id,
              division_id: created.division_id,
              contrato_id: (created as any).contrato_id,
              corpo_id: created.corpo_id,
              puesto_id: created.puesto_id,
              isActive: (created as any).isActive !== false,
              fecha: created.fecha instanceof Date ? created.fecha.toISOString() : created.fecha,
              ejecutivo_cuenta: created.ejecutivo_cuenta,
              evaluacion: processedEvaluation ? JSON.stringify(processedEvaluation) : '[]',
              articulos_puesto: (created as any).articulos_puesto || null,
              firma_supervisor: created.firma_supervisor,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(CHECKLIST_SUPERVISION_INCLUDE);

    const fullRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findUnique",
        where: { id: created.id },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(fullRow, preexistentSpecs);

    const origin = req.nextUrl.origin;
    const mapped = fullRow ? mapChecklistSupervisionPublicRow(fullRow, origin) : { id: created.id };

    return NextResponse.json(
      { status: true, message: "Checklist creado correctamente", id: created.id, data: mapped },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/checklist-supervision:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

