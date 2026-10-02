import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../../utils/prismaClient";
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../../../utils/reportError";

export const runtime = "nodejs";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

function getAccessTokenFromRequest(req: NextRequest): string {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const fromQuery = req.nextUrl.searchParams.get("token") || "";
  return fromQuery.trim();
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const idNum = parseIntStrict(resolvedParams.id);
    const imageNameParam = resolvedParams.image;
    if (!idNum || !imageNameParam) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 400, "ID o imagen faltante");
      return NextResponse.json({ status: false, message: "ID o imagen faltante" }, { status: 400 });
    }

    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 400, "Empleado inválido");
      return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });
    }

    const accessToken = getAccessTokenFromRequest(req);
    const record = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_solicitud_permiso", operation: "findUnique", where: { id: idNum } },
      token: accessToken || undefined,
    });
    if (!record) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 404, "Solicitud no encontrada");
      return NextResponse.json({ status: false, message: "Solicitud no encontrada" }, { status: 404 });
    }
    if ((record as any).isActive === false) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 404, "Solicitud no disponible");
      return NextResponse.json({ status: false, message: "Solicitud no disponible" }, { status: 404 });
    }

    const decodedFileName = decodeURIComponent(String(imageNameParam).trim());
    const fileRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_archivos_solicitud_permiso",
        operation: "findFirst",
        where: { solicitud_id: idNum, name: decodedFileName },
      },
      token: accessToken || undefined,
    });
    if (!fileRecord) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 404, "Imagen no encontrada");
      return NextResponse.json({ status: false, message: "Imagen no encontrada" }, { status: 404 });
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = parseIntStrict(empleado?.supervisor_id);
    const isExecutive =
      Number(record.ejecutivo_cuenta) === currentEmployeeId ||
      (myEjecutivoCuentaId != null && Number(record.ejecutivo_cuenta) === Number(myEjecutivoCuentaId));
    if (!isExecutive) {
      await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 400, "Solo el ejecutivo asignado puede ver este archivo");
      return NextResponse.json({ status: false, message: "Solo el ejecutivo asignado puede ver este archivo" }, { status: 400 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: "image",
      url: `permit-request/${idNum}/${decodedFileName}`,
      download: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        "Content-Type": fetched.headers.contentType,
        "Cache-Control": fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/permit-request/[id]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

