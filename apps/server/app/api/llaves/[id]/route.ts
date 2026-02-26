/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

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
    const { marca_id, lugar_abre, cantidad_copias, observaciones, firma_responsable } = body ?? {};
    if (!marca_id) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }

    const marcaDia = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(String(marca_id)) } }
    });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }

    // Ownership: solo se puede editar si pertenece al mismo cliente/corpo de la marca actual
    if (existing.cliente_id !== marcaDia.cliente_id || existing.corpo_id !== marcaDia.corpo_id) {
      return NextResponse.json({ status: false, message: "No autorizado para modificar este registro" }, { status: 200 });
    }

    // Registrar cambios (solo campos actualizados, excluyendo firmas)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    const updateData: any = {
      lugar_abre: typeof lugar_abre === "string" ? lugar_abre : existing.lugar_abre,
      cantidad_copias:
        cantidad_copias === undefined || cantidad_copias === null
          ? existing.cantidad_copias
          : parseInt(String(cantidad_copias)) || 0,
      observaciones: typeof observaciones === "string" ? observaciones : existing.observaciones,
      firma_responsable: typeof firma_responsable === "string" ? firma_responsable : existing.firma_responsable,
      created_at: existing.created_at ?? (toZonedTime(new Date(), "America/Costa_Rica") as Date),
      created_by: existing.created_by ?? (parseInt(String((payload as any)?.id ?? 0)) || 0),
    };

    // Comparar cambios (excluir firmas)
    for (const [k, v] of Object.entries(updateData)) {
      if (k === "firma_responsable") continue; // Excluir firmas
      const before = (existing as any)[k];
      const after = v;
      if (!eq(before, after)) {
        cambiosArr.push({
          prop: k,
          before: before instanceof Date ? before.toISOString() : before,
          after: after instanceof Date ? after.toISOString() : after,
        });
      }
    }

    // Convertir fechas a ISO strings para la API dinámica
    const updateDataForApi: any = {};
    for (const [k, v] of Object.entries(updateData)) {
      if (v instanceof Date) {
        updateDataForApi[k] = v.toISOString();
      } else {
        updateDataForApi[k] = v;
      }
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "e_llave",
        where: { id },
        data: updateDataForApi
      }
    });

    // Registrar cambios si hay alguno
    if (cambiosArr.length > 0) {
      const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
      const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          data: {
            nombre_tabla: "e_llave",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: createdAt.toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    return NextResponse.json({ status: true, message: "Llave actualizada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/llaves/[id]:", errorMessage);
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

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) {
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 200 });
    }
    const marcaDia = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_marca_dia", operation: "findUnique", where: { id: parseInt(marcaIdStr) } }
    });
    if (!marcaDia) {
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 200 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 200 });
    }
    if (existing.cliente_id !== marcaDia.cliente_id || existing.corpo_id !== marcaDia.corpo_id) {
      return NextResponse.json({ status: false, message: "No autorizado para eliminar este registro" }, { status: 200 });
    }

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = parseInt(String((payload as any)?.id ?? 0)) || 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica") as Date;
    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        data: {
          nombre_tabla: "e_llave",
          registro_id: id,
          cambios: JSON.stringify([{
            prop: "__deleted__",
            before: {
              id: existing.id,
              cliente_id: existing.cliente_id,
              corpo_id: existing.corpo_id,
              puesto_id: existing.puesto_id,
              lugar_abre: existing.lugar_abre,
              cantidad_copias: existing.cantidad_copias,
              observaciones: existing.observaciones,
            },
            after: null,
          }]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        }
      }
    });

    await callDynamicPrisma({
      req,
      data: { action: "DELETE", table: "e_llave", where: { id } }
    });
    return NextResponse.json({ status: true, message: "Llave eliminada correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/llaves/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


