import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";

export const runtime = "nodejs";

function isValidUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { valid, expired, message } = await verifyAccessTokenByApi(req);
    if (!valid) {
      return NextResponse.json(
        { status: false, expired, message },
        { status: expired ? 401 : 403 }
      );
    }

    const { id } = await context.params;
    const versionId = String(id || "").trim();
    if (!isValidUuid(versionId)) {
      return NextResponse.json(
        { status: false, message: "UUID inválido" },
        { status: 400 }
      );
    }

    const folderPath = path.join(process.cwd(), "mobile-apks", versionId);
    let files: string[] = [];
    try {
      files = await fs.readdir(folderPath);
    } catch {
      return NextResponse.json(
        { status: false, message: "No existe un APK para esta versión" },
        { status: 404 }
      );
    }

    const apkFileName = files.find((f) => f.toLowerCase().endsWith(".apk"));
    if (!apkFileName) {
      return NextResponse.json(
        { status: false, message: "Archivo APK no encontrado" },
        { status: 404 }
      );
    }

    const apkFullPath = path.join(folderPath, apkFileName);
    const fileBuffer = await fs.readFile(apkFullPath);
    const body = new Uint8Array(fileBuffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${apkFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ status: false, message: errorMessage }, { status: 500 });
  }
}
