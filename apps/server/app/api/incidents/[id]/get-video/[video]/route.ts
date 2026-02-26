import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    const video = resolvedParams.video;

    if (!id || !video) {
      return NextResponse.json(
        { status: false, message: 'ID o video faltante' },
        { status: 400 }
      );
    }

    const incident = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id } }
    });
    if (!incident) {
      return NextResponse.json(
        { status: false, message: 'Incidente no encontrado' },
        { status: 404 }
      );
    }

    const fileRecord = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_archivos_incidente",
        operation: "findFirst",
        where: { incidente_id: incident.id, name: video }
      }
    });

    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: 'Archivo de video no encontrado' },
        { status: 404 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: 'video',
      url: `incidents/${incident.id}/${video}`,
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
    console.error('Error in GET /api/incidents/[id]/get-video/[video]:', errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

