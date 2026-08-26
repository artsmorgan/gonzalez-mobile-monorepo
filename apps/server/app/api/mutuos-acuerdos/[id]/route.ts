/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { sendNotificationByEmployee } from "../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

const parseIntStrict = (value: any) => {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

/** Acepta data URL o base64 crudo; devuelve solo el payload base64 sin espacios. */
const normalizeParticipantManual = (input: unknown): string => {
  const s = String(input ?? "").trim();
  if (!s) return "";
  const idx = s.indexOf("base64,");
  if (s.toLowerCase().startsWith("data:image/") && idx !== -1) {
    return s.slice(idx + "base64,".length).replace(/\s+/g, "");
  }
  return s.replace(/\s+/g, "");
};

async function notifyEjecutivoBothParticipantsAccepted(
  req: NextRequest,
  existing: any,
  updated: any,
): Promise<void> {
  const bothAccepted = Boolean(updated?.ausente_acepta) && Boolean(updated?.reemplaza_acepta);
  if (!bothAccepted) return;

  const ejecutivoCuentaId = parseIntStrict(existing?.ejecutivo_cuenta);
  if (!ejecutivoCuentaId) return;

  const empleadosEjecutivos = await prisma.c_empleado.findMany({
    where: { supervisor_id: ejecutivoCuentaId },
    select: { id: true },
  });
  const employeeIds = (empleadosEjecutivos || [])
    .map((e) => e.id)
    .filter((id) => Number.isFinite(id) && id > 0);
  if (employeeIds.length === 0) return;

  const [empleadoAusente, empleadoReemplaza] = await Promise.all([
    parseIntStrict(existing.empleadoAusente_id)
      ? prisma.c_empleado.findUnique({ where: { id: Number(existing.empleadoAusente_id) } })
      : Promise.resolve(null),
    parseIntStrict(existing.empleadoReemplaza_id)
      ? prisma.c_empleado.findUnique({ where: { id: Number(existing.empleadoReemplaza_id) } })
      : Promise.resolve(null),
  ]);

  const ausenteNombre = empleadoAusente
    ? `${empleadoAusente.nombre ?? ""} ${empleadoAusente.primer_apellido ?? ""} ${empleadoAusente.segundo_apellido ?? ""}`.trim()
    : `ID ${existing.empleadoAusente_id}`;
  const reemplazaNombre = empleadoReemplaza
    ? `${empleadoReemplaza.nombre ?? ""} ${empleadoReemplaza.primer_apellido ?? ""} ${empleadoReemplaza.segundo_apellido ?? ""}`.trim()
    : `ID ${existing.empleadoReemplaza_id}`;

  const now = toZonedTime(new Date(), "America/Costa_Rica");
  const fecha = now.toISOString().split("T")[0];
  const hora = now.toISOString().split("T")[1]?.split(".")[0] ?? "";

  await sendNotificationByEmployee(
    req,
    0,
    [],
    "Mutuo acuerdo listo para firmar",
    `Ambos involucrados aceptaron el mutuo acuerdo #${existing.id} el día ${fecha} a las ${hora}. ` +
      `Participantes: ${ausenteNombre} y ${reemplazaNombre}. Pendiente de firma del ejecutivo de cuenta.`,
    employeeIds,
  ).catch((error) => {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error sending mutuos-acuerdos both-accepted notification:", msg);
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });

    const body = await req.json();
    const role = String(body?.role || "").trim().toLowerCase();
    if (role !== "ausente" && role !== "reemplaza") {
      return NextResponse.json({ status: false, message: "Role inválido" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id);
    if (!currentEmployeeId) return NextResponse.json({ status: false, message: "Empleado inválido" }, { status: 400 });

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_mutuos_acuerdos", operation: "findUnique", where: { id: idNum } },
    });
    if (!existing) return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });

    const now = toZonedTime(new Date(), "America/Costa_Rica").toISOString();
    let updateData: any = {};
    let cambios: any[] = [];

    const firmaAusenteNorm = normalizeParticipantManual(body?.firma_ausente_manual);
    const firmaReemplazaNorm = normalizeParticipantManual(body?.firma_reemplaza_manual);

    if (role === "ausente") {
      if (Number(existing.empleadoAusente_id) !== currentEmployeeId) {
        return NextResponse.json({ status: false, message: "No autorizado para aceptar como primer turno" }, { status: 403 });
      }
      if (existing.ausente_acepta) {
        return NextResponse.json({ status: true, message: "El primer turno ya había aceptado", data: existing }, { status: 200 });
      }
      if (!firmaAusenteNorm || firmaAusenteNorm.length < 80) {
        return NextResponse.json({ status: false, message: "La firma manual del primer turno es obligatoria" }, { status: 400 });
      }
      updateData = { ausente_acepta: true, ausente_acepta_at: now, firma_ausente_manual: firmaAusenteNorm };
      cambios = [
        { prop: "ausente_acepta", before: existing.ausente_acepta, after: true },
        { prop: "ausente_acepta_at", before: existing.ausente_acepta_at || null, after: now },
        { prop: "firma_ausente_manual", before: existing.firma_ausente_manual || null, after: "[base64]" },
      ];
    } else {
      if (Number(existing.empleadoReemplaza_id) !== currentEmployeeId) {
        return NextResponse.json({ status: false, message: "No autorizado para aceptar como segundo turno" }, { status: 403 });
      }
      if (existing.reemplaza_acepta) {
        return NextResponse.json({ status: true, message: "El segundo turno ya había aceptado", data: existing }, { status: 200 });
      }
      if (!firmaReemplazaNorm || firmaReemplazaNorm.length < 80) {
        return NextResponse.json({ status: false, message: "La firma manual del segundo turno es obligatoria" }, { status: 400 });
      }
      updateData = { reemplaza_acepta: true, reemplaza_acepta_at: now, firma_reemplaza_manual: firmaReemplazaNorm };
      cambios = [
        { prop: "reemplaza_acepta", before: existing.reemplaza_acepta, after: true },
        { prop: "reemplaza_acepta_at", before: existing.reemplaza_acepta_at || null, after: now },
        { prop: "firma_reemplaza_manual", before: existing.firma_reemplaza_manual || null, after: "[base64]" },
      ];
    }

    const updated = await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_mutuos_acuerdos",
        where: { id: idNum },
        data: updateData,
      },
    });

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_mutuos_acuerdos",
          registro_id: idNum,
          cambios: JSON.stringify(cambios),
          created_at: now,
          created_by: currentEmployeeId,
        },
      },
    });

    // Notificar al ejecutivo solo cuando ambos involucrados hayan firmado.
    await notifyEjecutivoBothParticipantsAccepted(req, existing, updated);

    return NextResponse.json({ status: true, message: "Aceptación registrada correctamente", data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
