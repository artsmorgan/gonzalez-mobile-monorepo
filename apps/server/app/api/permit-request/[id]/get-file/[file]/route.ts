import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenByApi } from '../../../../../../utils/verifyAccessTokenByApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { prisma } from '../../../../../../utils/prismaClient';
import { reportError } from '../../../../../../utils/reportError';

export const runtime = 'nodejs';

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

function getAccessTokenFromRequest(req: NextRequest): string {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const t = authHeader.slice(7).trim();
    if (t) return t;
  }
  const fromQuery = req.nextUrl.searchParams.get('token') || '';
  return fromQuery.trim();
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const idNum = parseIntStrict(resolvedParams.id);
    const fileNameParam = resolvedParams.file;

    if (!idNum || !fileNameParam) {
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 400, 'ID o archivo faltante');
      return NextResponse.json(
        { status: false, message: 'ID o archivo faltante' },
        { status: 400 }
      );
    }

    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 400, 'Empleado inválido');
      return NextResponse.json({ status: false, message: 'Empleado inválido' }, { status: 400 });
    }

    const accessToken = getAccessTokenFromRequest(req);
    const record = await callDynamicPrisma({
      req,
      data: {
        action: 'GET',
        table: 'c_solicitud_permiso',
        operation: 'findUnique',
        where: { id: idNum },
      },
      token: accessToken || undefined,
    });
    if (!record) {
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 404, 'Solicitud no encontrada');
      return NextResponse.json(
        { status: false, message: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }
    if ((record as any).isActive === false) {
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 404, 'Solicitud no disponible');
      return NextResponse.json({ status: false, message: 'Solicitud no disponible' }, { status: 404 });
    }
    const decodedFileName = decodeURIComponent(String(fileNameParam).trim());
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
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 404, 'Archivo no encontrado');
      return NextResponse.json(
        { status: false, message: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    // con prisma directamente
    const empleado = await prisma.c_empleado.findUnique({
      where: { id: currentEmployeeId },
    });
    const myEjecutivoCuentaId = parseIntStrict(empleado?.supervisor_id);
    const isExecutive =
      Number(record.ejecutivo_cuenta) === currentEmployeeId ||
      (myEjecutivoCuentaId != null && Number(record.ejecutivo_cuenta) === Number(myEjecutivoCuentaId));
    if (!isExecutive) {
      await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 400, 'Solo el ejecutivo asignado puede descargar este archivo');
      return NextResponse.json(
        { status: false, message: 'Solo el ejecutivo asignado puede descargar este archivo' },
        { status: 400 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: 'file',
      url: `permit-request/${idNum}/${decodedFileName}`,
      download: true,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        'Content-Type': fetched.headers.contentType,
        ...(fetched.headers.contentDisposition
          ? { 'Content-Disposition': fetched.headers.contentDisposition }
          : {}),
        'Cache-Control': fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/permit-request/[id]/get-file/[file]:', errorMessage);
    await reportError(req, 'api/permit-request/[id]/get-file/[file]', 'GET', 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
