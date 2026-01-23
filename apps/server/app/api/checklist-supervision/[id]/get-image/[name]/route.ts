import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await context.params;
    const checklistId = parseInt(String(id), 10);
    if (!checklistId) {
      return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });
    }

    const dir = path.join(process.cwd(), "public", "uploads", "checklist-supervision", `${checklistId}`);
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/*",
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/checklist-supervision/[id]/get-image/[name]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}

