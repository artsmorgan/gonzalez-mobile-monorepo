/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { prisma } from "../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";

/** Jerarquía: empresa_id, cliente_id, division_id, contrato_id, corpo_id, puesto_id (sucursal_id = corpo). */
function parseId(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    if (!corpoIdStr || String(corpoIdStr).trim() === "") {
      return NextResponse.json({ status: false, message: "Sucursal (corpo) no especificada" }, { status: 200 });
    }

    const targetCorpoId = parseInt(String(corpoIdStr), 10);
    if (!Number.isFinite(targetCorpoId) || targetCorpoId <= 0) {
      return NextResponse.json({ status: false, message: "corpo_id inválido" }, { status: 200 });
    }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_llave",
        operation: "findMany",
        where: {
          corpo_id: targetCorpoId,
          isActive: true,
        },
        include: {
          e_movimiento_llave: {
            orderBy: { id: "desc" },
          },
        },
        orderBy: { id: "desc" }
      }
    });

    const mapped = (rows || []).map((r: any) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      corpo_id: r.corpo_id,
      sucursal_id: r.corpo_id,
      puesto_id: r.puesto_id,
      empresa_id: r.empresa_id,
      division_id: r.division_id,
      contrato_id: r.contrato_id,
      isActive: r.isActive !== false,
      numero_llave: r.numero_llave,
      lugar_abre: r.lugar_abre,
      cantidad_copias: r.cantidad_copias,
      observaciones: r.observaciones,
      firma_responsable: r.firma_responsable,
      created_by: r.created_by,
      created_at: r.created_at,
      id_local: "",
      movimientos: (r.e_movimiento_llave || []).map((m: any) => ({
        id: m.id,
        llave_id: m.llave_id,
        nombre_persona_recibe: m.nombre_persona_recibe,
        nombre_persona_entrega: m.nombre_persona_entrega,
        departamento: m.departamento,
        telefono: m.telefono,
        entrega: m.entrega,
        recibe: m.recibe,
        fecha: m.fecha,
        hora: m.hora,
        firma_entrega: m.firma_entrega,
        firma_recibe: m.firma_recibe,
        firma_responsable: m.firma_responsable,
        id_local: "",
      })),
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    console.log(error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/llaves:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const {
      marca_id,
      numero_llave,
      lugar_abre,
      cantidad_copias,
      observaciones,
      firma_responsable,
      empresa_id: bodyEmpresaId,
      division_id: bodyDivisionId,
      contrato_id: bodyContratoId,
      cliente_id: bodyClienteId,
      corpo_id: bodyCorpoId,
      puesto_id: bodyPuestoId,
    } = body ?? {};

    if (!marca_id || !numero_llave || !lugar_abre || cantidad_copias === undefined || cantidad_copias === null || !firma_responsable) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }
    if (!marcaDia.puesto_id) {
      return NextResponse.json({ status: false, message: "Puesto no encontrado en marca" }, { status: 200 });
    }

    const useCliente =
      bodyClienteId != null && String(bodyClienteId).trim() !== ""
        ? parseInt(String(bodyClienteId), 10)
        : marcaDia.cliente_id;
    const useCorpo =
      bodyCorpoId != null && String(bodyCorpoId).trim() !== ""
        ? parseInt(String(bodyCorpoId), 10)
        : marcaDia.corpo_id;
    const usePuesto =
      bodyPuestoId != null && String(bodyPuestoId).trim() !== ""
        ? parseInt(String(bodyPuestoId), 10)
        : marcaDia.puesto_id;

    const useEmpresa = parseId(bodyEmpresaId);
    const useDivision = parseId(bodyDivisionId);
    const useContrato = parseId(bodyContratoId);
    if (useEmpresa == null || useDivision == null || useContrato == null) {
      return NextResponse.json(
        { status: false, message: "Incluya empresa_id, division_id y contrato_id (jerarquía desde el formulario o current_marca vía app)" },
        { status: 200 }
      );
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "e_llave",
        data: {
          cliente_id: useCliente,
          corpo_id: useCorpo,
          puesto_id: usePuesto,
          empresa_id: useEmpresa,
          division_id: useDivision,
          contrato_id: useContrato,
          isActive: true,
          numero_llave: String(numero_llave),
          lugar_abre: String(lugar_abre),
          cantidad_copias: parseInt(String(cantidad_copias)) || 0,
          observaciones: typeof observaciones === "string" ? observaciones : "",
          firma_responsable: String(firma_responsable),
          created_by: parseInt(String((payload as any)?.id ?? 0)) || 0,
          created_at: createdAt.toISOString(),
        }
      }
    });

    if (created) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      let fechaRegistro = createdAt.toISOString().split("T")[0];
      let horaRegistro = createdAt.toISOString().split("T")[1].split(".")[0];
      if (created.created_by) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: created.created_by } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (created.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: created.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }
      if (marcaDia.puesto_id) {
        const puesto = await prisma.e_estructura_puesto.findUnique({ where: { id: marcaDia.puesto_id } });
        if (puesto) {
          puestoNombre = puesto.nombre + " (" + puesto.codigo + ")";
        }
      }
      const description = "El empleado " + empNombre + " ha creado una llave en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, created.corpo_id, [created.created_by], "Llave registrada", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_llave",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              cliente_id: created.cliente_id,
              corpo_id: created.corpo_id,
              puesto_id: created.puesto_id,
              numero_llave: created.numero_llave,
              lugar_abre: created.lugar_abre,
              cantidad_copias: created.cantidad_copias,
              observaciones: created.observaciones,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    return NextResponse.json(
      {
        status: true,
        message: "Llave creada correctamente",
        id: created.id,
        empresa_id: useEmpresa,
        cliente_id: useCliente,
        division_id: useDivision,
        contrato_id: useContrato,
        corpo_id: useCorpo,
        sucursal_id: useCorpo,
        puesto_id: usePuesto,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/llaves:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


