import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { status: false, message: "ID de encuesta no especificado" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { field, value } = body as { field?: string; value?: string };

    if (field !== "firma_persona_evaluada") {
      return NextResponse.json(
        { status: false, message: "Campo inválido. Debe ser firma_persona_evaluada." },
        { status: 400 }
      );
    }

    const encuesta = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_encuesta_cliente",
        operation: "findUnique",
        where: { id },
      },
    });

    if (!encuesta) {
      return NextResponse.json(
        { status: false, message: "Encuesta no encontrada" },
        { status: 404 }
      );
    }

    const trimmed = typeof value === "string" ? value.trim() : "";
    const valueToStore = trimmed.length > 0 ? trimmed : null;

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_encuesta_cliente",
        operation: "update",
        where: { id },
        data: { firma_evaluado: valueToStore },
      },
    });

    return NextResponse.json(
      { status: true, message: "Firma actualizada correctamente" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PATCH /api/encuesta-nps/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
