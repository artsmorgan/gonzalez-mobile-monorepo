/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

function normalizeBase64(b64: string): string {
  if (!b64) return "";
  const idx = b64.indexOf("base64,");
  if (idx !== -1) return b64.slice(idx + "base64,".length);
  return b64;
}

// Función recursiva para procesar imágenes en la evaluación (como StaffEvaluationsScreen)
function processEvaluationImages(evaluation: any, checklistId: number): any {
  if (!evaluation || typeof evaluation !== "object") return evaluation;

  if (Array.isArray(evaluation)) {
    return evaluation.map((item) => processEvaluationImages(item, checklistId));
  }

  const processed: any = { ...evaluation };

  // Si es un input de tipo photo con value (data URI), procesar la imagen
  if (processed.type === "photo" && processed.value && typeof processed.value === "string" && processed.value.startsWith("data:image/")) {
    try {
      console.log(`Procesando imagen para input ID: ${processed.id}, value length: ${processed.value.length}`);
      const dir = path.join(process.cwd(), "public", "uploads", "checklist-supervision", `${checklistId}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Extraer base64 del data URI
      const normalizedBase64 = normalizeBase64(String(processed.value));
      console.log(`Base64 normalizado length: ${normalizedBase64.length}`);

      // Determinar extensión desde el data URI o usar jpg por defecto
      const mimeMatch = processed.value.match(/data:image\/([^;]+)/);
      const ext = mimeMatch ? mimeMatch[1].replace("jpeg", "jpg") : "jpg";

      const buffer = Buffer.from(normalizedBase64, "base64");
      const fileName = `${uuidv4()}.${ext}`;
      const filePath = path.join(dir, fileName);

      fs.writeFileSync(filePath, buffer);
      console.log(`Imagen guardada: ${filePath}, tamaño: ${buffer.length} bytes`);

      // Guardar el nombre del archivo y mantener imageOrientation si existe
      processed.file_name = fileName;
      // No eliminar value, pero el backend puede usar file_name para servir la imagen
      // El frontend seguirá usando value para mostrar la imagen localmente
      console.log(`Imagen procesada correctamente, file_name: ${fileName}`);
    } catch (error) {
      console.error("Error procesando imagen en evaluación:", error);
      // Si falla, mantener el value original
    }
  }

  // Procesar recursivamente subsections e inputs
  if (processed.subsections && Array.isArray(processed.subsections)) {
    processed.subsections = processed.subsections.map((sub: any) => processEvaluationImages(sub, checklistId));
  }

  if (processed.inputs && Array.isArray(processed.inputs)) {
    processed.inputs = processed.inputs.map((input: any) => processEvaluationImages(input, checklistId));
  }

  return processed;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const row = await prisma.c_checklist_supervision.findUnique({
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
      },
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
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

    const existing = await prisma.c_checklist_supervision.findUnique({ where: { id } });
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
        const processedEvaluation = processEvaluationImages(evaluationParsed, id);
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

    await prisma.c_checklist_supervision.update({
      where: { id },
      data: updateData,
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_checklist_supervision",
          registro_id: id,
          cambios: JSON.stringify(cambiosArr),
          created_at: createdAt,
          created_by: createdBy,
        },
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const existing = await prisma.c_checklist_supervision.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    await prisma.c_cambios_apps_modules.create({
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
            fecha: existing.fecha.toISOString(),
            ejecutivo_cuenta: existing.ejecutivo_cuenta,
            evaluacion: existing.evaluacion,
            articulos_puesto: (existing as any).articulos_puesto || null,
            firma_supervisor: existing.firma_supervisor,
            firma_responsable: existing.firma_responsable,
          },
          after: null,
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    await prisma.c_checklist_supervision.delete({ where: { id } });
    return NextResponse.json({ status: true, message: "Checklist eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/checklist-supervision/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

