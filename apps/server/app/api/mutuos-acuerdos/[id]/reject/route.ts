import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";
import { parseMarcaIdsArray, ymdFromFecha } from "../../../../../utils/mutuosAcuerdosMarcas";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

const parseDateInputToDate = (input: unknown): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
      return NextResponse.json({ status: false, message: "Solo se puede rechazar un mutuo acuerdo pendiente" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });

    const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    const canReject = myEjecutivoCuentaId !== null && Number(myEjecutivoCuentaId) === Number(existing.ejecutivo_cuenta);
    if (!canReject) {
      return NextResponse.json({ status: false, message: "No autorizado para rechazar este mutuo acuerdo" }, { status: 403 });
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
      return NextResponse.json({ status: false, message: "Ambos empleados deben aceptar antes de rechazar" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const horaAccion = parseDateInputToDate((body as any)?.hora_accion);

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: {
          estado: "rechazado",
        },
      },
    });

    console.log(horaAccion);
    const now = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    console.log(now);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: idNum,
          cambios: JSON.stringify([
            { prop: "estado", before: (existing as any)?.estado || null, after: "rechazado" },
          ]),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    const empleadoAusenteId = Number((existing as any)?.empleadoAusente_id || 0);
    const empleadoReemplazaId = Number((existing as any)?.empleadoReemplaza_id || 0);
    const recipients = Array.from(new Set([empleadoAusenteId, empleadoReemplazaId].filter((x) => Number(x) > 0)));
    if (recipients.length > 0) {
      const [empleadoAusente, empleadoReemplaza, ejecutivo, marcaAusenteNotif, marcaReemplazaNotif] = await Promise.all([
        empleadoAusenteId
          ? prisma.c_empleado.findUnique({ where: { id: empleadoAusenteId } })
          : null,
        empleadoReemplazaId
          ? prisma.c_empleado.findUnique({ where: { id: empleadoReemplazaId } })
          : null,
        prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } }),
        (() => {
          const id = parseMarcaIdsArray((existing as any)?.marcas_ausente ?? (existing as any)?.marcaDiaAusente_id)[0];
          return id ? prisma.c_marca_dia.findUnique({ where: { id } }) : Promise.resolve(null);
        })(),
        (() => {
          const id = parseMarcaIdsArray((existing as any)?.marcas_reemplaza ?? (existing as any)?.marcaDiaReemplaza_id)[0];
          return id ? prisma.c_marca_dia.findUnique({ where: { id } }) : Promise.resolve(null);
        })(),
      ]);
      const [puestoAusente, puestoReemplaza] = await Promise.all([
        (marcaAusenteNotif as any)?.puesto_id
          ? prisma.e_estructura_puesto.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.puesto_id) } })
          : null,
        (marcaReemplazaNotif as any)?.puesto_id
          ? prisma.e_estructura_puesto.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.puesto_id) } })
          : null,
      ]);

      const [sucursalAusente, sucursalReemplaza] = await Promise.all([
        (marcaAusenteNotif as any)?.corpo_id
          ? prisma.e_estructura_sucursal.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.corpo_id) } })
          : null,
        (marcaReemplazaNotif as any)?.corpo_id
          ? prisma.e_estructura_sucursal.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.corpo_id) } })
          : null,
      ]);

      const [clienteAusente, clienteReemplaza] = await Promise.all([
        (marcaAusenteNotif as any)?.cliente_id
          ? prisma.e_estructura_cliente.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.cliente_id) } })
          : null,
        (marcaReemplazaNotif as any)?.cliente_id
          ? prisma.e_estructura_cliente.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.cliente_id) } })
          : null,
      ]);

      const ausenteNombre = empleadoAusente
        ? `${empleadoAusente.nombre ?? ""} ${empleadoAusente.primer_apellido ?? ""} ${empleadoAusente.segundo_apellido ?? ""}`.trim()
        : `ID ${empleadoAusenteId}`;
      const reemplazaNombre = empleadoReemplaza
        ? `${empleadoReemplaza.nombre ?? ""} ${empleadoReemplaza.primer_apellido ?? ""} ${empleadoReemplaza.segundo_apellido ?? ""}`.trim()
        : `ID ${empleadoReemplazaId}`;
      const ejecutivoNombre = ejecutivo
        ? `${ejecutivo.nombre ?? ""} ${ejecutivo.primer_apellido ?? ""} ${ejecutivo.segundo_apellido ?? ""}`.trim()
        : `ID ${currentEmployeeId}`;

      const ausenteCedula = String((empleadoAusente as any)?.cedula ?? "");
      const reemplazaCedula = String((empleadoReemplaza as any)?.cedula ?? "");
      const fecha = now.split("T")[0];
      const hora = now.split("T")[1]?.replace("Z", "") || "";
      const fechaAusente =
        ymdFromFecha((existing as any)?.fecha_ausente) ||
        ((marcaAusenteNotif as any)?.fecha ? new Date((marcaAusenteNotif as any).fecha).toISOString().split("T")[0] : "-Sin fecha-");
      const fechaReemplaza =
        ymdFromFecha((existing as any)?.fecha_reemplaza) ||
        ((marcaReemplazaNotif as any)?.fecha ? new Date((marcaReemplazaNotif as any).fecha).toISOString().split("T")[0] : "-Sin fecha-");
      const horaInicioAusente = (marcaAusenteNotif as any)?.hora_inicio ? new Date((marcaAusenteNotif as any).hora_inicio).toISOString().split("T")[1].split(".")[0] : '-Sin hora-';
      const horaInicioReemplaza = (marcaReemplazaNotif as any)?.hora_inicio ? new Date((marcaReemplazaNotif as any).hora_inicio).toISOString().split("T")[1].split(".")[0] : '-Sin hora-';
      const puestoNombreAusente = (puestoAusente as any)?.nombre || "Desconocido";
      const puestoNombreReemplaza = (puestoReemplaza as any)?.nombre || "Desconocido";
      const sucursalNombreAusente = (sucursalAusente as any)?.nombre || "Desconocida";
      const sucursalNombreReemplaza = (sucursalReemplaza as any)?.nombre || "Desconocida";
      const clienteNombreAusente = (clienteAusente as any)?.nombre || "Desconocido";
      const clienteNombreReemplaza = (clienteReemplaza as any)?.nombre || "Desconocido";

      await sendNotificationByEmployee(
        req,
        0,
        [currentEmployeeId],
        `Mutuo acuerdo rechazado`,
        `El mutuo acuerdo fue rechazado por ${ejecutivoNombre} el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acordó cambiar el turno del día ${fechaAusente} a las ${horaInicioAusente} para el puesto ${puestoNombreAusente} (Sucursal ${sucursalNombreAusente} del cliente ${clienteNombreAusente}) por el turno del día ${fechaReemplaza} a las ${horaInicioReemplaza} para el puesto ${puestoNombreReemplaza} (Sucursal ${sucursalNombreReemplaza} del cliente ${clienteNombreReemplaza}) del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
        recipients
      ).catch((error) => {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error sending mutuos-acuerdos reject notification:", msg);
      });
    }

    return NextResponse.json(
      {
        status: true,
        message: "Mutuo acuerdo rechazado correctamente",
        data: { id: updated.id, estado: "rechazado" },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

