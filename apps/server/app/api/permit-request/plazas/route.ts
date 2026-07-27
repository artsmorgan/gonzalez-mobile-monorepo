import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../utils/prismaClient";

const parseIntStrict = (value: unknown): number | null => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

/** GET: listar plazas del empleado conectado (c_empleado_plaza donde plaza no tiene @ en codigo_plaza), con nombre plaza, puesto, sucursal y cliente */
export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message, data: [] }, { status: expired ? 401 : 403 });

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) {
      return NextResponse.json({ status: false, message: "Empleado inválido", data: [] }, { status: 400 });
    }

    const plazasValidas = await prisma.e_estructura_plazas.findMany({
      where: {
        OR: [{ codigo_plaza: null }, { codigo_plaza: { not: { contains: "@" } } }],
      },
      select: { id: true, nombre: true, puesto_id: true },
    });
    const validPlazaIds = plazasValidas.map((p) => p.id);
    if (validPlazaIds.length === 0) {
      return NextResponse.json({ status: true, message: "Sin plazas elegibles", data: [] }, { status: 200 });
    }

    const empleadoPlazas = await prisma.c_empleado_plaza.findMany({
      where: {
        empleado_id: currentEmployeeId,
        plaza_id: { in: validPlazaIds },
      },
      select: { plaza_id: true },
    });
    const plazaIds = [...new Set(empleadoPlazas.map((r) => r.plaza_id).filter(Boolean))] as number[];
    if (plazaIds.length === 0) {
      return NextResponse.json({ status: true, message: "Sin plazas asignadas al empleado", data: [] }, { status: 200 });
    }

    const plazasMap = new Map<number, { id: number; nombre: string; puesto_id: number | null }>();
    for (const p of plazasValidas) {
      if (plazaIds.includes(p.id)) {
        plazasMap.set(p.id, {
          id: p.id,
          nombre: String(p.nombre ?? "").trim() || "Plaza",
          puesto_id: p.puesto_id ?? null,
        });
      }
    }
    const puestoIds = [...new Set([...plazasMap.values()].map((x) => x.puesto_id).filter(Boolean))] as number[];
    if (puestoIds.length === 0) {
      const data = plazaIds.map((id) => {
        const p = plazasMap.get(id);
        return {
          id: p?.id ?? id,
          nombre_plaza: p?.nombre ?? "",
          nombre_puesto: null,
          nombre_sucursal: null,
          nombre_cliente: null,
        };
      });
      return NextResponse.json({ status: true, message: "Plazas obtenidas", data }, { status: 200 });
    }

    const arrPuestos = await prisma.e_estructura_puesto.findMany({
      where: { id: { in: puestoIds } },
      select: { id: true, nombre: true, sucursal_id: true },
    });
    const puestoMap = new Map<number, { nombre: string; sucursal_id: number | null }>();
    const sucursalIds: number[] = [];
    for (const p of arrPuestos) {
      puestoMap.set(p.id, { nombre: String(p.nombre ?? "").trim() || "Puesto", sucursal_id: p.sucursal_id ?? null });
      if (p.sucursal_id) sucursalIds.push(p.sucursal_id);
    }
    const uniqueSucursalIds = [...new Set(sucursalIds)];

    let contratoIds: number[] = [];
    const sucursalMap = new Map<number, { nombre: string; contrato_id: number | null }>();
    if (uniqueSucursalIds.length > 0) {
      const arrSuc = await prisma.e_estructura_sucursal.findMany({
        where: { id: { in: uniqueSucursalIds } },
        select: { id: true, nombre: true, contrato_id: true },
      });
      for (const s of arrSuc) {
        sucursalMap.set(s.id, { nombre: String(s.nombre ?? "").trim() || "Sucursal", contrato_id: s.contrato_id ?? null });
        if (s.contrato_id) contratoIds.push(s.contrato_id);
      }
      contratoIds = [...new Set(contratoIds)];
    }

    const contratoMap = new Map<number, number | null>();
    if (contratoIds.length > 0) {
      const arrCont = await prisma.e_estructura_contrato.findMany({
        where: { id: { in: contratoIds } },
        select: { id: true, cliente_id: true },
      });
      for (const c of arrCont) {
        contratoMap.set(c.id, c.cliente_id ?? null);
      }
    }

    const clienteIds = [...new Set([...contratoMap.values()].filter(Boolean))] as number[];
    const clienteMap = new Map<number, string>();
    if (clienteIds.length > 0) {
      const arrCl = await prisma.e_estructura_cliente.findMany({
        where: { id: { in: clienteIds } },
        select: { id: true, nombre: true },
      });
      for (const c of arrCl) {
        clienteMap.set(c.id, String(c.nombre ?? "").trim() || "Cliente");
      }
    }

    const data = plazaIds.map((plazaId) => {
      const plaza = plazasMap.get(plazaId);
      const puestoId = plaza?.puesto_id ?? null;
      const puesto = puestoId ? puestoMap.get(puestoId) : null;
      const sucursalId = puesto?.sucursal_id ?? null;
      const sucursal = sucursalId ? sucursalMap.get(sucursalId) : null;
      const contratoId = sucursal?.contrato_id ?? null;
      const clienteId = contratoId ? contratoMap.get(contratoId) : null;
      const nombreCliente = clienteId ? clienteMap.get(clienteId) ?? null : null;
      return {
        id: plazaId,
        nombre_plaza: plaza?.nombre ?? "",
        nombre_puesto: puesto?.nombre ?? null,
        nombre_sucursal: sucursal?.nombre ?? null,
        nombre_cliente: nombreCliente ?? null,
      };
    });

    return NextResponse.json({ status: true, message: "Plazas obtenidas", data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}
