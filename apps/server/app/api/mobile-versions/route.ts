import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenByApi } from "../../../utils/verifyAccessTokenByApi";
import mobile_versions from "../../../mobile_versions.json";

export async function GET(request: NextRequest) {
    try {
        const { valid, expired, payload, message } = await verifyAccessTokenByApi(request);
        if (!valid) { return NextResponse.json({ status: false, expired: expired, message: message }, { status: expired ? 401 : 403 }); }

        const lastVersion = process.env.APP_LAST_VERSION?.trim();
        const versions = Array.isArray(mobile_versions) ? mobile_versions : [];
        // `APP_LAST_VERSION` identifica cuál entrada de `mobile_versions.json` es la última publicada;
        // si no está configurada o no calza con ninguna, se usa la última entrada del arreglo.
        const matched = lastVersion ? versions.find((v: any) => v?.version === lastVersion) : undefined;
        const latest = matched ?? versions[versions.length - 1] ?? null;

        return NextResponse.json(latest, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}