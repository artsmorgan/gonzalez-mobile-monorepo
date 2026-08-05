import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import {
  type SendPushResult,
  sendPushToEmpleado,
  sendPushToEmpleados,
  sendPushToPlazas,
} from "../../../../utils/pushNotifications";

/**
 * POST /api/push/send
 * Envía una notificación push de prueba / operativa.
 * Body:
 * {
 *   title, body,
 *   data?: { type, id, action, ... },
 *   channelId?: "general" | "procesos",
 *   empleado_id?: number,
 *   plaza_id?: number,
 *   empleado_ids?: number[],
 *   plaza_ids?: number[]
 * }
 */
export async function POST(req: NextRequest) {
  console.log("[push/send] request received");
  try {
    const {
      valid,
      expired,
      message: authMessage,
    } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message: authMessage },
        { status: expired ? 401 : 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();
    const pushBody = String(body?.body ?? body?.description ?? "").trim();
    if (!title || !pushBody) {
      return NextResponse.json(
        { status: false, message: "title y body son requeridos" },
        { status: 200 }
      );
    }

    const channelId = body?.channelId === "procesos" ? "procesos" : "general";
    const data: Record<string, string> = {};
    if (body?.data && typeof body.data === "object") {
      for (const [k, v] of Object.entries(body.data)) {
        if (v == null) continue;
        data[String(k)] = String(v);
      }
    }

    const params = { title, body: pushBody, data, channelId: channelId as "general" | "procesos" };

    let result: SendPushResult = {
      sent: 0,
      failed: 0,
      tokensTargeted: 0,
      firebaseConfigured: true,
    };

    if (body?.empleado_id != null && body?.plaza_id != null) {
      result = await sendPushToEmpleado(req, Number(body.empleado_id), {
        ...params,
        plazaId: Number(body.plaza_id),
      });
    } else if (body?.empleado_id != null) {
      result = await sendPushToEmpleado(req, Number(body.empleado_id), params);
    } else if (Array.isArray(body?.empleado_ids) && body.empleado_ids.length > 0) {
      result = await sendPushToEmpleados(req, body.empleado_ids.map(Number), params);
    } else if (Array.isArray(body?.plaza_ids) && body.plaza_ids.length > 0) {
      result = await sendPushToPlazas(req, body.plaza_ids.map(Number), params);
    } else if (body?.plaza_id != null) {
      result = await sendPushToPlazas(req, [Number(body.plaza_id)], params);
    } else {
      return NextResponse.json(
        {
          status: false,
          message: "Indica empleado_id, empleado_ids, plaza_id o plaza_ids",
        },
        { status: 200 }
      );
    }

    const ok =
      result.firebaseConfigured &&
      result.tokensTargeted > 0 &&
      result.sent > 0 &&
      result.failed === 0;

    let responseMessage = "Push enviado";
    if (!result.firebaseConfigured) {
      responseMessage =
        "Firebase Admin no configurado en este servidor (revisa FIREBASE_* en el entorno donde corre la API)";
    } else if (result.tokensTargeted === 0) {
      responseMessage = "No hay tokens FCM activos para el destinatario indicado";
    } else if (result.sent === 0 && result.failed > 0) {
      responseMessage =
        "FCM rechazó todos los tokens (¿service account de otro proyecto Firebase que google-services.json?)";
    } else if (result.failed > 0) {
      responseMessage = "Push parcial: algunos tokens fallaron";
    }

    console.log("[push/send]", {
      ok,
      responseMessage,
      ...result,
    });
    return NextResponse.json({
      status: ok,
      message: responseMessage,
      ...result,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[push/send]", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
