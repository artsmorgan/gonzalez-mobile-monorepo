import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message, data: [] }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const corpoIdNum = parseInt(String(resolvedParams.corpo_id), 10);
    if (Number.isNaN(corpoIdNum) || corpoIdNum <= 0) {
      return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
    }

    const currentEmployeeId = parseInt(String((payload as any)?.id ?? 0), 10) || 0;
    const empleado = currentEmployeeId
      ? await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } })
      : null;
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;

    const records = await prisma.e_mutuos_acuerdos.findMany({
      where: { corpo_id: corpoIdNum },
      orderBy: { created_at: "desc" },
      include: {
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        n_ejecutivo_cuenta: { select: { id: true, nombre: true } },
      },
    });

    const mapped = records.map((r: any) => ({
      ...r,
      id_local: "",
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal
        ? `${r.e_estructura_sucursal.nro_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ` : ""}${r.e_estructura_sucursal.nombre}`
        : null,
      ejecutivo_nombre: r.n_ejecutivo_cuenta?.nombre || null,
      owned: myEjecutivoCuentaId !== null && myEjecutivoCuentaId === r.ejecutivo_cuenta,
    }));

    return NextResponse.json(
      { status: true, message: "Mutuos acuerdos obtenidos correctamente", data: mapped },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}


