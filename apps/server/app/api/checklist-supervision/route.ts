/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { createReport } from "../../../utils/createReporteArticuloMantenimiento";

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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");

    const where: any = {};
    if (clienteIdStr) where.cliente_id = parseInt(clienteIdStr);
    if (corpoIdStr) where.corpo_id = parseInt(corpoIdStr);
    if (puestoIdStr) where.puesto_id = parseInt(puestoIdStr);

    const rows = await prisma.c_checklist_supervision.findMany({
      where,
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
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      division_id: r.division_id,
      corpo_id: r.corpo_id,
      puesto_id: r.puesto_id,
      fecha: r.fecha,
      ejecutivo_cuenta: r.ejecutivo_cuenta,
      evaluacion: r.evaluacion,
      articulos_puesto: (r as any).articulos_puesto || null,
      firma_supervisor: r.firma_supervisor,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      cliente: r.e_estructura_cliente,
      corpo: r.e_estructura_sucursal,
      puesto: r.e_estructura_puesto,
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/checklist-supervision:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const body = await req.json();
    const {
      cliente_id,
      division_id,
      corpo_id,
      puesto_id,
      division,
      fecha,
      ejecutivo_cuenta,
      evaluacion,
      articulos_puesto,
      firma_supervisor,
      firma_responsable,
    } = body ?? {};

    if (
      !cliente_id ||
      !division_id ||
      !corpo_id ||
      !puesto_id ||
      !division ||
      !fecha ||
      !ejecutivo_cuenta ||
      !evaluacion ||
      !firma_supervisor ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
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

    // Crear el registro primero para obtener el ID
    const created = await prisma.c_checklist_supervision.create({
      data: {
        cliente_id: parseInt(String(cliente_id)),
        division_id: parseInt(String(division_id)),
        corpo_id: parseInt(String(corpo_id)),
        puesto_id: parseInt(String(puesto_id)),
        fecha: fechaDate,
        ejecutivo_cuenta: String(ejecutivo_cuenta),
        evaluacion: JSON.stringify(evaluationParsed), // Temporal, se actualizará después
        articulos_puesto: articulos_puesto ? String(articulos_puesto) : '',
        firma_supervisor: String(firma_supervisor),
        firma_responsable: String(firma_responsable),
        created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
        created_at: createdAt,
      },
    });

    // Procesar imágenes en la evaluación y actualizar
    try {
      console.log("Procesando imágenes para checklist ID:", created.id);
      const processedEvaluation = processEvaluationImages(evaluationParsed, created.id);
      console.log("Evaluación procesada, guardando...");

      await prisma.c_checklist_supervision.update({
        where: { id: created.id },
        data: {
          evaluacion: JSON.stringify(processedEvaluation),
        },
      });
      console.log("Evaluación actualizada correctamente");
    } catch (error) {
      console.error("Error procesando imágenes en evaluación:", error);
      // Continuar aunque falle el procesamiento de imágenes
    }

    if (created) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      if (puesto_id) {
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: puesto_id } });
        if (puesto) {
          puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
        }
      }
      const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(String((payload as any)?.id ?? 0)) || 0 } });
      if (empleado) {
        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
      }
      const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: corpo_id } });
      if (sucursal) {
        sucursalNombre = sucursal.nombre;
      }
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];

      // Verificar si hay problemas con los artículos (similar a entrega-puestos)
      let articulos_desc = ".";
      let send_notification = false;
      let articulos_reporte = [];
      if (articulos_puesto) {
        try {
          const articulos_puesto_array = typeof articulos_puesto === 'string' ? JSON.parse(articulos_puesto) : articulos_puesto;
          if (Array.isArray(articulos_puesto_array) && articulos_puesto_array.length > 0) {
            let init_desc = false;
            for (const articulo of articulos_puesto_array) {
              let articulo_desc = `- ${articulo.cantidad_real} de ${articulo.cantidad_requerida} unidades de "${articulo.nombre}" (Estado: ${articulo.estado})\n`;
              let add_desc = false;
              if (articulo.cantidad_requerida > articulo.cantidad_real) {
                add_desc = true;
              }

              let was_good = false;
              if (articulo.tipo == "Plan") {
                const last_mantenimiento = await prisma.c_articulo_mantenimiento.findFirst({ where: { articulo_plan_id: articulo.id }, orderBy: { fecha_solucion: "desc" } });
                if (last_mantenimiento) {
                  if (last_mantenimiento.estado == "Bueno") {
                    was_good = true;
                  }
                }
              }
              else {
                const last_mantenimiento = await prisma.c_articulo_mantenimiento.findFirst({ where: { articulo_asignado_id: articulo.id }, orderBy: { fecha_solucion: "desc" } });
                if (last_mantenimiento) {
                  if (last_mantenimiento.estado == "Bueno") {
                    was_good = true;
                  }
                }
              }

              if (articulo.estado != "Bueno" && was_good) {
                add_desc = true;
              }

              if (add_desc) {
                send_notification = true;
                if (!init_desc) {
                  articulos_desc = ". Sin embargo, los artículos registrados presentan los siguientes detalles:\n";
                  init_desc = true;
                }
                articulos_desc += articulo_desc;
                articulos_reporte.push({
                  id: articulo.id,
                  nombre: articulo.nombre,
                  tipo: articulo.tipo,
                  marca: articulo.marca,
                  serie: articulo.serie,
                  cantidad_requerida: articulo.cantidad_requerida,
                  cantidad_real: articulo.cantidad_real,
                  estado: articulo.estado,
                  observaciones: articulo.observaciones,
                });
              }
            }
          }
        } catch (error) {
          console.error("Error procesando artículos para notificación:", error);
        }
      }

      if (send_notification) {
        const description = "El empleado " + empNombre + " ha registrado un checklist de supervisión en el puesto " + puestoNombre + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro + articulos_desc;
        sendNotificationByRole(corpo_id, [created.created_by], "Checklist de supervisión registrado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
        createReport(articulos_reporte);
      }
    }

    return NextResponse.json({ status: true, message: "Checklist creado correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/checklist-supervision:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

