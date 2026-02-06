import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { toZonedTime } from "date-fns-tz";

export const runtime = "nodejs";

type VehicleImageInput = {
  extension: string;
  file_base64: string;
};

function safeParseJson<T>(value: any, fallback: T): T {
  try {
    if (typeof value === "string") {
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
  if (!b64) return "";
  const idx = b64.indexOf("base64,");
  if (idx !== -1) return b64.slice(idx + "base64,".length);
  return b64;
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const body = await req.json();
    const {
      empresa_id,
      cliente_id,
      corpo_id,
      placa,
      tipo,
      estado,
      kilometraje,
      prox_cambio_aceite,
      modelo,
      anno,
      descripcion,
      titulo_propiedad,
      rtv,
      marchamo,
      firma_responsable,
      imagenes,
    } = body || {};

    const existing = await prisma.c_vehiculos_corporativos.findUnique({
      where: { id: vehiculoId },
      include: { c_imagenes_vehiculos_corporativos: true },
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const updateData: any = {};
    if (empresa_id !== undefined) updateData.empresa_id = Number(empresa_id);
    if (cliente_id !== undefined) updateData.cliente_id = Number(cliente_id);
    if (corpo_id !== undefined) updateData.sucursal_id = Number(corpo_id);
    if (placa !== undefined) updateData.placa = String(placa ?? "");
    if (tipo !== undefined) updateData.tipo = String(tipo ?? "");
    if (estado !== undefined) updateData.estado = String(estado ?? "");
    if (kilometraje !== undefined) updateData.kilometraje = Number(kilometraje ?? 0);
    if (prox_cambio_aceite !== undefined) updateData.prox_cambio_aceite = Number(prox_cambio_aceite ?? 0);
    if (modelo !== undefined) updateData.modelo = String(modelo ?? "");
    if (anno !== undefined) updateData.anno = Number(anno ?? 0);
    if (descripcion !== undefined) updateData.descripcion = String(descripcion ?? "");
    if (titulo_propiedad !== undefined) updateData.titulo_propiedad = Boolean(titulo_propiedad);
    if (rtv !== undefined) updateData.rtv = Boolean(rtv);
    if (marchamo !== undefined) updateData.marchamo = Boolean(marchamo);
    if (firma_responsable !== undefined) updateData.firma_responsable = String(firma_responsable ?? "");

    // Registrar cambios (solo campos actualizados)
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
      // No registramos imágenes: esas vienen en `imagenes` y se guardan aparte.
      if (k === "imagenes") continue;

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

    const updated = await prisma.c_vehiculos_corporativos.update({
      where: { id: vehiculoId },
      data: updateData,
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    if (cambiosArr.length > 0) {
      const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
      await prisma.c_cambios_apps_modules.create({
        data: {
          nombre_tabla: "c_vehiculos_corporativos",
          registro_id: vehiculoId,
          cambios: JSON.stringify(cambiosArr),
          created_at: toZonedTime(new Date(), "America/Costa_Rica"),
          created_by: createdBy,
        },
      });
    }

    // Imágenes: si el cliente manda `imagenes`, hacemos reemplazo total
    if (imagenes !== undefined) {
      const imagesParsed = safeParseJson<VehicleImageInput[]>(imagenes, []);
      const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${updated.id}`);

      await prisma.c_imagenes_vehiculos_corporativos.deleteMany({ where: { vehiculo_id: updated.id } });
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
          if (!img?.file_base64 || !img?.extension) continue;
          let buffer: Buffer;
          try {
            buffer = Buffer.from(normalizeBase64(String(img.file_base64)), "base64");
          } catch {
            continue;
          }

          const ext = String(img.extension).replace(".", "").trim() || "jpg";
          const fileName = `${uuidv4()}.${ext}`;
          fs.writeFileSync(path.join(dir, fileName), buffer);

          await prisma.c_imagenes_vehiculos_corporativos.create({
            data: { name: fileName, vehiculo_id: updated.id },
          });
        }
      }
    }

    const full = await prisma.c_vehiculos_corporativos.findUnique({
      where: { id: updated.id },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Vehículo corporativo actualizado correctamente",
        data: {
          ...(full ?? updated),
          id_local: "",
          corpo_id: (full as any)?.sucursal_id ?? updated.sucursal_id,
          images: ((full as any)?.c_imagenes_vehiculos_corporativos || []).map((i: any) => ({
            id: i.id,
            name: i.name,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { id } = await context.params;
    const vehiculoId = parseInt(String(id), 10);
    if (!vehiculoId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_vehiculos_corporativos.findUnique({ where: { id: vehiculoId } });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.c_vehiculos_corporativos.delete({ where: { id: vehiculoId } });

    // Registrar cambio de eliminación
    const createdBy = payload?.id !== undefined && payload?.id !== null ? Number(payload.id) : 0;
    await prisma.c_cambios_apps_modules.create({
      data: {
        nombre_tabla: "c_vehiculos_corporativos",
        registro_id: vehiculoId,
        cambios: JSON.stringify([{
          prop: "__deleted__",
          before: {
            id: existing.id,
            placa: existing.placa,
            tipo: existing.tipo,
            modelo: existing.modelo,
            anno: existing.anno,
          },
          after: null,
        }]),
        created_at: toZonedTime(new Date(), "America/Costa_Rica"),
        created_by: createdBy,
      },
    });

    const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${vehiculoId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Vehículo corporativo eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/[id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


