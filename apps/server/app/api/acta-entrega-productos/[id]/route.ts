import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../utils/verifyToken';
import { prisma } from '../../../../utils/prismaClient';
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
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const {
      tipo_entrega,
      cliente,
      mensual,
      division,
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

    const updated = await prisma.c_acta_entre_producto.update({
      where: { id: actaId },
      data: {
        tipo_entrega: tipo_entrega !== undefined ? String(tipo_entrega ?? '') : existing.tipo_entrega,
        cliente: cliente !== undefined ? String(cliente ?? '') : existing.cliente,
        mensual: mensual !== undefined ? String(mensual ?? '') : existing.mensual,
        division: division !== undefined ? String(division ?? '') : existing.division,
        detalle: detalle !== undefined ? String(detalle ?? '') : existing.detalle,
        observaciones: observaciones !== undefined ? String(observaciones ?? '') : existing.observaciones,
        nombre_entrega: nombre_entrega !== undefined ? String(nombre_entrega ?? '') : existing.nombre_entrega,
        cedula_entrega: cedula_entrega !== undefined ? String(cedula_entrega ?? '') : existing.cedula_entrega,
        fecha_entrega: fecha_entrega !== undefined ? new Date(String(fecha_entrega)) : existing.fecha_entrega,
        firma_entrega: firma_entrega !== undefined ? String(firma_entrega ?? '') : existing.firma_entrega,
        nombre_recibe: nombre_recibe !== undefined ? String(nombre_recibe ?? '') : existing.nombre_recibe,
        cedula_recibe: cedula_recibe !== undefined ? String(cedula_recibe ?? '') : existing.cedula_recibe,
        fecha_recibe: fecha_recibe !== undefined ? new Date(String(fecha_recibe)) : existing.fecha_recibe,
        firma_recibe: firma_recibe !== undefined ? String(firma_recibe ?? '') : existing.firma_recibe,
        firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? '') : existing.firma_responsable,
      },
      include: { c_imagenes_acta_entrega_producto: true },
    });

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
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const resolvedParams = await context.params;
    const actaId = parseInt(resolvedParams.id, 10);
    if (!actaId) return NextResponse.json({ status: false, message: 'ID no especificado' }, { status: 400 });

    const existing = await prisma.c_acta_entre_producto.findUnique({ where: { id: actaId } });
    if (!existing) return NextResponse.json({ status: false, message: 'Registro no encontrado' }, { status: 404 });

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


