import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";

const stripDataUrlBase64 = (raw: string): string => {
  const s = String(raw || "").trim();
  if (!s) return "";
  const idx = s.indexOf("base64,");
  if (s.toLowerCase().startsWith("data:") && idx >= 0) return s.slice(idx + "base64,".length).trim();
  return s;
};

function parseFechaInput(fecha: any): Date | undefined {
  if (!fecha) return undefined;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === "string") {
    if (fecha.includes("/")) {
      const parts = fecha.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function ensureStringJson(value: any, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

type GeneralInductionImageInput = {
  file_base64: string;
  extension?: string;
  original_name?: string;
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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const {
      division,
      fecha,
      temas_a_tratar,
      colaboradores,
      capacitadores,
      firma_responsable,
      imagenes,
      empresa_id,
      cliente_id,
      corpo_id,
      division_id,
      contrato_id,
      puesto_id,
    } = body;

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id: idNum },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }
    const existingObj = existing as any;
    if (existingObj.isActive === false) {
      return NextResponse.json({ status: false, message: "Registro no disponible" }, { status: 404 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const updateData: any = {};
    if (division !== undefined) updateData.division = String(division).trim();
    if (empresa_id !== undefined) {
      const n = parseInt(String(empresa_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.empresa_id = n;
    }
    if (cliente_id !== undefined) {
      const n = parseInt(String(cliente_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.cliente_id = n;
    }
    if (corpo_id !== undefined) {
      const n = parseInt(String(corpo_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.corpo_id = n;
    }
    if (division_id !== undefined) {
      const n = parseInt(String(division_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.division_id = n;
    }
    if (contrato_id !== undefined) {
      const n = parseInt(String(contrato_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.contrato_id = n;
    }
    if (puesto_id !== undefined) {
      const n = parseInt(String(puesto_id), 10);
      if (!Number.isNaN(n) && n > 0) updateData.puesto_id = n;
    }
    if (fecha !== undefined) {
      if (fechaParsed) {
        updateData.fecha = fechaParsed.toISOString();
      }
    }
    if (temas_a_tratar !== undefined) updateData.temas_a_tratar = ensureStringJson(temas_a_tratar, "[]");
    if (colaboradores !== undefined) updateData.colaboradores = ensureStringJson(colaboradores, "[]");
    if (capacitadores !== undefined) updateData.capacitadores = ensureStringJson(capacitadores, "[]");
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable);

    // Registrar cambios (solo campos actualizados, incluyendo firma_responsable)
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
        table: "c_registro_induccion_general",
        operation: "update",
        where: { id: idNum },
        data: updateData,
        include: {
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });
    const updatedObj = updated as any;

    // Guardar nuevas imágenes (si vienen)
    let imagesParsed: GeneralInductionImageInput[] = [];
    if (imagenes) imagesParsed = safeParseJson<GeneralInductionImageInput[]>(imagenes, []);
    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `general-induction-register/${idNum}`,
        files: imagesParsed
          .filter((img) => img?.file_base64)
          .map((img) => ({
            type: "image",
            extension: String(img.extension || "jpg").replace(".", "").trim() || "jpg",
            original_name: img.original_name,
            file_base64: stripDataUrlBase64(String(img.file_base64)),
          })),
      });
      const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
      for (const uploaded of uploadedFiles) {
        await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_imagenes_registro_induccion_general",
            operation: "create",
            data: {
              name: uploaded.name,
              registro_id: idNum,
            },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id: idNum },
        include: {
          c_imagenes_registro_induccion_general: true,
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });
    const fullRecordObj = fullRecord as any;
    const baseUrl = req.nextUrl.origin;

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_registro_induccion_general",
            registro_id: idNum,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json(
      {
        status: true,
        message: "Registro de inducción general actualizado correctamente",
        data: {
          ...fullRecordObj,
          id_local: "",
          empresa_nombre: fullRecordObj?.e_estructura_empresa ? `${fullRecordObj.e_estructura_empresa.codigo} - ${fullRecordObj.e_estructura_empresa.nombre}` : null,
          cliente_nombre: fullRecordObj?.e_estructura_cliente?.nombre || null,
          corpo_nombre: fullRecordObj?.e_estructura_sucursal ? `${fullRecordObj.e_estructura_sucursal.nro_sucursal} - ${fullRecordObj.e_estructura_sucursal.nombre}` : null,
          images: (fullRecordObj?.c_imagenes_registro_induccion_general || []).map((img: any) => ({
            id: img.id,
            name: img.name,
            url: baseUrl ? `${baseUrl}/api/general-induction-register/${fullRecordObj.id}/get-image/${img.name}` : "",
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

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findUnique",
        where: { id: idNum },
      },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const existingObj = existing as any;
    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaValue = existingObj.fecha instanceof Date ? existingObj.fecha.toISOString() : (typeof existingObj.fecha === 'string' ? existingObj.fecha : null);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_registro_induccion_general",
          registro_id: idNum,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existingObj.id,
              empresa_id: existingObj.empresa_id,
              cliente_id: existingObj.cliente_id,
              corpo_id: existingObj.corpo_id,
              division: existingObj.division,
              fecha: fechaValue,
              temas_a_tratar: existingObj.temas_a_tratar,
              colaboradores: existingObj.colaboradores,
              capacitadores: existingObj.capacitadores,
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
        action: "DELETE",
        table: "c_registro_induccion_general",
        operation: "delete",
        where: { id: idNum },
      },
    });

    return NextResponse.json({ status: true, message: "Registro de inducción general eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


