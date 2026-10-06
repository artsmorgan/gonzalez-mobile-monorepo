/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../utils/reportError";

const VULNERABILIDAD_ESTRUCTURA_INCLUDE = {
  e_estructura_cliente: { select: { nombre: true } },
  e_estructura_sucursal: { select: { nombre: true } },
  e_estructura_puesto: { select: { nombre: true } },
};

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(VULNERABILIDAD_ESTRUCTURA_INCLUDE);

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findMany",
        where: { isActive: true },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
        orderBy: { id: "desc" },
      },
    });
    await hydratePreexistentRelations(rows, preexistentSpecs);

    const rowsArray = Array.isArray(rows) ? rows : [];
    const mapped = [];
    for (const r of rowsArray) {
      const images = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_imagenes_boleta_apreciacion_vulnerabilidad",
          operation: "findMany",
          where: { boleta_id: r.id },
          orderBy: { id: "asc" },
        },
      });
      const baseUrl = req.nextUrl.origin;
      mapped.push({
        id: r.id,
        empresa_id: (r as any).empresa_id ?? 0,
        cliente_id: r.cliente_id,
        cliente_nombre: (r as any).e_estructura_cliente?.nombre ?? "",
        division_id: (r as any).division_id ?? 0,
        contrato_id: (r as any).contrato_id ?? 0,
        corpo_id: r.corpo_id,
        corpo_nombre: (r as any).e_estructura_sucursal?.nombre ?? "",
        puesto_id: r.puesto_id,
        puesto_nombre: (r as any).e_estructura_puesto?.nombre ?? "",
        fecha: r.fecha,
        enlace: r.enlace,
        nombre_solicitante: r.nombre_solicitante,
        boleta: r.boleta,
        metricas_vulnerablidad: r.metricas_vulnerablidad,
        observaciones: r.observaciones ?? "",
        firma_solicitante: r.firma_solicitante,
        firma_responsable: r.firma_responsable,
        isActive: r.isActive !== false,
        images: (Array.isArray(images) ? images : []).map((img: any) => ({
          id: Number(img.id),
          name: String(img.name || ""),
          original_name: String(img.original_name || ""),
          url: baseUrl
            ? `${baseUrl}/api/apreciacion-vulnerabilidad/${r.id}/get-image/${encodeURIComponent(String(img.name || ""))}`
            : "",
        })),
        id_local: "",
      });
    }

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/apreciacion-vulnerabilidad:", errorMessage);
    await reportError(req, "api/apreciacion-vulnerabilidad", "GET", 500, errorMessage);
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

    if (
      !cliente_id ||
      !corpo_id ||
      !puesto_id ||
      !fecha ||
      !enlace ||
      !nombre_solicitante ||
      !boleta ||
      !metricas_vulnerablidad ||
      !firma_responsable
    ) {
      await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 500, "Datos incompletos");
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 500 });
    }

    const fechaDate = parseDateTime(fecha);
    if (!fechaDate) {
      await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 400, "Fecha inválida");
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    // Validar IDs existan (mínimo)
    const [cliente, corpo, puesto] = await Promise.all([
      prisma.e_estructura_cliente.findUnique({ where: { id: parseInt(String(cliente_id)) } }),
      prisma.e_estructura_sucursal.findUnique({ where: { id: parseInt(String(corpo_id)) } }),
      prisma.e_estructura_puesto.findUnique({ where: { id: parseInt(String(puesto_id)) } }),
    ]);
    if (!cliente) {
      await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 400, "Cliente inválido");
      return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 400 });
    }
    if (!corpo) {
      await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 400, "Corpo inválido");
      return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 400 });
    }
    if (!puesto) {
      await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 400, "Puesto inválido");
      return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 400 });
    }

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "create",
        data: {
          cliente_id: parseInt(String(cliente_id)),
          empresa_id: Number(empresa_id) > 0 ? parseInt(String(empresa_id)) : 0,
          division_id: Number(division_id) > 0 ? parseInt(String(division_id)) : 0,
          contrato_id: Number(contrato_id) > 0 ? parseInt(String(contrato_id)) : 0,
          corpo_id: parseInt(String(corpo_id)),
          puesto_id: parseInt(String(puesto_id)),
          fecha: fechaDate.toISOString(),
          enlace: String(enlace),
          nombre_solicitante: String(nombre_solicitante),
          boleta: String(boleta),
          metricas_vulnerablidad: String(metricas_vulnerablidad),
          observaciones: typeof observaciones === "string" ? observaciones : "",
          firma_solicitante: String(firma_solicitante ?? ""),
          firma_responsable: String(firma_responsable),
          isActive: true,
        },
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
    if (Array.isArray(imagesParsed) && imagesParsed.length > 0 && created?.id) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `apreciacion-vulnerabilidad/${created.id}`,
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
              boleta_id: created.id,
            },
          },
        });
      }
    }

    if (created) {

      const now = toZonedTime(new Date(), "America/Costa_Rica");

      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      let fechaRegistro = now.toISOString().split("T")[0];
      let horaRegistro = now.toISOString().split("T")[1].split(".")[0];
      const empleado = await prisma.c_empleado.findUnique({
        where: { id: parseInt(String(payload?.id ?? "0"), 10) },
      });
      if (empleado) {
        empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
      }
      if ((created as any).corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({
          where: { id: (created as any).corpo_id },
        });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      if ((created as any).puesto_id) {
        const puesto = await prisma.e_estructura_puesto.findUnique({
          where: { id: (created as any).puesto_id },
        });
        if (puesto) {
          puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado una apreciación de vulnerabilidad en el puesto " + puestoNombre + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, (created as any).corpo_id, [parseInt(String(payload?.id ?? "0"), 10)], "Apreciación de vulnerabilidad registrada", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String(payload?.id ?? 0), 10) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
          registro_id: (created as any).id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: (created as any).id,
              cliente_id: (created as any).cliente_id,
              empresa_id: (created as any).empresa_id,
              division_id: (created as any).division_id,
              contrato_id: (created as any).contrato_id,
              corpo_id: (created as any).corpo_id,
              puesto_id: (created as any).puesto_id,
              fecha: fechaDate.toISOString(),
              enlace: (created as any).enlace,
              nombre_solicitante: (created as any).nombre_solicitante,
              boleta: (created as any).boleta,
              metricas_vulnerablidad: (created as any).metricas_vulnerablidad,
              observaciones: (created as any).observaciones,
              firma_solicitante: (created as any).firma_solicitante,
              firma_responsable: (created as any).firma_responsable,
            },
          }]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json(
      { status: true, message: "Registro creado correctamente", id: (created as any).id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/apreciacion-vulnerabilidad:", errorMessage);
    await reportError(req, "api/apreciacion-vulnerabilidad", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


