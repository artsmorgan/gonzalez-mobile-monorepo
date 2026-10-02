/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import { reportError } from "../../../utils/reportError";

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired, message }, { status: expired ? 401 : 403 });
    }

    const body = await req.json();
    const {
      articulo_plan_id,
      articulo_asignado_id,
      estado,
      cantidad_necesaria,
      cantidad_real,
      observaciones,
      fecha_solucion,
      accion,
      fecha_inicio,
      numero_boleta_proveeduria,
      tipo,
      marca,
      modelo,
      serie_placa,
      marca_nuevo,
      modelo_nuevo,
      serie_placa_nuevo,
      categoria,
      tipo_mantenimiento_art,
      fecha_salida,
      fecha_entrada,
      kilometraje,
      mant_armas_form,
      categoria_mantinimiento,
      detalle,
      numero_fc,
      proveedor,
      costo_mo,
      costo_i,
      iva,
      costo_total,
      fecha_fin,
      reincidencia_treinta_dias,
      tipo_mant_art_reincid,
      hora_accion,
    } = body ?? {};

    const planId = articulo_plan_id != null ? Number(articulo_plan_id) : null;
    const asignadoId = articulo_asignado_id != null ? Number(articulo_asignado_id) : null;
    if (!planId && !asignadoId) {
      await reportError(req, "api/articulo-mantenimiento", "POST", 400, "Debe indicar articulo_plan_id o articulo_asignado_id");
      return NextResponse.json({ status: false, message: "Debe indicar articulo_plan_id o articulo_asignado_id" }, { status: 400 });
    }

    const whereLatest: any = planId ? { articulo_plan_id: planId } : { articulo_asignado_id: asignadoId };

    // Hora base de la acción (si viene de la app, via getHoraAccion)
    let actionTime: Date | null = null;
    if (hora_accion) {
      const parsed = new Date(hora_accion);
      if (isNaN(parsed.getTime())) {
        await reportError(req, "api/articulo-mantenimiento", "POST", 400, "hora_accion inválida");
        return NextResponse.json({ status: false, message: "hora_accion inválida" }, { status: 400 });
      }
      actionTime = parsed;
    }

    // Obtener último mantenimiento para este artículo (igual que en checklist-supervision)
    const latest = await callDynamicPrisma({
      req,
      data: {
        action: "GET",
        table: "c_articulo_mantenimiento",
        operation: "findFirst",
        where: whereLatest,
        // No todos los esquemas tienen updated_at indexado; usamos id desc como aproximación al último registro
        orderBy: { id: "desc" },
      },
    });

    // Validar concurrencia: si updated_at del último es más reciente que la acción, omitir
    if (actionTime && latest?.updated_at) {
      const latestUpdated = new Date(latest.updated_at);
      if (!isNaN(latestUpdated.getTime()) && actionTime.getTime() < latestUpdated.getTime()) {
        return NextResponse.json(
          { status: true, message: "Registro omitido: la acción es más antigua que updated_at del último mantenimiento" },
          { status: 200 }
        );
      }
    }

    const baseNow = actionTime ?? new Date();
    const now = toZonedTime(baseNow, "America/Costa_Rica");

    const buildFullUpdateData = (base: any, overrides?: { estado?: string; fecha_solucion?: any }) => {
      const data: any = {
        fecha_solucion:
          overrides?.fecha_solucion !== undefined
            ? overrides.fecha_solucion
            : (fecha_solucion !== undefined
              ? (fecha_solucion ? new Date(fecha_solucion).toISOString() : null)
              : (base?.fecha_solucion ?? null)),
        accion: accion !== undefined ? (accion || null) : (base?.accion ?? null),
        fecha_inicio:
          fecha_inicio !== undefined
            ? (fecha_inicio ? new Date(fecha_inicio).toISOString() : null)
            : (base?.fecha_inicio ?? null),
        numero_boleta_proveeduria:
          numero_boleta_proveeduria !== undefined
            ? (numero_boleta_proveeduria || null)
            : (base?.numero_boleta_proveeduria ?? null),
        tipo: tipo !== undefined ? (tipo || null) : (base?.tipo ?? null),
        marca: marca !== undefined ? (marca || null) : (base?.marca ?? null),
        modelo: modelo !== undefined ? (modelo || null) : (base?.modelo ?? null),
        serie_placa: serie_placa !== undefined ? (serie_placa || null) : (base?.serie_placa ?? null),
        marca_nuevo: marca_nuevo !== undefined ? (marca_nuevo || null) : (base?.marca_nuevo ?? null),
        modelo_nuevo: modelo_nuevo !== undefined ? (modelo_nuevo || null) : (base?.modelo_nuevo ?? null),
        serie_placa_nuevo: serie_placa_nuevo !== undefined ? (serie_placa_nuevo || null) : (base?.serie_placa_nuevo ?? null),
        categoria: categoria !== undefined ? (categoria || null) : (base?.categoria ?? null),
        tipo_mantenimiento_art:
          tipo_mantenimiento_art !== undefined
            ? (tipo_mantenimiento_art || null)
            : (base?.tipo_mantenimiento_art ?? null),
        fecha_salida:
          fecha_salida !== undefined
            ? (fecha_salida ? new Date(fecha_salida).toISOString() : null)
            : (base?.fecha_salida ?? null),
        fecha_entrada:
          fecha_entrada !== undefined
            ? (fecha_entrada ? new Date(fecha_entrada).toISOString() : null)
            : (base?.fecha_entrada ?? null),
        kilometraje:
          kilometraje !== undefined
            ? (kilometraje !== null ? parseInt(String(kilometraje)) : null)
            : (base?.kilometraje ?? null),
        mant_armas_form: mant_armas_form !== undefined ? (mant_armas_form || null) : (base?.mant_armas_form ?? null),
        categoria_mantinimiento:
          categoria_mantinimiento !== undefined
            ? (categoria_mantinimiento || null)
            : (base?.categoria_mantinimiento ?? null),
        detalle: detalle !== undefined ? (detalle || null) : (base?.detalle ?? null),
        numero_fc: numero_fc !== undefined ? (numero_fc || null) : (base?.numero_fc ?? null),
        proveedor: proveedor !== undefined ? (proveedor || null) : (base?.proveedor ?? null),
        costo_mo:
          costo_mo !== undefined
            ? (costo_mo !== null ? parseInt(String(costo_mo)) : null)
            : (base?.costo_mo ?? null),
        costo_i:
          costo_i !== undefined
            ? (costo_i !== null ? parseInt(String(costo_i)) : null)
            : (base?.costo_i ?? null),
        iva:
          iva !== undefined
            ? (iva !== null ? parseInt(String(iva)) : null)
            : (base?.iva ?? null),
        costo_total:
          costo_total !== undefined
            ? (costo_total !== null ? parseInt(String(costo_total)) : null)
            : (base?.costo_total ?? null),
        fecha_fin:
          fecha_fin !== undefined
            ? (fecha_fin ? new Date(fecha_fin).toISOString() : null)
            : (base?.fecha_fin ?? null),
        reincidencia_treinta_dias:
          reincidencia_treinta_dias !== undefined
            ? (reincidencia_treinta_dias === true || reincidencia_treinta_dias === "true")
            : Boolean(base?.reincidencia_treinta_dias),
        tipo_mant_art_reincid:
          tipo_mant_art_reincid !== undefined
            ? (tipo_mant_art_reincid || null)
            : (base?.tipo_mant_art_reincid ?? null),
        updated_at: now,
      };
      return data;
    };

    // Lógica de creación/actualización de reportes igual que checklist-supervision:
    // - Sin historial => last_estado = 'Bueno'
    // - Si estado_actual = 'Bueno': actualizar último si antes no era Bueno, o no hacer nada si ya era Bueno
    // - Si estado_actual != 'Bueno': crear nuevo si last_estado es Bueno o no había registros, o actualizar último si cambia entre estados no Buenos
    const last_estado: string = latest && latest.id ? String(latest.estado || "") : "Bueno";
    const estado_actual: string = String(estado || "Bueno");

    if (estado_actual === "Bueno") {
      if (last_estado !== "Bueno" && latest && latest.id) {
        const updateData: any = buildFullUpdateData(latest, {
          estado: "Bueno",
          fecha_solucion: now,
        });

        await callDynamicPrisma({
          req,
          data: {
            action: "UPDATE",
            table: "c_articulo_mantenimiento",
            operation: "update",
            where: { id: latest.id },
            data: updateData,
          },
        });

        return NextResponse.json({ status: true, message: "Mantenimiento actualizado correctamente" }, { status: 200 });
      }

      return NextResponse.json(
        { status: true, message: "Mantenimiento omitido: sin cambios relevantes en estado (sigue en Bueno)" },
        { status: 200 }
      );
    }

    if (!latest || !latest.id || last_estado === "Bueno") {
      const created = await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_articulo_mantenimiento",
          data: {
            articulo_plan_id: planId,
            articulo_asignado_id: asignadoId,
            estado: estado_actual,
            cantidad_necesaria: Math.max(0, Number(cantidad_necesaria) || 0),
            cantidad_real: Math.max(0, Number(cantidad_real) || 0),
            observaciones: String(observaciones || ""),
            fecha_solucion: fecha_solucion ? new Date(fecha_solucion).toISOString() : null,
            accion: accion || null,
            fecha_inicio: fecha_inicio ? new Date(fecha_inicio).toISOString() : null,
            numero_boleta_proveeduria: numero_boleta_proveeduria || null,
            tipo: tipo || null,
            marca: marca || null,
            modelo: modelo || null,
            serie_placa: serie_placa || null,
            marca_nuevo: marca_nuevo || null,
            modelo_nuevo: modelo_nuevo || null,
            serie_placa_nuevo: serie_placa_nuevo || null,
            categoria: categoria || null,
            tipo_mantenimiento_art: tipo_mantenimiento_art || null,
            fecha_salida: fecha_salida ? new Date(fecha_salida).toISOString() : null,
            fecha_entrada: fecha_entrada ? new Date(fecha_entrada).toISOString() : null,
            kilometraje: kilometraje !== null && kilometraje !== undefined ? parseInt(String(kilometraje)) : null,
            mant_armas_form: mant_armas_form || null,
            categoria_mantinimiento: categoria_mantinimiento || null,
            detalle: detalle || null,
            numero_fc: numero_fc || null,
            proveedor: proveedor || null,
            costo_mo: costo_mo !== null && costo_mo !== undefined ? parseInt(String(costo_mo)) : null,
            costo_i: costo_i !== null && costo_i !== undefined ? parseInt(String(costo_i)) : null,
            iva: iva !== null && iva !== undefined ? parseInt(String(iva)) : null,
            costo_total: costo_total !== null && costo_total !== undefined ? parseInt(String(costo_total)) : null,
            fecha_fin: fecha_fin ? new Date(fecha_fin).toISOString() : null,
            reincidencia_treinta_dias: reincidencia_treinta_dias === true || reincidencia_treinta_dias === "true",
            tipo_mant_art_reincid: tipo_mant_art_reincid || null,
            created_at: now,
            updated_at: now,
          },
        },
      });

      return NextResponse.json({ status: true, message: "Mantenimiento creado correctamente", data: created }, { status: 200 });
    }

    if (last_estado !== estado_actual && latest && latest.id) {
      const updateData: any = buildFullUpdateData(latest, {
        estado: estado_actual,
        fecha_solucion: null,
      });

      await callDynamicPrisma({
        req,
        data: {
          action: "UPDATE",
          table: "c_articulo_mantenimiento",
          operation: "update",
          where: { id: latest.id },
          data: updateData,
        },
      });

      return NextResponse.json({ status: true, message: "Mantenimiento actualizado correctamente" }, { status: 200 });
    }

    return NextResponse.json(
      { status: true, message: "Mantenimiento omitido: estado sin cambios frente al último registro" },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/articulo-mantenimiento:", errorMessage);
    await reportError(req, "api/articulo-mantenimiento", "POST", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
