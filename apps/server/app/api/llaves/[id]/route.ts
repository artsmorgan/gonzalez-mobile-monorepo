/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../../utils/reportError";

function parseId(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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
      await reportError(req, "api/llaves/[id]", "PUT", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const body = await req.json();
    const {
      marca_id,
      numero_llave,
      lugar_abre,
      cantidad_copias,
      observaciones,
      firma_responsable,
      empresa_id: bodyEmpresaId,
      division_id: bodyDivisionId,
      contrato_id: bodyContratoId,
      cliente_id: bodyClienteId,
      corpo_id: bodyCorpoId,
      puesto_id: bodyPuestoId,
    } = body ?? {};
    if (!marca_id) {
      await reportError(req, "api/llaves/[id]", "PUT", 400, "Marca no especificada");
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
    }

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id)) } });
    if (!marcaDia) {
      await reportError(req, "api/llaves/[id]", "PUT", 404, "Marca no encontrada");
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      await reportError(req, "api/llaves/[id]", "PUT", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    if (existing.cliente_id !== marcaDia.cliente_id) {
      await reportError(req, "api/llaves/[id]", "PUT", 400, "No autorizado para modificar este registro");
      return NextResponse.json({ status: false, message: "No autorizado para modificar este registro" }, { status: 400 });
    }

    const nextCliente =
      bodyClienteId != null && String(bodyClienteId).trim() !== ""
        ? parseInt(String(bodyClienteId), 10)
        : existing.cliente_id;
    const nextCorpo =
      bodyCorpoId != null && String(bodyCorpoId).trim() !== ""
        ? parseInt(String(bodyCorpoId), 10)
        : existing.corpo_id;
    const nextPuesto =
      bodyPuestoId != null && String(bodyPuestoId).trim() !== ""
        ? parseInt(String(bodyPuestoId), 10)
        : existing.puesto_id;

    if (nextCliente !== marcaDia.cliente_id) {
      await reportError(req, "api/llaves/[id]", "PUT", 400, "Cliente destino no coincide con la marca");
      return NextResponse.json({ status: false, message: "Cliente destino no coincide con la marca" }, { status: 400 });
    }

    const nextEmpresa = parseId(bodyEmpresaId) ?? Number(existing.empresa_id);
    const nextDivision = parseId(bodyDivisionId) ?? Number(existing.division_id);
    const nextContrato = parseId(bodyContratoId) ?? Number(existing.contrato_id);
    if (!Number.isFinite(nextEmpresa) || nextEmpresa <= 0 || !Number.isFinite(nextDivision) || nextDivision <= 0 || !Number.isFinite(nextContrato) || nextContrato <= 0) {
      await reportError(req, "api/llaves/[id]", "PUT", 400, "Indique empresa_id, division_id y contrato_id válidos (o vienen del registro actual)");
      return NextResponse.json(
        { status: false, message: "Indique empresa_id, division_id y contrato_id válidos (o vienen del registro actual)" },
        { status: 400 }
      );
    }

    if (Number(nextCorpo) !== Number(existing.corpo_id)) {
      await callDynamicPrisma({
        req,
        data: {
          action: "DELETE",
          table: "e_llave_en_llavero",
          operation: "deleteMany",
          where: { llave_id: id },
        },
      });
    }

    // Registrar cambios (solo campos actualizados, excluyendo firmas)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      return false;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    const updateData: any = {
      cliente_id: nextCliente,
      corpo_id: nextCorpo,
      puesto_id: nextPuesto,
      empresa_id: nextEmpresa,
      division_id: nextDivision,
      contrato_id: nextContrato,
      numero_llave: typeof numero_llave === "string" ? numero_llave : existing.numero_llave,
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

    // Comparar cambios (incluir firmas)
    for (const [k, v] of Object.entries(updateData)) {
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

    return NextResponse.json(
      {
        status: true,
        message: "Llave actualizada correctamente",
        id,
        empresa_id: nextEmpresa,
        cliente_id: nextCliente,
        division_id: nextDivision,
        contrato_id: nextContrato,
        corpo_id: nextCorpo,
        sucursal_id: nextCorpo,
        puesto_id: nextPuesto,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/llaves/[id]:", errorMessage);
    await reportError(req, "api/llaves/[id]", "PUT", 500, errorMessage);
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
      await reportError(req, "api/llaves/[id]", "DELETE", 400, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const marcaIdStr = req.nextUrl.searchParams.get("m");
    if (!marcaIdStr) {
      await reportError(req, "api/llaves/[id]", "DELETE", 400, "Marca no especificada");
      return NextResponse.json({ status: false, message: "Marca no especificada" }, { status: 400 });
    }
    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(marcaIdStr) } });
    if (!marcaDia) {
      await reportError(req, "api/llaves/[id]", "DELETE", 404, "Marca no encontrada");
      return NextResponse.json({ status: false, message: "Marca no encontrada" }, { status: 404 });
    }

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "e_llave", operation: "findUnique", where: { id } }
    });
    if (!existing) {
      await reportError(req, "api/llaves/[id]", "DELETE", 404, "Registro no encontrado");
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }
    if (existing.cliente_id !== marcaDia.cliente_id) {
      await reportError(req, "api/llaves/[id]", "DELETE", 400, "No autorizado para eliminar este registro");
      return NextResponse.json({ status: false, message: "No autorizado para eliminar este registro" }, { status: 400 });
    }

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "e_llave_en_llavero",
        operation: "deleteMany",
        where: { llave_id: id },
      },
    });

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
              numero_llave: existing.numero_llave,
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
    await reportError(req, "api/llaves/[id]", "DELETE", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


