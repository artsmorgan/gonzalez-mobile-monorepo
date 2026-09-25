import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../../utils/verifyAccessTokenByApi";
import mobile_versions from "../../../../mobile_versions.json";

export const runtime = "nodejs";

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

    // 🔧 Aquí debes mapear UUID → tag
    const mobileVersion = mobile_versions.find((version: any) => version.id === id);
    const releaseTag = `v${mobileVersion?.version || '0.0.0'}`; // <-- lo tienes que implementar

    // 🔥 Llamada a la API de GitHub
    const response = await fetch(
      `https://api.github.com/repos/artsmorgan/gonzalez-mobile-monorepo/releases/tags/${releaseTag}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { status: false, message: "Release no encontrado en GitHub" },
        { status: 404 }
      );
    }

    const data = await response.json();

    // 🔍 Buscar el APK
    const asset = data.assets.find((a: any) =>
      a.name.toLowerCase().endsWith(".apk")
    );

    if (!asset) {
      return NextResponse.json(
        { status: false, message: "APK no encontrado en release" },
        { status: 404 }
      );
    }

    // 🚀 URL directa (rápida)
    const directUrl = asset.browser_download_url;

    return NextResponse.redirect(directUrl);

  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Error obteniendo APK" },
      { status: 500 }
    );
  }
}