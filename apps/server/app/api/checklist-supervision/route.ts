/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { mapChecklistSupervisionPublicRow } from "./mapPublicRow";
import { processChecklistSupervisionArticulosMantenimiento } from "./articulosMantenimiento";
import { processChecklistEvaluationImages, validateChecklistEmpleadoHoras } from "./evaluationImages";
import { notifyChecklistSupervisionEmpleado } from "./notifyEmpleado";
import {
  sanitizeArticulosPuestoForPersistence,
  stripMantenimientoFilesFromArticulosPuesto,
} from "../../../utils/sanitizeArticulosPuestoForPersistence";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../utils/reportError";

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
  return processChecklistEvaluationImages(req, evaluation, checklistId, uploadDynamicFiles, callDynamicPrisma);
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
    await reportError(req, "api/checklist-supervision", "GET", 500, errorMessage);
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
      empleado_id,
      empleado_nombre,
      empleado_codigo,
      hora_inicio,
      hora_fin,
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
      await reportError(req, "api/checklist-supervision", "POST", 400, errorMessage);
      return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }

    const createdAt = new Date(created_at);
    /** Instante de la acción en el cliente; si no viene, coincide con created_at del checklist. */
    const accionAt =
      hora_accion != null && String(hora_accion).trim()
        ? new Date(hora_accion)
        : createdAt;
    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
    const empleadoHoras = validateChecklistEmpleadoHoras({
      empleado_id,
      empleado_nombre,
      empleado_codigo,
      hora_inicio,
      hora_fin,
    });
    if (!empleadoHoras.ok) {
      await reportError(req, "api/checklist-supervision", "POST", 400, empleadoHoras.message);
      return NextResponse.json({ status: false, message: empleadoHoras.message }, { status: 400 });
    }
    const horaInicioParsed = empleadoHoras.horaInicio;
    const horaFinParsed = empleadoHoras.horaFin;
    const empleadoIdNum = empleadoHoras.empleadoId;

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
      await reportError(req, "api/checklist-supervision", "POST", 404, "Sucursal no encontrada");
      return NextResponse.json({ status: false, message: "Sucursal no encontrada" }, { status: 404 });
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
          empleado_id: empleadoHoras.empleadoId,
          empleado_nombre: empleadoHoras.empleadoNombre,
          empleado_codigo: empleadoHoras.empleadoCodigo,
          hora_inicio: horaInicioParsed.toISOString(),
          hora_fin: horaFinParsed.toISOString(),
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
      try {
        await callDynamicPrisma({
          req,
          data: {
            action: "DELETE",
            table: "c_checklist_supervision",
            operation: "delete",
            where: { id: created.id },
          },
        });
      } catch (rollbackError) {
        console.error("Error en rollback de checklist tras fallo de imágenes:", rollbackError);
      }
      await reportError(req, "api/checklist-supervision", "POST", 500, "Error al procesar imágenes de la evaluación");
      return NextResponse.json(
        { status: false, message: "Error al procesar imágenes de la evaluación" },
        { status: 500 }
      );
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

    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    try {
      await notifyChecklistSupervisionEmpleado({
        req,
        empleadoId: empleadoIdNum,
        corpoId: parseInt(String(corpo_id), 10),
        puestoId: parseInt(String(puesto_id), 10),
        fechaRegistro: fechaDate,
        evaluacion: processedEvaluation ?? evaluationParsed,
        createdByEmpleadoId: createdBy,
      });
    } catch (notifyErr) {
      console.error("Error notificando empleado del checklist de supervisión:", notifyErr);
    }

    // Registrar cambio de creación
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
    await reportError(req, "api/checklist-supervision", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

