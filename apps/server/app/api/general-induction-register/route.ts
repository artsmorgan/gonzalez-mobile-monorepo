import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

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

export async function POST(req: NextRequest) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const {
      empresa_id,
      cliente_id,
      corpo_id,
      division,
      fecha,
      temas_a_tratar,
      colaboradores,
      capacitadores,
      firma_responsable,
    } = await req.json();

    const required: Array<[string, any]> = [
      ["empresa_id", empresa_id],
      ["cliente_id", cliente_id],
      ["corpo_id", corpo_id],
      ["division", division],
      ["temas_a_tratar", temas_a_tratar],
      ["colaboradores", colaboradores],
      ["capacitadores", capacitadores],
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const empresaIdNum = parseInt(String(empresa_id), 10);
    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    if ([empresaIdNum, clienteIdNum, corpoIdNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");

    const record = await prisma.c_registro_induccion_general.create({
      data: {
        empresa_id: empresaIdNum,
        cliente_id: clienteIdNum,
        corpo_id: corpoIdNum,
        division: String(division).trim(),
        ...(fechaParsed ? { fecha: fechaParsed } : {}),
        temas_a_tratar: ensureStringJson(temas_a_tratar, "[]"),
        colaboradores: ensureStringJson(colaboradores, "[]"),
        capacitadores: ensureStringJson(capacitadores, "[]"),
        firma_responsable: String(firma_responsable),
        created_at: createdAt,
        created_by: payload.id?.toString?.() || "",
      },
      include: {
        e_estructura_empresa: { select: { nombre: true, codigo: true } },
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Registro de inducción general creado correctamente",
        data: {
          ...record,
          id_local: "",
          empresa_nombre: record.e_estructura_empresa ? `${record.e_estructura_empresa.codigo} - ${record.e_estructura_empresa.nombre}` : null,
          cliente_nombre: record.e_estructura_cliente?.nombre || null,
          corpo_nombre: record.e_estructura_sucursal ? `${record.e_estructura_sucursal.nro_sucursal} - ${record.e_estructura_sucursal.nombre}` : null,
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


