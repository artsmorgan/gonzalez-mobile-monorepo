import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";

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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const { division, fecha, temas_a_tratar, colaboradores, capacitadores, firma_responsable } = await req.json();

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const updated = await prisma.c_registro_induccion_general.update({
      where: { id: idNum },
      data: {
        division: division !== undefined ? String(division).trim() : undefined,
        ...(fecha !== undefined ? (fechaParsed ? { fecha: fechaParsed } : {}) : {}),
        temas_a_tratar: temas_a_tratar !== undefined ? ensureStringJson(temas_a_tratar, "[]") : undefined,
        colaboradores: colaboradores !== undefined ? ensureStringJson(colaboradores, "[]") : undefined,
        capacitadores: capacitadores !== undefined ? ensureStringJson(capacitadores, "[]") : undefined,
        firma_responsable: firma_responsable !== undefined ? String(firma_responsable) : undefined,
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
        message: "Registro de inducción general actualizado correctamente",
        data: {
          ...updated,
          id_local: "",
          empresa_nombre: updated.e_estructura_empresa ? `${updated.e_estructura_empresa.codigo} - ${updated.e_estructura_empresa.nombre}` : null,
          cliente_nombre: updated.e_estructura_cliente?.nombre || null,
          corpo_nombre: updated.e_estructura_sucursal ? `${updated.e_estructura_sucursal.nro_sucursal} - ${updated.e_estructura_sucursal.nombre}` : null,
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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const idNum = parseInt(String(resolvedParams.id), 10);
    if (Number.isNaN(idNum) || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    await prisma.c_registro_induccion_general.delete({ where: { id: idNum } });

    return NextResponse.json({ status: true, message: "Registro de inducción general eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


