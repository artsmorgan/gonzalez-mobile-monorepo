import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { deleteUploadsFileByRelativePath } from "../../../utils/deleteUploadsFileByRelativePath";

type AttendanceControlImageInput = {
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

function normalizeRecord(record: any, baseUrl: string, sucursalNombreMap?: Record<number, string>) {
  const corpoId = Number(record?.corpo_id || 0);
  const { c_imagenes_control_asistencia: _imgs, ...rest } = record || {};
  return {
    ...rest,
    id_local: "",
    puesto_id: record?.puesto_id != null ? Number(record.puesto_id) : 0,
    isActive: record?.isActive !== false,
    cliente: record?.nombre_cliente || null,
    sucursal_nombre: (corpoId && sucursalNombreMap ? sucursalNombreMap[corpoId] : null) || null,
    total_presentes: record?.total_presentes !== null && record?.total_presentes !== undefined ? String(record.total_presentes) : null,
    images: (record?.c_imagenes_control_asistencia || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      original_name: f.original_name,
      url: baseUrl ? `${baseUrl}/api/attendance-control/${record.id}/get-image/${f.name}` : "",
    })),
  };
}

function parseDateInput(value: any): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map((x) => parseInt(x, 10));
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTurnoLetter(turno: string): string {
  return String(turno || "").trim().charAt(0).toUpperCase();
}

async function buildColaboradoresFromMarcas(req: NextRequest, params: { fecha: Date; corpo_id: number; turno: string }) {
  const turnoLetter = getTurnoLetter(params.turno);
  if (!["D", "M", "N"].includes(turnoLetter)) {
    throw new Error("Turno inválido");
  }

  const start = new Date(params.fecha.getFullYear(), params.fecha.getMonth(), params.fecha.getDate(), 0, 0, 0, 0);
  const end = new Date(params.fecha.getFullYear(), params.fecha.getMonth(), params.fecha.getDate(), 23, 59, 59, 999);

  const marcas = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "c_marca_dia",
      operation: "findMany",
      where: {
        corpo_id: params.corpo_id,
        tipo_turno: turnoLetter,
        fecha: {
          gte: start.toISOString(),
          lte: end.toISOString(),
        },
      },
      include: {
        c_empleado_c_marca_dia_empleadoFijo_idToc_empleado: {
          select: {
            id: true,
            nombre: true,
            primer_apellido: true,
            segundo_apellido: true,
            cedula: true,
          },
        },
        e_estructura_cliente: { select: { id: true, nombre: true } },
        e_estructura_sucursal: { select: { id: true, nombre: true } },
        e_estructura_puesto: { select: { id: true, nombre: true } },
      },
      orderBy: [{ hora_inicio: "asc" }, { id: "asc" }],
    },
  });

  const colaboradores = (Array.isArray(marcas) ? marcas : []).map((m: any) => {
    const emp = m.c_empleado_c_marca_dia_empleadoFijo_idToc_empleado;
    const nombre = [emp?.nombre, emp?.primer_apellido, emp?.segundo_apellido].filter(Boolean).join(" ").trim();
    const ausente = !m.hora_entrada_digitada;
    return {
      empleado_id: emp?.id || m.empleadoFijo_id || null,
      marca_id: m.id,
      ausente,
      nombre: nombre || "",
      cedula: emp?.cedula || "",
      cliente: m.e_estructura_cliente?.nombre || "",
      sucursal: m.e_estructura_sucursal?.nombre || "",
      puesto: m.e_estructura_puesto?.nombre || "",
      hora_inicio: m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null,
      hora_fin: m.hora_fin ? new Date(m.hora_fin).toISOString() : null,
      tipo_turno: m.tipo_turno || null,
    };
  });

  const totalPresentes = colaboradores.filter((c: any) => !c.ausente).length;
  return { colaboradores, totalPresentes };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseInt(String(id), 10);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_control_asistencia", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const body = await req.json();
    const imagenesRaw = body?.imagenes;
    const deleteImagenesRaw = body?.delete_imagenes;
    const empresa_id = parseInt(String(body?.empresa_id || existing.empresa_id || 0), 10);
    const cliente_id = parseInt(String(body?.cliente_id || existing.cliente_id || 0), 10);
    const division_id = parseInt(String(body?.division_id || existing.division_id || 0), 10);
    const contrato_id = parseInt(String(body?.contrato_id || existing.contrato_id || 0), 10);
    const corpo_id = parseInt(String(body?.corpo_id || existing.corpo_id || 0), 10);
    const puesto_id = body?.puesto_id !== undefined && body?.puesto_id !== null && String(body?.puesto_id).trim() !== ''
      ? parseInt(String(body.puesto_id), 10)
      : Number((existing as any).puesto_id ?? 0);
    const fechaDate = parseDateInput(body?.fecha || existing.fecha);
    const turno = String(body?.turno || existing.turno || "").trim();
    const firma_responsable = String(body?.firma_responsable || existing.firma_responsable || "").trim();

    if (!empresa_id || !cliente_id || !division_id || !contrato_id || !corpo_id || !fechaDate || !turno || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Faltan campos obligatorios para actualizar el control de asistencia" }, { status: 400 });
    }
    if (!Number.isFinite(puesto_id) || puesto_id <= 0) {
      return NextResponse.json({ status: false, message: "puesto_id es obligatorio" }, { status: 400 });
    }

    const { colaboradores, totalPresentes } = await buildColaboradoresFromMarcas(req, { fecha: fechaDate, corpo_id, turno });

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_control_asistencia",
        operation: "update",
        where: { id: idNum },
        data: {
          empresa_id,
          cliente_id,
          division_id,
          contrato_id,
          corpo_id,
          fecha: fechaDate.toISOString(),
          turno,
          total_presentes: totalPresentes,
          colaboradores: JSON.stringify(colaboradores),
          firma_responsable,
          puesto_id,
        },
      },
    });

    const deleteIds: number[] = deleteImagenesRaw ? safeParseJson<number[]>(deleteImagenesRaw, []) : [];
    if (deleteIds.length > 0) {
      const imagesToDelete = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_imagenes_control_asistencia",
          operation: "findMany",
          where: { control_id: idNum, id: { in: deleteIds } },
        },
      });
      const imagesArray = Array.isArray(imagesToDelete) ? imagesToDelete : [];
      for (const img of imagesArray) {
        const imgObj = img as any;
        const fn = String(imgObj?.name || "").trim();
        if (fn) {
          const rel = `attendance-control/${idNum}/${fn}`;
          deleteUploadsFileByRelativePath(rel);
        }
      }
      await callDynamicPrisma({
        req,
        data: {
          action: "DELETE",
          table: "c_imagenes_control_asistencia",
          operation: "deleteMany",
          where: { control_id: idNum, id: { in: deleteIds } },
        },
      });
    }

    let imagesParsed: AttendanceControlImageInput[] = [];
    if (imagenesRaw) imagesParsed = safeParseJson<AttendanceControlImageInput[]>(imagenesRaw, []);
    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `attendance-control/${idNum}`,
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
            table: "c_imagenes_control_asistencia",
            operation: "create",
            data: {
              name: uploaded.name,
              original_name: uploaded.original_name || uploaded.name,
              control_id: idNum,
            },
          },
        });
      }
    }

    const created_by = Number(payload?.id || 0);
    const created_at = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_control_asistencia",
          registro_id: idNum,
          cambios: JSON.stringify([
            { prop: "fecha", before: existing.fecha, after: fechaDate.toISOString() },
            { prop: "turno", before: existing.turno, after: turno },
            { prop: "colaboradores", before: existing.colaboradores, after: JSON.stringify(colaboradores) },
            { prop: "total_presentes", before: existing.total_presentes, after: totalPresentes },
          ]),
          created_at,
          created_by,
        },
      },
    });

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findUnique",
        where: { id: idNum },
        include: { c_imagenes_control_asistencia: true },
      },
    });

    let sucursalNombreMap: Record<number, string> = {};
    const fullCorpoId = Number((fullRecord as any)?.corpo_id || corpo_id || 0);
    if (fullCorpoId > 0) {
      const sucursal = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findUnique",
          where: { id: fullCorpoId },
          select: { id: true, nombre: true },
        },
      });
      if (sucursal && (sucursal as any).id) {
        sucursalNombreMap[Number((sucursal as any).id)] = String((sucursal as any).nombre || "");
      }
    }

    return NextResponse.json(
      {
        status: true,
        message: "Control de asistencia actualizado correctamente",
        data: normalizeRecord(fullRecord || updated || existing, req.nextUrl.origin, sucursalNombreMap),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseInt(String(id), 10);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_control_asistencia", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const created_by = Number(payload?.id || 0);
    const created_at = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_control_asistencia",
          registro_id: idNum,
          cambios: JSON.stringify([{ prop: "__deleted__", before: { id: idNum }, after: null }]),
          created_at,
          created_by,
        },
      },
    });

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_control_asistencia", operation: "delete", where: { id: idNum } },
    });

    return NextResponse.json({ status: true, message: "Control de asistencia eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
