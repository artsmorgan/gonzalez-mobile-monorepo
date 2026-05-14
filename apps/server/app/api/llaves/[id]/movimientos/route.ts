/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../../utils/sendNotification";
import { toZonedTime } from "date-fns-tz";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Acepta HH:mm:ss, H:mm:ss o ISO con T; devuelve cadena normalizada para e_movimiento_llave.hora */
function normalizeHoraMovimientoInput(value: any): { ok: true; horaNormalized: string } | { ok: false } {
  if (value == null || String(value).trim() === "") return { ok: false };
  let s = String(value).trim();
  if (s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      return { ok: true, horaNormalized: `1970-01-01T${hh}:${mm}:${ss}.000Z` };
    }
    s = s.split("T")[1]?.split(".")[0] || "";
  }
  const parts = s.split(":");
  if (parts.length < 2) return { ok: false };
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
  const sec = String(parseInt(parts[2] ?? "0", 10) || 0).padStart(2, "0");
  const tryD = new Date(`1970-01-01T${h}:${m}:${sec}`);
  if (isNaN(tryD.getTime())) return { ok: false };
  return { ok: true, horaNormalized: `1970-01-01T${h}:${m}:${sec}.000Z` };
}

async function getMarcaDiaOrFail(req: NextRequest, marcaId: number) {
  const marcaDia = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: marcaId } }
  });
  if (!marcaDia) return { ok: false as const, marcaDia: null, message: "Marca no encontrada" };
  if (!marcaDia.empleadoFijo_id) return { ok: false as const, marcaDia: null, message: "Empleado no encontrado" };

  const lastMarca = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "c_marca_dia",
      operation: "findFirst",
      where: { empleadoFijo_id: marcaDia.empleadoFijo_id },
      orderBy: [{ fecha: "desc" }, { hora_inicio: "desc" }]
    }
  });
  if (!lastMarca) return { ok: false as const, marcaDia: null, message: "No se encontró la última marca" };
  return { ok: true as const, marcaDia, message: "" };
}

async function validateLlaveOwnership(req: NextRequest, llaveId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(req, marcaId);
  if (!marcaRes.ok) return { ok: false as const, llave: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const llave = await callDynamicPrisma({
    req,
    data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id: llaveId } }
  });
  if (!llave) return { ok: false as const, llave: null, message: "Llave no encontrada" };
  if (llave.cliente_id !== marcaDia.cliente_id) {
    return { ok: false as const, llave: null, message: "No autorizado" };
  }
  return { ok: true as const, llave, message: "" };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    if (!llaveId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    const marcaId = parseInt(marcaIdStr);

    const own = await validateLlaveOwnership(req, llaveId, marcaId);
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_movimiento_llave",
        operation: "findMany",
        where: { llave_id: llaveId },
        orderBy: { id: "desc" }
      }
    });

    return NextResponse.json({ status: true, data: rows }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/llaves/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const llaveId = parseInt(resolvedParams.id);
    if (!llaveId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const llave = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id: llaveId } }
    });
    if (!llave) return NextResponse.json({ status: false, message: "Llave no encontrada" }, { status: 200 });

    const body = await req.json();
    const {
      marca_id,
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      fecha,
      hora,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    } = body ?? {};

    if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateLlaveOwnership(req, llaveId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = parseDateOnly(fecha);
    const horaNormRes = normalizeHoraMovimientoInput(hora);
    if (!fechaDate || !horaNormRes.ok) return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 500 });
    const horaNormalized = horaNormRes.horaNormalized;

    const requiredStrings = [
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      firma_responsable,
    ];
    if (requiredStrings.some((v) => typeof v !== "string" || v.trim().length === 0)) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "e_movimiento_llave",
        data: {
          llave_id: llaveId,
          nombre_persona_recibe: String(nombre_persona_recibe),
          nombre_persona_entrega: String(nombre_persona_entrega),
          departamento: String(departamento),
          telefono: String(telefono),
          fecha: fechaDate.toISOString(),
          // Guardar la hora como cadena HH:mm:ss sin desplazamiento por zona horaria
          hora: horaNormalized,
          firma_entrega:
            firma_entrega != null && typeof firma_entrega === "string" && firma_entrega.trim().length > 0
              ? firma_entrega.trim()
              : null,
          firma_recibe:
            firma_recibe != null && typeof firma_recibe === "string" && firma_recibe.trim().length > 0
              ? firma_recibe.trim()
              : null,
          firma_responsable: String(firma_responsable),
        }
      }
    });

    if (created) {

      let sucursalNombre = "Desconocida";

      let fechaRegistro = fechaDate.toISOString().split("T")[0];
      let horaRegistro = horaNormalized;

      if (llave.corpo_id) {
        const sucursal = await callDynamicPrisma({
          req,
          data: { action: "GET", table: "e_estructura_sucursal", operation: "findUnique", where: { id: llave.corpo_id } }
        });
        if (sucursal) {
          sucursalNombre = sucursal.nombre;
        }
      }

      const description = "Se ha registrado un movimiento de la llave " + llave.numero_llave + " (" + llave.cantidad_copias + " copias) de la sucursal " + sucursalNombre + " el día " + fechaRegistro + " a las " + horaRegistro + "(Del empleado " + nombre_persona_entrega + " a " + nombre_persona_recibe + ")";
      await sendNotificationByRole(req, llave.corpo_id, [], "Movimiento de llave registrado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Registrar cambio de creación
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_movimiento_llave",
          registro_id: created.id,
          cambios: JSON.stringify([{
            prop: "__created__",
            before: null,
            after: {
              id: created.id,
              llave_id: created.llave_id,
              nombre_persona_recibe: created.nombre_persona_recibe,
              nombre_persona_entrega: created.nombre_persona_entrega,
              departamento: created.departamento,
              telefono: created.telefono,
              fecha: created.fecha instanceof Date ? created.fecha.toISOString() : created.fecha,
              hora: created.hora instanceof Date ? created.hora.toISOString() : created.hora,
              firma_entrega: created.firma_entrega,
              firma_recibe: created.firma_recibe,
              firma_responsable: created.firma_responsable,
            },
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    return NextResponse.json(
      { status: true, message: "Movimiento creado correctamente", id: created.id },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/llaves/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


