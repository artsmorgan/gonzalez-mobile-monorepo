import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { fetchDynamicFile } from '../../../../../../utils/callDynamicFilesApi';
import { callDynamicPrisma } from '../../../../../../utils/callDynamicPrisma';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const incidentId = parseInt(resolvedParams.id, 10);
    const fileName = resolvedParams.file;

    if (!incidentId || !fileName) {
      return NextResponse.json(
        { status: false, message: 'ID o archivo faltante' },
        { status: 400 }
      );
    }

    const incident = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_incidente", operation: "findUnique", where: { id: incidentId } }
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
        where: { incidente_id: incident.id, name: fileName }
      }
    });

    if (!fileRecord) {
      return NextResponse.json(
        { status: false, message: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    const fetched = await fetchDynamicFile({
      req,
      type: 'file',
      url: `incidents/${incident.id}/${fileName}`,
      download: true,
    });

    return new NextResponse(fetched.buffer, {
      headers: {
        'Content-Type': fetched.headers.contentType,
        ...(fetched.headers.contentDisposition ? { 'Content-Disposition': fetched.headers.contentDisposition } : {}),
        'Cache-Control': fetched.headers.cacheControl,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error in GET /api/incidents/[id]/get-file/[file]:', errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

