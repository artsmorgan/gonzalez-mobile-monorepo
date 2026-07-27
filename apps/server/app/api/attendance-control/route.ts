import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
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
    const date = new Date(`${str}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTurnoLetter(turno: string): string {
  return String(turno || "").trim().charAt(0).toUpperCase();
}

async function buildColaboradoresFromMarcas(_req: NextRequest, params: { fecha: Date; corpo_id: number; turno: string }) {
  const turnoLetter = getTurnoLetter(params.turno);
  if (!["D", "M", "N"].includes(turnoLetter)) {
    throw new Error("Turno inválido");
  }

  const start = new Date(params.fecha.getFullYear(), params.fecha.getMonth(), params.fecha.getDate(), 0, 0, 0, 0);
  const end = new Date(params.fecha.getFullYear(), params.fecha.getMonth(), params.fecha.getDate(), 23, 59, 59, 999);

  const marcas = await prisma.c_marca_dia.findMany({
    where: {
      corpo_id: params.corpo_id,
      tipo_turno: turnoLetter,
      fecha: {
        gte: start,
        lte: end,
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
      c_empleado_c_marca_dia_empleadoReemplaza_idToc_empleado: {
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
  });

  const colaboradores = marcas.map((m) => {
    const empFijo = m.c_empleado_c_marca_dia_empleadoFijo_idToc_empleado;
    const empReemplazo = m.c_empleado_c_marca_dia_empleadoReemplaza_idToc_empleado;
    const emp = empReemplazo || empFijo;
    const nombre = [emp?.nombre, emp?.primer_apellido, emp?.segundo_apellido].filter(Boolean).join(" ").trim();
    const ausente = m.hora_entrada_digitada != null ? false : true;
    const nombreOriginal = [empFijo?.nombre, empFijo?.primer_apellido, empFijo?.segundo_apellido].filter(Boolean).join(" ").trim();
    const nombreReemplazo = [empReemplazo?.nombre, empReemplazo?.primer_apellido, empReemplazo?.segundo_apellido].filter(Boolean).join(" ").trim();
    return {
      empleado_id: emp?.id || m.empleadoReemplaza_id || m.empleadoFijo_id || null,
      empleado_original_id: empFijo?.id || m.empleadoFijo_id || null,
      empleado_reemplaza_id: empReemplazo?.id || m.empleadoReemplaza_id || null,
      nombre_original: nombreOriginal || "",
      nombre_reemplazo: nombreReemplazo || "",
      cedula_reemplazo: empReemplazo?.cedula || "",
      is_reemplazo: Boolean(empReemplazo?.id || m.empleadoReemplaza_id),
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
  const totalEmpleadosTurno = colaboradores.length;
  return { colaboradores, totalPresentes, totalEmpleadosTurno };
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
    total_empleados_turno:
      record?.total_empleados_turno !== null && record?.total_empleados_turno !== undefined
        ? String(record.total_empleados_turno)
        : null,
    nombre_supervisor: record?.nombre_supervisor != null ? String(record.nombre_supervisor) : null,
    comentarios: record?.comentarios != null ? String(record.comentarios) : null,
    firma_manual_supervisor: record?.firma_manual_supervisor != null ? String(record.firma_manual_supervisor) : null,
    empleado_firmas: Array.isArray(record?.c_control_asistencia_empleado_firmas)
      ? record.c_control_asistencia_empleado_firmas.map((f: any) => ({
          id: Number(f?.id || 0),
          empleado_id: Number(f?.empleado_id || 0),
          firma: String(f?.firma || ""),
        }))
      : [],
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

    where.isActive = true;

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findMany",
        where,
        orderBy: { created_at: "desc" },
        include: { c_imagenes_control_asistencia: true, c_control_asistencia_empleado_firmas: true },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const uniqueCorpoIds = Array.from(new Set(recordsArray.map((r: any) => Number(r?.corpo_id || 0)).filter((id: number) => id > 0)));
    let sucursalNombreMap: Record<number, string> = {};
    if (uniqueCorpoIds.length > 0) {
      const sucursales = await prisma.e_estructura_sucursal.findMany({
        where: { id: { in: uniqueCorpoIds } },
        select: { id: true, nombre: true },
      });
      const sucursalesArray = Array.isArray(sucursales) ? sucursales : [];
      sucursalNombreMap = sucursalesArray.reduce((acc: Record<number, string>, item: any) => {
        const id = Number(item?.id || 0);
        if (id > 0) acc[id] = String(item?.nombre || "");
        return acc;
      }, {});
    }

    const baseUrl = req.nextUrl.origin;
    const normalized = recordsArray
      .filter((r: any) => r && r.isActive !== false)
      .map((r: any) => normalizeRecord(r, baseUrl, sucursalNombreMap));
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
    const puesto_id = parseInt(String(body?.puesto_id ?? 0), 10);
    const fechaDate = parseDateInput(body?.fecha);
    const turno = String(body?.turno || "").trim();
    const firma_responsable = String(body?.firma_responsable || "").trim();
    const nombre_supervisor = body?.nombre_supervisor != null ? String(body.nombre_supervisor).trim() : "";
    const comentarios = body?.comentarios != null ? String(body.comentarios).trim() : "";
    const firma_manual_supervisor =
      body?.firma_manual_supervisor != null ? String(body.firma_manual_supervisor).trim() : "";
    const firmasEmpleados = safeParseJson<Array<{ empleado_id?: number; marca_id?: number; firma?: string }>>(body?.firmas_empleados, []);
    const imagenes = body?.imagenes;

    if (!empresa_id || !cliente_id || !division_id || !contrato_id || !corpo_id || !fechaDate || !turno || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Faltan campos obligatorios para crear el control de asistencia" }, { status: 400 });
    }
    if (!Number.isFinite(puesto_id) || puesto_id <= 0) {
      return NextResponse.json({ status: false, message: "puesto_id es obligatorio" }, { status: 400 });
    }

    const { colaboradores, totalPresentes, totalEmpleadosTurno } = await buildColaboradoresFromMarcas(req, { fecha: fechaDate, corpo_id, turno });
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
          total_empleados_turno: totalEmpleadosTurno,
          colaboradores: JSON.stringify(colaboradores),
          firma_responsable,
          nombre_supervisor: nombre_supervisor || null,
          comentarios: comentarios || null,
          firma_manual_supervisor: firma_manual_supervisor || null,
          created_at,
          created_by,
          puesto_id,
          isActive: true,
        },
      },
    });

    const createdObj = created as any;
    const validSignatures = firmasEmpleados
      .map((s) => ({
        marca_id: Number(s?.marca_id || 0),
        empleado_id: Number(s?.empleado_id || 0),
        firma: String(s?.firma || "").trim(),
      }))
      .filter((s) => s.firma && (s.empleado_id > 0 || s.marca_id > 0));
    if (validSignatures.length > 0) {
      const colaboradoresByMarca = new Map<number, any>();
      for (const c of colaboradores) {
        const mid = Number((c as any)?.marca_id || 0);
        if (mid > 0) colaboradoresByMarca.set(mid, c);
      }
      const marcaIds = [...new Set(validSignatures.map((s) => Number(s.marca_id || 0)).filter((id) => id > 0))];
      const marcasRows = marcaIds.length
        ? await prisma.c_marca_dia.findMany({
            where: { id: { in: marcaIds } },
            select: { id: true, empleadoFijo_id: true, empleadoReemplaza_id: true },
          })
        : [];
      const marcaById = new Map<number, any>();
      for (const m of Array.isArray(marcasRows) ? marcasRows : []) {
        const mid = Number((m as any)?.id || 0);
        if (mid > 0) marcaById.set(mid, m);
      }
      for (const sig of validSignatures) {
        const marcaRow = sig.marca_id > 0 ? marcaById.get(sig.marca_id) : null;
        const resolvedByMarca = sig.marca_id > 0 ? colaboradoresByMarca.get(sig.marca_id) : null;
        const empleadoId = Number(
          marcaRow?.empleadoReemplaza_id ||
          marcaRow?.empleadoFijo_id ||
          (sig.empleado_id > 0 ? sig.empleado_id : 0) ||
          resolvedByMarca?.empleado_id ||
          0
        );
        if (!empleadoId) continue;
        await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_control_asistencia_empleado_firmas",
            operation: "create",
            data: {
              control_id: createdObj.id,
              empleado_id: empleadoId,
              firma: sig.firma,
            },
          },
        });
      }
    }
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
        include: { c_imagenes_control_asistencia: true, c_control_asistencia_empleado_firmas: true },
      },
    });

    let sucursalNombreMap: Record<number, string> = {};
    const createdCorpoId = Number((fullRecord as any)?.corpo_id || createdObj?.corpo_id || 0);
    if (createdCorpoId > 0) {
      const sucursal = await prisma.e_estructura_sucursal.findUnique({
        where: { id: createdCorpoId },
        select: { id: true, nombre: true },
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
