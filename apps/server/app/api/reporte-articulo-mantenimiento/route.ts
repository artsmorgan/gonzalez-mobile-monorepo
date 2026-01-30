/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    // Parámetros de la jerarquía completa
    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const divisionIdStr = req.nextUrl.searchParams.get("division_id");
    const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const puestoIdStr = req.nextUrl.searchParams.get("puesto_id");

    const where: any = {};

    // Filtro por empresa: filtrar clientes que pertenecen a esa empresa
    // Solo se aplica si no hay filtro más específico de cliente
    if (empresaIdStr && !clienteIdStr) {
      const empresaId = parseInt(empresaIdStr);
      const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: empresaId },
        select: { id: true },
      });
      const clienteIds = clientes.map((c) => c.id);
      if (clienteIds.length > 0) {
        where.cliente_id = { in: clienteIds };
      } else {
        // Si no hay clientes, retornar vacío
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    }

    // Filtro directo por cliente (tiene prioridad sobre empresa)
    if (clienteIdStr) {
      where.cliente_id = parseInt(clienteIdStr);
    }

    // Filtro por división: usar el campo division (String)
    if (divisionIdStr) {
      const divisionId = parseInt(divisionIdStr);
      const division = await prisma.n_division.findUnique({
        where: { id: divisionId },
        select: { nombre: true },
      });
      if (division) {
        where.division = division.nombre;
      } else {
        // Si no existe la división, retornar vacío
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    }

    // Filtro por contrato: filtrar sucursales que pertenecen a ese contrato
    // Solo se aplica si no hay filtro más específico de corpo
    if (contratoIdStr && !corpoIdStr) {
      const contratoId = parseInt(contratoIdStr);
      const sucursales = await prisma.e_estructura_sucursal.findMany({
        where: { contrato_id: contratoId },
        select: { id: true },
      });
      const sucursalIds = sucursales.map((s) => s.id);
      if (sucursalIds.length > 0) {
        where.corpo_id = { in: sucursalIds };
      } else {
        // Si no hay sucursales, retornar vacío
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    }

    // Filtro directo por corpo (tiene prioridad sobre contrato)
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    }

    // Filtro directo por puesto
    if (puestoIdStr) {
      where.puesto_id = parseInt(puestoIdStr);
    }

    const rows = await prisma.c_reporte_articulo_mantenimiento.findMany({
      where,
      include: {
        e_estructura_cliente: {
          select: { id: true, nombre: true },
        },
        e_estructura_sucursal: {
          select: { id: true, nombre: true },
        },
        e_estructura_puesto: {
          select: { id: true, nombre: true, codigo: true },
        },
        c_activo_mantenimiento: {
          include: {
            c_reporte_articulo_mantenimiento: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      corpo_id: r.corpo_id,
      puesto_id: r.puesto_id,
      division: r.division,
      fecha_reporte: r.fecha_reporte,
      created_by: r.created_by,
      solucionado: r.solucionado,
      cliente: r.e_estructura_cliente,
      corpo: r.e_estructura_sucursal,
      puesto: r.e_estructura_puesto,
      activos: r.c_activo_mantenimiento,
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/reporte-articulo-mantenimiento:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

