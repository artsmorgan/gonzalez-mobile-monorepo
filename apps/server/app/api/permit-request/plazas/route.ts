import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";

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

    // 1) Plazas válidas: e_estructura_plazas donde codigo_plaza no contiene '@'
    const plazasValidas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_plazas",
        operation: "findMany",
        where: {
          OR: [
            { codigo_plaza: null },
            { codigo_plaza: { not: { contains: "@" } } },
          ],
        },
        select: { id: true, nombre: true, puesto_id: true },
      },
    });
    const arrPlazas = Array.isArray(plazasValidas) ? plazasValidas : [];
    const validPlazaIds = arrPlazas.map((p: any) => parseIntStrict(p?.id)).filter(Boolean) as number[];
    if (validPlazaIds.length === 0) {
      return NextResponse.json({ status: true, message: "Sin plazas elegibles", data: [] }, { status: 200 });
    }

    // 2) c_empleado_plaza del empleado cuya plaza_id esté en validPlazaIds
    const empleadoPlazas = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_empleado_plaza",
        operation: "findMany",
        where: {
          empleado_id: currentEmployeeId,
          plaza_id: { in: validPlazaIds },
        },
        select: { plaza_id: true },
      },
    });
    const arrEmpPlaza = Array.isArray(empleadoPlazas) ? empleadoPlazas : [];
    const plazaIds = [...new Set(arrEmpPlaza.map((r: any) => parseIntStrict(r?.plaza_id)).filter(Boolean))] as number[];
    if (plazaIds.length === 0) {
      return NextResponse.json({ status: true, message: "Sin plazas asignadas al empleado", data: [] }, { status: 200 });
    }

    // 3) Datos de plazas (id, nombre, puesto_id)
    const plazasMap = new Map<number, { id: number; nombre: string; puesto_id: number | null }>();
    for (const p of arrPlazas) {
      const id = parseIntStrict(p?.id);
      if (id && plazaIds.includes(id)) {
        plazasMap.set(id, {
          id,
          nombre: String(p?.nombre ?? "").trim() || "Plaza",
          puesto_id: parseIntStrict(p?.puesto_id) ?? null,
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

    // 4) Puestos (id, nombre, sucursal_id)
    const puestosRaw = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findMany",
        where: { id: { in: puestoIds } },
        select: { id: true, nombre: true, sucursal_id: true },
      },
    });
    const arrPuestos = Array.isArray(puestosRaw) ? puestosRaw : [];
    const puestoMap = new Map<number, { nombre: string; sucursal_id: number | null }>();
    const sucursalIds: number[] = [];
    for (const p of arrPuestos) {
      const id = parseIntStrict(p?.id);
      const sucId = parseIntStrict(p?.sucursal_id);
      if (id) {
        puestoMap.set(id, { nombre: String(p?.nombre ?? "").trim() || "Puesto", sucursal_id: sucId });
        if (sucId) sucursalIds.push(sucId);
      }
    }
    const uniqueSucursalIds = [...new Set(sucursalIds)];

    let contratoIds: number[] = [];
    const sucursalMap = new Map<number, { nombre: string; contrato_id: number | null }>();
    if (uniqueSucursalIds.length > 0) {
      const sucursalesRaw = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findMany",
          where: { id: { in: uniqueSucursalIds } },
          select: { id: true, nombre: true, contrato_id: true },
        },
      });
      const arrSuc = Array.isArray(sucursalesRaw) ? sucursalesRaw : [];
      for (const s of arrSuc) {
        const id = parseIntStrict(s?.id);
        const cId = parseIntStrict(s?.contrato_id);
        if (id) {
          sucursalMap.set(id, { nombre: String(s?.nombre ?? "").trim() || "Sucursal", contrato_id: cId });
          if (cId) contratoIds.push(cId);
        }
      }
      contratoIds = [...new Set(contratoIds)];
    }

    let clienteIds: number[] = [];
    const contratoMap = new Map<number, number | null>();
    if (contratoIds.length > 0) {
      const contratosRaw = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_contrato",
          operation: "findMany",
          where: { id: { in: contratoIds } },
          select: { id: true, cliente_id: true },
        },
      });
      const arrCont = Array.isArray(contratosRaw) ? contratosRaw : [];
      for (const c of arrCont) {
        const id = parseIntStrict(c?.id);
        const clId = parseIntStrict(c?.cliente_id);
        if (id) {
          contratoMap.set(id, clId);
          if (clId) clienteIds.push(clId);
        }
      }
      clienteIds = [...new Set(clienteIds)];
    }

    const clienteMap = new Map<number, string>();
    if (clienteIds.length > 0) {
      const clientesRaw = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findMany",
          where: { id: { in: clienteIds } },
          select: { id: true, nombre: true },
        },
      });
      const arrCl = Array.isArray(clientesRaw) ? clientesRaw : [];
      for (const c of arrCl) {
        const id = parseIntStrict(c?.id);
        if (id) clienteMap.set(id, String(c?.nombre ?? "").trim() || "Cliente");
      }
    }

    const data = plazaIds.map((plazaId) => {
      const plaza = plazasMap.get(plazaId);
      const puestoId = plaza?.puesto_id ?? null;
      const puesto = puestoId ? puestoMap.get(puestoId) : null;
      const sucursalId = puesto?.sucursal_id ?? null;
      const sucursal = sucursalId ? sucursalMap.get(sucursalId) : null;
      const contratoId = sucursal?.contrato_id ?? (sucursalId ? contratoMap.get(sucursalId) : null) ?? null;
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
