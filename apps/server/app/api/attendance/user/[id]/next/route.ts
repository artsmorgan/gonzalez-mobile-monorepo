import { NextRequest, NextResponse } from "next/server";
import { toZonedTime } from "date-fns-tz";
import axios from "axios";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { prisma } from "../../../../../../utils/prismaClient";

export const runtime = "nodejs";

type MarcaFutureReturn = {
  id: number;
  fecha: Date;
  hora_inicio: Date | null;
  hora_fin: Date | null;
  tipo_turno: string | null;
  empresa: { id: number; nombre: string };
  cliente: { id: number; nombre: string };
  contrato: { id: number; nombre: string };
  corpo: {
    id: number;
    nombre: string;
    ubicacion: { lat: number | null; lng: number | null };
  };
  puesto: {
    id: number;
    nombre: string;
    ubicacion: { lat: number | null; lng: number | null };
  };
  plaza: { id: number; nombre: string };
};

// GET: marcas del usuario para hoy y los próximos 30 días (vía Planillas → c_marca_dia)
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const { id } = await context.params;
    const empleadoId = parseInt(id, 10);
    if (Number.isNaN(empleadoId)) {
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const planillasToken =
      decodeURIComponent(req.headers.get("Planillas-Token") ?? "").trim() || null;
    if (!planillasToken) {
      return NextResponse.json(
        { status: false, message: "Token de Planillas no encontrado" },
        { status: 200 }
      );
    }

    const empleado = await prisma.c_empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) {
      return NextResponse.json(
        { status: false, message: "Empleado no encontrado" },
        { status: 200 }
      );
    }

    const planillasUrl = String(process.env.PLANILLAS_URL || "").trim().replace(/\/+$/, "");
    if (!planillasUrl) {
      return NextResponse.json(
        { status: false, message: "PLANILLAS_URL no configurada" },
        { status: 500 }
      );
    }

    // Misma base de fecha CR que attendance/user/[id]
    let now = toZonedTime(new Date(), "America/Costa_Rica");
    //now = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    let dateCursor = new Date(now.toISOString().split("T")[0]);

    const marcasIdsSet = new Set<number>();

    // 1 búsqueda por día a Planillas (hoy + 29 días = 30 días)
    for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
      const fechaParam = dateCursor.toISOString().split("T")[0];

      try {
        const planillasResponse = await axios.get(`${planillasUrl}/marcas`, {
          headers: {
            Authorization: `Bearer ${planillasToken}`,
          },
          params: {
            empleado_codigo: empleado.cedula,
            fecha: fechaParam,
          },
        });

        const dayMarcas = planillasResponse?.data?.data?.marcas;
        if (Array.isArray(dayMarcas)) {
          for (const marca of dayMarcas) {
            const marcaId = Number(marca?.id);
            if (Number.isFinite(marcaId) && marcaId > 0) {
              marcasIdsSet.add(marcaId);
            }
          }
        }
      } catch (dayError: unknown) {
        const dayMsg = dayError instanceof Error ? dayError.message : "Error desconocido";
        console.error(
          `Error consultando Planillas /marcas para ${fechaParam}:`,
          dayMsg
        );
      }

      dateCursor = new Date(dateCursor.getTime() + 1 * 24 * 60 * 60 * 1000);
    }

    const marcasIds = Array.from(marcasIdsSet);
    if (marcasIds.length === 0) {
      return NextResponse.json({ status: true, marcas: [] }, { status: 200 });
    }

    const marcas = await prisma.c_marca_dia.findMany({
      where: { id: { in: marcasIds } },
      orderBy: [{ fecha: "asc" }, { hora_inicio: "asc" }],
    });

    const marcasReturn: MarcaFutureReturn[] = [];

    const empresas_ids = marcas.map((marca) => (marca.empresa_id != null ? marca.empresa_id : 0));
    const clientes_ids = marcas.map((marca) => (marca.cliente_id != null ? marca.cliente_id : 0));
    const contratos_ids = marcas.map((marca) =>
      marca.contrato_id != null ? marca.contrato_id : 0
    );
    const corpos_ids = marcas.map((marca) => (marca.corpo_id != null ? marca.corpo_id : 0));
    const puestos_ids = marcas.map((marca) => (marca.puesto_id != null ? marca.puesto_id : 0));
    const plazas_ids = marcas.map((marca) => (marca.plaza_id != null ? marca.plaza_id : 0));

    const [empresas, clientes, contratos, corpos, puestos, plazas] = await Promise.all([
      prisma.e_estructura_empresa.findMany({ where: { id: { in: empresas_ids } } }),
      prisma.e_estructura_cliente.findMany({ where: { id: { in: clientes_ids } } }),
      prisma.e_estructura_contrato.findMany({ where: { id: { in: contratos_ids } } }),
      prisma.e_estructura_sucursal.findMany({ where: { id: { in: corpos_ids } } }),
      prisma.e_estructura_puesto.findMany({ where: { id: { in: puestos_ids } } }),
      prisma.e_estructura_plazas.findMany({ where: { id: { in: plazas_ids } } }),
    ]);

    for (const marca of marcas) {
      // Misma regla que attendance/user/[id]: si el fijo es el empleado pero hay reemplazo, no listar
      if (marca.empleadoFijo_id == empleadoId && marca.empleadoReemplaza_id != null) {
        continue;
      }

      const empresa = empresas.find((e) => e.id == marca.empresa_id);
      const cliente = clientes.find((c) => c.id == marca.cliente_id);
      const contrato = contratos.find((c) => c.id == marca.contrato_id);
      const corpo = corpos.find((c) => c.id == marca.corpo_id);
      const puesto = puestos.find((p) => p.id == marca.puesto_id);
      const plaza = plazas.find((p) => p.id == marca.plaza_id);

      marcasReturn.push({
        id: marca.id,
        fecha: marca.fecha,
        hora_inicio: marca.hora_inicio,
        hora_fin: marca.hora_fin,
        tipo_turno: marca.tipo_turno,
        empresa: {
          id: marca.empresa_id ?? 0,
          nombre: empresa?.nombre ?? "Indefinido",
        },
        cliente: {
          id: marca.cliente_id ?? 0,
          nombre: cliente?.nombre ?? "Indefinido",
        },
        contrato: {
          id: marca.contrato_id ?? 0,
          nombre: contrato?.nombre ?? "Indefinido",
        },
        corpo: {
          id: marca.corpo_id ?? 0,
          nombre: corpo?.nombre ?? "Indefinido",
          ubicacion: {
            lat: corpo?.coordenadas_gpslat ? parseFloat(corpo.coordenadas_gpslat) : null,
            lng: corpo?.coordenadas_gpslng ? parseFloat(corpo.coordenadas_gpslng) : null,
          },
        },
        puesto: {
          id: marca.puesto_id ?? 0,
          nombre: puesto?.nombre ?? "Indefinido",
          ubicacion: {
            lat: puesto?.coordenadas_gpslat ? parseFloat(puesto.coordenadas_gpslat) : null,
            lng: puesto?.coordenadas_gpslng ? parseFloat(puesto.coordenadas_gpslng) : null,
          },
        },
        plaza: {
          id: marca.plaza_id ?? 0,
          nombre: plaza?.nombre ?? "Indefinido",
        },
      });
    }

    return NextResponse.json({ status: true, marcas: marcasReturn }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/attendance/user/[id]/next:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
