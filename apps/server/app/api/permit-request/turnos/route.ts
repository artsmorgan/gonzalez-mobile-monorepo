import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";
import { getPermitTurnosFromPlanillasRange } from "../../../../utils/getPermitTurnosFromPlanillasRange";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const empleadoId = Number((payload as any)?.id || 0);
    if (!empleadoId) return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });

    const planillasToken =
      decodeURIComponent(req.headers.get("Planillas-Token") ?? "").trim() || null;
    if (!planillasToken) {
      return NextResponse.json(
        { status: false, message: "Token de Planillas no encontrado", data: [] },
        { status: 200 }
      );
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      return NextResponse.json({ status: false, message: "Empleado no encontrado", data: [] }, { status: 200 });
    }

    const fechaInicio = `${req.nextUrl.searchParams.get("fecha_inicio")}T00:00:00.000Z`;
    const fechaFin = `${req.nextUrl.searchParams.get("fecha_fin")}T00:00:00.000Z`;

    if (!fechaInicio || !fechaFin) {
      return NextResponse.json({ status: false, message: "Debes enviar fecha_inicio y fecha_fin válidas", data: [] }, { status: 400 });
    }
    if (new Date(fechaInicio).getTime() > new Date(fechaFin).getTime()) {
      return NextResponse.json({ status: false, message: "fecha_inicio no puede ser mayor a fecha_fin", data: [] }, { status: 400 });
    }

    const plazaIdParam = req.nextUrl.searchParams.get("plaza_id");
    const plazaId = plazaIdParam ? Number(plazaIdParam) : null;

    const data = await getPermitTurnosFromPlanillasRange({
      planillasToken,
      empleadoCedula: String(empleado.cedula || ""),
      fechaInicio: new Date(fechaInicio),
      fechaFin: new Date(fechaFin),
      plazaId: plazaId != null && !Number.isNaN(plazaId) ? plazaId : null,
    });

    return NextResponse.json(
      { status: true, message: data.length ? "Turnos encontrados" : "El usuario está libre en ese rango", data },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
