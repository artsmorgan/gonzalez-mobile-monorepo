import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { parseIntStrict } from "../../../../../utils/mutuosAcuerdosMarcas";
import { reportError } from "../../../../../utils/reportError";
import { buildActionEnv } from "../../../../../utils/guardifyActions/appEnv";
import { parseDateInput } from "../../../../../utils/guardifyActions/env";
import { rechazarMutuoAcuerdo } from "../../../../../utils/guardifyActions/mutuos";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });

    const { id } = await context.params;
    const idNum = parseIntStrict(id);
    if (!idNum) {
      await reportError(req, "api/mutuos-acuerdos/[id]/reject", "PUT", 400, "ID inválido");
      return NextResponse.json({ status: false, message: "ID inválido" }, { status: 400 });
    }

    const currentEmployeeId = parseIntStrict((payload as any)?.id) ?? 0;
    const body = await req.json().catch(() => ({}));
    // La lógica (reglas, bitácora y notificación) vive en `utils/guardifyActions/mutuos.ts`: la comparte la API de acciones de Guardify.
    const res = await rechazarMutuoAcuerdo(buildActionEnv(req, "api/mutuos-acuerdos/[id]/reject", "PUT", { verifyUser: true }), { id: idNum, actorId: currentEmployeeId, horaAccion: parseDateInput((body as any)?.hora_accion) });
    if (!res.ok) return NextResponse.json({ status: false, message: res.message }, { status: res.status });
    return NextResponse.json(res.body, { status: res.status });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    await reportError(req, "api/mutuos-acuerdos/[id]/reject", "PUT", 400, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}
