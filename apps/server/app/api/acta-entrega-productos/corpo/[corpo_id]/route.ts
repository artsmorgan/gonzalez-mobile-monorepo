import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../utils/verifyToken';
import { prisma } from '../../../../../utils/prismaClient';

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const corpoId = parseInt(resolvedParams.corpo_id, 10);
    if (!corpoId) return NextResponse.json({ status: false, message: 'corpo_id inválido' }, { status: 400 });

    const records = await prisma.c_acta_entre_producto.findMany({
      where: { corpo_id: corpoId },
      orderBy: { fecha: 'desc' },
      include: { c_imagenes_acta_entrega_producto: true },
    });

    const mapped = records.map((r) => ({
      ...r,
      id_local: '',
      images: (r.c_imagenes_acta_entrega_producto || []).map((img) => ({ id: img.id, name: img.name })),
    }));

    return NextResponse.json({ status: true, message: 'Actas obtenidas correctamente', data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


