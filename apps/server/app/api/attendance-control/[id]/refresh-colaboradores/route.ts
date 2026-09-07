import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../../utils/reportError";

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
    const inicio = m.hora_inicio ? new Date(m.hora_inicio).toISOString() : null;
    const fin = m.hora_fin ? new Date(m.hora_fin).toISOString() : null;
    return {
      empleado_id: emp?.id || m.empleadoReemplaza_id || m.empleadoFijo_id || null,
      empleado_original_id: empFijo?.id || m.empleadoFijo_id || null,
      empleado_reemplaza_id: empReemplazo?.id || m.empleadoReemplaza_id || null,
      nombre_original: [empFijo?.nombre, empFijo?.primer_apellido, empFijo?.segundo_apellido].filter(Boolean).join(" ").trim(),
      nombre_reemplazo: [empReemplazo?.nombre, empReemplazo?.primer_apellido, empReemplazo?.segundo_apellido].filter(Boolean).join(" ").trim(),
      cedula_reemplazo: empReemplazo?.cedula || "",
      is_reemplazo: Boolean(empReemplazo?.id || m.empleadoReemplaza_id),
      marca_id: m.id,
      ausente,
      nombre: nombre || "",
      cedula: emp?.cedula || "",
      cliente: m.e_estructura_cliente?.nombre || "",
      sucursal: m.e_estructura_sucursal?.nombre || "",
      puesto: m.e_estructura_puesto?.nombre || "",
      hora_inicio: inicio,
      hora_fin: fin,
      tipo_turno: m.tipo_turno || null,
    };
  });

  const totalPresentes = colaboradores.filter((c: any) => !c.ausente).length;
  const totalEmpleadosTurno = colaboradores.length;
  return { colaboradores, totalPresentes, totalEmpleadosTurno };
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseInt(String(id), 10);
    if (!idNum) {
      await reportError(req, "api/attendance-control/[id]/refresh-colaboradores", "POST", 400, "ID inválido");
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_control_asistencia", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) {
      await reportError(req, "api/attendance-control/[id]/refresh-colaboradores", "POST", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const fecha = new Date(existing.fecha);
    const corpo_id = Number(existing.corpo_id || 0);
    const turno = String(existing.turno || "");
    if (!corpo_id || Number.isNaN(fecha.getTime()) || !turno) {
      await reportError(req, "api/attendance-control/[id]/refresh-colaboradores", "POST", 400, "El registro no tiene datos válidos para refrescar colaboradores");
      return NextResponse.json({ status: false, message: "El registro no tiene datos válidos para refrescar colaboradores" }, { status: 400 });
    }

    const { colaboradores, totalPresentes, totalEmpleadosTurno } = await buildColaboradoresFromMarcas(req, { fecha, corpo_id, turno });
    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_control_asistencia",
        operation: "update",
        where: { id: idNum },
        data: {
          colaboradores: JSON.stringify(colaboradores),
          total_presentes: totalPresentes,
          total_empleados_turno: totalEmpleadosTurno,
        },
      },
    });

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
            { prop: "colaboradores", before: existing.colaboradores, after: JSON.stringify(colaboradores) },
            { prop: "total_presentes", before: existing.total_presentes, after: totalPresentes },
            { prop: "total_empleados_turno", before: (existing as any).total_empleados_turno, after: totalEmpleadosTurno },
          ]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: Number(payload?.id || 0),
        },
      },
    });

    return NextResponse.json({ status: true, message: "Colaboradores actualizados correctamente", data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/attendance-control/[id]/refresh-colaboradores", "POST", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
