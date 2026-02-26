import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const corpoIdNum = parseInt(String(resolvedParams.corpo_id), 10);
    if (Number.isNaN(corpoIdNum) || corpoIdNum <= 0) {
      return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
    }

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findMany",
        where: {
          corpo_id: corpoIdNum,
        },
        orderBy: { created_at: "desc" },
        include: {
          c_imagenes_registro_induccion_general: true,
          e_estructura_empresa: { select: { nombre: true, codigo: true } },
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
        },
      },
    });

    const recordsArray = Array.isArray(records) ? records : [];
    const recordsWithNames = recordsArray.map((r: any) => ({
      ...r,
      id_local: "",
      empresa_nombre: r.e_estructura_empresa ? `${r.e_estructura_empresa.codigo} - ${r.e_estructura_empresa.nombre}` : null,
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ${r.e_estructura_sucursal.nombre}` : null,
      images: (r?.c_imagenes_registro_induccion_general || []).map((img: any) => ({
        id: img.id,
        name: img.name,
        url: req.nextUrl.origin ? `${req.nextUrl.origin}/api/general-induction-register/${r.id}/get-image/${img.name}` : "",
      })),
    }));

    return NextResponse.json(
      { status: true, message: "Registros de inducción general obtenidos correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}


