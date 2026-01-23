import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../../utils/verifyToken";
import { prisma } from "../../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

type ContributionFileInput = {
  type: string;
  extension: string;
  original_name?: string;
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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; contributionId: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, contributionId } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    if (!incidentId || !aporteId) {
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 200 });
    }

    const empleadoId = parseInt(String((payload as any)?.id ?? (payload as any)?.empleado_id ?? "0"), 10);
    if (!empleadoId) return NextResponse.json({ status: false, message: "Empleado no identificado" }, { status: 200 });

    const aporte = await prisma.c_contribucion_incidente.findFirst({
      where: { id: aporteId, incidente_id: incidentId },
    });
    if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 200 });

    const body = await req.json();
    const { aporte: aporteText, archivos } = body ?? {};

    if (typeof aporteText === "string") {
      await prisma.c_contribucion_incidente.update({
        where: { id: aporteId },
        data: {
          aporte: aporteText,
        },
      });
    }

    let filesParsed: ContributionFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<ContributionFileInput[]>(archivos, []);
    }

    if (filesParsed.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, "aportes", `${aporteId}`);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      for (const f of filesParsed) {
        if (!f?.file_base64 || !f?.extension || !f?.type) continue;
        let buffer: Buffer;
        try {
          buffer = Buffer.from(normalizeBase64(String(f.file_base64)), "base64");
        } catch {
          continue;
        }

        const ext = String(f.extension).replace(".", "").trim() || "dat";
        const fileName = `${uuidv4()}.${ext}`;
        fs.writeFileSync(path.join(dir, fileName), buffer);

        const originalName =
          (typeof f.original_name === "string" && f.original_name.trim().length > 0)
            ? f.original_name.trim()
            : fileName;

        await prisma.c_archivos_aporte_incidente.create({
          data: {
            name: fileName,
            original_name: originalName,
            type: String(f.type),
            extension: ext,
            contribucion_id: aporteId,
          },
        });
      }
    }

    return NextResponse.json({ status: true, message: "Aporte actualizado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in PUT /api/incidents/[id]/contributions/[contributionId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; contributionId: string }> }) {
  try {
    const { valid, expired, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 });

    const { id, contributionId } = await context.params;
    const incidentId = parseInt(id, 10);
    const aporteId = parseInt(contributionId, 10);
    if (!incidentId || !aporteId) {
      return NextResponse.json({ status: false, message: "IDs no especificados" }, { status: 200 });
    }

    const aporte = await prisma.c_contribucion_incidente.findFirst({
      where: { id: aporteId, incidente_id: incidentId },
      include: { c_archivos_aporte_incidente: true },
    });
    if (!aporte) return NextResponse.json({ status: false, message: "Aporte no encontrado" }, { status: 200 });

    await prisma.c_contribucion_incidente.delete({ where: { id: aporteId } });

    const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, "aportes", `${aporteId}`);
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({ status: true, message: "Aporte eliminado correctamente" }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in DELETE /api/incidents/[id]/contributions/[contributionId]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


