import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

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

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const fechaStr = req.nextUrl.searchParams.get("fecha");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const turnoStr = req.nextUrl.searchParams.get("turno");

    const fecha = parseDateInput(fechaStr);
    const corpo_id = corpoIdStr ? parseInt(String(corpoIdStr), 10) : 0;
    const turno = String(turnoStr || "").trim();

    if (!fecha || !corpo_id || !turno) {
      return NextResponse.json(
        { status: false, message: "Faltan parámetros: fecha, corpo_id y turno son obligatorios" },
        { status: 400 }
      );
    }

    const turnoLetter = getTurnoLetter(turno);
    if (!["D", "M", "N"].includes(turnoLetter)) {
      return NextResponse.json(
        { status: false, message: "Turno inválido. Use Diurno (D), Mixto (M) o Nocturno (N)." },
        { status: 400 }
      );
    }

    const start = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
    const end = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);

    const marcas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_marca_dia",
        operation: "findMany",
        where: {
          corpo_id,
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

    return NextResponse.json({
      status: true,
      message: "Marcas obtenidas correctamente",
      data: { colaboradores, total_presentes: totalPresentes },
    }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[attendance-control/marcas]", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
