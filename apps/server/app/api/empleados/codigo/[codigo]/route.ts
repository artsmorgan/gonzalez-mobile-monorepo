import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

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

    const empleado = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado",
        operation: "findFirst",
        where: { codigo: codigoValue },
      },
    });

    if (!empleado) {
      return NextResponse.json(
        { status: false, message: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    const empleadoObj = empleado as any;
    const nombreCompleto = [
      empleadoObj?.nombre,
      empleadoObj?.primer_apellido,
      empleadoObj?.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return NextResponse.json(
      {
        status: true,
        data: {
          id: empleadoObj.id,
          codigo: empleadoObj.codigo,
          nombre: empleadoObj.nombre,
          cedula: empleadoObj.cedula,
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
