/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByRole } from "../../../utils/sendNotification";

function parseDateTime(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "findMany",
        include: {
          e_estructura_cliente: { select: { nombre: true } },
          e_estructura_sucursal: { select: { nombre: true } },
          e_estructura_puesto: { select: { nombre: true } },
        },
        orderBy: { id: "desc" },
      },
    });

    const rowsArray = Array.isArray(rows) ? rows : [];
    const mapped = rowsArray.map((r: any) => ({
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nombre: (r as any).e_estructura_cliente?.nombre ?? "",
      corpo_id: r.corpo_id,
      corpo_nombre: (r as any).e_estructura_sucursal?.nombre ?? "",
      puesto_id: r.puesto_id,
      puesto_nombre: (r as any).e_estructura_puesto?.nombre ?? "",
      fecha: r.fecha,
      enlace: r.enlace,
      nombre_solicitante: r.nombre_solicitante,
      boleta: r.boleta,
      metricas_vulnerablidad: r.metricas_vulnerablidad,
      observaciones: r.observaciones ?? "",
      firma_solicitante: r.firma_solicitante,
      firma_responsable: r.firma_responsable,
      id_local: "",
    }));

    return NextResponse.json({ status: true, data: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/apreciacion-vulnerabilidad:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      puesto_id,
      fecha,
      enlace,
      nombre_solicitante,
      boleta,
      metricas_vulnerablidad,
      observaciones,
      firma_solicitante,
      firma_responsable,
    } = body ?? {};

    if (
      !cliente_id ||
      !corpo_id ||
      !puesto_id ||
      !fecha ||
      !enlace ||
      !nombre_solicitante ||
      !boleta ||
      !metricas_vulnerablidad ||
      !firma_solicitante ||
      !firma_responsable
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const fechaDate = parseDateTime(fecha);
    if (!fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    // Validar IDs existan (mínimo)
    const [cliente, corpo, puesto] = await Promise.all([
      callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_cliente",
          operation: "findUnique",
          where: { id: parseInt(String(cliente_id)) },
        },
      }),
      callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_sucursal",
          operation: "findUnique",
          where: { id: parseInt(String(corpo_id)) },
        },
      }),
      callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "e_estructura_puesto",
          operation: "findUnique",
          where: { id: parseInt(String(puesto_id)) },
        },
      }),
    ]);
    if (!cliente) return NextResponse.json({ status: false, message: "Cliente inválido" }, { status: 200 });
    if (!corpo) return NextResponse.json({ status: false, message: "Corpo inválido" }, { status: 200 });
    if (!puesto) return NextResponse.json({ status: false, message: "Puesto inválido" }, { status: 200 });

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_boleta_apreciacion_vulnerabilidad",
        operation: "create",
        data: {
          cliente_id: parseInt(String(cliente_id)),
          corpo_id: parseInt(String(corpo_id)),
          puesto_id: parseInt(String(puesto_id)),
          fecha: fechaDate.toISOString(),
          enlace: String(enlace),
          nombre_solicitante: String(nombre_solicitante),
          boleta: String(boleta),
          metricas_vulnerablidad: String(metricas_vulnerablidad),
          observaciones: typeof observaciones === "string" ? observaciones : "",
          firma_solicitante: String(firma_solicitante),
          firma_responsable: String(firma_responsable),
        },
      },
    });

    if (created) {

      const now = toZonedTime(new Date(), "America/Costa_Rica");

      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let puestoNombre = "Desconocido";
      let fechaRegistro = now.toISOString().split("T")[0];
      let horaRegistro = now.toISOString().split("T")[1].split(".")[0];
      const empleado = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_empleado",
          operation: "findUnique",
          where: { id: parseInt(String(payload?.id ?? "0"), 10) },
        },
      });
      if (empleado) {
        empNombre = (empleado as any).nombre + " " + (empleado as any).primer_apellido + " " + (empleado as any).segundo_apellido;
      }
      if ((created as any).corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_sucursal",
            operation: "findUnique",
            where: { id: (created as any).corpo_id },
          },
        });
        if (sucursal) {
          sucursalNombre = (sucursal as any).nombre;
        }
      }
      if ((created as any).puesto_id) {
        const puesto = await callDynamicPrisma({
          req,
          data: {
            action: "GET",
            table: "e_estructura_puesto",
            operation: "findUnique",
            where: { id: (created as any).puesto_id },
          },
        });
        if (puesto) {
          puestoNombre = (puesto as any).nombre + " (" + (puesto as any).codigo + ")";
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha registrado una apreciación de vulnerabilidad en el puesto " + puestoNombre + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro;
      await sendNotificationByRole(req, (created as any).corpo_id, [parseInt(String(payload?.id ?? "0"), 10)], "Apreciación de vulnerabilidad registrada", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String(payload?.id ?? 0), 10) || 0;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_boleta_apreciacion_vulnerabilidad",
          registro_id: (created as any).id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: (created as any).id,
              cliente_id: (created as any).cliente_id,
              corpo_id: (created as any).corpo_id,
              puesto_id: (created as any).puesto_id,
              fecha: fechaDate.toISOString(),
              enlace: (created as any).enlace,
              nombre_solicitante: (created as any).nombre_solicitante,
              boleta: (created as any).boleta,
              metricas_vulnerablidad: (created as any).metricas_vulnerablidad,
              observaciones: (created as any).observaciones,
            },
          }]),
          created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
          created_by: createdBy,
        },
      },
    });

    return NextResponse.json(
      { status: true, message: "Registro creado correctamente", id: (created as any).id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/apreciacion-vulnerabilidad:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


