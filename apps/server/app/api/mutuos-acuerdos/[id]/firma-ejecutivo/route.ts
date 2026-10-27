import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../../utils/reportError";
import { buildActionEnv } from "../../../../../utils/guardifyActions/appEnv";
import { aprobarMutuoAcuerdo } from "../../../../../utils/guardifyActions/aprobar-mutuo";

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
    if (!idNum) {
      await reportError(req, "api/mutuos-acuerdos/[id]/firma-ejecutivo", "PUT", 400, "ID inválido");
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;
    if (!planillasToken) {
      await reportError(req, "api/mutuos-acuerdos/[id]/firma-ejecutivo", "PUT", 400, "Token de Planillas no encontrado");
      return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 400 });
    }

    const body = await req.json();
    // La lógica (reglas, firmas, cambio de guardia en Planillas, bitácora y notificación) vive en `utils/guardifyActions/aprobar-mutuo.ts`: la comparte la API de acciones de Guardify.
    const res = await aprobarMutuoAcuerdo(buildActionEnv(req, "api/mutuos-acuerdos/[id]/firma-ejecutivo", "PUT", { verifyUser: true }), {
      id: idNum,
      actorId: parseIntStrict((payload as any)?.id) ?? 0,
      firmaDigital: String(body?.firma_ejecutivo_cuenta_digital || ""),
      firmaManual: String(body?.firma_ejecutivo_cuenta_manual || ""),
      horaAccion: parseDateInputToDate(body?.hora_accion),
      planillasToken,
    });
    if (!res.ok) return NextResponse.json({ status: false, message: res.message }, { status: res.status });
    return NextResponse.json(res.body, { status: res.status });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/mutuos-acuerdos/[id]/firma-ejecutivo", "PUT", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
