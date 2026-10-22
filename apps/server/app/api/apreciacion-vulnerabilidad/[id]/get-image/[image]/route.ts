import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';
import { reportError } from '../../../../../../utils/reportError';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; image: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const boletaId = parseInt(resolvedParams.id, 10);
    const image = resolvedParams.image;

    if (!boletaId || !image) {
      await reportError(req, "api/apreciacion-vulnerabilidad/[id]/get-image/[image]", "GET", 400, 'ID de boleta o imagen faltante');
      return NextResponse.json(
        { status: false, message: 'ID de boleta o imagen faltante' },
        { status: 400 }
      );
    }

    const token = req.nextUrl.searchParams.get('token') || undefined;

    const boleta = await callDynamicPrisma({
      req,
      token,
      data: {
        action: 'GET',
        table: 'c_boleta_apreciacion_vulnerabilidad',
        operation: 'findUnique',
        where: { id: boletaId, isActive: true },
      },
    });
    if (!boleta) {
      await reportError(req, "api/apreciacion-vulnerabilidad/[id]/get-image/[image]", "GET", 404, 'Registro no encontrado');
      return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });
    }

    const imageRecord = await callDynamicPrisma({
      req,
      token,
      data: {
        action: 'GET',
        table: 'c_imagenes_boleta_apreciacion_vulnerabilidad',
        operation: 'findFirst',
        where: { boleta_id: boletaId, name: image },
      },
    });
    if (!imageRecord) {
      await reportError(req, "api/apreciacion-vulnerabilidad/[id]/get-image/[image]", "GET", 404, 'Imagen no encontrada');
      return NextResponse.json({ status: false, message: 'Imagen no encontrada' }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: 'image',
      url: `apreciacion-vulnerabilidad/${boletaId}/${image}`,
      download: false,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        'Content-Type': fetched.headers.contentType,
        'Cache-Control': fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/apreciacion-vulnerabilidad/[id]/get-image/[image]:', errorMessage);
    await reportError(req, "api/apreciacion-vulnerabilidad/[id]/get-image/[image]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

