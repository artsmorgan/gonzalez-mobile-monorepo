import { NextRequest, NextResponse } from 'next/server';
import { fetchDynamicFile } from "../../../../../utils/callDynamicFilesApi";

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        await reportError(req, "api/training/[id]/get-image", "GET", 400, 'ID faltante');
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    try {
        const capacitacion = await callDynamicPrisma({
            req,
            data: {
                action: "GET",
                table: "e_registro_capacitaciones",
                operation: "findUnique",
                where: { id },
            },
        });
        if (!capacitacion) {
            await reportError(req, "api/training/[id]/get-image", "GET", 404, 'Capacitación no encontrada');
            return NextResponse.json({ status: false, message: 'Capacitación no encontrada' }, { status: 404 });
        }

        const capacitacionObj = capacitacion as any;
        if (!capacitacionObj.file || capacitacionObj.file === '-') {
            await reportError(req, "api/training/[id]/get-image", "GET", 404, 'Capacitación no encontrada');
            return NextResponse.json({ status: false, message: 'Capacitación no encontrada' }, { status: 404 });
        }

        const nameParam = req.nextUrl.searchParams.get('name')?.trim();
        let fileName = String(capacitacionObj.file).trim();
        if (fileName.startsWith('{')) {
            try {
                const o = JSON.parse(fileName) as { items?: { name: string }[] };
                const items = Array.isArray(o?.items) ? o.items : [];
                if (nameParam) {
                    const found = items.find((x) => x && x.name === nameParam);
                    fileName = found?.name || '';
                } else {
                    fileName = items[0]?.name || '';
                }
            } catch {
                fileName = '';
            }
        }
        if (!fileName) {
            await reportError(req, "api/training/[id]/get-image", "GET", 404, 'Archivo no encontrado');
            return NextResponse.json({ status: false, message: 'Archivo no encontrado' }, { status: 404 });
        }

        const { inferUploadType } = await import('../../trainingFileField');
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
        const dynType = isImage ? 'image' : inferUploadType(
            ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'
        );

        const fetched = await fetchDynamicFile({
            req,
            type: dynType === 'image' ? 'image' : 'file',
            url: `training/${capacitacionObj.id}/${fileName}`,
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
        await reportError(req, "api/training/[id]/get-image", "GET", 500, errorMessage);
        return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
    }
}
