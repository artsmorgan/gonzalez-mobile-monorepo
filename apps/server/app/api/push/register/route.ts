import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { upsertFcmDevice } from "../../../../utils/pushNotifications";

/**
 * POST /api/push/register
 * Registra o actualiza el token FCM del dispositivo para el empleado autenticado.
 * Body: { token, platform, plaza_id?, device_id?, app_version?, app_variant? }
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
    const platform = String(body?.platform ?? "android").trim().toLowerCase();
    const plazaRaw = body?.plaza_id;
    const plaza_id =
      plazaRaw != null && plazaRaw !== "" && Number.isFinite(Number(plazaRaw)) && Number(plazaRaw) > 0
        ? Number(plazaRaw)
        : null;

    const empleadoFromToken = Number(payload?.id ?? payload?.empleado_id ?? 0);
    const empleadoFromBody = Number(body?.empleado_id ?? 0);
    const empleado_id =
      Number.isFinite(empleadoFromToken) && empleadoFromToken > 0
        ? empleadoFromToken
        : empleadoFromBody;

    if (!Number.isFinite(empleado_id) || empleado_id <= 0) {
      return NextResponse.json(
        { status: false, message: "empleado_id no disponible en la sesión" },
        { status: 200 }
      );
    }

    if (!token) {
      return NextResponse.json({ status: false, message: "token requerido" }, { status: 200 });
    }

    // Evitar que un cliente registre tokens a nombre de otro empleado
    if (
      Number.isFinite(empleadoFromBody) &&
      empleadoFromBody > 0 &&
      empleadoFromBody !== empleado_id
    ) {
      return NextResponse.json(
        { status: false, message: "empleado_id no coincide con la sesión" },
        { status: 200 }
      );
    }

    const device = await upsertFcmDevice(req, {
      empleado_id,
      plaza_id,
      token,
      platform: platform || "android",
      device_id: body?.device_id != null ? String(body.device_id) : null,
      app_version: body?.app_version != null ? String(body.app_version) : null,
      app_variant: body?.app_variant != null ? String(body.app_variant) : null,
    });

    return NextResponse.json({
      status: true,
      message: "Dispositivo registrado",
      device: {
        id: device.id,
        empleado_id: device.empleado_id,
        plaza_id: device.plaza_id,
        platform: device.platform,
        app_variant: device.app_variant,
        activo: device.activo,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[push/register]", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
