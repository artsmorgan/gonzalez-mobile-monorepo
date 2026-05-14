import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
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
        return NextResponse.json({ status: false, message: "No autorizado para aceptar como ausente" }, { status: 403 });
      }
      if (existing.ausente_acepta) {
        return NextResponse.json({ status: true, message: "El ausente ya había aceptado", data: existing }, { status: 200 });
      }
      if (!firmaAusenteNorm || firmaAusenteNorm.length < 80) {
        return NextResponse.json({ status: false, message: "La firma manual del ausente es obligatoria" }, { status: 400 });
      }
      updateData = { ausente_acepta: true, ausente_acepta_at: now, firma_ausente_manual: firmaAusenteNorm };
      cambios = [
        { prop: "ausente_acepta", before: existing.ausente_acepta, after: true },
        { prop: "ausente_acepta_at", before: existing.ausente_acepta_at || null, after: now },
        { prop: "firma_ausente_manual", before: existing.firma_ausente_manual || null, after: "[base64]" },
      ];
    } else {
      if (Number(existing.empleadoReemplaza_id) !== currentEmployeeId) {
        return NextResponse.json({ status: false, message: "No autorizado para aceptar como reemplaza" }, { status: 403 });
      }
      if (existing.reemplaza_acepta) {
        return NextResponse.json({ status: true, message: "El reemplaza ya había aceptado", data: existing }, { status: 200 });
      }
      if (!firmaReemplazaNorm || firmaReemplazaNorm.length < 80) {
        return NextResponse.json({ status: false, message: "La firma manual del reemplaza es obligatoria" }, { status: 400 });
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

    return NextResponse.json({ status: true, message: "Aceptación registrada correctamente", data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

