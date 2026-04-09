/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

function parseDateOnly(value: any): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      cliente_id,
      corpo_id,
      fecha,
      nombre_oficial_entrega,
      nombre_oficial_recibe,
      tipo_documento,
      descripcion,
      firma_representante_cliente,
      firma_responsable,
    } = body ?? {};

    if (cliente_id == null || corpo_id == null) {
      return NextResponse.json({ status: false, message: "cliente_id y corpo_id son obligatorios" }, { status: 200 });
    }

    const clienteIdNum = parseInt(String(cliente_id), 10);
    const corpoIdNum = parseInt(String(corpo_id), 10);
    if (!Number.isFinite(clienteIdNum) || clienteIdNum <= 0 || !Number.isFinite(corpoIdNum) || corpoIdNum <= 0) {
      return NextResponse.json({ status: false, message: "cliente_id o corpo_id inválidos" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_control_documento_entregado_cliente",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!existing || !existing.id) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    if (existing.cliente_id !== clienteIdNum || existing.corpo_id !== corpoIdNum) {
      return NextResponse.json({ status: false, message: "No autorizado para modificar este registro" }, { status: 200 });
    }

    const fechaDate = fecha ? parseDateOnly(fecha) : null;
    if (fecha && !fechaDate) {
      return NextResponse.json({ status: false, message: "Fecha inválida" }, { status: 200 });
    }

    const existingFecha = existing.fecha instanceof Date ? existing.fecha : new Date(existing.fecha);
    const updateData: any = {
      fecha: fechaDate ? fechaDate.toISOString() : existingFecha.toISOString(),
      nombre_oficial_entrega:
        typeof nombre_oficial_entrega === "string" ? nombre_oficial_entrega : existing.nombre_oficial_entrega,
      nombre_oficial_recibe:
        typeof nombre_oficial_recibe === "string" ? nombre_oficial_recibe : existing.nombre_oficial_recibe,
      tipo_documento: typeof tipo_documento === "string" ? tipo_documento : existing.tipo_documento,
      descripcion: typeof descripcion === "string" ? descripcion : existing.descripcion,
      firma_representante_cliente:
        firma_representante_cliente !== undefined
          ? (firma_representante_cliente != null && String(firma_representante_cliente).trim() !== ""
            ? String(firma_representante_cliente)
            : null)
          : existing.firma_representante_cliente,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
    };

    // Registrar cambios (solo campos actualizados, excluyendo firmas)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(updateData)) {
      const before = (existing as any)[k];
      const after = v;
      if (!eq(before, after)) {
        const beforeValue = before instanceof Date ? before.toISOString() : (typeof before === 'string' && before.includes('T') ? before : before);
        const afterValue = after instanceof Date ? after.toISOString() : (typeof after === 'string' && after.includes('T') ? after : after);
        cambiosArr.push({
          prop: k,
          before: beforeValue,
          after: afterValue,
        });
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_control_documento_entregado_cliente",
        where: { id },
        data: updateData,
      },
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "e_control_documento_entregado_cliente",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json({ status: true, message: "Documento entregado actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/documentos-entregados/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const corpoIdStr = req.nextUrl.searchParams.get("corpo_id");
    const clienteIdStr = req.nextUrl.searchParams.get("cliente_id");
    if (!corpoIdStr || !clienteIdStr) {
      return NextResponse.json({ status: false, message: "corpo_id y cliente_id son obligatorios" }, { status: 200 });
    }

    const corpoIdNum = parseInt(corpoIdStr, 10);
    const clienteIdNum = parseInt(clienteIdStr, 10);
    if (!Number.isFinite(corpoIdNum) || corpoIdNum <= 0 || !Number.isFinite(clienteIdNum) || clienteIdNum <= 0) {
      return NextResponse.json({ status: false, message: "corpo_id o cliente_id inválidos" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_control_documento_entregado_cliente",
        operation: "findUnique",
        where: { id },
      },
    });
    if (!existing || !existing.id) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    if (existing.cliente_id !== clienteIdNum || existing.corpo_id !== corpoIdNum) {
      return NextResponse.json({ status: false, message: "No autorizado para eliminar este registro" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const existingFecha = existing.fecha instanceof Date ? existing.fecha : new Date(existing.fecha);
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_control_documento_entregado_cliente",
          registro_id: id,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existing.id,
              cliente_id: existing.cliente_id,
              corpo_id: existing.corpo_id,
              fecha: existingFecha.toISOString(),
              nombre_oficial_entrega: existing.nombre_oficial_entrega,
              nombre_oficial_recibe: existing.nombre_oficial_recibe,
              tipo_documento: existing.tipo_documento,
              descripcion: existing.descripcion,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "e_control_documento_entregado_cliente",
        where: { id },
      },
    });
    return NextResponse.json({ status: true, message: "Documento entregado eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/documentos-entregados/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


