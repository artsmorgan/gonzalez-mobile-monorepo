import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs'; // 👈 necesario para usar fs

import { prisma } from "../../../../../utils/prismaClient";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);

    if (!id) {
        return NextResponse.json({ status: false, message: 'ID faltante' }, { status: 400 });
    }

    const capacitacion = await prisma.e_registro_capacitaciones.findUnique({ where: { id } });
    if (!capacitacion || !capacitacion.file) {
        return NextResponse.json({ status: false, message: 'Capacitación no encontrada' }, { status: 404 });
    }

    const filePath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'training',
        `${capacitacion.id}`,
        capacitacion.file
    );

    console.log('📂 Buscando archivo en:', filePath);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ status: false, message: 'Archivo no encontrado' }, { status: 404 });
    }

    const file = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.webp') contentType = 'image/webp';

    return new NextResponse(Buffer.from(file), {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        },
    });
}
