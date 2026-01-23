import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../utils/verifyToken';
import { prisma } from '../../../utils/prismaClient';
import { toZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { sendNotificationByRole } from '../../../utils/sendNotification';

export const runtime = 'nodejs';

type ActaImageInput = {
  file_base64: string;
  extension?: string; // jpg | png | etc
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

export async function POST(req: NextRequest) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const {
      marca_id,
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

    if (!marca_id) return NextResponse.json({ status: false, message: 'Marca no especificada' }, { status: 400 });

    const marcaDia = await prisma.c_marca_dia.findUnique({ where: { id: parseInt(String(marca_id), 10) } });
    if (!marcaDia) return NextResponse.json({ status: false, message: 'Marca no encontrada' }, { status: 404 });

    // Validaciones mínimas (campos NOT NULL en prisma)
    const required: Array<[string, any]> = [
      ['tipo_entrega', tipo_entrega],
      ['cliente', cliente],
      ['mensual', mensual],
      ['division', division],
      ['detalle', detalle],
      ['observaciones', observaciones],
      ['nombre_entrega', nombre_entrega],
      ['cedula_entrega', cedula_entrega],
      ['fecha_entrega', fecha_entrega],
      ['firma_entrega', firma_entrega],
      ['nombre_recibe', nombre_recibe],
      ['cedula_recibe', cedula_recibe],
      ['fecha_recibe', fecha_recibe],
      ['firma_recibe', firma_recibe],
      ['firma_responsable', firma_responsable],
    ];
    for (const [k, v] of required) {
      if (v === undefined || v === null || String(v).trim().length === 0) {
        return NextResponse.json({ status: false, message: `El campo ${k} es requerido` }, { status: 400 });
      }
    }

    const createdAt = toZonedTime(new Date(), 'America/Costa_Rica');

    const newRecord = await prisma.c_acta_entre_producto.create({
      data: {
        empresa_id: marcaDia.empresa_id,
        cliente_id: marcaDia.cliente_id,
        contrato_id: marcaDia.contrato_id,
        corpo_id: marcaDia.corpo_id,
        puesto_id: marcaDia.puesto_id,
        plaza_id: marcaDia.plaza_id,
        fecha: createdAt,
        tipo_entrega: String(tipo_entrega),
        cliente: String(cliente),
        mensual: String(mensual),
        division: String(division),
        detalle: String(detalle),
        observaciones: String(observaciones),
        nombre_entrega: String(nombre_entrega),
        cedula_entrega: String(cedula_entrega),
        fecha_entrega: new Date(String(fecha_entrega)),
        firma_entrega: String(firma_entrega),
        nombre_recibe: String(nombre_recibe),
        cedula_recibe: String(cedula_recibe),
        fecha_recibe: new Date(String(fecha_recibe)),
        firma_recibe: String(firma_recibe),
        firma_responsable: String(firma_responsable),
      },
      include: { c_imagenes_acta_entrega_producto: true },
    });

    if (newRecord) {
      let empNombre = "Desconocido";
      let sucursalNombre = "Desconocida";
      let clienteNombre = "Desconocido";
      let fechaRegistro = newRecord.fecha.toISOString().split("T")[0];
      if (payload.id) {
        const empleado = await prisma.c_empleado.findUnique({ where: { id: parseInt(String(payload.id), 10) } });
        if (empleado) {
          empNombre = empleado.nombre + " " + empleado.primer_apellido + " " + empleado.segundo_apellido;
        }
      }
      if (newRecord.corpo_id) {
        const sucursal = await prisma.e_estructura_sucursal.findUnique({ where: { id: newRecord.corpo_id } });
        if (sucursal) {
          sucursalNombre = sucursal.nombre + " (" + sucursal.nro_sucursal + ")";
        }
      }
      if (newRecord.cliente_id) {
        const cliente = await prisma.e_estructura_cliente.findUnique({ where: { id: newRecord.cliente_id } });
        if (cliente) {
          clienteNombre = cliente.nombre;
        }
      }
      const descriptionNotificacion = "El empleado " + empNombre + " ha creado un registro de acta de entrega de productos para el cliente " + clienteNombre + " en la sucursal " + sucursalNombre + " el día " + fechaRegistro;
      sendNotificationByRole(newRecord.corpo_id, [parseInt(String(payload.id), 10)], "Acta de entrega de productos creada", descriptionNotificacion, ["ADMINISTRATIVO", "SUPERVISOR"]);
    }

    // Guardar imágenes (si vienen)
    let imagesParsed: ActaImageInput[] = [];
    if (imagenes) imagesParsed = safeParseJson<ActaImageInput[]>(imagenes, []);

    if (imagesParsed.length > 0) {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'acta-entrega-productos', `${newRecord.id}`);
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
          data: { name: fileName, acta_id: newRecord.id },
        });
      }
    }

    const fullRecord = await prisma.c_acta_entre_producto.findUnique({
      where: { id: newRecord.id },
      include: { c_imagenes_acta_entrega_producto: true },
    });

    return NextResponse.json(
      {
        status: true,
        message: 'Acta creada correctamente',
        data: {
          ...(fullRecord ?? newRecord),
          id_local: '',
          images: ((fullRecord as any)?.c_imagenes_acta_entrega_producto || []).map((f: any) => ({
            id: f.id,
            name: f.name,
          })),
          created_by: payload.id?.toString() || '',
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


