import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { hydratePreexistentRelations, splitIncludeByTableGroup } from "../../../../../utils/hydratePreexistentIncludes";
import { reportError } from "../../../../../utils/reportError";

const GENERAL_INDUCTION_FULL_INCLUDE = {
  c_imagenes_registro_induccion_general: true,
  e_estructura_empresa: { select: { nombre: true, codigo: true } },
  e_estructura_cliente: { select: { nombre: true } },
  e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
};

export async function GET(req: NextRequest, context: { params: Promise<{ corpo_id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const corpoIdNum = parseInt(String(resolvedParams.corpo_id), 10);
    if (Number.isNaN(corpoIdNum) || corpoIdNum <= 0) {
      await reportError(req, "api/general-induction-register/corpo/[corpo_id]", "GET", 400, "Corpo inválido");
      return NextResponse.json({ status: false, message: "Corpo inválido", data: [] }, { status: 400 });
    }

    const { sameGroupInclude, preexistentSpecs } = splitIncludeByTableGroup(GENERAL_INDUCTION_FULL_INCLUDE);

    const records = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_registro_induccion_general",
        operation: "findMany",
        where: {
          corpo_id: corpoIdNum,
          isActive: true,
        },
        orderBy: { created_at: "desc" },
        ...(sameGroupInclude ? { include: sameGroupInclude } : {}),
      },
    });
    await hydratePreexistentRelations(records, preexistentSpecs);

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
    await reportError(req, "api/general-induction-register/corpo/[corpo_id]", "GET", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 500 });
  }
}


