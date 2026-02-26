import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { uploadDynamicFiles } from "../../../utils/callDynamicFilesApi";

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

function normalizeRecord(record: any, baseUrl: string, sucursalNombreMap?: Record<number, string>) {
  const corpoId = Number(record?.corpo_id || 0);
  return {
    ...record,
    id_local: "",
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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const divisionIdStr = req.nextUrl.searchParams.get("division_id");
    const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const where: any = {};

    if (corpoIdStr) where.corpo_id = parseInt(corpoIdStr, 10);
    else if (contratoIdStr) where.contrato_id = parseInt(contratoIdStr, 10);
    else if (divisionIdStr) where.division_id = parseInt(divisionIdStr, 10);
    else if (clienteIdStr) where.cliente_id = parseInt(clienteIdStr, 10);
    else if (empresaIdStr) where.empresa_id = parseInt(empresaIdStr, 10);
    else return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        include: { c_imagenes_control_asistencia: true },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const uniqueCorpoIds = Array.from(new Set(recordsArray.map((r: any) => Number(r?.corpo_id || 0)).filter((id: number) => id > 0)));
    let sucursalNombreMap: Record<number, string> = {};
    if (uniqueCorpoIds.length > 0) {
      const sucursales = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findMany",
          where: { id: { in: uniqueCorpoIds } },
          select: { id: true, nombre: true },
        },
      });
      const sucursalesArray = Array.isArray(sucursales) ? sucursales : [];
      sucursalNombreMap = sucursalesArray.reduce((acc: Record<number, string>, item: any) => {
        const id = Number(item?.id || 0);
        if (id > 0) acc[id] = String(item?.nombre || "");
        return acc;
      }, {});
    }

    const baseUrl = req.nextUrl.origin;
    const normalized = recordsArray.map((r: any) => normalizeRecord(r, baseUrl, sucursalNombreMap));
    return NextResponse.json({ status: true, message: "Controles de asistencia obtenidos correctamente", data: normalized }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const body = await req.json();
    const empresa_id = parseInt(String(body?.empresa_id || 0), 10);
    const cliente_id = parseInt(String(body?.cliente_id || 0), 10);
    const division_id = parseInt(String(body?.division_id || 0), 10);
    const contrato_id = parseInt(String(body?.contrato_id || 0), 10);
    const corpo_id = parseInt(String(body?.corpo_id || 0), 10);
    const fechaDate = parseDateInput(body?.fecha);
    const turno = String(body?.turno || "").trim();
    const firma_responsable = String(body?.firma_responsable || "").trim();
    const imagenes = body?.imagenes;

    if (!empresa_id || !cliente_id || !division_id || !contrato_id || !corpo_id || !fechaDate || !turno || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Faltan campos obligatorios para crear el control de asistencia" }, { status: 400 });
    }

    const { colaboradores, totalPresentes } = await buildColaboradoresFromMarcas(req, { fecha: fechaDate, corpo_id, turno });
    const created_at = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    const created_by = Number(payload?.id || 0);

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_control_asistencia",
        operation: "create",
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
          created_at,
          created_by,
        },
      },
    });

    const createdObj = created as any;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_control_asistencia",
          registro_id: createdObj.id,
          cambios: JSON.stringify([{ prop: "__created__", before: null, after: { id: createdObj.id } }]),
          created_at,
          created_by,
        },
      },
    });

    const imagesParsed: AttendanceControlImageInput[] = imagenes ? safeParseJson<AttendanceControlImageInput[]>(imagenes, []) : [];
    if (imagesParsed.length > 0) {
      const uploadResp = await uploadDynamicFiles({
        req,
        folderPath: `attendance-control/${createdObj.id}`,
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
              control_id: createdObj.id,
            },
          },
        });
      }
    }

    const fullRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findUnique",
        where: { id: createdObj.id },
        include: { c_imagenes_control_asistencia: true },
      },
    });

    let sucursalNombreMap: Record<number, string> = {};
    const createdCorpoId = Number((fullRecord as any)?.corpo_id || createdObj?.corpo_id || 0);
    if (createdCorpoId > 0) {
      const sucursal = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findUnique",
          where: { id: createdCorpoId },
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
        message: "Control de asistencia creado correctamente",
        data: normalizeRecord(fullRecord || createdObj, req.nextUrl.origin, sucursalNombreMap),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
