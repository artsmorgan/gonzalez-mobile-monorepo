import { NextRequest } from "next/server";
import { toZonedTime } from "date-fns-tz";
import { callDynamicPrisma } from "./callDynamicPrisma";
import { getFirebaseMessaging } from "./firebaseAdmin";

export type PushDataPayload = Record<string, string>;

export type SendPushParams = {
  title: string;
  body: string;
  data?: PushDataPayload;
  /** Canal Android sugerido (general | procesos). */
  channelId?: "general" | "procesos";
};

const TABLE = "a_mobile_fcm_device";

const INVALID_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

function nowCostaRica(): Date {
  return toZonedTime(new Date(), "America/Costa_Rica");
}

function normalizeData(data?: PushDataPayload): PushDataPayload {
  const out: PushDataPayload = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[String(key)] = String(value);
  }
  return out;
}

export async function deactivateFcmTokens(req: NextRequest, tokens: string[]): Promise<void> {
  const unique = Array.from(new Set(tokens.map((t) => String(t || "").trim()).filter(Boolean)));
  if (unique.length === 0) return;
  await callDynamicPrisma({
    req,
    data: {
      action: "UPDATE",
      table: TABLE,
      operation: "updateMany",
      many: true,
      where: { token: { in: unique } },
      data: { activo: false, updated_at: nowCostaRica() },
      select: { id: true },
    },
  });
}

async function sendToTokens(
  req: NextRequest,
  tokens: string[],
  params: SendPushParams
): Promise<{ sent: number; failed: number }> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.warn("[pushNotifications] Firebase Messaging no disponible; omitiendo envío FCM");
    return { sent: 0, failed: 0 };
  }

  const unique = Array.from(new Set(tokens.map((t) => String(t || "").trim()).filter(Boolean)));
  if (unique.length === 0) return { sent: 0, failed: 0 };

  const data = normalizeData({
    ...(params.data || {}),
    channelId: params.channelId || "general",
  });

  const channelId = params.channelId || "general";
  let sent = 0;
  let failed = 0;
  const invalid: string[] = [];

  // Envío en lotes de 500 (límite FCM multicast)
  const chunkSize = 500;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: params.title,
          body: params.body,
        },
        data,
        android: {
          priority: "high",
          notification: {
            channelId,
            sound: "default",
          },
        },
      });

      response.responses.forEach((res, idx) => {
        if (res.success) {
          sent += 1;
          return;
        }
        failed += 1;
        const code = String(res.error?.code || "");
        if (INVALID_TOKEN_CODES.has(code)) {
          invalid.push(chunk[idx]);
        } else {
          console.warn("[pushNotifications] Error FCM:", code, res.error?.message);
        }
      });
    } catch (error) {
      failed += chunk.length;
      console.error("[pushNotifications] Error sendEachForMulticast:", error);
    }
  }

  if (invalid.length > 0) {
    await deactivateFcmTokens(req, invalid);
  }

  return { sent, failed };
}

/** Dispositivos activos para empleado (+ plaza opcional). */
export async function findActiveFcmTokens(
  req: NextRequest,
  params: {
    empleadoId?: number | number[];
    plazaId?: number | number[] | null;
    /** Si true y hay plazaId, exige coincidencia exacta de plaza. */
    requirePlazaMatch?: boolean;
  }
): Promise<string[]> {
  const empleadoIds = Array.isArray(params.empleadoId)
    ? params.empleadoId.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : params.empleadoId != null
      ? [Number(params.empleadoId)].filter((n) => Number.isFinite(n) && n > 0)
      : [];

  const plazaIdsRaw = Array.isArray(params.plazaId)
    ? params.plazaId
    : params.plazaId != null
      ? [params.plazaId]
      : [];
  const plazaIds = plazaIdsRaw.map(Number).filter((n) => Number.isFinite(n) && n > 0);

  if (empleadoIds.length === 0 && plazaIds.length === 0) return [];

  const where: Record<string, unknown> = { activo: true };

  if (empleadoIds.length > 0) {
    where.empleado_id = empleadoIds.length === 1 ? empleadoIds[0] : { in: empleadoIds };
  }

  if (params.requirePlazaMatch && plazaIds.length > 0) {
    where.plaza_id = plazaIds.length === 1 ? plazaIds[0] : { in: plazaIds };
  } else if (plazaIds.length > 0 && empleadoIds.length === 0) {
    where.plaza_id = plazaIds.length === 1 ? plazaIds[0] : { in: plazaIds };
  }

  const rows = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: TABLE,
      operation: "findMany",
      where,
      select: { token: true },
    },
  });

  const list = Array.isArray(rows) ? rows : [];
  return list.map((r: { token?: string }) => String(r?.token || "")).filter(Boolean);
}

export async function sendPushToEmpleado(
  req: NextRequest,
  empleadoId: number,
  params: SendPushParams & { plazaId?: number | null }
): Promise<{ sent: number; failed: number }> {
  const eid = Number(empleadoId);
  if (!Number.isFinite(eid) || eid <= 0) return { sent: 0, failed: 0 };

  const plazaId =
    params.plazaId != null && Number.isFinite(Number(params.plazaId)) && Number(params.plazaId) > 0
      ? Number(params.plazaId)
      : null;

  const tokens = await findActiveFcmTokens(req, {
    empleadoId: eid,
    plazaId,
    requirePlazaMatch: plazaId != null,
  });

  return sendToTokens(req, tokens, params);
}

export async function sendPushToEmpleados(
  req: NextRequest,
  empleadoIds: number[],
  params: SendPushParams
): Promise<{ sent: number; failed: number }> {
  const tokens = await findActiveFcmTokens(req, { empleadoId: empleadoIds });
  return sendToTokens(req, tokens, params);
}

export async function sendPushToPlazas(
  req: NextRequest,
  plazaIds: number[],
  params: SendPushParams
): Promise<{ sent: number; failed: number }> {
  const tokens = await findActiveFcmTokens(req, { plazaId: plazaIds });
  return sendToTokens(req, tokens, params);
}

export type UpsertFcmDeviceInput = {
  empleado_id: number;
  plaza_id?: number | null;
  token: string;
  platform: string;
  device_id?: string | null;
  app_version?: string | null;
  app_variant?: string | null;
};

export async function upsertFcmDevice(req: NextRequest, input: UpsertFcmDeviceInput) {
  const token = String(input.token || "").trim();
  const empleado_id = Number(input.empleado_id);
  if (!token || !Number.isFinite(empleado_id) || empleado_id <= 0) {
    throw new Error("empleado_id y token son requeridos");
  }

  const plaza_id =
    input.plaza_id != null && Number.isFinite(Number(input.plaza_id)) && Number(input.plaza_id) > 0
      ? Number(input.plaza_id)
      : null;

  const now = nowCostaRica();
  const platform = String(input.platform || "android").toLowerCase().slice(0, 20);
  const device_id = input.device_id != null ? String(input.device_id).slice(0, 255) : null;
  const app_version = input.app_version != null ? String(input.app_version).slice(0, 50) : null;
  const app_variant = input.app_variant != null ? String(input.app_variant).slice(0, 20) : null;

  const existing = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: TABLE,
      operation: "findFirst",
      where: { token },
    },
  });

  if (existing?.id) {
    return callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: TABLE,
        operation: "update",
        where: { id: existing.id },
        data: {
          empleado_id,
          plaza_id,
          platform,
          device_id,
          app_version,
          app_variant,
          activo: true,
          updated_at: now,
        },
      },
    });
  }

  return callDynamicPrisma({
    req,
    data: {
      action: "POST",
      table: TABLE,
      operation: "create",
      data: {
        empleado_id,
        plaza_id,
        token,
        platform,
        device_id,
        app_version,
        app_variant,
        activo: true,
        created_at: now,
        updated_at: now,
      },
    },
  });
}

export async function deactivateFcmDeviceByToken(
  req: NextRequest,
  token: string,
  empleadoId?: number
) {
  const t = String(token || "").trim();
  if (!t) return { count: 0 };
  const where: Record<string, unknown> = { token: t };
  if (empleadoId != null && Number.isFinite(Number(empleadoId)) && Number(empleadoId) > 0) {
    where.empleado_id = Number(empleadoId);
  }

  const rows = await callDynamicPrisma({
    req,
    data: {
      action: "UPDATE",
      table: TABLE,
      operation: "updateMany",
      many: true,
      where,
      data: { activo: false, updated_at: nowCostaRica() },
      select: { id: true },
    },
  });

  const count = Array.isArray(rows) ? rows.length : 0;
  return { count };
}
