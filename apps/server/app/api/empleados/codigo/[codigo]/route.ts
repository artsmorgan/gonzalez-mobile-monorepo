import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../../utils/prismaClient";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const { codigo } = await context.params;
    const codigoValue = String(codigo || "").trim();
    if (!codigoValue) {
      return NextResponse.json(
        { status: false, message: "Código no especificado" },
        { status: 400 }
      );
    }

    const empleado = await prisma.c_empleado.findFirst({
      where: { codigo: codigoValue },
    });

    if (!empleado) {
      return NextResponse.json(
        { status: false, message: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    const nombreCompleto = [
      empleado.nombre,
      empleado.primer_apellido,
      empleado.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return NextResponse.json(
      {
        status: true,
        data: {
          id: empleado.id,
          codigo: empleado.codigo,
          nombre: empleado.nombre,
          cedula: empleado.cedula,
          nombre_completo: nombreCompleto,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
