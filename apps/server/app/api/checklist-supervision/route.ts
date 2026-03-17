/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { createReport, updateReport } from "../../../utils/createReporteArticuloMantenimiento";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

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

    const where: any = {};
    if (clienteIdStr) where.cliente_id = parseInt(clienteIdStr);
    if (corpoIdStr) where.corpo_id = parseInt(corpoIdStr);
    if (puestoIdStr) where.puesto_id = parseInt(puestoIdStr);

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_checklist_supervision",
        operation: "findMany",
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
        orderBy: { id: "desc" }
      }
    });

    const mapped = rows.map((r: any) => ({
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
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
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
      created_at,
      hora_accion,
    } = body ?? {};

    if (
      !cliente_id ||
      !division_id ||
      !corpo_id ||
      !puesto_id ||
      !division ||
      !fecha ||
      !evaluacion ||
      !firma_responsable ||
      !created_at
    ) {
      const errorMessage = "Datos incompletos: " +
        (!cliente_id ? "cliente_id, " : "") +
        (!division_id ? "division_id, " : "") +
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
    const accionAtMs = accionAt.getTime();
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

    const sucursal = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: parseInt(String(corpo_id)) } }
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
          cliente_id: parseInt(String(cliente_id)),
          division_id: parseInt(String(division_id)),
          corpo_id: parseInt(String(corpo_id)),
          puesto_id: parseInt(String(puesto_id)),
          fecha: fechaDate.toISOString(),
          ejecutivo_cuenta: String(sucursal.ejecutivoCuenta_id ?? 0),
          evaluacion: '[]', // Temporal, se actualizará después
          articulos_puesto: articulos_puesto ? String(articulos_puesto) : '',
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
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      if (puesto_id) {
        const puesto = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "e_estructura_puesto", operation: "findUnique", where: { id: puesto_id } }
        });
        if (puesto) {
          puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
        }
      }
      const empleado = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "c_empleado", operation: "findUnique", where: { id: parseInt(String((payload as any)?.id ?? 0)) || 0 } }
      });
      if (empleado) {
        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
      }
      const sucursal = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: corpo_id } }
      });
      if (sucursal) {
        sucursalNombre = sucursal.nombre;
      }
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];

      // Verificar artículos del puesto y generar/actualizar reportes de mantenimiento
      let articulos_desc = ".";
      let send_notification = false;
      const articulos_reporte: any[] = [];
      const articulos_reporte_update: any[] = [];
      if (articulos_puesto) {
        try {
          const articulos_puesto_array = typeof articulos_puesto === "string" ? JSON.parse(articulos_puesto) : articulos_puesto;
          if (Array.isArray(articulos_puesto_array) && articulos_puesto_array.length > 0) {
            let init_desc = false;
            for (const articulo of articulos_puesto_array) {
              let articulo_desc = `- ${articulo.cantidad_real} de ${articulo.cantidad_requerida} unidades de "${articulo.nombre}" (Estado: ${articulo.estado})\n`;

              let last_estado: string | null = null;
              let last_mantenimiento: any = null;
              if (articulo.tipo === "Plan") {
                last_mantenimiento = await callDynamicPrisma({
                  req,
                  data: {
                    action: "GET",
                    table: "c_articulo_mantenimiento",
                    operation: "findFirst",
                    where: { articulo_plan_id: articulo.id },
                    orderBy: { fecha_solucion: "desc" },
                  },
                });
              } else {
                last_mantenimiento = await callDynamicPrisma({
                  req,
                  data: {
                    action: "GET",
                    table: "c_articulo_mantenimiento",
                    operation: "findFirst",
                    where: { articulo_asignado_id: articulo.id },
                    orderBy: { fecha_solucion: "desc" },
                  },
                });
              }

              if (last_mantenimiento && last_mantenimiento.id) {
                last_estado = String(last_mantenimiento.estado || "");
                // Validar que el último mantenimiento no tenga un updated_at más reciente que el momento del checklist
                if (last_mantenimiento.updated_at) {
                  const lastUpdated = new Date(last_mantenimiento.updated_at);
                  if (!isNaN(lastUpdated.getTime()) && lastUpdated.getTime() > accionAtMs) {
                    // Mantenimiento actualizado después de hora_accion/created_at → no crear ni evaluar
                    continue;
                  }
                }
              } else {
                // Si no hay registros previos asumimos que el estado base era Bueno
                last_estado = "Bueno";
              }

              const estado_actual = String(articulo.estado || "");

              switch (estado_actual) {
                case "Bueno":
                  // Si antes no era Bueno y ahora sí, se actualiza el último reporte a Bueno
                  if (last_estado !== "Bueno" && last_mantenimiento && last_mantenimiento.id) {
                    articulos_reporte_update.push({
                      id: last_mantenimiento.id,
                      estado: "Bueno",
                      cantidad_real: articulo.cantidad_requerida,
                      fecha_solucion: createdAt,
                    });
                  }
                  break;
                default:
                  if (last_estado === "Bueno") {
                    // Transición Bueno -> no Bueno: notificar y crear nuevo reporte
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
                      created_at: createdAt,
                      updated_at: createdAt,
                    });
                  } else if (last_estado !== estado_actual && last_mantenimiento && last_mantenimiento.id) {
                    // Cambio entre estados no Buenos: actualizar reporte existente
                    articulos_reporte_update.push({
                      id: last_mantenimiento.id,
                      estado: estado_actual,
                      cantidad_real: articulo.cantidad_real,
                      fecha_solucion: null,
                      updated_at: createdAt,
                    });
                  }
                  break;
              }
            }
          }
        } catch (error) {
          console.error("Error procesando artículos para notificación y reportes:", error);
        }
      }

      if (articulos_reporte.length > 0) {
        await createReport(req, articulos_reporte);
      }
      if (articulos_reporte_update.length > 0) {
        await updateReport(req, articulos_reporte_update);
      }

      if (send_notification) {
        const description =
          "El empleado " +
          empNombre +
          " ha registrado un checklist de supervisión en el puesto " +
          puestoNombre +
          " en la sucursal " +
          sucursalNombre +
          " el día " +
          fechaRegistro +
          " a las " +
          horaRegistro +
          articulos_desc;
        await sendNotificationByRole(req, corpo_id, [created.created_by], "Checklist de supervisión registrado", description, [
          "ADMINISTRATIVO",
          "SUPERVISOR",
        ]);
      }
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
              cliente_id: created.cliente_id,
              division_id: created.division_id,
              corpo_id: created.corpo_id,
              puesto_id: created.puesto_id,
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

    return NextResponse.json({ status: true, message: "Checklist creado correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/checklist-supervision:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

