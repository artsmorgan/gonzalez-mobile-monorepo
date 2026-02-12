import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = {};

    // Si hay filtros jerárquicos, usarlos (prioridad: corpo > cliente > empresa)
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    } else if (clienteIdStr) {
      // Si hay cliente pero no corpo, buscar todas las sucursales del cliente
      const clienteId = parseInt(clienteIdStr);
      const cliente = await prisma.e_estructura_cliente.findUnique({
        where: { id: clienteId },
      });
      if (!cliente) {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
      // Obtener todos los contratos del cliente y luego todas las sucursales
      const divisiones = await prisma.n_division.findMany();
      const contratoIds: number[] = [];
      for (const division of divisiones) {
        const contratos = await prisma.e_estructura_contrato.findMany({
          where: {
            cliente_id: clienteId,
            division_id: division.id,
            deleted: null,
          },
          select: { id: true },
        });
        contratos.forEach((c) => {
          if (!contratoIds.includes(c.id)) contratoIds.push(c.id);
        });
      }
      if (contratoIds.length > 0) {
        const sucursales = await prisma.e_estructura_sucursal.findMany({
          where: {
            contrato_id: { in: contratoIds },
          },
          select: { id: true },
        });
        const sucursalIds = sucursales.map((s) => s.id);
        if (sucursalIds.length > 0) {
          where.corpo_id = { in: sucursalIds };
        } else {
          return NextResponse.json({ status: true, data: [] }, { status: 200 });
        }
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    } else if (empresaIdStr) {
      // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
      const empresaId = parseInt(empresaIdStr);
      const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: empresaId },
        select: { id: true },
      });
      const clienteIds = clientes.map((c) => c.id);
      if (clienteIds.length > 0) {
        // Obtener todos los contratos de estos clientes y luego todas las sucursales
        const divisiones = await prisma.n_division.findMany();
        const contratoIds: number[] = [];
        for (const division of divisiones) {
          const contratos = await prisma.e_estructura_contrato.findMany({
            where: {
              cliente_id: { in: clienteIds },
              division_id: division.id,
              deleted: null,
            },
            select: { id: true },
          });
          contratos.forEach((c) => {
            if (!contratoIds.includes(c.id)) contratoIds.push(c.id);
          });
        }
        if (contratoIds.length > 0) {
          const sucursales = await prisma.e_estructura_sucursal.findMany({
            where: {
              contrato_id: { in: contratoIds },
            },
            select: { id: true },
          });
          const sucursalIds = sucursales.map((s) => s.id);
          if (sucursalIds.length > 0) {
            where.corpo_id = { in: sucursalIds };
          } else {
            return NextResponse.json({ status: true, data: [] }, { status: 200 });
          }
        } else {
          return NextResponse.json({ status: true, data: [] }, { status: 200 });
        }
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    } else {
      return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });
    }

    const records = await prisma.c_registro_induccion_general.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        e_estructura_empresa: { select: { nombre: true, codigo: true } },
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
      },
    });

    const recordsWithNames = records.map((r: any) => ({
      ...r,
      id_local: "",
      empresa_nombre: r.e_estructura_empresa ? `${r.e_estructura_empresa.codigo} - ${r.e_estructura_empresa.nombre}` : null,
      cliente_nombre: r.e_estructura_cliente?.nombre || null,
      corpo_nombre: r.e_estructura_sucursal ? `${r.e_estructura_sucursal.nro_sucursal} - ${r.e_estructura_sucursal.nombre}` : null,
    }));

    return NextResponse.json(
      { status: true, message: "Registros de inducción general obtenidos correctamente", data: recordsWithNames },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

function parseFechaInput(fecha: any): Date | undefined {
  if (!fecha) return undefined;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha === "string") {
    if (fecha.includes("/")) {
      const parts = fecha.split("/");
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(fecha);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

function ensureStringJson(value: any, fallback: string) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      empresa_id,
      cliente_id,
      corpo_id,
      division,
      fecha,
      temas_a_tratar,
      colaboradores,
      capacitadores,
      firma_responsable,
    } = await req.json();

    const required: Array<[string, any]> = [
      ["empresa_id", empresa_id],
      ["cliente_id", cliente_id],
      ["corpo_id", corpo_id],
      ["division", division],
      ["temas_a_tratar", temas_a_tratar],
      ["colaboradores", colaboradores],
      ["capacitadores", capacitadores],
      ["firma_responsable", firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const empresaIdNum = parseInt(String(empresa_id), 10);
    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    if ([empresaIdNum, clienteIdNum, corpoIdNum].some((n) => Number.isNaN(n) || n <= 0)) {
      return NextResponse.json({ status: false, message: "IDs inválidos" }, { status: 400 });
    }

    const fechaParsed = parseFechaInput(fecha);
    if (fecha !== undefined && fecha !== null && !fechaParsed) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 400 });
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");

    const createdBy = payload.id !== undefined && payload.id !== null ? Number(payload.id) : 0;

    const record = await prisma.c_registro_induccion_general.create({
      data: {
        empresa_id: empresaIdNum,
        cliente_id: clienteIdNum,
        corpo_id: corpoIdNum,
        division: String(division).trim(),
        ...(fechaParsed ? { fecha: fechaParsed } : {}),
        temas_a_tratar: ensureStringJson(temas_a_tratar, "[]"),
        colaboradores: ensureStringJson(colaboradores, "[]"),
        capacitadores: ensureStringJson(capacitadores, "[]"),
        firma_responsable: String(firma_responsable),
        created_at: createdAt,
        created_by: createdBy.toString(),
      },
      include: {
        e_estructura_empresa: { select: { nombre: true, codigo: true } },
        e_estructura_cliente: { select: { nombre: true } },
        e_estructura_sucursal: { select: { nombre: true, nro_sucursal: true } },
      },
    });

    // Registrar cambio de creación
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_registro_induccion_general",
        registro_id: record.id,
        cambios: JSON.stringify([{
          prop: "__created__",
          before: null,
          after: {
            id: record.id,
            empresa_id: record.empresa_id,
            cliente_id: record.cliente_id,
            corpo_id: record.corpo_id,
            division: record.division,
            fecha: record.fecha ? record.fecha.toISOString() : null,
            temas_a_tratar: record.temas_a_tratar,
            colaboradores: record.colaboradores,
            capacitadores: record.capacitadores,
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    if (record) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = record.fecha.toISOString().split("T")[0];
      if (record.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(String(record.created_by), 10) } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (record.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: record.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de inducción general en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
      sendNotificationByRole(record.corpo_id, [parseInt(String(record.created_by), 10)], "Registro de inducción general creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Registro de inducción general creado correctamente",
        data: {
          ...record,
          id_local: "",
          empresa_nombre: record.e_estructura_empresa ? `${record.e_estructura_empresa.codigo} - ${record.e_estructura_empresa.nombre}` : null,
          cliente_nombre: record.e_estructura_cliente?.nombre || null,
          corpo_nombre: record.e_estructura_sucursal ? `${record.e_estructura_sucursal.nro_sucursal} - ${record.e_estructura_sucursal.nombre}` : null,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


