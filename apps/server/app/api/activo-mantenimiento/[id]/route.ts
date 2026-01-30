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
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const resolvedParams = await context.params;
    const id = parseInt(resolvedParams.id);
    if (!id) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const body = await req.json();
    const {
      fecha_solucion,
      accion,
      fecha_inicio,
      tipo,
      marca,
      modelo,
      serie_placa,
      categoria,
      kilometraje,
      fecha_salida,
      fecha_entrada,
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
      marcar_como_resuelto,
      files,
    } = body ?? {};

    const existing = await prisma.c_activo_mantenimiento.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Activo no encontrado" }, { status: 200 });
    }

    const updateData: any = {};

    // Si marcar_como_resuelto es true, establecer fecha_solucion al momento actual
    if (marcar_como_resuelto === true) {
      updateData.fecha_solucion = toZonedTime(new Date(), "America/Costa_Rica");
    }

    if (accion !== undefined) updateData.accion = accion || null;
    if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio ? new Date(fecha_inicio) : null;
    if (tipo !== undefined) updateData.tipo = tipo || null;
    if (marca !== undefined) updateData.marca = marca || null;
    if (modelo !== undefined) updateData.modelo = modelo || null;
    if (serie_placa !== undefined) updateData.serie_placa = serie_placa || null;
    if (categoria !== undefined) updateData.categoria = categoria || null;
    if (kilometraje !== undefined) updateData.kilometraje = kilometraje !== null && kilometraje !== undefined ? parseInt(String(kilometraje)) : null;
    if (fecha_salida !== undefined) updateData.fecha_salida = fecha_salida ? new Date(fecha_salida) : null;
    if (fecha_entrada !== undefined) updateData.fecha_entrada = fecha_entrada ? new Date(fecha_entrada) : null;
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

    await prisma.c_activo_mantenimiento.update({
      where: { id },
      data: updateData,
    });

    // Procesar archivos si se proporcionan
    if (files) {
      let filesParsed: Array<{
        type: string;
        extension: string;
        original_name?: string;
        file_base64: string;
      }> = [];

      try {
        filesParsed = typeof files === 'string' ? JSON.parse(files) : files;
      } catch (err) {
        console.error("Error parsing files JSON:", err);
        return NextResponse.json(
          {
            status: false,
            message: "Formato de archivos inválido"
          },
          { status: 200 }
        );
      }

      if (filesParsed.length > 0) {
        const dir = path.join(
          process.cwd(),
          "public",
          "uploads",
          "activo-mantenimiento",
          `${id}`
        );
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        for (const file of filesParsed) {
          if (!file.file_base64 || !file.extension || !file.type) {
            continue;
          }

          // Decodificar base64 directamente y capturar errores
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
            (typeof file.original_name === "string" && file.original_name.trim().length > 0)
              ? file.original_name.trim()
              : fileName;

          await prisma.c_archivos_adjuntos_archivo_mantenimiento.create({
            data: {
              name: fileName,
              original_name: originalName,
              type: file.type,
              extension: file.extension,
              activo_mantenimiento_id: id
            }
          });
        }
      }
    }

    return NextResponse.json({ status: true, message: "Activo actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/activo-mantenimiento/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

