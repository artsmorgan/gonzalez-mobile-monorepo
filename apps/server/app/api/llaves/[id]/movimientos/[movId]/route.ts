/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { prisma } from "../../../../../../utils/prismaClient";
import { getUserMarca } from "../../../../../../utils/getUserMarca";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseTimeOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`1970-01-01T${s}`);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function getMarcaDiaOrFail(marcaId: number) {
  const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: marcaId } });
  if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
  if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

  const lastMarca = await getUserMarca(marcaDia.empleadoFijo_id);
  if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
  if (marcaDia.id !== lastMarca.id) return { ok: false as const, marcaDia: null, message: "Hay una nueva marca más reciente" };
  return { ok: true as const, marcaDia, message: "" };
}

async function validateOwnership(llaveId: number, movId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(marcaId);
  if (!marcaRes.ok) return { ok: false as const, marcaDia: null, llave: null, mov: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const llave = await prisma.e_llave.findUnique({ where: { id: llaveId } });
  if (!llave) return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "Llave no encontrada" };
  if (llave.cliente_id !== marcaDia.cliente_id || llave.corpo_id !== marcaDia.corpo_id) {
    return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "No autorizado" };
  }

  const mov = await prisma.e_movimiento_llave.findUnique({ where: { id: movId } });
  if (!mov || mov.llave_id !== llaveId) {
    return { ok: false as const, marcaDia: null, llave: null, mov: null, message: "Movimiento no encontrado" };
  }

  return { ok: true as const, marcaDia, llave, mov, message: "" };
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!llaveId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const body = await req.json();
    const {
      marca_id,
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      entrega,
      recibe,
      fecha,
      hora,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    } = body ?? {};

    if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(llaveId, movId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = fecha ? parseDateOnly(fecha) : null;
    const horaDate = hora ? parseTimeOnly(hora) : null;
    if ((fecha && !fechaDate) || (hora && !horaDate)) {
      return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 200 });
    }

    await prisma.e_movimiento_llave.update({
      where: { id: movId },
      data: {
        nombre_persona_recibe: typeof nombre_persona_recibe === "string" ? nombre_persona_recibe : own.mov!.nombre_persona_recibe,
        nombre_persona_entrega: typeof nombre_persona_entrega === "string" ? nombre_persona_entrega : own.mov!.nombre_persona_entrega,
        departamento: typeof departamento === "string" ? departamento : own.mov!.departamento,
        telefono: typeof telefono === "string" ? telefono : own.mov!.telefono,
        entrega: typeof entrega === "string" ? entrega : own.mov!.entrega,
        recibe: typeof recibe === "string" ? recibe : own.mov!.recibe,
        fecha: fechaDate ?? own.mov!.fecha,
        hora: horaDate ?? own.mov!.hora,
        firma_entrega: typeof firma_entrega === "string" ? firma_entrega : own.mov!.firma_entrega,
        firma_recibe: typeof firma_recibe === "string" ? firma_recibe : own.mov!.firma_recibe,
        firma_responsable: typeof firma_responsable === "string" ? firma_responsable : own.mov!.firma_responsable,
      },
    });

    return NextResponse.json({ status: true, message: "Movimiento actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/llaves/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; movId: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    const movId = parseInt(resolvedParams.movId);
    if (!llaveId || !movId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateOwnership(llaveId, movId, parseInt(marcaIdStr));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    await prisma.e_movimiento_llave.delete({ where: { id: movId } });
    return NextResponse.json({ status: true, message: "Movimiento eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/llaves/[id]/movimientos/[movId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


