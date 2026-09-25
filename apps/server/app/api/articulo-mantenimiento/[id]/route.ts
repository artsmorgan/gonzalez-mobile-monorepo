/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import { callDynamicPrisma } from "../../../../utils/callDynamicPrisma";
import { toZonedTime } from "date-fns-tz";
import fs from "fs";
import path from "path";
import { uploadDynamicFiles } from "../../../../utils/callDynamicFilesApi";
import { reportError } from "../../../../utils/reportError";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message, payload } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      await reportError(req, "api/articulo-mantenimiento/[id]", "PUT", 500, "ID no especificado");
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 500 });
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
      marcar_como_resuelto,
      hora_accion,
      files,
    } = body ?? {};

    console.log("body", body);

    const existing = await callDynamicPrisma({
      req,
      data: { action: "GET", table: "c_articulo_mantenimiento", operation: "findUnique", where: { id } }
    });

    // Hora de acción enviada por la app (getHoraAccion)
    let actionTime: Date | null = null;
    if (hora_accion) {
      const parsed = new Date(hora_accion);
      if (isNaN(parsed.getTime())) {
        await reportError(req, "api/articulo-mantenimiento/[id]", "PUT", 400, "hora_accion inválida");
        return NextResponse.json({ status: false, message: "hora_accion inválida" }, { status: 400 });
      }
      actionTime = parsed;
    }

    const planId = articulo_plan_id != null ? Number(articulo_plan_id) : null;
    const asignadoId = articulo_asignado_id != null ? Number(articulo_asignado_id) : null;
    const baseNow = actionTime ?? new Date();

    // Si el registro no existe, crear uno nuevo (upsert por UPDATE), salvo que el último updated_at sea más reciente.
    if (!existing) {
      if (!planId && !asignadoId) {
        return NextResponse.json({
          status: true,
          message: "Registro omitido: no se pudo determinar articulo_plan_id/articulo_asignado_id para crear",
        }, { status: 200 });
      }

      const whereLatest: any = planId ? { articulo_plan_id: planId } : { articulo_asignado_id: asignadoId };
      const latest = await callDynamicPrisma({
        req,
        data: {
          action: "GET",
          table: "c_articulo_mantenimiento",
          operation: "findFirst",
          where: whereLatest,
          orderBy: { id: "desc" },
        },
      });
      if (latest?.updated_at) {
        const latestUpdated = new Date(latest.updated_at);
        if (!isNaN(latestUpdated.getTime()) && baseNow.getTime() < latestUpdated.getTime()) {
          return NextResponse.json({
            status: true,
            message: "Registro omitido: updated_at más reciente en último mantenimiento",
          }, { status: 200 });
        }
      }

      const createData: any = {
        estado: String(estado || "Bueno"),
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
        created_at: toZonedTime(baseNow, "America/Costa_Rica"),
        updated_at: toZonedTime(baseNow, "America/Costa_Rica"),
      };
      if (planId) createData.e_estructura_articulo_corpo_puesto_plan = { connect: { id: planId } };
      if (asignadoId) createData.e_estructura_articulo_corpo_puesto_entrega = { connect: { id: asignadoId } };

      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_articulo_mantenimiento",
          operation: "create",
          data: createData,
        }
      });
      return NextResponse.json({ status: true, message: "Registro de mantenimiento creado correctamente" }, { status: 200 });
    }

    // Evitar sobrescribir con acciones más antiguas que el último update del registro existente
    if (actionTime) {
      const updatedAt = existing.updated_at ? new Date(existing.updated_at) : null;
      if (updatedAt && !isNaN(updatedAt.getTime()) && actionTime.getTime() < updatedAt.getTime()) {
        return NextResponse.json({
          status: true,
          message: "Registro omitido: la acción es más antigua que updated_at del registro",
        }, { status: 200 });
      }
    }

    const updateData: any = {};

    if (estado !== undefined) updateData.estado = String(estado || "Bueno");
    if (cantidad_necesaria !== undefined) updateData.cantidad_necesaria = Math.max(0, Number(cantidad_necesaria) || 0);
    if (cantidad_real !== undefined) updateData.cantidad_real = Math.max(0, Number(cantidad_real) || 0);
    if (observaciones !== undefined) updateData.observaciones = String(observaciones || "");

    // Si marcar_como_resuelto es true, establecer fecha_solucion (preferir la enviada por el cliente)
    // y actualizar estado a "Bueno" y cantidad_real = cantidad_necesaria
    if (marcar_como_resuelto === true) {
      if (fecha_solucion) {
        updateData.fecha_solucion = new Date(fecha_solucion);
      } else {
        updateData.fecha_solucion = toZonedTime(new Date(), "America/Costa_Rica");
      }
      updateData.estado = "Bueno";
      updateData.cantidad_real = existing.cantidad_necesaria;
    } else if (fecha_solucion !== undefined) {
      updateData.fecha_solucion = fecha_solucion ? new Date(fecha_solucion) : null;
    }

    if (accion !== undefined) updateData.accion = accion || null;
    if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio ? new Date(fecha_inicio) : null;
    if (numero_boleta_proveeduria !== undefined) updateData.numero_boleta_proveeduria = numero_boleta_proveeduria || null;
    if (tipo !== undefined) updateData.tipo = tipo || null;
    if (marca !== undefined) updateData.marca = marca || null;
    if (modelo !== undefined) updateData.modelo = modelo || null;
    if (serie_placa !== undefined) updateData.serie_placa = serie_placa || null;
    if (marca_nuevo !== undefined) updateData.marca_nuevo = marca_nuevo || null;
    if (modelo_nuevo !== undefined) updateData.modelo_nuevo = modelo_nuevo || null;
    if (serie_placa_nuevo !== undefined) updateData.serie_placa_nuevo = serie_placa_nuevo || null;
    if (categoria !== undefined) updateData.categoria = categoria || null;
    if (tipo_mantenimiento_art !== undefined) updateData.tipo_mantenimiento_art = tipo_mantenimiento_art || null;
    if (fecha_salida !== undefined) updateData.fecha_salida = fecha_salida ? new Date(fecha_salida) : null;
    if (fecha_entrada !== undefined) updateData.fecha_entrada = fecha_entrada ? new Date(fecha_entrada) : null;
    if (kilometraje !== undefined) updateData.kilometraje = kilometraje !== null && kilometraje !== undefined ? parseInt(String(kilometraje)) : null;
    if (mant_armas_form !== undefined) updateData.mant_armas_form = mant_armas_form || null;
    if (categoria_mantinimiento !== undefined) updateData.categoria_mantinimiento = categoria_mantinimiento || null;
    if (detalle !== undefined) updateData.detalle = detalle || null;
    if (numero_fc !== undefined) updateData.numero_fc = numero_fc || null;
    if (proveedor !== undefined) updateData.proveedor = proveedor || null;
    if (costo_mo !== undefined) updateData.costo_mo = costo_mo !== null && costo_mo !== undefined ? parseInt(String(costo_mo)) : null;
    if (costo_i !== undefined) updateData.costo_i = costo_i !== null && costo_i !== undefined ? parseInt(String(costo_i)) : null;
    if (iva !== undefined) updateData.iva = iva !== null && iva !== undefined ? parseInt(String(iva)) : null;
    if (costo_total !== undefined) updateData.costo_total = costo_total !== null && costo_total !== undefined ? parseInt(String(costo_total)) : null;
    if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin ? new Date(fecha_fin) : null;
    if (reincidencia_treinta_dias !== undefined) updateData.reincidencia_treinta_dias = reincidencia_treinta_dias === true || reincidencia_treinta_dias === "true";
    if (tipo_mant_art_reincid !== undefined) updateData.tipo_mant_art_reincid = tipo_mant_art_reincid || null;
    updateData.updated_at = toZonedTime(baseNow, "America/Costa_Rica");

    // Registrar cambios (solo campos actualizados)
    const eq = (a: any, b: any) => {
      if (a === b) return true;
      if (a == null && b == null) return true;
      const da = a instanceof Date ? a : (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) ? new Date(a) : null);
      const db = b instanceof Date ? b : (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b) ? new Date(b) : null);
      if (da && db) return da.getTime() === db.getTime();
      return false;
    };

    // Remueve campos relacionados a adjuntos del formulario de armas:
    // - fotos (antes/después) y sus referencias/nombres
    const sanitizeMantArmasForm = (value: any) => {
      if (!value) return value;
      let obj: any = null;
      try {
        obj = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return value; // si no es JSON válido, no tocamos (pero tampoco vamos a loguear adjuntos vía files)
      }
      if (!obj || typeof obj !== "object") return value;

      const clone: any = Array.isArray(obj) ? [...obj] : { ...obj };
      const keysToDrop = new Set([
        "foto_antes",
        "foto_despues",
        "fotoAntes",
        "fotoDespues",
        "foto_antes_nombre",
        "foto_despues_nombre",
        "fotoAntesNombre",
        "fotoDespuesNombre",
      ]);
      for (const k of Object.keys(clone)) {
        const lk = k.toLowerCase();
        if (keysToDrop.has(k) || lk.includes("foto_antes") || lk.includes("foto_despues") || lk.includes("arma_foto_antes") || lk.includes("arma_foto_despues")) {
          delete clone[k];
        }
      }
      return clone;
    };

    const flattenObject = (obj: any, prefix = ""): Record<string, any> => {
      if (!obj || typeof obj !== "object") return { [prefix || "value"]: obj };
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        const next = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !(v instanceof Date)) {
          // Arrays: guardar como JSON string para que sea “dato escrito” en un solo valor
          if (Array.isArray(v)) out[next] = JSON.stringify(v);
          else Object.assign(out, flattenObject(v, next));
        } else {
          out[next] = v instanceof Date ? v.toISOString() : v;
        }
      }
      return out;
    };

    const cambiosArr: Array<{ prop: string; before: any; after: any }> = [];
    for (const [k, v] of Object.entries(updateData)) {
      // No registramos adjuntos: esos vienen en `files` y se guardan aparte.
      if (k === "files") continue;

      // En mant_armas_form solo registramos datos escritos y firmas, no fotos/referencias a fotos.
      if (k === "mant_armas_form") {
        const beforeSan = sanitizeMantArmasForm((existing as any)[k]);
        const afterSan = sanitizeMantArmasForm(v);
        const beforeFlat = flattenObject(beforeSan, "mant_armas_form");
        const afterFlat = flattenObject(afterSan, "mant_armas_form");
        const allKeys = new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)]);
        for (const kk of allKeys) {
          const b = beforeFlat[kk];
          const a = afterFlat[kk];
          if (!eq(b, a)) cambiosArr.push({ prop: kk, before: b, after: a });
        }
        continue;
      }

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
        table: "c_articulo_mantenimiento",
        operation: "update",
        where: { id },
        data: updateDataForApi
      }
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await callDynamicPrisma({
        req,
        data: {
          action: "POST",
          table: "c_cambios_apps_modules",
          operation: "create",
          data: {
            nombre_tabla: "c_articulo_mantenimiento",
            registro_id: id,
            cambios: JSON.stringify(cambiosArr),
            created_at: toZonedTime(new Date(), "America/Costa_Rica").toISOString(),
            created_by: createdBy,
          }
        }
      });
    }

    // Archivos adjuntos: solo se crean nuevos; no se borra el resto. Excepción: al subir de nuevo `arma_foto_antes` / `arma_foto_despues` se reemplaza ese adjunto.
    if (files) {
      let filesParsed: Array<{ type: string; extension: string; original_name?: string; file_base64: string }> = [];
      try {
        filesParsed = typeof files === "string" ? JSON.parse(files) : files;
      } catch (err) {
        console.error("Error parsing files JSON:", err);
        await reportError(req, "api/articulo-mantenimiento/[id]", "PUT", 400, "Formato de archivos inválido");
        return NextResponse.json({ status: false, message: "Formato de archivos inválido" }, { status: 400 });
      }

      const validFiles = filesParsed.filter((f) => f?.file_base64 && f?.extension && f?.type);
      if (validFiles.length > 0) {
        const dir = path.join(process.cwd(), "public", "uploads", "articulo-mantenimiento", `${id}`);

        // Si es imagen arma_foto_antes/despues, eliminar existentes antes de subir
        for (const file of validFiles) {
          const originalName =
            typeof file.original_name === "string" && file.original_name.trim().length > 0 ? file.original_name.trim() : "";
          if (file.type === "image" && (originalName.startsWith("arma_foto_antes") || originalName.startsWith("arma_foto_despues"))) {
            try {
              const existingFiles = await callDynamicPrisma({
                req,
                data: {
                  action: "GET",
                  table: "c_archivos_adjuntos_articulo_mantenimiento",
                  operation: "findMany",
                  where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" }
                }
              });
              for (const ef of (existingFiles as any[])) {
                try {
                  const oldPath = path.join(dir, ef.name);
                  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                } catch (e) {
                  console.warn("No se pudo eliminar archivo anterior:", e);
                }
              }
              if (Array.isArray(existingFiles) && existingFiles.length > 0) {
                await callDynamicPrisma({
                  req,
                  data: {
                    action: "DELETE",
                    table: "c_archivos_adjuntos_articulo_mantenimiento",
                    operation: "deleteMany",
                    where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" }
                  }
                });
              }
            } catch (e) {
              console.warn("No se pudo limpiar imagen previa:", e);
            }
          }
        }

        const uploadResp = await uploadDynamicFiles({
          req,
          folderPath: `articulo-mantenimiento/${id}`,
          files: validFiles.map((f) => ({
            type: (f.type || "file") as "image" | "video" | "audio" | "file",
            extension: String(f.extension).replace(".", "").trim() || "bin",
            original_name: f.original_name,
            file_base64: f.file_base64,
          })),
        });

        const uploadedFiles = Array.isArray(uploadResp?.files) ? uploadResp.files : [];
        for (let i = 0; i < uploadedFiles.length; i++) {
          const uploaded = uploadedFiles[i];
          const file = validFiles[i];
          const originalName =
            typeof file?.original_name === "string" && file.original_name.trim().length > 0
              ? file.original_name.trim()
              : uploaded?.original_name || uploaded?.name || "";
          await callDynamicPrisma({
            req,
            data: {
              action: "POST",
              table: "c_archivos_adjuntos_articulo_mantenimiento",
              operation: "create",
              data: {
                name: uploaded.name,
                original_name: originalName,
                type: file?.type || "file",
                extension: file?.extension || "bin",
                activo_mantenimiento_id: id,
              }
            }
          });
        }
      }
    }

    return NextResponse.json({ status: true, message: "Mantenimiento actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/articulo-mantenimiento/[id]:", errorMessage);
    await reportError(req, "api/articulo-mantenimiento/[id]", "PUT", 500, errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


