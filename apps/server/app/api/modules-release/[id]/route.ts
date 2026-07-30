import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum || idNum <= 0) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body?.is_visible !== "boolean") {
      return NextResponse.json(
        { status: false, message: "Debes enviar is_visible como booleano" },
        { status: 400 }
      );
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "n_app_module_visibility",
        operation: "findUnique",
        where: { id: idNum },
      },
    });

    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "n_app_module_visibility",
        operation: "update",
        where: { id: idNum },
        data: { is_visible: body.is_visible },
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Visibilidad actualizada correctamente",
        data: {
          id: updated?.id ?? idNum,
          module_name: updated?.module_name ?? existing?.module_name ?? null,
          real_name: updated?.real_name ?? existing?.real_name ?? null,
          is_visible: Boolean(updated?.is_visible ?? body.is_visible),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
