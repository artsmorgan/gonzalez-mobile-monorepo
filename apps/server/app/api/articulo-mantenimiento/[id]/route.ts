/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import { toZonedTime } from "date-fns-tz";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message, payload } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });
    }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const body = await req.json();
    const {
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
      files,
    } = body ?? {};

    const existing = await prisma.c_articulo_mantenimiento.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ status: false, message: "Registro de mantenimiento no encontrado" }, { status: 200 });

    const updateData: any = {};

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

    await prisma.c_articulo_mantenimiento.update({ where: { id }, data: updateData });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_articulo_mantenimiento",
          registro_id: id,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    // Archivos adjuntos
    if (files) {
      let filesParsed: Array<{ type: string; extension: string; original_name?: string; file_base64: string }> = [];
      try {
        filesParsed = typeof files === "string" ? JSON.parse(files) : files;
      } catch (err) {
        console.error("Error parsing files JSON:", err);
        return NextResponse.json({ status: false, message: "Formato de archivos inválido" }, { status: 200 });
      }

      if (Array.isArray(filesParsed) && filesParsed.length > 0) {
        const dir = path.join(process.cwd(), "public", "uploads", "articulo-mantenimiento", `${id}`);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        for (const file of filesParsed) {
          if (!file.file_base64 || !file.extension || !file.type) continue;
          let buffer: Buffer;
          try {
            buffer = Buffer.from(file.file_base64, "base64");
          } catch {
            console.warn("Formato de archivo inválido, se omite uno de los archivos");
            continue;
          }
          const fileName = `${uuidv4()}.${file.extension}`;
          const filePath = path.join(dir, fileName);
          fs.writeFileSync(filePath, buffer);

          const originalName =
            typeof file.original_name === "string" && file.original_name.trim().length > 0 ? file.original_name.trim() : fileName;

          // Si es una imagen "especial" (ej: arma_foto_antes / arma_foto_despues), reemplazar la existente
          // para no acumular múltiples archivos con el mismo original_name.
          if (file.type === "image" && (originalName.startsWith("arma_foto_antes") || originalName.startsWith("arma_foto_despues"))) {
            try {
              const existingFiles = await prisma.c_archivos_adjuntos_articulo_mantenimiento.findMany({
                where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" },
              });
              for (const ef of existingFiles) {
                try {
                  const oldPath = path.join(dir, ef.name);
                  if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                } catch (e) {
                  console.warn("No se pudo eliminar archivo anterior:", e);
                }
              }
              if (existingFiles.length > 0) {
                await prisma.c_archivos_adjuntos_articulo_mantenimiento.deleteMany({
                  where: { activo_mantenimiento_id: id, original_name: originalName, type: "image" },
                });
              }
            } catch (e) {
              console.warn("No se pudo limpiar imagen previa:", e);
            }
          }

          await prisma.c_archivos_adjuntos_articulo_mantenimiento.create({
            data: {
              name: fileName,
              original_name: originalName,
              type: file.type,
              extension: file.extension,
              activo_mantenimiento_id: id,
            },
          });
        }
      }
    }

    return NextResponse.json({ status: true, message: "Mantenimiento actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/articulo-mantenimiento/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


