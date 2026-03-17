import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";

export const runtime = "nodejs";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
    }

    const record = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_solicitud_permiso",
        operation: "findUnique",
        where: { id: idNum },
      },
    });
    if (!record) {
      return NextResponse.json({ status: false, message: "Solicitud no encontrada" }, { status: 404 });
    }
    const mainFile = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_archivos_solicitud_permiso",
        operation: "findFirst",
        where: { solicitud_id: idNum },
        orderBy: [{ is_main: "desc" }, { id: "asc" }],
      },
    });
    if (!mainFile?.name) {
      return NextResponse.json({ status: false, message: "La solicitud no tiene archivo adjunto" }, { status: 404 });
    }

    const empleado = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado",
        operation: "findUnique",
        where: { id: currentEmployeeId },
      },
    });
    const myEjecutivoCuentaId = parseIntStrict(empleado?.supervisor_id);
    const isExecutive = myEjecutivoCuentaId && Number(record.ejecutivo_cuenta) === Number(myEjecutivoCuentaId);
    if (!isExecutive) {
      return NextResponse.json(
        { status: false, message: "Solo el ejecutivo asignado puede descargar este archivo" },
        { status: 403 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "file",
      url: `permit-request/${idNum}/${mainFile.name}`,
    });

    const headers = new Headers();
    headers.set("Content-Type", fetched.headers.contentType || "application/octet-stream");
    headers.set("Cache-Control", fetched.headers.cacheControl || "private, max-age=0");
    headers.set("Content-Disposition", `attachment; filename="${String(mainFile.original_name || mainFile.name).replace(/"/g, "")}"`);

    return new NextResponse(fetched.buffer, { status: 200, headers });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
