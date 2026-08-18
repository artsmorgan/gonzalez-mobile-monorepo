/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { mapChecklistSupervisionPublicRow } from "../mapPublicRow";
import { processChecklistSupervisionArticulosMantenimiento } from "../articulosMantenimiento";
import { processChecklistEvaluationImages, validateChecklistEmpleadoHoras } from "../evaluationImages";
import {
  sanitizeArticulosPuestoForPersistence,
  stripMantenimientoFilesFromArticulosPuesto,
} from "../../../../utils/sanitizeArticulosPuestoForPersistence";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../../utils/hydratePreexistentIncludes";

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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(CHECKLIST_SUPERVISION_INCLUDE);

    const row = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findUnique",
        where: { id },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      }
    });
    await hydratePreexistentRelations(row, preexistentSpecs);

    if (!row) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    if ((row as any).isActive === false) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    const mapped = mapChecklistSupervisionPublicRow(row, req.nextUrl.origin);

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
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      puesto_id,
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
    if (empresa_id !== undefined) updateData.empresa_id = parseInt(String(empresa_id));
    if (cliente_id !== undefined) updateData.cliente_id = parseInt(String(cliente_id));
    if (division_id !== undefined) updateData.division_id = parseInt(String(division_id));
    if (contrato_id !== undefined) updateData.contrato_id = parseInt(String(contrato_id));
    if (corpo_id !== undefined) updateData.corpo_id = parseInt(String(corpo_id));
    if (puesto_id !== undefined) updateData.puesto_id = parseInt(String(puesto_id));
    if (fecha !== undefined) updateData.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    if (ejecutivo_cuenta !== undefined) updateData.ejecutivo_cuenta = String(ejecutivo_cuenta);
    if (articulos_puesto !== undefined) {
      updateData.articulos_puesto = sanitizeArticulosPuestoForPersistence(articulos_puesto);
    }
    if (firma_supervisor !== undefined) {
      updateData.firma_supervisor =
        firma_supervisor != null && typeof firma_supervisor === "string" && firma_supervisor.trim().length > 0
          ? firma_supervisor.trim()
          : null;
    }
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable);
    const touchesEmpleadoHoras =
      empleado_id !== undefined ||
      empleado_nombre !== undefined ||
      empleado_codigo !== undefined ||
      hora_inicio !== undefined ||
      hora_fin !== undefined;
    if (touchesEmpleadoHoras) {
      const empleadoHoras = validateChecklistEmpleadoHoras({
        empleado_id: empleado_id !== undefined ? empleado_id : (existing as any).empleado_id,
        empleado_nombre: empleado_nombre !== undefined ? empleado_nombre : (existing as any).empleado_nombre,
        empleado_codigo: empleado_codigo !== undefined ? empleado_codigo : (existing as any).empleado_codigo,
        hora_inicio: hora_inicio !== undefined ? hora_inicio : (existing as any).hora_inicio,
        hora_fin: hora_fin !== undefined ? hora_fin : (existing as any).hora_fin,
      });
      if (!empleadoHoras.ok) {
        return NextResponse.json({ status: false, message: empleadoHoras.message }, { status: 200 });
      }
      updateData.empleado_id = empleadoHoras.empleadoId;
      updateData.empleado_nombre = empleadoHoras.empleadoNombre;
      updateData.empleado_codigo = empleadoHoras.empleadoCodigo;
      updateData.hora_inicio = empleadoHoras.horaInicio.toISOString();
      updateData.hora_fin = empleadoHoras.horaFin.toISOString();
    }

    // Procesar evaluación si se proporciona
    if (evaluacion !== undefined) {
      let evaluationParsed = safeParseJson<any>(evaluacion, []);

      // Procesar imágenes en la evaluación
      try {
        const processedEvaluation = await processEvaluationImages(req, evaluationParsed, id);
        console.log("processedEvaluation", processedEvaluation);
        updateData.evaluacion = JSON.stringify(processedEvaluation);

      } catch (error) {
        console.error("Error procesando imágenes en evaluación:", error);
        // Si falla, guardar sin procesar
        updateData.evaluacion = String(evaluacion);
      }
    }

    // Comparar cambios (incluir firmas)
    for (const [k, v] of Object.entries(updateData)) {
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

    if (articulos_puesto !== undefined) {
      const corpoIdNum =
        corpo_id !== undefined ? parseInt(String(corpo_id), 10) : Number((existing as any).corpo_id);
      const puestoIdNum =
        puesto_id !== undefined ? parseInt(String(puesto_id), 10) : Number((existing as any).puesto_id);
      if (
        Number.isFinite(corpoIdNum) &&
        Number.isFinite(puestoIdNum) &&
        corpoIdNum > 0 &&
        puestoIdNum > 0
      ) {
        const accionAt =
          hora_accion != null && String(hora_accion).trim()
            ? new Date(hora_accion)
            : created_at != null && String(created_at).trim()
              ? new Date(created_at)
              : new Date();
        const existingCreatedBy = Number((existing as any).created_by);
        const curUser = parseInt(String((payload as any)?.id ?? 0), 10) || 0;
        const notifySenderIds =
          existingCreatedBy > 0 ? [existingCreatedBy] : curUser > 0 ? [curUser] : [];
        await processChecklistSupervisionArticulosMantenimiento({
          req,
          articulos_puesto,
          accionAt,
          corpo_id: corpoIdNum,
          puesto_id: puestoIdNum,
          payload,
          notifySenderIds,
          fechaNotificacion: accionAt,
          isUpdate: true,
        });

        const articulosStored = stripMantenimientoFilesFromArticulosPuesto(
          sanitizeArticulosPuestoForPersistence(articulos_puesto),
        );
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_checklist_supervision",
            where: { id },
            data: { articulos_puesto: articulosStored },
          },
        });
      }
    }

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

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(CHECKLIST_SUPERVISION_INCLUDE);

    const fullRow = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findUnique",
        where: { id },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(fullRow, preexistentSpecs);

    const mapped = fullRow ? mapChecklistSupervisionPublicRow(fullRow, req.nextUrl.origin) : { id };

    return NextResponse.json(
      { status: true, message: "Checklist actualizado correctamente", data: mapped },
      { status: 200 }
    );
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
      data: {
        action: "UPDATE",
        table: "c_checklist_supervision",
        where: { id },
        data: { isActive: false },
      },
    });
    return NextResponse.json({ status: true, message: "Checklist eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/checklist-supervision/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

