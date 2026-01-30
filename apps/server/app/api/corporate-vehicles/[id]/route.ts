import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../utils/verifyToken";
import { prisma } from "../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

    const updated = await prisma.c_vehiculos_corporativos.update({
      where: { id: vehiculoId },
      data: {
        empresa_id: empresa_id !== undefined ? Number(empresa_id) : existing.empresa_id,
        cliente_id: cliente_id !== undefined ? Number(cliente_id) : existing.cliente_id,
        sucursal_id: corpo_id !== undefined ? Number(corpo_id) : existing.sucursal_id,
        placa: placa !== undefined ? String(placa ?? "") : existing.placa,
        tipo: tipo !== undefined ? String(tipo ?? "") : existing.tipo,
        estado: estado !== undefined ? String(estado ?? "") : (existing as any).estado,
        kilometraje: kilometraje !== undefined ? Number(kilometraje ?? 0) : existing.kilometraje,
        prox_cambio_aceite: prox_cambio_aceite !== undefined ? Number(prox_cambio_aceite ?? 0) : existing.prox_cambio_aceite,
        modelo: modelo !== undefined ? String(modelo ?? "") : existing.modelo,
        anno: anno !== undefined ? Number(anno ?? 0) : existing.anno,
        descripcion: descripcion !== undefined ? String(descripcion ?? "") : existing.descripcion,
        titulo_propiedad: titulo_propiedad !== undefined ? Boolean(titulo_propiedad) : existing.titulo_propiedad,
        rtv: rtv !== undefined ? Boolean(rtv) : existing.rtv,
        marchamo: marchamo !== undefined ? Boolean(marchamo) : existing.marchamo,
        firma_responsable: firma_responsable !== undefined ? String(firma_responsable ?? "") : existing.firma_responsable,
      },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

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


