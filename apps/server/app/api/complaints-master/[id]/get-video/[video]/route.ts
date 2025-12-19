import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; video: string }> }
) {
  try {
    const { id, video } = await context.params;
    const complaintId = parseInt(id, 10);
    if (!complaintId) return NextResponse.json({ status: false, message: "ID no especificado" }, { status: 200 });

    const dir = path.join(process.cwd(), "public", "uploads", "complaints-master", `${complaintId}`);
    const filePath = path.join(dir, video);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ status: false, message: "Archivo no encontrado" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "video/*",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in GET /api/complaints-master/[id]/get-video/[video]:", errorMessage);
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}


