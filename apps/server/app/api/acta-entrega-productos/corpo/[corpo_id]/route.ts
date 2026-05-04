import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenByApi } from '../../../../../utils/verifyAccessTokenByApi';
import { callDynamicPrisma } from '../../../../../utils/callDynamicPrisma';
import { mapActaEntregaImagesForClient } from '../../mapActaEntregaImagesForClient';

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const corpoId = parseInt(resolvedParams.corpo_id, 10);
    if (!corpoId) return NextResponse.json({ status: false, message: 'corpo_id inválido' }, { status: 400 });

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_acta_entre_producto",
        operation: "findMany",
        where: { corpo_id: corpoId, isActive: true },
        orderBy: { fecha: 'desc' },
        include: { c_imagenes_acta_entrega_producto: true },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const baseUrl = req.nextUrl.origin;
    const mapped = recordsArray.map((r: any) => {
      const { c_imagenes_acta_entrega_producto: _img, ...rest } = r;
      return {
        ...rest,
        id_local: '',
        images: mapActaEntregaImagesForClient(Number(r.id), r.c_imagenes_acta_entrega_producto, baseUrl),
      };
    });

    return NextResponse.json({ status: true, message: 'Actas obtenidas correctamente', data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


