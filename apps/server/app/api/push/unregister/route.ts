import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { deactivateFcmDeviceByToken } from "../../../../utils/pushNotifications";

/**
 * POST /api/push/unregister
 * Marca el token FCM como inactivo (logout / revocación local).
 * Body: { token }
 */
export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const empleadoId = Number(payload?.id ?? 0);

    if (!token) {
      return NextResponse.json({ status: false, message: "token requerido" }, { status: 200 });
    }

    const result = await deactivateFcmDeviceByToken(
      req,
      token,
      Number.isFinite(empleadoId) && empleadoId > 0 ? empleadoId : undefined
    );

    return NextResponse.json({
      status: true,
      message: "Dispositivo desregistrado",
      deactivated: result.count,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[push/unregister]", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
