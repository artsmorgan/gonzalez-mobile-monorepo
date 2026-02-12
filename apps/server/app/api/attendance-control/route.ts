import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import { sendNotificationByRole } from "../../../utils/sendNotification";

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const empresaIdStr = req.nextUrl.searchParams.get("empresa_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    const divisionIdStr = req.nextUrl.searchParams.get("division_id");
    const contratoIdStr = req.nextUrl.searchParams.get("contrato_id");
    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");

    const where: any = {};

    // Prioridad: corpo_id > contrato_id > division_id > cliente_id > empresa_id
    if (corpoIdStr) {
      where.corpo_id = parseInt(corpoIdStr);
    } else if (contratoIdStr) {
      where.contrato_id = parseInt(contratoIdStr);
    } else if (divisionIdStr) {
      where.division_id = parseInt(divisionIdStr);
    } else if (clienteIdStr) {
      where.cliente_id = parseInt(clienteIdStr);
    } else if (empresaIdStr) {
      // Si hay empresa pero no cliente, buscar todos los clientes de la empresa
      const empresaId = parseInt(empresaIdStr);
      const clientes = await prisma.e_estructura_cliente.findMany({
        where: { empresa_id: empresaId },
        select: { id: true },
      });
      const clienteIds = clientes.map((c) => c.id);
      if (clienteIds.length > 0) {
        where.cliente_id = { in: clienteIds };
      } else {
        return NextResponse.json({ status: true, data: [] }, { status: 200 });
      }
    } else {
      return NextResponse.json({ status: false, message: "Debe especificar filtros jerárquicos" }, { status: 400 });
    }

    const records = await prisma.c_control_asistencia.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      }
    });

    const recordsWithIdLocal = records.map(record => ({
      ...record,
      id_local: ""
    }));

    return NextResponse.json({
      status: true,
      message: "Controles de asistencia obtenidos correctamente",
      data: recordsWithIdLocal
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage, data: [] }, { status: 400 });
  }
}

function parseDDMMYYYYToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  // expected: dd/mm/yyyy
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const yyyy = parseInt(parts[2], 10);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  // validate roundtrip
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);

    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const {
      marca_id,
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      cliente,
      fecha,
      turno,
      area_piso,
      total_presentes,
      fijos,
      colaboradores,
      firma_responsable
    } = await req.json();

    if (!marca_id) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
    }
    if (!firma_responsable) {
      return NextResponse.json({ status: false, message: "Firma del responsable es obligatoria" }, { status: 400 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marca_id) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
    }

    if (!marcaDia.empleadoFijo_id) {
      return NextResponse.json({ status: false, message: "Empleado no encontrado" }, { status: 404 });
    }

    const fechaDate = parseDDMMYYYYToDate(fecha);
    const totalPresentesInt = toIntOrNull(total_presentes);
    const fijosInt = toIntOrNull(fijos);

    if (!cliente) {
      return NextResponse.json({ status: false, message: "Nombre de cliente es obligatorio" }, { status: 400 });
    }
    if (!fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida (formato esperado dd/mm/yyyy)" }, { status: 400 });
    }
    if (!turno) {
      return NextResponse.json({ status: false, message: "Turno es obligatorio" }, { status: 400 });
    }
    if (!area_piso) {
      return NextResponse.json({ status: false, message: "Área/Piso es obligatorio" }, { status: 400 });
    }
    if (totalPresentesInt === null) {
      return NextResponse.json({ status: false, message: "Total presentes inválido" }, { status: 400 });
    }
    if (fijosInt === null) {
      return NextResponse.json({ status: false, message: "Fijos inválido" }, { status: 400 });
    }
    if (!colaboradores) {
      return NextResponse.json({ status: false, message: "Colaboradores es obligatorio" }, { status: 400 });
    }

    const contrato = await prisma.e_estructura_contrato.findUnique({ where: { id: parseInt(contrato_id) } });
    if (!contrato) {
      return NextResponse.json({ status: false, message: "Contrato no encontrado" }, { status: 404 });
    }

    // Usar campos jerárquicos del request o de la marca
    const empresaId = empresa_id || marcaDia.empresa_id;
    const clienteId = cliente_id || marcaDia.cliente_id;
    const divisionId = division_id || contrato.division_id;
    const contratoId = contrato_id || marcaDia.contrato_id;
    const corpoId = corpo_id || marcaDia.corpo_id;

    if (!empresaId || !clienteId || !divisionId || !contratoId || !corpoId) {
      return NextResponse.json({ status: false, message: "Faltan campos jerárquicos requeridos (empresa_id, cliente_id, division_id, contrato_id, corpo_id)" }, { status: 400 });
    }

    // Autocompletar campos desde la marca
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload.id !== undefined && payload.id !== null ? Number(payload.id) : 0;

    const new_record = await prisma.c_control_asistencia.create({
      data: {
        empresa_id: empresaId,
        cliente_id: clienteId,
        division_id: divisionId,
        contrato_id: contratoId,
        corpo_id: corpoId,
        nombre_cliente: String(cliente),
        fecha: fechaDate,
        turno: String(turno),
        area_piso: String(area_piso),
        total_presentes: totalPresentesInt,
        fijos: fijosInt,
        colaboradores: String(colaboradores),
        firma_responsable: String(firma_responsable),
        created_at: createdAt,
        created_by: createdBy
      }
    });

    // Registrar cambio de creación
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_control_asistencia",
        registro_id: new_record.id,
        cambios: JSON.stringify([{
          prop: "__created__",
          before: null,
          after: {
            id: new_record.id,
            empresa_id: new_record.empresa_id,
            cliente_id: new_record.cliente_id,
            division_id: new_record.division_id,
            contrato_id: new_record.contrato_id,
            corpo_id: new_record.corpo_id,
            nombre_cliente: (new_record as any).nombre_cliente,
            fecha: (new_record as any).fecha ? (new_record as any).fecha.toISOString() : null,
            turno: (new_record as any).turno,
            area_piso: (new_record as any).area_piso,
            total_presentes: (new_record as any).total_presentes,
            fijos: (new_record as any).fijos,
            colaboradores: (new_record as any).colaboradores,
          },
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    if (new_record) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let fechaRegistro = new_record.created_at.toISOString().split("T")[0];
      if (new_record.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(String(new_record.created_by), 10) } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (new_record.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: new_record.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro decontrol de asistencia en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
      sendNotificationByRole(new_record.corpo_id, [parseInt(String(new_record.created_by), 10)], "Control de asistencia creado", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    return NextResponse.json({
      status: true,
      message: "Control de asistencia creado correctamente",
      data: {
        id: new_record.id,
        nombre_cliente: (new_record as any).nombre_cliente,
        fecha: (new_record as any).fecha,
        turno: (new_record as any).turno,
        area_piso: (new_record as any).area_piso,
        total_presentes: (new_record as any).total_presentes,
        fijos: (new_record as any).fijos,
        colaboradores: (new_record as any).colaboradores,
        firma_responsable: (new_record as any).firma_responsable,
        created_at: (new_record as any).created_at,
        created_by: (new_record as any).created_by,
      }
    }, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

