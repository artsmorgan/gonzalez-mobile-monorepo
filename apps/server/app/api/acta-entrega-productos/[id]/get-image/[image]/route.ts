import { NextRequest, NextResponse } from 'next/server';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string; image: string }> }) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);
    const image = resolvedParams.image;

    if (!id || !image) {
      return NextResponse.json({ status: false, message: 'ID o imagen faltante' }, { status: 400 });
    }

    const acta = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!acta) {
      return NextResponse.json({ status: false, message: 'Acta no encontrada' }, { status: 404 });
    }
    const actaObj = acta as any;

    const fileRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_imagenes_acta_entrega_producto",
        operation: "findFirst",
        where: { acta_id: actaObj.id, name: image },
      },
    });
    if (!fileRecord) {
      return NextResponse.json({ status: false, message: 'Archivo no encontrado' }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
      req,
      type: 'image',
      url: `acta-entrega-productos/${actaObj.id}/${image}`,
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
    console.error('Error in GET /api/acta-entrega-productos/[id]/get-image/[image]:', errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


