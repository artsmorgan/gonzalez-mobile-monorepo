import { NextRequest, NextResponse } from "next/server";
import mobile_versions_prod from "../../../mobile_versions_prod.json";
import mobile_versions_test from "../../../mobile_versions_test.json";

/**
 * Catálogo de versiones según el entorno (`APP_MODE`): "production" → `mobile_versions_prod.json`; "testing" → `mobile_versions_test.json`.
 * Cualquier otro valor (desarrollo local, sin definir) usa el de pruebas para no publicar versiones de producción por error.
 */
function loadMobileVersions(): unknown[] {
    const mode = String(process.env.APP_MODE ?? "").trim().toLowerCase();
    const catalog = mode === "production" ? mobile_versions_prod : mobile_versions_test;
    return Array.isArray(catalog) ? catalog : [];
}

/**
 * Pública (sin token): la consulta de la última versión se hace también desde el inicio de sesión, antes de tener sesión, y debe seguir funcionando
 * para una app desactualizada aunque el servidor exija una versión (ver `middleware.ts`). Solo devuelve el catálogo de versiones, que no es sensible.
 */
export async function GET(_request: NextRequest) {
    try {
        const lastVersion = process.env.APP_LAST_VERSION?.trim();
        const versions = loadMobileVersions();
        // `APP_LAST_VERSION` identifica cuál entrada del catálogo del entorno es la última publicada;
        // si no está configurada o no calza con ninguna, se usa la última entrada del arreglo.
        const matched = lastVersion ? versions.find((v: any) => v?.version === lastVersion) : undefined;
        const latest = matched ?? versions[versions.length - 1] ?? null;

        return NextResponse.json(latest, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
