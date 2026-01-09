/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const body = await req.json();
    const { marca_id, lugar_abre, cantidad_copias, observaciones, firma_responsable } = body ?? {};
    if (!marca_id) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const existing = await prisma.e_llave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Ownership: solo se puede editar si pertenece al mismo cliente/corpo de la marca actual
    if (existing.cliente_id !== marcaDia.cliente_id || existing.corpo_id !== marcaDia.corpo_id) {
      return NextResponse.json({ status: false, message: "No autorizado para modificar este registro" }, { status: 200 });
    }

    await prisma.e_llave.update({
      where: { id },
      data: {
        lugar_abre: typeof lugar_abre === "string" ? lugar_abre : existing.lugar_abre,
        cantidad_copias:
          cantidad_copias === undefined || cantidad_copias === null
            ? existing.cantidad_copias
            : parseInt(String(cantidad_copias)) || 0,
        observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
        firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
        created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
        created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
      },
    });

    return NextResponse.json({ status: true, message: "Llave actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/llaves/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const existing = await prisma.e_llave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }
    if (existing.cliente_id !== marcaDia.cliente_id || existing.corpo_id !== marcaDia.corpo_id) {
      return NextResponse.json({ status: false, message: "No autorizado para eliminar este registro" }, { status: 200 });
    }

    await prisma.e_llave.delete({ where: { id } });
    return NextResponse.json({ status: true, message: "Llave eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/llaves/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


