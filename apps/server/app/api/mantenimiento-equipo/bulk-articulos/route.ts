/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { reportError } from "../../../../utils/reportError";
import { buildActionEnv } from "../../../../utils/guardifyActions/appEnv";
import { cargarInventarioPuesto } from "../../../../utils/guardifyActions/inventario";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const planillasToken = decodeURIComponent(req.headers.get('Planillas-Token') ?? '') || null;

    if (!planillasToken) {
        await reportError(req, "api/mantenimiento-equipo/bulk-articulos", "POST", 400, "Token de Planillas no encontrado");
        return NextResponse.json({ status: false, message: "Token de Planillas no encontrado" }, { status: 400 });
    }

    const body = await req.json();
    // La lógica (validación, qué se omite y el envío a Planillas) vive en `utils/guardifyActions/inventario.ts`: la comparte la API de cargas de Guardify.
    const res = await cargarInventarioPuesto(buildActionEnv(req, "api/mantenimiento-equipo/bulk-articulos", "POST", { verifyUser: true }), { filas: body?.articulos, planillasToken, modo: "aplicar" });
    if (!res.ok) return NextResponse.json({ status: false, message: res.message, ...(res.errors?.length ? { errors: res.errors } : {}) }, { status: res.status });
    return NextResponse.json({ status: true, message: res.body.message, created_plans: res.body.created_plans, created_entregas: res.body.created_entregas, skipped: res.body.skipped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/mantenimiento-equipo/bulk-articulos:", errorMessage);
    await reportError(req, "api/mantenimiento-equipo/bulk-articulos", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
