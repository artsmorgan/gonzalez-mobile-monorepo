import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";

function encuestaCambiosEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
  const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
  if (da && db) return da.getTime() === db.getTime();
  return false;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { status: false, message: "ID de encuesta no especificado" },
        { status: 400 }
      );
    }

    const existing = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_encuesta_cliente",
        operation: "findUnique",
        where: { id },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { status: false, message: "Encuesta no encontrada" },
        { status: 404 }
      );
    }

    const existingObj = existing as any;
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const fechaVal =
      existingObj.fecha instanceof Date
        ? existingObj.fecha.toISOString()
        : typeof existingObj.fecha === "string"
          ? existingObj.fecha
          : null;

    await callDynamicPrisma({
      req,
      data: {
        action: "POST",
        table: "c_cambios_apps_modules",
        operation: "create",
        data: {
          nombre_tabla: "c_encuesta_cliente",
          registro_id: id,
          cambios: JSON.stringify([
            {
              prop: "__deleted__",
              before: {
                id: existingObj.id,
                empresa_id: existingObj.empresa_id,
                cliente_id: existingObj.cliente_id,
                corpo_id: existingObj.corpo_id,
                puesto_id: existingObj.puesto_id,
                division_id: existingObj.division_id,
                responsable_id: existingObj.responsable_id,
                fecha: fechaVal,
                evaluaciones: existingObj.evaluaciones,
                empresa_evaluado: existingObj.empresa_evaluado,
                nombre_evaluado: existingObj.nombre_evaluado,
                cedula_evaluado: existingObj.cedula_evaluado,
                telefono_evaluado: existingObj.telefono_evaluado,
                email_evaluado: existingObj.email_evaluado,
                nombre_responsable: existingObj.nombre_responsable,
                cedula_responsable: existingObj.cedula_responsable,
                observaciones: existingObj.observaciones,
              },
              after: null,
            },
          ]),
          created_at: createdAt.toISOString(),
          created_by: createdBy,
        },
      },
    });

    await callDynamicPrisma({
      req,
      data: {
        action: "DELETE",
        table: "c_encuesta_cliente",
        operation: "delete",
        where: { id },
      },
    });

    return NextResponse.json(
      { status: true, message: "Encuesta eliminada correctamente" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/encuesta-nps/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { status: false, message: "ID de encuesta no especificado" },
        { status: 400 }
      );
    }

    const encuestaExisting = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_encuesta_cliente",
        operation: "findUnique",
        where: { id },
      },
    });

    if (!encuestaExisting) {
      return NextResponse.json(
        { status: false, message: "Encuesta no encontrada" },
        { status: 404 }
      );
    }

    const existingObj = encuestaExisting as any;

    const {
      empresa_id,
      cliente_id,
      division_id,
      corpo_id,
      puesto_id,
      fecha,
      evaluaciones,
      persona_evaluada,
      cedula_persona_evaluada,
      telefono_persona_evaluada,
      email_persona_evaluada,
      nombre_responsable,
      cedula_responsable,
      firma_responsable,
      firma_persona_evaluada,
      empresa_evaluada,
      observaciones,
    } = await req.json();

    if (
      !empresa_evaluada ||
      !puesto_id ||
      !fecha ||
      !evaluaciones ||
      !persona_evaluada ||
      !cedula_persona_evaluada ||
      !nombre_responsable ||
      !cedula_responsable ||
      !firma_responsable ||
      observaciones === undefined ||
      observaciones === null
    ) {
      return NextResponse.json({ status: false, message: "Datos incompletos" }, { status: 200 });
    }

    if (!empresa_id || !cliente_id || !division_id || !corpo_id || !puesto_id) {
      return NextResponse.json(
        { status: false, message: "IDs de jerarquía incompletos" },
        { status: 200 }
      );
    }

    const empresa = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_empresa",
        operation: "findUnique",
        where: { id: parseInt(String(empresa_id)) },
      },
    });
    if (!empresa) {
      return NextResponse.json({ status: false, message: "Empresa no encontrada" }, { status: 200 });
    }

    const cliente = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_cliente",
        operation: "findUnique",
        where: { id: parseInt(String(cliente_id)) },
      },
    });
    if (!cliente) {
      return NextResponse.json({ status: false, message: "Cliente no encontrado" }, { status: 200 });
    }

    const corpo = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_sucursal",
        operation: "findUnique",
        where: { id: parseInt(String(corpo_id)) },
      },
    });
    if (!corpo) {
      return NextResponse.json({ status: false, message: "Corpo no encontrado" }, { status: 200 });
    }

    const puesto_db = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "e_estructura_puesto",
        operation: "findUnique",
        where: { id: parseInt(String(puesto_id)) },
      },
    });
    if (!puesto_db) {
      return NextResponse.json({ status: false, message: "Puesto no encontrado" }, { status: 200 });
    }

    const division = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "n_division",
        operation: "findUnique",
        where: { id: parseInt(String(division_id)) },
      },
    });
    if (!division) {
      return NextResponse.json({ status: false, message: "Division no encontrada" }, { status: 200 });
    }

    const empresaObj = empresa as any;
    const clienteObj = cliente as any;
    const corpoObj = corpo as any;
    const puestoObj = puesto_db as any;
    const divisionObj = division as any;

    const fechaDate = fecha instanceof Date ? fecha : new Date(fecha);
    const evaluacionesStr =
      typeof evaluaciones === "string" ? evaluaciones : JSON.stringify(evaluaciones);

    const updateData: Record<string, any> = {
      empresa_id: empresaObj.id,
      cliente_id: clienteObj.id,
      corpo_id: corpoObj.id,
      puesto_id: puestoObj.id,
      division_id: divisionObj.id,
      empresa_evaluado: String(empresa_evaluada ?? ""),
      firma_responsable: String(firma_responsable ?? ""),
      fecha: fechaDate.toISOString(),
      evaluaciones: evaluacionesStr,
      nombre_evaluado: String(persona_evaluada ?? ""),
      cedula_evaluado: String(cedula_persona_evaluada ?? ""),
      telefono_evaluado: String(telefono_persona_evaluada ?? ""),
      email_evaluado: String(email_persona_evaluada ?? ""),
      firma_evaluado:
        firma_persona_evaluada != null &&
        String(firma_persona_evaluada).trim() !== ""
          ? firma_persona_evaluada
          : null,
      nombre_responsable: String(nombre_responsable ?? ""),
      cedula_responsable: String(cedula_responsable ?? ""),
      observaciones: String(observaciones ?? ""),
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(updateData)) {
      const before = existingObj[k];
      const after = v;
      if (!encuestaCambiosEq(before, after)) {
        const beforeValue =
          before instanceof Date
            ? before.toISOString()
            : typeof before === "string" && /^\d{4}-\d{2}-\d{2}T/.test(before)
              ? before
              : before;
        const afterValue =
          after instanceof Date
            ? after.toISOString()
            : typeof after === "string" && /^\d{4}-\d{2}-\d{2}T/.test(after)
              ? after
              : after;
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
        table: "c_encuesta_cliente",
        operation: "update",
        where: { id },
        data: updateData,
      },
    });

    if (cambiosArr.length > 0) {
      const createdBy =
        payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_encuesta_cliente",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json(
      { status: true, message: "Encuesta actualizada correctamente" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/encuesta-nps/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id, 10);

    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { status: false, message: "ID de encuesta no especificado" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { field, value } = body as { field?: string; value?: string };

    if (field !== "firma_persona_evaluada") {
      return NextResponse.json(
        { status: false, message: "Campo inválido. Debe ser firma_persona_evaluada." },
        { status: 400 }
      );
    }

    const encuesta = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_encuesta_cliente",
        operation: "findUnique",
        where: { id },
      },
    });

    if (!encuesta) {
      return NextResponse.json(
        { status: false, message: "Encuesta no encontrada" },
        { status: 404 }
      );
    }

    const trimmed = typeof value === "string" ? value.trim() : "";
    const valueToStore = trimmed.length > 0 ? trimmed : null;

    const encuestaObj = encuesta as any;
    const beforeFirma = encuestaObj.firma_evaluado ?? null;
    const firmaChanged = !encuestaCambiosEq(beforeFirma, valueToStore);

    await callDynamicPrisma({
      req,
      data: {
        action: "UPDATE",
        table: "c_encuesta_cliente",
        operation: "update",
        where: { id },
        data: { firma_evaluado: valueToStore },
      },
    });

    if (firmaChanged) {
      const createdBy =
        payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_encuesta_cliente",
            registro_id: id,
            cambios: JSON.stringify([
              {
                prop: "firma_evaluado",
                before: beforeFirma,
                after: valueToStore,
              },
            ]),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          },
        },
      });
    }

    return NextResponse.json(
      { status: true, message: "Firma actualizada correctamente" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PATCH /api/encuesta-nps/[id]:", errorMessage);
    return NextResponse.json(
      { status: false, message: errorMessage },
      { status: 500 }
    );
  }
}
