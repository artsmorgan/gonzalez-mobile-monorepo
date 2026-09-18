import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../../utils/callDynamicFilesApi";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../../utils/reportError";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        await reportError(req, "api/activities/equipo/[id]/get-image", "GET", 400, "ID faltante");
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    try {
        const actividad = await callDynamicPrisma({
            req,
            data: { action: "GET", table: "e_actividades_puesto_plaza", operation: "findUnique", where: { id } }
        });
        if (!actividad || !actividad.articles) {
            await reportError(req, "api/activities/equipo/[id]/get-image", "GET", 404, "Actividad de revisión no encontrada");
            return NextResponse.json({ status: false, message: 'Actividad de revisión no encontrada' }, { status: 404 });
        }

        const articuloId = Number(req.nextUrl.searchParams.get("article_id") || 0);
        if (!articuloId) {
            await reportError(req, "api/activities/equipo/[id]/get-image", "GET", 400, "article_id faltante");
            return NextResponse.json({ status: false, message: 'article_id faltante' }, { status: 400 });
        }
        let articles: any[] = [];
        try {
            articles = JSON.parse(actividad.articles);
        } catch {
            articles = [];
        }
        const articulo = Array.isArray(articles) ? articles.find((a: any) => Number(a?.id) === articuloId) : null;
        if (!articulo || !articulo.file_name) {
            await reportError(req, "api/activities/equipo/[id]/get-image", "GET", 404, "Imagen no encontrada para el artículo");
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        await reportError(req, "api/activities/equipo/[id]/get-image", "GET", 400, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
    }
}
