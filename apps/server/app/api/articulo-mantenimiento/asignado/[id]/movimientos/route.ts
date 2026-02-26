/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../../../utils/callDynamicPrisma";
import { sendNotificationByRole } from "../../../../../../utils/sendNotification";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseTimeOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`1970-01-01T${s}`);
  if (isNaN(d.getTime())) return null;
  return d;
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
  if (marcaDia.id !== lastMarca.id) return { ok: false as const, marcaDia: null, message: "Hay una nueva marca más reciente" };
  return { ok: true as const, marcaDia, message: "" };
}

async function validateAsignadoOwnership(req: NextRequest, asignadoId: number, marcaId: number) {
  const marcaRes = await getMarcaDiaOrFail(req, marcaId);
  if (!marcaRes.ok) return { ok: false as const, asignado: null, marcaDia: null, message: marcaRes.message };
  const marcaDia = marcaRes.marcaDia!;

  const asignado = await callDynamicPrisma({
    req,
    data: {
      action: "GET",
      table: "e_estructura_articulo_corpo_puesto_entrega",
      operation: "findUnique",
      where: { id: asignadoId },
      include: { e_estructura_sucursal: true, e_estructura_puesto: true }
    }
  });
  if (!asignado) return { ok: false as const, asignado: null, marcaDia: null, message: "Artículo asignado no encontrado" };

  if (asignado.puesto_id && marcaDia.puesto_id && asignado.puesto_id !== marcaDia.puesto_id) {
    return { ok: false as const, asignado: null, marcaDia: null, message: "No autorizado" };
  }
  if (asignado.corpo_id && marcaDia.corpo_id && asignado.corpo_id !== marcaDia.corpo_id) {
    return { ok: false as const, asignado: null, marcaDia: null, message: "No autorizado" };
  }

  return { ok: true as const, asignado, marcaDia, message: "" };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const asignadoId = parseInt(resolvedParams.id);
    if (!asignadoId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    const marcaId = parseInt(marcaIdStr);

    const own = await validateAsignadoOwnership(req, asignadoId, marcaId);
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const rows = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_movimientos_articulo_mantenimiento",
        operation: "findMany",
        where: { articulo_asignado_id: asignadoId },
        orderBy: { id: "desc" }
      }
    });

    return NextResponse.json({ status: true, data: rows }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/articulo-mantenimiento/asignado/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const asignadoId = parseInt(resolvedParams.id);
    if (!asignadoId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const body = await req.json();
    const {
      marca_id,
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      entrega,
      recibe,
      fecha,
      hora,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    } = body ?? {};

    if (!marca_id) return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });

    const own = await validateAsignadoOwnership(req, asignadoId, parseInt(String(marca_id)));
    if (!own.ok) return NextResponse.json({ status: false, message: own.message }, { status: 200 });

    const fechaDate = parseDateOnly(fecha);
    const horaDate = parseTimeOnly(hora);
    if (!fechaDate || !horaDate) return NextResponse.json({ status: false, message: "Fecha u hora inválida" }, { status: 200 });

    const requiredStrings = [
      nombre_persona_recibe,
      nombre_persona_entrega,
      departamento,
      telefono,
      entrega,
      recibe,
      firma_entrega,
      firma_recibe,
      firma_responsable,
    ];
    if (requiredStrings.some((v) => typeof v !== "string" || v.trim().length === 0)) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    const created = await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_movimientos_articulo_mantenimiento",
        data: {
          articulo_plan_id: null,
          articulo_asignado_id: asignadoId,
          nombre_persona_recibe: String(nombre_persona_recibe),
          nombre_persona_entrega: String(nombre_persona_entrega),
          departamento: String(departamento),
          telefono: String(telefono),
          entrega: String(entrega),
          recibe: String(recibe),
          fecha: fechaDate.toISOString(),
          hora: horaDate.toISOString(),
          firma_entrega: String(firma_entrega),
          firma_recibe: String(firma_recibe),
          firma_responsable: String(firma_responsable),
        }
      }
    });

    if (created) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      const cambiosArr: Array<{ prop: string; before: any; after: any }> = [
        { prop: "__created__", before: null, after: true },
        { prop: "articulo_plan_id", before: null, after: null },
        { prop: "articulo_asignado_id", before: null, after: asignadoId },
        { prop: "nombre_persona_recibe", before: null, after: String(nombre_persona_recibe) },
        { prop: "nombre_persona_entrega", before: null, after: String(nombre_persona_entrega) },
        { prop: "departamento", before: null, after: String(departamento) },
        { prop: "telefono", before: null, after: String(telefono) },
        { prop: "entrega", before: null, after: String(entrega) },
        { prop: "recibe", before: null, after: String(recibe) },
        { prop: "fecha", before: null, after: fechaDate.toISOString() },
        { prop: "hora", before: null, after: horaDate.toISOString() },
      ];
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "c_movimientos_articulo_mantenimiento",
            registro_id: created.id,
            cambios: JSON.stringify(cambiosArr),
            created_at: new Date().toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    if (created) {
      const sucursalNombre = own.asignado?.e_estructura_sucursal?.nombre ?? "Desconocida";
      const puestoNombre = own.asignado?.e_estructura_puesto?.nombre ?? "Desconocido";

      const fechaRegistro = fechaDate.toISOString().split("T")[0];
      const horaRegistro = horaDate.toISOString().split("T")[1].split(".")[0];

      const description = `Se ha registrado un movimiento del artículo (Asignado) del puesto ${puestoNombre} de la sucursal ${sucursalNombre} el día ${fechaRegistro} a las ${horaRegistro} (Del empleado ${nombre_persona_entrega} a ${nombre_persona_recibe})`;
      if (own.asignado?.corpo_id) {
        await sendNotificationByRole(req, own.asignado.corpo_id, [], "Movimiento de artículo registrado", description, ["ADMINISTRATIVO", "SUPERVISOR"]);
      }
    }

    return NextResponse.json({ status: true, message: "Movimiento creado correctamente", id: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/articulo-mantenimiento/asignado/[id]/movimientos:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


