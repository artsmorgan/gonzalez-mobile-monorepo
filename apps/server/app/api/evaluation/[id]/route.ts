import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired: expired, message: message },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id) {
      return NextResponse.json(
        { status: false, message: "Evaluación no especificada" },
        { status: 400 }
      );
    }

    const evaluation = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_evaluacion_empleado", operation: "findUnique", where: { id } }
    });

    if (!evaluation) {
      return NextResponse.json(
        { status: false, message: "Evaluación no encontrada" },
        { status: 404 }
      );
    }

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "c_evaluacion_empleado", where: { id } }
    });

    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "evaluations",
      `${id}`
    );

    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    return NextResponse.json(
      { status: true, message: "Evaluación eliminada con éxito" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/evaluation/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired: expired, message: message },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id) {
      return NextResponse.json(
        { status: false, message: "Evaluación no especificada" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { field, value } = body as { field?: string; value?: string };

    if (!field || (field !== "firma_empleado" && field !== "firma_empleado_manual")) {
      return NextResponse.json(
        { status: false, message: "Campo inválido. Debe ser firma_empleado o firma_empleado_manual." },
        { status: 400 }
      );
    }

    const evaluation = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_evaluacion_empleado", operation: "findUnique", where: { id } }
    });

    if (!evaluation) {
      return NextResponse.json(
        { status: false, message: "Evaluación no encontrada" },
        { status: 404 }
      );
    }

    const trimmed = typeof value === "string" ? value.trim() : "";
    const valueToStore = trimmed.length > 0 ? trimmed : null;

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_evaluacion_empleado",
        operation: "update",
        where: { id },
        data: { [field]: valueToStore }
      }
    });

    return NextResponse.json(
      { status: true, message: "Firma actualizada correctamente" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PATCH /api/evaluation/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
