/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { getUserMarca } from "../../../utils/getUserMarca";
import { toZonedTime } from "date-fns-tz";

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

function normalizeToStringifiedJson(value: any): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? []);
}

export async function GET(req: NextRequest) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }
    // Soporte para filtros directos por estructura (sin depender de marca)
    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const sucursalIdStr = req.nextUrl.searchParams.get("sucursal_id");

    let empresaId: number | null = empresaIdStr ? parseInt(String(empresaIdStr), 10) : null;
    let clienteId: number | null = clienteIdStr ? parseInt(String(clienteIdStr), 10) : null;
    let sucursalId: number | null = sucursalIdStr ? parseInt(String(sucursalIdStr), 10) : null;

    // Compat: si no vienen ids directos, usamos marca (comportamiento anterior)
    if (!empresaId || !clienteId || !sucursalId) {
      const marcaIdStr = req.nextUrl.searchParams.get("m");
      if (!marcaIdStr) {
        return NextResponse.json(
          { status: false, message: "Marca no especificada" },
          { status: 200 }
        );
      }

      const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }

      if (!marcaDia.empleadoFijo_id) {
        return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 200 });
      }

      const lastMarca = await getUserMarca(marcaDia.empleadoFijo_id);
      if (!lastMarca) {
        return NextResponse.json({ status: false, message: "No se encontró la última marca" }, { status: 200 });
      }
      if (marcaDia.id !== lastMarca.id) {
        return NextResponse.json({ status: false, message: "Hay una nueva marca más reciente" }, { status: 200 });
      }

      empresaId = marcaDia.empresa_id;
      clienteId = marcaDia.cliente_id;
      sucursalId = marcaDia.corpo_id;
    }

    const rows = await prisma.c_bitacora_vehiculo_detenido.findMany({
      where: {
        empresa_id: Number(empresaId),
        cliente_id: Number(clienteId),
        sucursal_id: Number(sucursalId),
      },
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      empresa_id: r.empresa_id,
      cliente_id: r.cliente_id,
      sucursal_id: r.sucursal_id,
      tipo: r.tipo,
      informacion_general: safeParseJson<any[]>(r.informacion_general, []),
      informacion_revision: safeParseJson<any[]>(r.informacion_revision, []),
      movimientos_vehiculos: safeParseJson<any[]>(r.movimientos_vehiculos, []),
      observaciones: r.observaciones,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const body = await req.json();
    const {
      marca_id,
      empresa_id,
      cliente_id,
      sucursal_id,
      uso_id,
      tipo,
      informacion_general,
      informacion_revision,
      movimientos_vehiculos,
      observaciones,
      firma_responsable,
    } = body ?? {};

    // marca_id era requerido previamente. Ahora permitimos crear por estructura directa.
    if ((!marca_id && (!empresa_id || !cliente_id || !sucursal_id)) || !tipo || !observaciones || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    let empresaId = empresa_id ? Number(empresa_id) : 0;
    let clienteId = cliente_id ? Number(cliente_id) : 0;
    let sucursalId = sucursal_id ? Number(sucursal_id) : 0;

    if (marca_id) {
      const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
      if (!marcaDia) {
        return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
      }
      // Si no vienen ids explícitos, usamos los de marca
      if (!empresaId) empresaId = marcaDia.empresa_id;
      if (!clienteId) clienteId = marcaDia.cliente_id;
      if (!sucursalId) sucursalId = marcaDia.corpo_id;
    }

    if (!empresaId || !clienteId || !sucursalId) {
      return NextResponse.json({ status: false, message: "Estructura incompleta" }, { status: 200 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;

    const created = await prisma.c_bitacora_vehiculo_detenido.create({
      data: {
        empresa_id: empresaId,
        cliente_id: clienteId,
        sucursal_id: sucursalId,
        uso_id: uso_id ? Number(uso_id) : null,
        tipo: String(tipo),
        informacion_general: normalizeToStringifiedJson(informacion_general),
        informacion_revision: normalizeToStringifiedJson(informacion_revision),
        movimientos_vehiculos: normalizeToStringifiedJson(movimientos_vehiculos),
        observaciones: String(observaciones),
        firma_responsable: String(firma_responsable),
        created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
        created_at: createdAt,
      },
    });

    // Vinculación: si viene `uso_id`, marcamos el uso con `bitacora_id = created.id`
    if (uso_id) {
      try {
        await prisma.c_usos_vehiculos_corporativos.update({
          where: { id: Number(uso_id) },
          data: { bitacora_id: created.id },
        });
      } catch {
        // si falla, no rompemos el create de bitácora
      }
    }

    return NextResponse.json({ status: true, message: "Bitácora creada correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/bitacora-vehiculo-detenido:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


