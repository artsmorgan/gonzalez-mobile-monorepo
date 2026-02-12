/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import { getUserMarca } from "../../../../../utils/getUserMarca";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

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

async function validateLlaveOwnership(llaveId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(marcaId);
  if (!marcaRes.ok) return { ok: false as const, llave: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const llave = await prisma.e_llave.findUnique({ where: { id: llaveId } });
  if (!llave) return { ok: false as const, llave: null, message: "Llave no encontrada" };
  if (llave.cliente_id !== marcaDia.cliente_id || llave.corpo_id !== marcaDia.corpo_id) {
    return { ok: false as const, llave: null, message: "No autorizado" };
  }
  return { ok: true as const, llave, message: "" };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    if (!llaveId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    const marcaId = parseInt(marcaIdStr);

    const own = await validateLlaveOwnership(llaveId, marcaId);
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const rows = await prisma.e_movimiento_llave.findMany({
      where: { llave_id: llaveId },
      orderBy: { id: "desc" },
    });

    return NextResponse.json({ status: true, data: rows }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/llaves/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    if (!llaveId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const llave = await prisma.e_llave.findUnique({ where: { id: llaveId } });
    if (!llave) return NextResponse.json({ status: false, message: "Llave no encontrada" }, { status: 200 });

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

    const own = await validateLlaveOwnership(llaveId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = parseDateOnly(fecha);
    const horaDate = parseTimeOnly(hora);
    if (!fechaDate || !horaDate) return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 200 });

    const requiredStrings = [
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      entrega,
      recibe,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    ];
    if (requiredStrings.some((v) => typeof v !== "string" || v.trim().length === 0)) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const created = await prisma.e_movimiento_llave.create({
      data: {
        llave_id: llaveId,
        nombre_persona_recibe: String(nombre_persona_recibe),
        nombre_persona_entrega: String(nombre_persona_entrega),
        departamento: String(departamento),
        telefono: String(telefono),
        entrega: String(entrega),
        recibe: String(recibe),
        fecha: fechaDate,
        hora: horaDate,
        firma_entrega: String(firma_entrega),
        firma_recibe: String(firma_recibe),
        firma_responsable: String(firma_responsable),
      },
    });

    if (created) {

      let sucursalNombre = "Desconocida";

      let fechaRegistro = fechaDate.toISOString().split("T")[0];
      let horaRegistro = horaDate.toISOString().split("T")[1].split(".")[0];

      if (llave.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: llave.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }

      const description = "Se ha registrado un movimiento de la llave " + llave.lugar_abre + " (" + llave.cantidad_copias + " copias) de la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro + "(Del empleado " + nombre_persona_entrega + " a " + nombre_persona_recibe + ")";
      sendNotificationByRole(llave.corpo_id, [], "Movimiento de llave registrado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "e_movimiento_llave",
        registro_id: created.id,
        cambios: JSON.stringify([{
          prop: "__created__",
          before: null,
          after: {
            id: created.id,
            llave_id: created.llave_id,
            nombre_persona_recibe: created.nombre_persona_recibe,
            nombre_persona_entrega: created.nombre_persona_entrega,
            departamento: created.departamento,
            telefono: created.telefono,
            entrega: created.entrega,
            recibe: created.recibe,
            fecha: created.fecha.toISOString(),
            hora: created.hora.toISOString(),
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    return NextResponse.json(
      { status: true, message: "Movimiento creado correctamente", id: created.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/llaves/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


