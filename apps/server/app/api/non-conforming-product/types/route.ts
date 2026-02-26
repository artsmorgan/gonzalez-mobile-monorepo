import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const tipos = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_tipos_producto_no_conforme",
        operation: "findMany",
        orderBy: { nombre: "asc" },
      },
    });

    return NextResponse.json(
      {
        status: true,
        data: Array.isArray(tipos) ? tipos : [],
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in GET /api/non-conforming-product/types:", error);
    return NextResponse.json(
      { status: false, message: error?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}
