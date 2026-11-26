import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { reportError } from "../../../../../utils/reportError";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const puestoIdParam = resolvedParams.id;
    const puestoId = parseInt(puestoIdParam, 10);

    if (!puestoId || Number.isNaN(puestoId)) {
      await reportError(req, "api/entrega-puestos/puesto/[id]", "GET", 400, "Puesto inválido");
      return NextResponse.json(
        { status: false, message: "Puesto inválido" },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const empleadoIdParam = searchParams.get("empleado_id");

    const where: any = {
      puesto_id: puestoId,
    };

    if (empleadoIdParam) {
      const empleadoId = parseInt(empleadoIdParam, 10);
      if (!Number.isNaN(empleadoId)) {
        where.created_by = empleadoId;
      }
    }

    const registros = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_registro_entrega_puesto",
        operation: "findMany",
        where,
        orderBy: {
          created_at: "desc",
        },
      },
    });

    const registrosArray = Array.isArray(registros)
      ? registros
      : registros
      ? [registros]
      : [];

    const registros_return = registrosArray.map((reg: any) => {
      let articulosParsed: any[] = [];
      try {
        if (reg.articulos_puesto) {
          const parsed =
            typeof reg.articulos_puesto === "string"
              ? JSON.parse(reg.articulos_puesto)
              : reg.articulos_puesto;
          if (Array.isArray(parsed)) {
            articulosParsed = parsed;
          }
        }
      } catch {
        articulosParsed = [];
      }

      return {
        id: reg.id,
        oficial_entrega: reg.oficial_entrega,
        fecha_entrada_entrega: reg.fecha_entrada_entrega,
        fecha_salida_entrega: reg.fecha_salida_entrega,
        hora_entrada_entrega: reg.hora_entrada_entrega,
        hora_salida_entrega: reg.hora_salida_entrega,
        turno_entrega: reg.turno_entrega,
        marca_entrega_id: reg.marca_entrega_id ?? null,
        oficial_recibe: reg.oficial_recibe,
        fecha_entrada_recibe: reg.fecha_entrada_recibe,
        fecha_salida_recibe: reg.fecha_salida_recibe,
        hora_entrada_recibe: reg.hora_entrada_recibe,
        hora_salida_recibe: reg.hora_salida_recibe,
        turno_recibe: reg.turno_recibe,
        marca_recibe_id: reg.marca_recibe_id ?? null,
        articulos_puesto: articulosParsed,
        observaciones: reg.observaciones,
        firma_recibe: reg.firma_recibe,
        firma_entrega: reg.firma_entrega,
        firma_responsable: reg.firma_responsable,
        image_delivery: reg.image_delivery ?? null,
        image_receives: reg.image_receives ?? null,
        created_at: reg.created_at,
        created_by: reg.created_by,
      };
    });

    return NextResponse.json(
      {
        status: true,
        registros: registros_return,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error(
      "Error in GET /api/entrega-puestos/puesto/[id]:",
      errorMessage
    );
    await reportError(req, "api/entrega-puestos/puesto/[id]", "GET", 500, errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

