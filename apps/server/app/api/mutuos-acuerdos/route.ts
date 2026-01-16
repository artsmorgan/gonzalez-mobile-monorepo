import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

function ensureStringJson(value: any, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

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

export async function POST(req: NextRequest) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      ejecutivo_cuenta,
      fecha,
      turno,
      informacion_oficial_interesado,
      informacion_oficial_colaborador,
      motivo,
      firma_responsable,
      // opcional: se permite pero el formulario de creación lo omite
      firma_ejecutivo_cuenta,
    } = body ?? {};

    const required: Array<[string, any]> = [
      ["cliente_id", cliente_id],
      ["corpo_id", corpo_id],
      ["ejecutivo_cuenta", ejecutivo_cuenta],
      ["fecha", fecha],
      ["turno", turno],
      ["informacion_oficial_interesado", informacion_oficial_interesado],
      ["informacion_oficial_colaborador", informacion_oficial_colaborador],
      ["motivo", motivo],
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    const ejecutivoCuentaNum = parseInt(String(ejecutivo_cuenta), 10);
    if ([clienteIdNum, corpoIdNum, ejecutivoCuentaNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (!fechaParsed) return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = parseInt(String((payload as any)?.id ?? 0), 10) || 0;

    const record = await prisma.e_mutuos_acuerdos.create({
      data: {
        cliente_id: clienteIdNum,
        corpo_id: corpoIdNum,
        ejecutivo_cuenta: ejecutivoCuentaNum,
        fecha: fechaParsed,
        turno: String(turno).trim(),
        informacion_oficial_interesado: ensureStringJson(informacion_oficial_interesado, "[]"),
        informacion_oficial_colaborador: ensureStringJson(informacion_oficial_colaborador, "[]"),
        motivo: String(motivo),
        // En creación se permite vacío: se llenará luego con firma dibujada si owned=true
        firma_ejecutivo_cuenta: typeof firma_ejecutivo_cuenta === "string" ? firma_ejecutivo_cuenta : "",
        firma_responsable: String(firma_responsable),
        created_at: createdAt,
        created_by: createdBy,
      },
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
      },
    });

    // owned: misma lógica que incidencias (supervisor_id === ejecutivo_cuenta)
    const empleado = createdBy ? await prisma.c_empleado.findUnique({ where: { id: createdBy } }) : null;
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;

    return NextResponse.json(
      {
        status: true,
        message: "Mutuo acuerdo creado correctamente",
        data: {
          ...record,
          id_local: "",
          cliente_nombre: (record as any).e_estructura_cliente?.nombre || null,
          corpo_nombre: (record as any).e_estructura_sucursal
            ? `${(record as any).e_estructura_sucursal.nro_sucursal ? `${(record as any).e_estructura_sucursal.nro_sucursal} - ` : ""}${(record as any).e_estructura_sucursal.nombre}`
            : null,
          ejecutivo_nombre: (record as any).n_ejecutivo_cuenta?.nombre || null,
          owned: myEjecutivoCuentaId !== null && myEjecutivoCuentaId === (record as any).ejecutivo_cuenta,
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


