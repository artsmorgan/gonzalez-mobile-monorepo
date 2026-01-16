import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../utils/verifyToken";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

type VehicleImageInput = {
  extension: string; // jpg|png|...
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

export async function POST(req: NextRequest) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) {
      return NextResponse.json({ status: false, message }, { status: 401 });
    }

    const {
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
    } = await req.json();

    const clienteId = Number(cliente_id);
    const sucursalId = Number(corpo_id);
    if (!clienteId || !sucursalId) {
      return NextResponse.json(
        { status: false, message: "Cliente y Sucursal son requeridos" },
        { status: 400 }
      );
    }

    if (!firma_responsable || String(firma_responsable).trim().length === 0) {
      return NextResponse.json(
        { status: false, message: "La firma del responsable es requerida" },
        { status: 400 }
      );
    }

    const createdAt = toZonedTime(new Date(), "America/Costa_Rica");
    const createdBy = payload.id !== undefined && payload.id !== null ? Number(payload.id) : 0;

    const newRecord = await prisma.c_vehiculos_corporativos.create({
      data: {
        cliente_id: clienteId,
        sucursal_id: sucursalId,
        placa: String(placa ?? ""),
        tipo: String(tipo ?? ""),
        estado: String(estado ?? "Activo"),
        kilometraje: Number(kilometraje ?? 0),
        prox_cambio_aceite: Number(prox_cambio_aceite ?? 0),
        modelo: String(modelo ?? ""),
        anno: Number(anno ?? 0),
        descripcion: String(descripcion ?? ""),
        titulo_propiedad: Boolean(titulo_propiedad ?? true),
        rtv: Boolean(rtv ?? true),
        marchamo: Boolean(marchamo ?? true),
        firma_responsable: String(firma_responsable ?? ""),
        created_by: createdBy,
        created_at: createdAt,
      },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    // Imágenes anexas
    let imagesParsed: VehicleImageInput[] = [];
    if (imagenes !== undefined) {
      imagesParsed = safeParseJson<VehicleImageInput[]>(imagenes, []);
    }

    if (imagesParsed.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${newRecord.id}`);
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
          data: {
            name: fileName,
            vehiculo_id: newRecord.id,
          },
        });
      }
    }

    const fullRecord = await prisma.c_vehiculos_corporativos.findUnique({
      where: { id: newRecord.id },
      include: { c_imagenes_vehiculos_corporativos: true },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Vehículo corporativo creado correctamente",
        data: {
          ...(fullRecord ?? newRecord),
          id_local: "",
          images: ((fullRecord as any)?.c_imagenes_vehiculos_corporativos || []).map((i: any) => ({
            id: i.id,
            name: i.name,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/corporate-vehicles:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}


