import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../utils/sendNotification";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

type PncFileInput = {
  type: string; // image | audio | video | document
  extension: string;
  original_name?: string;
  file_base64: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
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

function buildFileUrl(baseUrl: string, recordId: number, file: { name: string; type: string }): string {
  const fileName = file.name;
  const type = String(file.type || "file").toLowerCase();
  let urlPath: string;
  if (type === "image") {
    urlPath = `/api/non-conforming-product/${recordId}/get-image/${fileName}`;
  } else if (type === "audio") {
    urlPath = `/api/non-conforming-product/${recordId}/get-audio/${fileName}`;
  } else if (type === "video") {
    urlPath = `/api/non-conforming-product/${recordId}/get-video/${fileName}`;
  } else {
    urlPath = `/api/non-conforming-product/${recordId}/get-file/${fileName}`;
  }
  return `${baseUrl}${urlPath}`;
}

function parseDateOnly(input: any): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (s.length === 0) return null;
  // aceptar YYYY-MM-DD
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);

    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      cliente_id,
      corpo_id,
      empresa_id,
      division_id,
      contrato_id,
      puesto_id,
      fecha_identificacion,
      responsable_cuenta,
      tipo_servicio_no_conforme,
      persona_identifico_pnc,
      firma_persona_identifico_pnc,
      descripcion,
      persona_origino_pnc,
      firma_persona_origino_pnc,
      accion_implementada,
      fecha_solucion,
      responsable_aprobar,
      firma_responsable,
      archivos,
    } = await req.json();

    const clienteId = Number(cliente_id);
    const corpoId = Number(corpo_id);
    const empresaId = Number(empresa_id);
    const divisionId = Number(division_id);
    const contratoId = Number(contrato_id);
    const puestoId = Number(puesto_id);
    if (!clienteId || !corpoId) {
      return NextResponse.json({ status: false, message: "Cliente y Sucursal son requeridos" }, { status: 400 });
    }
    if (!empresaId || !divisionId || !contratoId || !puestoId) {
      return NextResponse.json(
        { status: false, message: "empresa, división, contrato y puesto son requeridos" },
        { status: 400 }
      );
    }

    const fechaIdent = parseDateOnly(fecha_identificacion);
    const fechaSol = parseDateOnly(fecha_solucion);
    if (!fechaIdent || !fechaSol) {
      return NextResponse.json({ status: false, message: "Fechas inválidas (identificación / solución)" }, { status: 400 });
    }

    if (!firma_responsable || String(firma_responsable).trim().length === 0) {
      return NextResponse.json({ status: false, message: "La firma del responsable es requerida" }, { status: 400 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");

    const newRecord = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_producto_no_conforme",
        operation: "create",
        data: {
          cliente_id: clienteId,
          corpo_id: corpoId,
          empresa_id: empresaId,
          division_id: divisionId,
          contrato_id: contratoId,
          puesto_id: puestoId,
          fecha_identificacion: fechaIdent.toISOString(),
          responsable_cuenta: String(responsable_cuenta ?? ""),
          tipo_servicio_no_conforme: String(tipo_servicio_no_conforme ?? ""),
          persona_identifico_pnc: String(persona_identifico_pnc ?? ""),
          firma_persona_identifico_pnc:
            firma_persona_identifico_pnc != null && String(firma_persona_identifico_pnc).trim().length > 0
              ? String(firma_persona_identifico_pnc).trim()
              : null,
          descripcion: String(descripcion ?? ""),
          persona_origino_pnc: String(persona_origino_pnc ?? ""),
          firma_persona_origino_pnc:
            firma_persona_origino_pnc != null && String(firma_persona_origino_pnc).trim().length > 0
              ? String(firma_persona_origino_pnc).trim()
              : null,
          accion_implementada: String(accion_implementada ?? ""),
          fecha_solucion: fechaSol.toISOString(),
          responsable_aprobar: String(responsable_aprobar ?? ""),
          firma_responsable: String(firma_responsable ?? ""),
          created_at: createdAt.toISOString(),
          created_by: payload?.id?.toString() || "",
        },
        include: {
          e_archivos_producto_no_conforme: true,
        },
      },
    });
    const newRecordObj = newRecord as any;

    // Archivos anexos
    let filesParsed: PncFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<PncFileInput[]>(archivos, []);
    }

    if (newRecordObj) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (newRecordObj.created_by) {
        const empleado = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "c_empleado",
            operation: "findUnique",
            where: { id: Number(newRecordObj.created_by) },
          },
        });
        if (empleado) {
          const empleadoObj = empleado as any;
          empNombre = empleadoObj.nombre + " " + empleadoObj.primer_apellido + " " + empleadoObj.segundo_apellido;
        }
      }
      if (newRecordObj.corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: newRecordObj.corpo_id },
          },
        });
        if (sucursal) {
          const sucursalObj = sucursal as any;
          sucursalNombre = sucursalObj.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado un producto no conforme en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, newRecordObj.corpo_id, [Number(newRecordObj.created_by)], "Producto no conforme registrado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    if (filesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `non-conforming-product/${newRecordObj.id}`,
        files: filesParsed
          .filter((f) => f?.file_base64 && f?.extension && f?.type)
          .map((f) => ({
            type: f.type,
            extension: f.extension,
            original_name: f.original_name,
            file_base64: f.file_base64,
          })),
      });

      const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      for (const uploaded of uploadedFiles) {
        await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "e_archivos_producto_no_conforme",
            operation: "create",
            data: {
              name: uploaded.name,
              original_name: uploaded.original_name || uploaded.name,
              type: uploaded.type,
              extension: uploaded.extension,
              pnc_id: newRecordObj.id,
            },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_producto_no_conforme",
        operation: "findUnique",
        where: { id: newRecordObj.id },
        include: { e_archivos_producto_no_conforme: true },
      },
    });

    // Registrar cambio de creación
    const createdBy = parseInt(String(payload?.id ?? 0), 10) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_producto_no_conforme",
          registro_id: newRecordObj.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: newRecordObj.id,
              cliente_id: newRecordObj.cliente_id,
              corpo_id: newRecordObj.corpo_id,
              fecha_identificacion: fechaIdent.toISOString(),
              responsable_cuenta: newRecordObj.responsable_cuenta,
              tipo_servicio_no_conforme: newRecordObj.tipo_servicio_no_conforme,
              persona_identifico_pnc: newRecordObj.persona_identifico_pnc,
              firma_persona_identifico_pnc: newRecordObj.firma_persona_identifico_pnc,
              descripcion: newRecordObj.descripcion,
              persona_origino_pnc: newRecordObj.persona_origino_pnc,
              firma_persona_origino_pnc: newRecordObj.firma_persona_origino_pnc,
              accion_implementada: newRecordObj.accion_implementada,
              fecha_solucion: fechaSol.toISOString(),
              responsable_aprobar: newRecordObj.responsable_aprobar,
              firma_responsable: newRecordObj.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    const fullRecordObj = fullRecord as any;
    const archivosArray = Array.isArray(fullRecordObj?.e_archivos_producto_no_conforme) ? fullRecordObj.e_archivos_producto_no_conforme : [];
    const baseUrl = req.nextUrl.origin;
    return NextResponse.json(
      {
        status: true,
        message: "Producto no conforme creado correctamente",
        data: {
          ...(fullRecordObj ?? newRecordObj),
          id: newRecordObj.id,
          id_local: "",
          files: archivosArray.map((f: any) => ({
            id: f.id,
            name: f.name,
            original_name: f.original_name,
            type: f.type,
            extension: f.extension,
            url: buildFileUrl(baseUrl, newRecordObj.id, f),
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

