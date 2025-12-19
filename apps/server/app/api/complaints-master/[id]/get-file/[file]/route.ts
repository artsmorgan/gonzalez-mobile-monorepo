import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; file: string }> }
) {
  try {
    const { id, file } = await context.params;
    const complaintId = parseInt(id, 10);
    if (!complaintId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${complaintId}`);
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${file}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/complaints-master/[id]/get-file/[file]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


