import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../../../utils/verifyToken";
import { prisma } from "../../../../../utils/prismaClient";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { findContributionIncidents } from "../../../../../utils/findContributionIncidents";

export const runtime = "nodejs";

type ContributionFileInput = {
  type: string; // image | audio | video | document
  extension: string;
  original_name?: string;
  file_base64: string; // base64 puro (sin data:)
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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const { id } = await context.params;
    const incidentId = parseInt(id, 10);
    if (!incidentId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const incident = await prisma.c_incidente.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });

    const mapped = await findContributionIncidents(incidentId);

    return NextResponse.json({ status: true, contributions: mapped }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/incidents/[id]/contributions:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, payload, message } = verifyAccessToken(req);
    if (!valid) return NextResponse.json({ status: false, message }, { status: 401 });

    const { id } = await context.params;
    const incidentId = parseInt(id, 10);
    if (!incidentId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const incident = await prisma.c_incidente.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ status: false, message: "Incidente no encontrado" }, { status: 200 });

    const body = await req.json();
    const { aporte, rol_aporte, archivos } = body ?? {};

    const empleadoId = parseInt(String((payload as any)?.id ?? (payload as any)?.empleado_id ?? "0"), 10);
    if (!empleadoId) return NextResponse.json({ status: false, message: "Empleado no identificado" }, { status: 200 });

    if (!aporte || String(aporte).trim().length === 0) {
      return NextResponse.json({ status: false, message: "Aporte requerido" }, { status: 200 });
    }

    const roleStr = (typeof rol_aporte === "string" ? rol_aporte : "").trim();
    if (roleStr.length === 0) {
      return NextResponse.json({ status: false, message: "Rol de aporte requerido" }, { status: 200 });
    }

    let filesParsed: ContributionFileInput[] = [];
    if (archivos) {
      filesParsed = safeParseJson<ContributionFileInput[]>(archivos, []);
    }

    const created = await prisma.c_contribucion_incidente.create({
      data: {
        incidente_id: incidentId,
        empleado_id: empleadoId,
        aporte: String(aporte),
        rol_aporte: roleStr,
        created_at: new Date(),
      },
    });

    if (filesParsed.length > 0) {
      const dir = path.join(process.cwd(), "public", "uploads", "incidents", `${incidentId}`, "aportes", `${created.id}`);
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
            contribucion_id: created.id,
          },
        });
      }
    }

    return NextResponse.json({ status: true, message: "Aporte creado con éxito", contributionId: created.id }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in POST /api/incidents/[id]/contributions:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


