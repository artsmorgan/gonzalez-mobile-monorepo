import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const corpoIdNum = parseInt(String(resolvedParams.corpo_id), 10);
    if (Number.isNaN(corpoIdNum) || corpoIdNum <= 0) {
      return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
    }

    const records = await prisma.c_agenda_minuta.findMany({
      where: { corpo_id: corpoIdNum },
      orderBy: { created_at: "desc" },
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        e_estructura_puesto: { select: { nombre: true, codigo: true } },
      },
    });

    const recordsWithNames = records.map((r: any) => ({
      ...r,
      id_local: "",
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ${r.e_estructura_sucursal.nombre}` : null,
      puesto_nombre: r.e_estructura_puesto
        ? `${r.e_estructura_puesto.codigo ? `${r.e_estructura_puesto.codigo} - ` : ""}${r.e_estructura_puesto.nombre}`
        : null,
    }));

    return NextResponse.json(
      { status: true, message: "Agendas minuta obtenidas correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}


