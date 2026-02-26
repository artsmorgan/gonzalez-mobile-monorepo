import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const actividad = await callDynamicPrisma({
        req,
        data: { action: "GET", table: "e_actividades_puesto_plaza", operation: "findUnique", where: { id } }
    });
    if (!actividad || !actividad.articles) {
        return NextResponse.json({ status: false, message: 'Actividad de revisión no encontrada' }, { status: 404 });
    }

    const articuloId = Number(req.nextUrl.searchParams.get("article_id") || 0);
    if (!articuloId) return NextResponse.json({ status: false, message: 'article_id faltante' }, { status: 400 });
    let articles: any[] = [];
    try {
        articles = JSON.parse(actividad.articles);
    } catch {
        articles = [];
    }
    const articulo = Array.isArray(articles) ? articles.find((a: any) => Number(a?.id) === articuloId) : null;
    if (!articulo || !articulo.file_name) {
        return NextResponse.json({ status: false, message: 'Imagen no encontrada para el artículo' }, { status: 404 });
    }

    const fetched = await fetchDynamicFile({
        req,
        type: 'image',
        url: `activities/equipo/${actividad.id}/${articuloId}/${articulo.file_name}`,
        download: false,
    });

    return new NextResponse(fetched.buffer, {
        headers: {
            'Content-Type': fetched.headers.contentType,
            'Cache-Control': fetched.headers.cacheControl,
        },
    });
}
