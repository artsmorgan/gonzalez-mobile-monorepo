import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

function normalizeBase64(b64: string): string {
  if (!b64) return "";
  const idx = b64.indexOf("base64,");
  if (idx !== -1) return b64.slice(idx + "base64,".length);
  return b64;
}

function processMaintenanceImage(base64Data: string, vehiculoId: number, prefix: string): string {
  if (!base64Data || base64Data.trim().length === 0) return "";

  try {
    const normalized = normalizeBase64(base64Data);
    if (!normalized) return "";

    const buffer = Buffer.from(normalized, "base64");
    const dir = path.join(process.cwd(), "public", "uploads", "corporate-vehicles", `${vehiculoId}`, "maintenances");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = `${prefix}_${uuidv4()}.jpg`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);

    return fileName;
  } catch (error) {
    console.error(`Error processing ${prefix} image:`, error);
    return "";
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ maintenance_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { maintenance_id } = await context.params;
    const maintenanceId = parseInt(String(maintenance_id), 10);
    if (!maintenanceId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_mantenimiento_vehiculos_corporativos.findUnique({
      where: { id: maintenanceId }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const {
      fecha,
      imagen_antes,
      tipo,
      mantenimiento,
      diagnostico,
      kilometraje_siguiente_revision,
      imagen_despues,
      nombre_mecanico,
      firma_mecanico,
      firma_responsable,
    } = body || {};

    // Procesar imágenes si se proporcionan
    let imagenAntesFileName = existing.imagen_antes;
    let imagenDespuesFileName = existing.imagen_despues;

    if (imagen_antes !== undefined && imagen_antes) {
      const processed = processMaintenanceImage(imagen_antes, existing.vehiculo_id, "antes");
      if (processed) {
        imagenAntesFileName = processed;
      } else {
        imagenAntesFileName = String(imagen_antes);
      }
    }

    if (imagen_despues !== undefined && imagen_despues) {
      const processed = processMaintenanceImage(imagen_despues, existing.vehiculo_id, "despues");
      if (processed) {
        imagenDespuesFileName = processed;
      } else {
        imagenDespuesFileName = String(imagen_despues);
      }
    }

    const updated = await prisma.c_mantenimiento_vehiculos_corporativos.update({
      where: { id: maintenanceId },
      data: {
        fecha: fecha !== undefined ? (fecha ? new Date(fecha) : new Date()) : existing.fecha,
        imagen_antes: imagen_antes !== undefined ? imagenAntesFileName : existing.imagen_antes,
        tipo: tipo !== undefined ? String(tipo ?? "") : existing.tipo,
        mantenimiento: mantenimiento !== undefined ? String(mantenimiento ?? "") : existing.mantenimiento,
        diagnostico: diagnostico !== undefined ? String(diagnostico ?? "") : existing.diagnostico,
        kilometraje_siguiente_revision:
          kilometraje_siguiente_revision !== undefined
            ? Number(kilometraje_siguiente_revision ?? 0)
            : existing.kilometraje_siguiente_revision,
        imagen_despues: imagen_despues !== undefined ? imagenDespuesFileName : existing.imagen_despues,
        nombre_mecanico: nombre_mecanico !== undefined ? String(nombre_mecanico ?? "") : existing.nombre_mecanico,
        firma_mecanico: firma_mecanico !== undefined ? String(firma_mecanico ?? "") : existing.firma_mecanico,
        firma_responsable:
          firma_responsable !== undefined ? String(firma_responsable ?? "") : existing.firma_responsable,
      },
    });

    return NextResponse.json({ status: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/corporate-vehicles/maintenances/[maintenance_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ maintenance_id: string }> }
) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

    const { maintenance_id } = await context.params;
    const maintenanceId = parseInt(String(maintenance_id), 10);
    if (!maintenanceId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 400 });
    }

    const existing = await prisma.c_mantenimiento_vehiculos_corporativos.findUnique({
      where: { id: maintenanceId }
    });
    if (!existing) {
      return NextResponse.json({ status: false, message: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.c_mantenimiento_vehiculos_corporativos.delete({ where: { id: maintenanceId } });

    return NextResponse.json({ status: true, message: "Mantenimiento eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/corporate-vehicles/maintenances/[maintenance_id]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 400 });
  }
}

