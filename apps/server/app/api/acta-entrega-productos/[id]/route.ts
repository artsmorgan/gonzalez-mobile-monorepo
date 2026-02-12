import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../utils/verifyToken';
import { prisma } from '../../../../utils/prismaClient';
import { toZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

type ActaImageInput = {
  file_base64: string;
  extension?: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return fallback;
      return JSON.parse(trimmed) as T;
    }
    if (value === null || value === undefined) return fallback;
    return value as T;
  } catch {
    return fallback;
  }
}

function normalizeBase64(b64: string): string {
  if (!b64) return '';
  const idx = b64.indexOf('base64,');
  if (idx !== -1) return b64.slice(idx + 'base64,'.length);
  return b64;
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const {
      tipo_entrega,
      empresa_id,
      cliente_id,
      division_id,
      contrato_id,
      corpo_id,
      mensual,
      detalle,
      observaciones,
      nombre_entrega,
      cedula_entrega,
      fecha_entrega,
      firma_entrega,
      nombre_recibe,
      cedula_recibe,
      fecha_recibe,
      firma_recibe,
      firma_responsable,
      imagenes,
    } = await req.json();

    const existing = await prisma.c_acta_entre_producto.findUnique({ where: { id: actaId } });
    if (!existing) return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });

    const updateData: any = {
      empresa_id: empresa_id !== undefined ? Number(empresa_id) : undefined,
      cliente_id: cliente_id !== undefined ? Number(cliente_id) : undefined,
      division_id: division_id !== undefined ? Number(division_id) : undefined,
      contrato_id: contrato_id !== undefined ? Number(contrato_id) : undefined,
      corpo_id: corpo_id !== undefined ? Number(corpo_id) : undefined,
      tipo_entrega: tipo_entrega !== undefined ? String(tipo_entrega ?? '') : undefined,
      mensual: mensual !== undefined ? String(mensual ?? '') : undefined,
      detalle: detalle !== undefined ? String(detalle ?? '') : undefined,
      observaciones: observaciones !== undefined ? String(observaciones ?? '') : undefined,
      nombre_entrega: nombre_entrega !== undefined ? String(nombre_entrega ?? '') : undefined,
      cedula_entrega: cedula_entrega !== undefined ? String(cedula_entrega ?? '') : undefined,
      fecha_entrega: fecha_entrega !== undefined ? new Date(String(fecha_entrega)) : undefined,
      firma_entrega: firma_entrega !== undefined ? String(firma_entrega ?? '') : undefined,
      nombre_recibe: nombre_recibe !== undefined ? String(nombre_recibe ?? '') : undefined,
      cedula_recibe: cedula_recibe !== undefined ? String(cedula_recibe ?? '') : undefined,
      fecha_recibe: fecha_recibe !== undefined ? new Date(String(fecha_recibe)) : undefined,
      firma_recibe: firma_recibe !== undefined ? String(firma_recibe ?? '') : undefined,
      firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? '') : undefined,
    };

    // Eliminar campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

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
      if (k.startsWith("firma_")) continue; // Excluir firmas

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

    const updated = await prisma.c_acta_entre_producto.update({
      where: { id: actaId },
      data: updateData,
      include: { c_imagenes_acta_entrega_producto: true },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_acta_entre_producto",
          registro_id: actaId,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    // Reemplazo de imágenes (si viene `imagenes`)
    let imagesParsed: ActaImageInput[] = [];
    if (imagenes !== undefined) imagesParsed = safeParseJson<ActaImageInput[]>(imagenes, []);

    if (imagenes !== undefined) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'acta-entrega-productos', `${updated.id}`);

      await prisma.c_imagenes_acta_entrega_producto.deleteMany({ where: { acta_id: updated.id } });
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }

      if (imagesParsed.length > 0) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        for (const img of imagesParsed) {
          if (!img?.file_base64) continue;
          let buffer: Buffer;
          try {
            buffer = Buffer.from(normalizeBase64(String(img.file_base64)), 'base64');
          } catch {
            continue;
          }
          const ext = String(img.extension || 'jpg').replace('.', '').trim() || 'jpg';
          const fileName = `${uuidv4()}.${ext}`;
          fs.writeFileSync(path.join(dir, fileName), buffer);
          await prisma.c_imagenes_acta_entrega_producto.create({
            data: { name: fileName, acta_id: updated.id },
          });
        }
      }
    }

    const fullRecord = await prisma.c_acta_entre_producto.findUnique({
      where: { id: updated.id },
      include: { c_imagenes_acta_entrega_producto: true },
    });

    return NextResponse.json(
      {
        status: true,
        message: 'Acta actualizada correctamente',
        data: {
          ...(fullRecord ?? updated),
          id_local: '',
          images: ((fullRecord as any)?.c_imagenes_acta_entrega_producto || []).map((f: any) => ({
            id: f.id,
            name: f.name,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const existing = await prisma.c_acta_entre_producto.findUnique({ where: { id: actaId } });
    if (!existing) return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });

    // Registrar cambio de eliminación antes de eliminar
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_acta_entre_producto",
        registro_id: actaId,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            empresa_id: existing.empresa_id,
            cliente_id: existing.cliente_id,
            division_id: existing.division_id,
            contrato_id: existing.contrato_id,
            corpo_id: existing.corpo_id,
            fecha: existing.fecha.toISOString(),
            tipo_entrega: existing.tipo_entrega,
            mensual: existing.mensual,
            detalle: existing.detalle,
            observaciones: existing.observaciones,
            nombre_entrega: existing.nombre_entrega,
            cedula_entrega: existing.cedula_entrega,
            fecha_entrega: existing.fecha_entrega.toISOString(),
            nombre_recibe: existing.nombre_recibe,
            cedula_recibe: existing.cedula_recibe,
            fecha_recibe: existing.fecha_recibe.toISOString(),
          },
          after: null,
        }]),
        created_at: createdAt,
        created_by: createdBy,
      },
    });

    await prisma.c_acta_entre_producto.delete({ where: { id: actaId } });

    const dir = path.join(process.cwd(), 'public', 'uploads', 'acta-entrega-productos', `${actaId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: 'Acta eliminada correctamente' }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


