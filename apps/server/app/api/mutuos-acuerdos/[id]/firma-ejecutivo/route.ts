import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../../utils/prismaClient";
import { fetchDynamicFile, uploadDynamicFiles } from "../../../../../utils/callDynamicFilesApi";
import { toZonedTime } from "date-fns-tz";
import { sendNotificationByEmployee } from "../../../../../utils/sendNotification";
import axios from "axios";

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

/** Extrae [hora, minuto] desde un valor Date/string de hora de marca. */
const parseClockParts = (value: unknown): string[] | null => {
  if (value == null || value === "") return null;
  const iso = value instanceof Date ? value.toISOString() : String(value);
  const afterT = iso.includes("T") ? iso.split("T")[1] : iso;
  const parts = afterT.replace(/\.\d+Z?$/i, "").split(":");
  if (parts.length < 2) return null;
  return parts;
};

const formatClockLabel = (value: unknown): string => {
  const parts = parseClockParts(value);
  return parts ? `${parts[0]}:${parts[1]}` : "-Sin hora-";
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
    if (!planillasToken) {
      return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 200 });
    }

    const body = await req.json();
    const firmaDigital = String(body?.firma_ejecutivo_cuenta_digital || "").trim();
    const firmaManual = String(body?.firma_ejecutivo_cuenta_manual || "").trim();
    const horaAccion = parseDateInputToDate(body?.hora_accion);
    if (!firmaDigital || firmaDigital.length < 10 || !firmaManual || firmaManual.length < 10) {
      return NextResponse.json({ status: false, message: "Se requiere la firma digital y la firma manual del ejecutivo" }, { status: 400 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const estadoActual = String((existing as any)?.estado || "").trim().toLowerCase() || "pendiente";
    if (estadoActual !== "pendiente") {
      return NextResponse.json({ status: false, message: "Solo se puede aprobar un mutuo acuerdo pendiente" }, { status: 400 });
    }

    if (existing.firma_ejecutivo_cuenta_digital || existing.firma_ejecutivo_cuenta_manual) {
      return NextResponse.json(
        { status: false, message: "Este mutuo acuerdo ya fue firmado por el ejecutivo" },
        { status: 400 }
      );
    }

    if (!existing.ausente_acepta || !existing.reemplaza_acepta) {
      return NextResponse.json({ status: false, message: "Ambos empleados deben aceptar antes de firmar" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });

    const empleado = await prisma.c_empleado.findUnique({ where: { id: currentEmployeeId } });
    const myEjecutivoCuentaId = empleado?.supervisor_id ?? null;
    const canSign = myEjecutivoCuentaId !== null && Number(myEjecutivoCuentaId) === Number(existing.ejecutivo_cuenta);
    if (!canSign) {
      return NextResponse.json({ status: false, message: "No autorizado para firmar este mutuo acuerdo" }, { status: 403 });
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: {
          firma_ejecutivo_cuenta_manual: firmaManual,
          firma_ejecutivo_cuenta_digital: firmaDigital,
          estado: "aprobado",
        },
      },
    });

    const now = horaAccion ? horaAccion.toISOString() : toZonedTime(new Date(), "America/Costa_Rica").toISOString();

    if (updated) {

      /*
      tipo: MUT
      empleado_reemplaza_id: 
      fecha_reemplaza:
      empleado_ausente_id
      fecha_ausente
      coordinado_por_id
      coordinador_id
      */

      const marcaAusente = await prisma.c_marca_dia.findUnique({ where: { id: Number((existing as any)?.marcaDiaAusente_id || 0) } });
      const marcaReemplaza = await prisma.c_marca_dia.findUnique({ where: { id: Number((existing as any)?.marcaDiaReemplaza_id || 0) } });

      if (!marcaAusente || !marcaReemplaza) {
        return NextResponse.json({ status: false, message: "Marca ausente o reemplaza no encontrada" }, { status: 200 });
      }

      const fechaAusente = new Date(marcaAusente.fecha).toISOString().split("T")[0];
      const fechaReemplaza = new Date(marcaReemplaza.fecha).toISOString().split("T")[0];

      const coordinador = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "n_ejecutivo_cuenta_coordinador",
          operation: "findFirst",
          where: { ejecutivo_cuenta_id: myEjecutivoCuentaId },
        },
      });

      if (!coordinador) {
        return NextResponse.json({ status: false, message: "Coordinador no encontrado" }, { status: 200 });
      }

      const body = {
        tipo: 'MUT',
        empleado_reemplaza_id: updated.empleadoReemplaza_id,
        fecha_reemplaza: fechaReemplaza,
        empleado_ausente_id: updated.empleadoAusente_id,
        fecha_ausente: fechaAusente,
        coordinado_por_id: 3,
        coordinador_id: coordinador.coordinador_id,
      };

      console.log(body);
      
      const planillasResponse = await axios.post(`${process.env.PLANILLAS_URL}/cdg`, body, {
          headers: {
              "Authorization": `Bearer ${planillasToken}`,
              "Content-Type": "application/json"
          }
      });

      if (!planillasResponse.data.success) {
          return NextResponse.json({ status: false, message: "Error al crear el cambio de guardia en Planillas" }, { status: 200 });
      }

      const cambioGuardiaCreated = await prisma.c_cambio_guardia.findUnique({ where: { id: planillasResponse.data.data.id } });

      if (cambioGuardiaCreated) {
        // Actualizar el mutuo acuerdo con el id del cambio de guardia
        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "e_mutuos_acuerdos",
            where: { id: idNum },
            data: {
              cambio_guardia_id: cambioGuardiaCreated.id,
            },
          },
        });
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: idNum,
          cambios: JSON.stringify([
            { prop: "firma_ejecutivo_cuenta_manual", before: existing.firma_ejecutivo_cuenta_manual || null, after: firmaManual },
            { prop: "firma_ejecutivo_cuenta_digital", before: existing.firma_ejecutivo_cuenta_digital || null, after: firmaDigital },
            { prop: "estado", before: (existing as any)?.estado || null, after: "aprobado" },
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
        prisma.c_marca_dia.findUnique({ where: { id: Number((existing as any)?.marcaDiaAusente_id || 0) } }),
        prisma.c_marca_dia.findUnique({ where: { id: Number((existing as any)?.marcaDiaReemplaza_id || 0) } }),
      ]);
      const [puestoAusente, puestoReemplaza] = await Promise.all([
        (marcaAusenteNotif as any)?.puesto_id
          ? prisma.e_estructura_puesto.findUnique({ where: { id: Number((marcaAusenteNotif as any)?.puesto_id) } })
          : null,
        (marcaReemplazaNotif as any)?.puesto_id
          ? prisma.e_estructura_puesto.findUnique({ where: { id: Number((marcaReemplazaNotif as any)?.puesto_id) } })
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
      console.log(5);

      const fechaAusente = (marcaAusenteNotif as any)?.fecha ? new Date((marcaAusenteNotif as any).fecha).toISOString().split("T")[0] : fecha;
      const fechaReemplaza = (marcaReemplazaNotif as any)?.fecha ? new Date((marcaReemplazaNotif as any).fecha).toISOString().split("T")[0] : fecha;
      const horaInicioAusente = (marcaAusenteNotif as any)?.hora_inicio ? new Date((marcaAusenteNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
      const horaInicioReemplaza = (marcaReemplazaNotif as any)?.hora_inicio ? new Date((marcaReemplazaNotif as any).hora_inicio).toISOString().split("T")[1] : hora;
      const puestoNombreAusente = (puestoAusente as any)?.nombre || "Desconocido";
      const puestoNombreReemplaza = (puestoReemplaza as any)?.nombre || "Desconocido";
      console.log(6);
      await sendNotificationByEmployee(
        req,
        0,
        [currentEmployeeId],
        `Mutuo acuerdo aprobado`,
        `El mutuo acuerdo fue aprobado por ${ejecutivoNombre} el día ${fecha} a las ${hora}. El empleado ${ausenteNombre} (cédula ${ausenteCedula || "N/A"}) acordó cambiar el turno del día ${fechaAusente} a las ${horaInicioAusente} para el puesto ${puestoNombreAusente} por el turno del día ${fechaReemplaza} a las ${horaInicioReemplaza} para el puesto ${puestoNombreReemplaza} del empleado ${reemplazaNombre} (cédula ${reemplazaCedula || "N/A"}).`,
        recipients
      ).catch((error) => {
        const msg = error instanceof Error ? error.message : "Error desconocido";
        console.error("Error sending mutuos-acuerdos firma-ejecutivo notification:", msg);
      });
    }

    return NextResponse.json(
      {
        status: true,
        message: "Firmas del ejecutivo guardadas correctamente",
        data: {
          id: updated.id,
          firma_ejecutivo_cuenta_manual: updated.firma_ejecutivo_cuenta_manual,
          firma_ejecutivo_cuenta_digital: updated.firma_ejecutivo_cuenta_digital,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
