import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const controlId = Number(id);
    if (!Number.isFinite(controlId) || controlId <= 0) {
      return NextResponse.json({ status: false, message: "ID de control inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const marcaId = Number(body?.marca_id || 0);
    const firma = String(body?.firma || "").trim();
    if (!Number.isFinite(marcaId) || marcaId <= 0 || !firma) {
      return NextResponse.json({ status: false, message: "marca_id y firma son obligatorios" }, { status: 400 });
    }

    const control = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia",
        operation: "findUnique",
        where: { id: controlId },
        include: { c_control_asistencia_empleado_firmas: true },
      },
    });
    if (!control) {
      return NextResponse.json({ status: false, message: "Control no encontrado" }, { status: 404 });
    }

    const marca = await prisma.c_marca_dia.findUnique({
      where: { id: marcaId },
      select: {
        id: true,
        hora_entrada_digitada: true,
        empleadoFijo_id: true,
        empleadoReemplaza_id: true,
      },
    });
    if (!marca) {
      return NextResponse.json({ status: false, message: "No se encontró la marca especificada" }, { status: 404 });
    }
    if (!((marca as any).hora_entrada_digitada)) {
      return NextResponse.json({ status: false, message: "No se puede firmar un colaborador ausente" }, { status: 400 });
    }
    const empleadoId = Number((marca as any).empleadoReemplaza_id || (marca as any).empleadoFijo_id || 0);
    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
      return NextResponse.json({ status: false, message: "empleado_id inválido para la marca seleccionada" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_control_asistencia_empleado_firmas",
        operation: "findFirst",
        where: { control_id: controlId, empleado_id: empleadoId },
      },
    });

    const saved = (existing as any)?.id
      ? await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_control_asistencia_empleado_firmas",
            operation: "update",
            where: { id: (existing as any).id },
            data: { firma },
          },
        })
      : await callDynamicPrisma({
          req,
          data: {
            action: "POST",
            table: "c_control_asistencia_empleado_firmas",
            operation: "create",
            data: {
              control_id: controlId,
              empleado_id: empleadoId,
              firma,
            },
          },
        });

    return NextResponse.json(
      {
        status: true,
        message: "Firma actualizada correctamente",
        data: {
          id: (saved as any)?.id,
          control_id: controlId,
          empleado_id: empleadoId,
          marca_id: marcaId,
          firma,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
